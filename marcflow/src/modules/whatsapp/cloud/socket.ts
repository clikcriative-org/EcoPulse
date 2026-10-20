// CloudSocket: speaks the WhatsApp Cloud API but looks like the subset of Baileys' WASocket that MarcFlow uses.
// Flows, broadcasts, quick replies, auto-reply and the inbox keep calling sock.sendMessage(...) / sock.ev.on(...)
// and never need to know which provider is behind the session.
import { EventEmitter } from "events";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
    CloudApiError, jidToWaId, markCloudRead, sendCloudMessage, uploadCloudMedia, type CloudCreds,
} from "./api";
import { logger } from "@/lib/logger";

type Media = Buffer | { url: string };

const unsupported = (what: string) => () => {
    throw new CloudApiError(`${what} não existe na API oficial do WhatsApp`, 400);
};

const isBuffer = (m: unknown): m is Buffer => Buffer.isBuffer(m);
const cleanMime = (mime: string) => mime.split(";")[0].trim();

const EXT: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "application/pdf": "pdf",
};

export class CloudSocket {
    ev = new EventEmitter();
    user: { id: string; name?: string; lid?: string } | undefined;
    /** last incoming wamid per chat: the Cloud API only shows "typing..." as a reply to one */
    private lastIncoming = new Map<string, string>();

    constructor(private creds: CloudCreds, private sessionId: string, me?: { phone: string; name?: string }) {
        this.ev.setMaxListeners(50);
        if (me) this.user = { id: `${me.phone.replace(/\D/g, "")}@s.whatsapp.net`, name: me.name };
    }

    rememberIncoming(jid: string, wamid: string) {
        this.lastIncoming.set(jid, wamid);
    }

