/* eslint-disable @typescript-eslint/no-explicit-any -- WhatsApp proto messages are loosely typed */
import path from "path";
import { normalizeMessageContent, type WAMessage } from "@whiskeysockets/baileys";

export const ARCHIVE_ROOT = path.join(process.cwd(), "data", "archive");

export type MediaKind = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "STICKER";
export const MEDIA_TYPES: readonly string[] = ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT", "STICKER"];
/** Audio always comes along; the rest only when "Incluir fotos, vídeos e documentos" is on. */
export const wantsMedia = (type: string, includeMedia: boolean) => type === "AUDIO" || (includeMedia && MEDIA_TYPES.includes(type));

export interface Described { type: string; text: string; quotedId: string | null; mime: string | null }

const MEDIA_KEYS: Record<string, { type: MediaKind; caption: "caption" | "fileName" | null }> = {
    imageMessage: { type: "IMAGE", caption: "caption" },
    videoMessage: { type: "VIDEO", caption: "caption" },
    audioMessage: { type: "AUDIO", caption: null },
    documentMessage: { type: "DOCUMENT", caption: "fileName" },
    stickerMessage: { type: "STICKER", caption: null },
};

// Protocol/system envelopes are not part of the conversation (edits and revokes are handled by the live store)
const SKIP = ["protocolMessage", "senderKeyDistributionMessage", "reactionMessage", "keepInChatMessage", "pollUpdateMessage"];

/** Turns a WhatsApp message into what the archive keeps; null for technical messages. Unknown kinds keep a marker so context isn't lost. */
export function describeMessage(msg: WAMessage): Described | null {
    const c = normalizeMessageContent(msg.message) as any;
    if (!c) return null;
    const keys = Object.keys(c).filter(k => k !== "messageContextInfo");
    if (!keys.length || keys.every(k => SKIP.includes(k))) return null;

    let quotedId: string | null = null;
    for (const k of keys) if (c[k]?.contextInfo?.stanzaId) { quotedId = c[k].contextInfo.stanzaId; break; }

    for (const k of keys) {
        const m = MEDIA_KEYS[k];
        if (m) return { type: m.type, text: (m.caption && c[k][m.caption]) || "", quotedId, mime: c[k].mimetype || null };
    }
    if (c.conversation) return { type: "TEXT", text: c.conversation, quotedId, mime: null };
    if (c.extendedTextMessage) return { type: "TEXT", text: c.extendedTextMessage.text || "", quotedId, mime: null };
    if (c.locationMessage || c.liveLocationMessage) {
        const l = c.locationMessage || c.liveLocationMessage;
        return { type: "LOCATION", text: `${l.degreesLatitude},${l.degreesLongitude}`, quotedId, mime: null };
    }
    if (c.contactMessage) return { type: "CONTACT", text: c.contactMessage.displayName || "", quotedId, mime: null };
    if (c.contactsArrayMessage) return { type: "CONTACT", text: (c.contactsArrayMessage.contacts || []).map((x: any) => x.displayName).join(", "), quotedId, mime: null };
    const poll = c.pollCreationMessage || c.pollCreationMessageV2 || c.pollCreationMessageV3;
    if (poll) return { type: "TEXT", text: `[enquete] ${poll.name}: ${(poll.options || []).map((o: any) => o.optionName).join(" | ")}`, quotedId, mime: null };
    const reply = c.buttonsResponseMessage?.selectedDisplayText || c.listResponseMessage?.title || c.templateButtonReplyMessage?.selectedDisplayText;
    if (reply) return { type: "TEXT", text: reply, quotedId, mime: null };
    return { type: "TEXT", text: `[mensagem do tipo ${keys[0]} sem texto]`, quotedId, mime: null };
}

/** "Maria Silva" + 5511900000000@s.whatsapp.net -> "Maria-Silva__5511900000000" (groups end in -grupo). Stable: set once per chat. */
export function folderName(name: string | null | undefined, jid: string) {
    const slug = (name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    const id = jid.split("@")[0].replace(/[^A-Za-z0-9-]/g, "");
    return `${slug || "sem-nome"}__${id}${jid.endsWith("@g.us") ? "-grupo" : ""}`;
}

export const chatDir = (sessionDbId: string, folder: string) => path.join(ARCHIVE_ROOT, sessionDbId, folder);

const EXT: Record<string, string> = { "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "application/pdf": "pdf" };
/** audios/20261018-140322_<keyId>.ogg  (UTC stamp keeps names sortable and independent of the viewer's time zone) */
export function mediaRelPath(type: string, ts: Date, keyId: string, mime: string | null, fileName?: string) {
    const base = (mime || "").split(";")[0].trim();
    const fromName = fileName && path.extname(fileName).slice(1).toLowerCase();
    const ext = fromName || EXT[base] || base.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
    const stamp = ts.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    return `${type === "AUDIO" ? "audios" : "midias"}/${stamp}_${keyId.replace(/[^A-Za-z0-9]/g, "")}.${ext}`;
}
