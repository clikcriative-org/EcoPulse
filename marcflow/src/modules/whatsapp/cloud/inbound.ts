// Turns Cloud API webhook payloads into the Baileys-shaped events the message store already handles.
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { downloadCloudMedia, waIdToJid, type CloudCreds } from "./api";
import type { CloudSocket } from "./socket";

// Baileys numbering used by the store: 1 SENT, 2 DELIVERED, 3 READ, 4 PLAYED; -1 is ours for FAILED
const STATUS: Record<string, number> = { sent: 1, delivered: 2, read: 3, played: 4, failed: -1 };

const MEDIA_KEY: Record<string, string> = {
    image: "imageMessage", video: "videoMessage", audio: "audioMessage", document: "documentMessage", sticker: "stickerMessage",
};

/** Entry point for one `changes[].value` object of a "messages" webhook. */
export async function handleCloudChange(value: any) {
    const phoneNumberId: string | undefined = value?.metadata?.phone_number_id;
    if (!phoneNumberId) return;

    const session = await prisma.session.findUnique({ where: { cloudPhoneNumberId: phoneNumberId }, include: { cloudCredential: true } });
    if (!session || session.provider !== "cloud" || !session.cloudCredential) {
        logger.warn("Cloud", `webhook for unknown phone_number_id ${phoneNumberId}`);
        return;
    }
    const { waManager } = await import("../manager");
    const sock = waManager.getInstance(session.sessionId)?.socket as unknown as CloudSocket | null | undefined;
    if (!sock) {
        logger.warn("Cloud", `session ${session.sessionId} is stopped: webhook ignored (start it in the panel)`);
        return;
    }
    const creds: CloudCreds = { phoneNumberId, accessToken: session.cloudCredential.accessToken, wabaId: session.cloudWabaId };

    const names = new Map<string, string>();
    for (const c of value.contacts || []) if (c?.wa_id && c.profile?.name) names.set(c.wa_id, c.profile.name);

    const messages = [];
    for (const m of value.messages || []) {
        try {
            const wa = await toWAMessage(m, names.get(m.from), creds, session.sessionId);
            if (!wa) continue;
            sock.rememberIncoming(wa.key.remoteJid, m.id);
            messages.push(wa);
        } catch (e) {
            logger.error("Cloud", `could not read incoming message ${m?.id}`, e);
        }
    }
    if (messages.length) sock.ev.emit("messages.upsert", { messages, type: "notify" });

    const updates = (value.statuses || []).map((s: any) => {
        if (s.status === "failed") logger.warn("Cloud", `message ${s.id} to ${s.recipient_id} failed: ${s.errors?.[0]?.title || "?"} (${s.errors?.[0]?.code || "?"})`);
        return { key: { id: s.id, remoteJid: waIdToJid(s.recipient_id), fromMe: true }, update: { status: STATUS[s.status] ?? 1 } };
    });
    if (updates.length) sock.ev.emit("messages.update", updates);
}

export async function toWAMessage(m: any, pushName: string | undefined, creds: CloudCreds, sessionId: string) {
    const remoteJid = waIdToJid(m.from);
    let message: Record<string, any>;
    let localMediaUrl: string | null = null;

    switch (m.type) {
        case "text":
            message = { conversation: m.text?.body || "" };
            break;
        case "interactive": {
            // tap on a reply button / list row sent by a Menu block: the id is the option number
            const r = m.interactive?.button_reply || m.interactive?.list_reply;
            message = { conversation: String(r?.id ?? r?.title ?? "") };
            break;
        }
        case "button": // quick-reply button of a template
            message = { conversation: m.button?.text || m.button?.payload || "" };
            break;
        case "reaction":
            message = { reactionMessage: { text: m.reaction?.emoji, key: { id: m.reaction?.message_id } } };
            break;
        case "location":
            message = { locationMessage: { degreesLatitude: m.location?.latitude, degreesLongitude: m.location?.longitude, name: m.location?.name, address: m.location?.address } };
            break;
        case "contacts":
            message = { contactMessage: { displayName: m.contacts?.[0]?.name?.formatted_name || "Contato" } };
            break;
        case "image": case "video": case "audio": case "document": case "sticker": {
            const media = m[m.type] || {};
            const key = MEDIA_KEY[m.type];
            message = { [key]: { caption: media.caption, mimetype: media.mime_type, fileName: media.filename, ptt: m.type === "audio" ? !!media.voice : undefined } };
            if (media.id) localMediaUrl = await saveIncomingMedia(creds, media.id, sessionId, m.id).catch(e => {
                logger.error("Cloud", `media ${media.id} download failed`, e);
                return null;
            });
            break;
        }
        case "unsupported":
        case "system":
        default:
            logger.debug("Cloud", `ignored incoming type ${m.type}`);
            return null;
    }

    // quoted replies: Baileys puts the quoted id in contextInfo.stanzaId
    if (m.context?.id) {
        const k = Object.keys(message)[0];
        if (k === "conversation") message = { extendedTextMessage: { text: message.conversation, contextInfo: { stanzaId: m.context.id } } };
        else message[k] = { ...message[k], contextInfo: { stanzaId: m.context.id } };
    }

    return {
        key: { remoteJid, fromMe: false, id: m.id as string },
        pushName,
        messageTimestamp: Number(m.timestamp) || Math.floor(Date.now() / 1000),
        message,
        _localMediaUrl: localMediaUrl,
    };
}

async function saveIncomingMedia(creds: CloudCreds, mediaId: string, sessionId: string, wamid: string) {
    const { buffer, mime } = await downloadCloudMedia(creds, mediaId);
    const ext = mime.split("/")[1]?.split(";")[0] || "bin";
    const filename = `${sessionId}-${wamid.replace(/[^\w.-]/g, "_")}.${ext}`;
    const filePath = path.join(process.cwd(), "data", "media", filename);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
    return `/api/media/${filename}`;
}