    async sendMessage(jid: string, content: any, options?: any): Promise<any> {
        if (jid.endsWith("@g.us")) throw new CloudApiError("Grupos não são suportados pela API oficial do WhatsApp", 400);
        if (jid.endsWith("@newsletter") || jid === "status@broadcast") throw new CloudApiError("Canais e status não são suportados pela API oficial", 400);

        const to = jidToWaId(jid);
        const quotedId: string | undefined = options?.quoted?.key?.id;
        const context = quotedId ? { context: { message_id: quotedId } } : {};

        // what the inbox stores for this send (same shape Baileys would emit)
        let echo: Record<string, any>;
        let localBuffer: { buf: Buffer; mime: string } | null = null;
        let mediaLink: string | null = null;
        let payload: Record<string, any>;

        const media = async (kind: "image" | "video" | "audio" | "document" | "sticker", m: Media, mime: string, fileName?: string) => {
            if (isBuffer(m)) {
                localBuffer = { buf: m, mime };
                return { id: await uploadCloudMedia(this.creds, m, cleanMime(mime), fileName) };
            }
            mediaLink = m.url;
            return { link: m.url };
        };

        if (content.react) {
            payload = { to, type: "reaction", reaction: { message_id: content.react.key?.id, emoji: content.react.text || "" } };
            await sendCloudMessage(this.creds, payload);
            return undefined; // reactions are not inbox rows
        } else if (typeof content.text === "string") {
            payload = { to, type: "text", text: { body: content.text, preview_url: /https?:\/\//.test(content.text) }, ...context };
            echo = { conversation: content.text };
        } else if (content.image) {
            const mime = content.mimetype || "image/jpeg";
            payload = { to, type: "image", image: { ...(await media("image", content.image, mime)), caption: content.caption }, ...context };
            echo = { imageMessage: { caption: content.caption || "", mimetype: mime } };
        } else if (content.video) {
            const mime = content.mimetype || "video/mp4";
            payload = { to, type: "video", video: { ...(await media("video", content.video, mime)), caption: content.caption }, ...context };
            echo = { videoMessage: { caption: content.caption || "", mimetype: mime } };
        } else if (content.audio) {
            const mime = content.mimetype || (content.ptt ? "audio/ogg; codecs=opus" : "audio/mpeg");
            payload = { to, type: "audio", audio: await media("audio", content.audio, mime), ...context };
            echo = { audioMessage: { mimetype: mime, ptt: !!content.ptt } };
        } else if (content.document) {
            const mime = content.mimetype || "application/octet-stream";
            const fileName = content.fileName || "arquivo";
            payload = { to, type: "document", document: { ...(await media("document", content.document, mime, fileName)), filename: fileName, caption: content.caption }, ...context };
            echo = { documentMessage: { caption: content.caption || "", fileName, mimetype: mime } };
        } else if (content.sticker) {
            payload = { to, type: "sticker", sticker: await media("sticker", content.sticker, "image/webp") };
            echo = { stickerMessage: { mimetype: "image/webp" } };
        } else if (content.location) {
            const l = content.location;
            payload = { to, type: "location", location: { latitude: l.degreesLatitude, longitude: l.degreesLongitude, name: l.name, address: l.address } };
            echo = { locationMessage: l };
        } else if (content.contacts) {
            const cards = (content.contacts.contacts || []).map((c: { vcard: string }) => vcardToCloud(c.vcard, content.contacts.displayName));
            payload = { to, type: "contacts", contacts: cards };
            echo = { contactMessage: { displayName: content.contacts.displayName } };
        } else if (content.poll) {
            // Menu blocks sent "as poll": the Cloud API has native buttons/lists instead.
            // Reply ids are the option numbers, which the flow engine already accepts as an answer.
            const { name, values } = content.poll as { name: string; values: string[] };
            payload = { to, ...interactiveMenu(name, values) };
            echo = { conversation: `${name}\n\n${values.map((v, i) => `${i + 1}. ${v}`).join("\n")}` };
        } else if (content.template) {
            // Business-initiated message outside the 24h window: only approved templates are allowed
            const t = content.template as { name: string; language: string; components?: any[]; preview?: string };
            payload = { to, type: "template", template: { name: t.name, language: { code: t.language }, ...(t.components?.length ? { components: t.components } : {}) } };
            echo = { conversation: t.preview || `[template: ${t.name}]` };
        } else if (content.interactive) {
            payload = { to, type: "interactive", interactive: content.interactive, ...context };
            echo = { conversation: content.interactive?.body?.text || "[mensagem interativa]" };
        } else if (content.delete) {
            throw new CloudApiError("A API oficial não permite apagar mensagens enviadas", 400);
        } else if (content.edit) {
            throw new CloudApiError("A API oficial não permite editar mensagens enviadas", 400);
        } else if (content.forward) {
            throw new CloudApiError("A API oficial não tem encaminhamento; envie o conteúdo de novo", 400);
        } else {
            throw new CloudApiError(`Tipo de mensagem não suportado na API oficial: ${Object.keys(content).join(", ")}`, 400);
        }

        const id = await sendCloudMessage(this.creds, payload);
        const msg: any = {
            key: { remoteJid: jid, fromMe: true, id },
            message: echo!,
            messageTimestamp: Math.floor(Date.now() / 1000),
            status: 1,
        };
        msg._localMediaUrl = localBuffer ? await this.saveLocal(id, localBuffer) : mediaLink;
        // Baileys emits our own sends as "append": the store saves them without firing bots or webhooks again
        this.ev.emit("messages.upsert", { messages: [msg], type: "append" });
        return msg;
    }

    private async saveLocal(id: string, { buf, mime }: { buf: Buffer; mime: string }) {
        try {
            const filename = `${this.sessionId}-${id.replace(/[^\w.-]/g, "_")}.${EXT[cleanMime(mime)] || "bin"}`;
            const filePath = path.join(process.cwd(), "data", "media", filename);
            await mkdir(path.dirname(filePath), { recursive: true });
            await writeFile(filePath, buf);
            return `/api/media/${filename}`;
        } catch (e) {
            logger.error("Cloud", "could not keep a local copy of sent media", e);
            return null;
        }
    }

    async readMessages(keys: { remoteJid?: string | null; id?: string | null; fromMe?: boolean | null }[]) {
        for (const k of keys) {
            if (k.fromMe || !k.id) continue;
            await markCloudRead(this.creds, k.id).catch(e => logger.debug("Cloud", "mark read failed", e));
        }
    }

    async sendPresenceUpdate(type: string, jid?: string) {
        if (type !== "composing" && type !== "recording") return;
        const last = jid ? this.lastIncoming.get(jid) : undefined;
        if (last) await markCloudRead(this.creds, last, true).catch(() => undefined);
    }

    // No equivalents in the Cloud API: harmless no-ops where callers only want a best effort
    async presenceSubscribe() {}
    async profilePictureUrl() { return undefined; }
    async groupFetchAllParticipating() { return {}; }
    async logout() {}
    end() {}

    groupMetadata = unsupported("Grupos");
    groupCreate = unsupported("Criar grupos");
    groupLeave = unsupported("Sair de grupos");
    groupParticipantsUpdate = unsupported("Gerenciar participantes de grupos");
    groupSettingUpdate = unsupported("Configurar grupos");
    groupUpdateSubject = unsupported("Renomear grupos");
    groupUpdateDescription = unsupported("Descrição de grupos");
    groupToggleEphemeral = unsupported("Mensagens temporárias");
    groupInviteCode = unsupported("Link de convite de grupo");
    groupRevokeInvite = unsupported("Link de convite de grupo");
    groupAcceptInvite = unsupported("Entrar em grupos");
    chatModify = unsupported("Arquivar/fixar/silenciar conversas");
    updateBlockStatus = unsupported("Bloquear contatos pelo painel");
    updateProfilePicture = unsupported("Trocar foto do perfil pelo painel (use o WhatsApp Manager)");
    removeProfilePicture = unsupported("Remover foto do perfil pelo painel (use o WhatsApp Manager)");
    updateProfileStatus = unsupported("Recado do perfil pelo painel (use o WhatsApp Manager)");
    updateProfileName = unsupported("Nome do perfil pelo painel (use o WhatsApp Manager)");
    fetchMessageHistory = unsupported("Buscar histórico antigo no celular");
    requestPairingCode = unsupported("Código de pareamento");
    appPatch = unsupported("Sincronizar etiquetas com o WhatsApp");
}

/** Up to 3 short options → reply buttons; up to 10 → list; more than that → numbered text. */
export function interactiveMenu(question: string, values: string[]) {
    const body = { text: question.slice(0, 1024) };
    if (values.length <= 3 && values.every(v => v.length <= 20)) {
        return {
            type: "interactive",
            interactive: {
                type: "button", body,
                action: { buttons: values.map((v, i) => ({ type: "reply", reply: { id: String(i + 1), title: v } })) },
            },
        };
    }
    if (values.length <= 10) {
        return {
            type: "interactive",
            interactive: {
                type: "list", body,
                action: {
                    button: "Ver opções",
                    sections: [{
                        title: "Opções",
                        // list titles are capped at 24 chars: the full text goes in the description
                        rows: values.map((v, i) => ({ id: String(i + 1), title: v.length <= 24 ? v : `${v.slice(0, 23)}…`, ...(v.length > 24 ? { description: v.slice(0, 72) } : {}) })),
                    }],
                },
            },
        };
    }
    return { type: "text", text: { body: `${question}\n\n${values.map((v, i) => `${i + 1}. ${v}`).join("\n")}` } };
}

/** Minimal vCard → Cloud API contact card (name + phones). */
export function vcardToCloud(vcard: string, displayName?: string) {
    const fn = /^FN:(.*)$/m.exec(vcard)?.[1]?.trim() || displayName || "Contato";
    const org = /^ORG:([^;\n]*)/m.exec(vcard)?.[1]?.trim();
    const phones = [...vcard.matchAll(/^TEL([^:]*):(.*)$/gm)].map(m => {
        const waId = /waid=(\d+)/.exec(m[1])?.[1];
        return { phone: m[2].trim(), ...(waId ? { wa_id: waId } : {}), type: "CELL" };
    });
    return {
        name: { formatted_name: fn, first_name: fn.split(" ")[0] },
        ...(org ? { org: { company: org } } : {}),
        phones,
    };
}
