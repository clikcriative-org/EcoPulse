import fs from "fs/promises";
import type { WASocket } from "@whiskeysockets/baileys";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { toOggOpus } from "@/modules/whatsapp/voice";
import { contactVars, renderTags } from "./logic";
import type { QuickReplyAction } from "./types";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// One quick reply at a time per chat, so two clicks don't interleave messages
const g = global as unknown as { __qrQueues?: Map<string, Promise<unknown>> };
const queues = (g.__qrQueues ??= new Map<string, Promise<unknown>>());

interface Opts { sessionId: string; dbSessionId: string; jid: string; title: string; actions: QuickReplyAction[] }

function emit(sessionId: string, payload: Record<string, unknown>) {
    (global as unknown as { io?: { to(room: string): { emit(ev: string, data: unknown): void } } }).io
        ?.to(sessionId).emit("quickreply.progress", payload);
}

async function hourInTz(): Promise<number> {
    const cfg = await prisma.systemConfig.findUnique({ where: { id: "default" }, select: { timezone: true } });
    const tz = cfg?.timezone || process.env.TZ || "America/Sao_Paulo";
    return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
}

async function lastMessages(dbSessionId: string, jid: string) {
    const m = await prisma.message.findFirst({ where: { sessionId: dbSessionId, remoteJid: jid }, orderBy: { timestamp: "desc" }, select: { keyId: true, fromMe: true, timestamp: true, senderJid: true } });
    // Group messages from others must name their sender (participant) or WhatsApp/Baileys rejects the patch
    return m ? [{ key: { remoteJid: jid, id: m.keyId, fromMe: m.fromMe, participant: m.fromMe || !jid.endsWith("@g.us") ? undefined : m.senderJid || undefined }, messageTimestamp: Math.floor(m.timestamp.getTime() / 1000) }] : [];
}

async function presence(sock: WASocket, jid: string, kind: "composing" | "recording", seconds: number) {
    if (!seconds) return;
    await sock.sendPresenceUpdate(kind, jid).catch(() => undefined);
    await sleep(seconds * 1000);
    await sock.sendPresenceUpdate("paused", jid).catch(() => undefined);
}

async function runOne(sock: WASocket, o: Opts, a: QuickReplyAction, vars: Record<string, string>) {
    const { jid, dbSessionId, sessionId } = o;
    switch (a.type) {
        case "text":
            await presence(sock, jid, "composing", a.typing);
            await sock.sendMessage(jid, { text: renderTags(a.text, vars) });
            await sleep(a.wait * 1000);
            return;
        case "image": case "video": case "audio": case "document": case "sticker": {
            const asset = await prisma.flowAsset.findFirst({ where: { id: a.assetId, sessionId: dbSessionId } });
            if (!asset) throw new Error("Arquivo de mídia não encontrado");
            const buf = await fs.readFile(asset.path);
            const caption = a.caption ? renderTags(a.caption, vars) : undefined;
            if (a.type === "image") return void await sock.sendMessage(jid, { image: buf, caption });
            if (a.type === "video") return void await sock.sendMessage(jid, { video: buf, caption });
            if (a.type === "sticker") return void await sock.sendMessage(jid, { sticker: buf });
            if (a.type === "audio") return void await sock.sendMessage(jid, { audio: await toOggOpus(buf), mimetype: "audio/ogg; codecs=opus", ptt: true });
            return void await sock.sendMessage(jid, { document: buf, mimetype: asset.mime, fileName: a.fileName || asset.originalName, caption });
        }
        case "contact": {
            const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${a.name}\nTEL;type=CELL;type=VOICE;waid=${a.phone}:+${a.phone}\nEND:VCARD`;
            return void await sock.sendMessage(jid, { contacts: { displayName: a.name, contacts: [{ vcard }] } });
        }
        case "groupInvite": {
            const code = await sock.groupInviteCode(a.groupJid);
            if (!code) throw new Error("Não foi possível gerar o convite (você é admin do grupo?)");
            return void await sock.sendMessage(jid, { text: `https://chat.whatsapp.com/${code}` });
        }
        case "wait": return sleep(a.seconds * 1000);
        case "typing": return presence(sock, jid, "composing", a.seconds);
        case "recording": return presence(sock, jid, "recording", a.seconds);
        case "addLabel": case "removeLabel": {
            const label = await prisma.label.findFirst({ where: { id: a.labelId, sessionId } });
            if (!label) throw new Error("Etiqueta não encontrada");
            if (a.type === "addLabel") await prisma.chatLabel.upsert({ where: { labelId_chatJid: { labelId: label.id, chatJid: jid } }, create: { labelId: label.id, chatJid: jid }, update: {} });
            else await prisma.chatLabel.deleteMany({ where: { labelId: label.id, chatJid: jid } });
            return;
        }
        case "removeAllLabels":
            await prisma.chatLabel.deleteMany({ where: { chatJid: jid, label: { sessionId } } });
            return;
        case "archive": case "unarchive":
            return sock.chatModify({ archive: a.type === "archive", lastMessages: await lastMessages(dbSessionId, jid) }, jid);
        case "pin": case "unpin":
            return sock.chatModify({ pin: a.type === "pin" }, jid);
        case "markUnread":
            return sock.chatModify({ markRead: false, lastMessages: await lastMessages(dbSessionId, jid) }, jid);
        case "block":
            return sock.updateBlockStatus(jid, "block");
    }
}

async function execute(o: Opts) {
    const { waManager } = await import("@/modules/whatsapp/manager");
    const inst = waManager.getInstance(o.sessionId);
    const sock = inst?.socket && inst.status === "CONNECTED" ? (inst.socket as WASocket) : null;
    const total = o.actions.length;
    const base = { jid: o.jid, title: o.title, total };
    if (!sock) return emit(o.sessionId, { ...base, step: 0, done: true, error: "Sessão do WhatsApp desconectada" });
    const errors = await runActions(sock, o);
    emit(o.sessionId, { ...base, step: total, done: true, error: errors.join(" · ") || undefined });
}

/** Runs every action in order on the given socket; returns the per-action errors. */
export async function runActions(sock: WASocket, o: Opts): Promise<string[]> {
    const base = { jid: o.jid, title: o.title, total: o.actions.length };
    const [contact, fd, hour] = await Promise.all([
        prisma.contact.findUnique({ where: { sessionId_jid: { sessionId: o.dbSessionId, jid: o.jid } }, select: { name: true, notify: true } }),
        prisma.contactFlowData.findUnique({ where: { sessionId_contactJid: { sessionId: o.dbSessionId, contactJid: o.jid } } }),
        hourInTz(),
    ]);
    const vars = contactVars(contact?.name || contact?.notify || "", o.jid, hour, (fd?.fields as Record<string, string>) || {});

    const errors: string[] = [];
    for (let i = 0; i < o.actions.length; i++) {
        emit(o.sessionId, { ...base, step: i + 1 });
        try { await runOne(sock, o, o.actions[i], vars); }
        catch (e) {
            // A failed action (e.g. label gone) doesn't stop the rest, same as flow action blocks
            errors.push(`Ação ${i + 1}: ${(e as Error).message}`);
            logger.warn("QuickReply", `"${o.title}" action ${i + 1} failed`, e);
        }
    }
    return errors;
}

/** Queues the quick reply for this chat and returns right away; progress goes out as "quickreply.progress". */
export function runQuickReply(o: Opts) {
    const key = `${o.dbSessionId}:${o.jid}`;
    const next = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => execute(o));
    queues.set(key, next);
    next.catch(e => logger.error("QuickReply", "run failed", e)).finally(() => { if (queues.get(key) === next) queues.delete(key); });
}
