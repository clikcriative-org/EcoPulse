import fs from "fs/promises";
import path from "path";
import { BufferJSON, downloadMediaMessage, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import type { Message, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isLidJid, normalizeJid, resolveToPhoneJid } from "@/lib/jid-utils";
import { MEDIA_TYPES, chatDir, describeMessage, folderName, mediaRelPath, wantsMedia } from "./extract";

/**
 * Importer behind "Exportar conversas": it prepares the selected chats for the ZIP. Three phases, all resumable because the state lives in the database:
 *  1. scan     – copies everything the system already stored (Message table + its audio/media files) into the archive;
 *  2. backfill – asks the phone for older messages, chat by chat (Baileys fetchMessageHistory, 50 per request);
 *  3. media    – downloads audio (and photos/videos/documents when enabled) from the raw messages kept in step 2.
 * Re-running is idempotent: messages are unique per (session, WhatsApp message id).
 */

export const BACKFILL_PAGE = 50;       // WhatsApp's per-request ceiling for on-demand history
const WAIT_MS = Number(process.env.ARCHIVE_WAIT_MS) || 12_000;  // how long the phone gets to answer one request
const PACE_MS = Number(process.env.ARCHIVE_PACE_MS) || 3_000;   // pause between requests of the same chat
const MAX_EMPTY = 2;                   // unanswered/empty requests in a row before a chat counts as fully fetched
const WORKERS = 5;                     // chats asked in parallel
const SCAN_BATCH = 500;

const g = global as unknown as { __archiveRunning?: Set<string>; __archivePolicy?: Map<string, boolean> };
const running = (g.__archiveRunning ??= new Set());
const policy = (g.__archivePolicy ??= new Map<string, boolean>());

/** includeMedia of the job running for this WhatsApp session (undefined = no job). Lets history sync skip heavy downloads. */
export const archiveMediaPolicy = (waSessionId: string) => policy.get(waSessionId);

export interface Deps {
    getSocket(waSessionId: string): Promise<WASocket | null>;
    download(msg: WAMessage, sock: WASocket): Promise<Buffer>;
}
const realDeps: Deps = {
    async getSocket(waSessionId) {
        const { waManager } = await import("@/modules/whatsapp/manager");
        const inst = waManager.getInstance(waSessionId);
        return inst?.socket && inst.status === "CONNECTED" ? inst.socket : null;
    },
    // On 404/410 Baileys asks the phone to re-upload the file once before giving up
    download: (msg, sock) => downloadMediaMessage(msg, "buffer", {}, { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }) as Promise<Buffer>,
};

class Stop extends Error { }
class Pause extends Error { }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const alive = async (jobId: string) => {
    const j = await prisma.archiveJob.findUnique({ where: { id: jobId }, select: { status: true } });
    if (j?.status !== "running") throw new Stop();
};

type Job = NonNullable<Awaited<ReturnType<typeof prisma.archiveJob.findUnique>>>;
/** jids = the chats selected for this export (null = every chat of the session) */
interface Ctx { dbId: string; waId: string; userId: string; includeMedia: boolean; jids: string[] | null }
const jidsOf = (job: { chatJids: unknown }) => (Array.isArray(job.chatJids) ? (job.chatJids as string[]) : null);
const chatScope = (ctx: Pick<Ctx, "dbId" | "jids">) => ({ sessionId: ctx.dbId, ...(ctx.jids ? { jid: { in: ctx.jids } } : {}) });

// ---- chats -----------------------------------------------------------------

/** Finds or creates the archive chat of every jid (names come from contacts/groups; the folder name never changes afterwards). */
async function ensureChats(ctx: Ctx, jids: string[]) {
    const found = new Map(
        (await prisma.archiveChat.findMany({ where: { sessionId: ctx.dbId, jid: { in: jids } }, select: { id: true, jid: true, name: true, folder: true } })).map(c => [c.jid, c]),
    );
    const missing = jids.filter(j => !found.has(j));
    const wantName = [...found.values()].filter(c => !c.name).map(c => c.jid).concat(missing);
    const names = new Map<string, string>();
    if (wantName.length) {
        const [contacts, groups] = await Promise.all([
            prisma.contact.findMany({ where: { sessionId: ctx.dbId, jid: { in: wantName } }, select: { jid: true, name: true, notify: true, verifiedName: true } }),
            prisma.group.findMany({ where: { sessionId: ctx.dbId, jid: { in: wantName } }, select: { jid: true, subject: true } }),
        ]);
        for (const c of contacts) { const n = c.name || c.verifiedName || c.notify; if (n) names.set(c.jid, n); }
        for (const gr of groups) if (gr.subject) names.set(gr.jid, gr.subject);
    }
    if (missing.length) {
        await prisma.archiveChat.createMany({
            skipDuplicates: true,
            data: missing.map(jid => ({ userId: ctx.userId, sessionId: ctx.dbId, jid, name: names.get(jid) ?? null, isGroup: jid.endsWith("@g.us"), folder: folderName(names.get(jid), jid) })),
        });
    }
    for (const c of found.values()) if (!c.name && names.has(c.jid)) await prisma.archiveChat.update({ where: { id: c.id }, data: { name: names.get(c.jid) } });
    return new Map(
        (await prisma.archiveChat.findMany({ where: { sessionId: ctx.dbId, jid: { in: jids } }, select: { id: true, jid: true, folder: true } })).map(c => [c.jid, c]),
    );
}

const skipJid = (jid: string) => jid === "status@broadcast" || jid.endsWith("@newsletter") || jid.endsWith("@broadcast");

async function placeFile(src: string, dst: string) {
    await fs.mkdir(path.dirname(dst), { recursive: true });
    try { await fs.link(src, dst); } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "EEXIST") return;
        await fs.copyFile(src, dst); // different filesystem
    }
}

// ---- phase 1: what the system already stored -------------------------------

type NewRow = Prisma.ArchiveMessageCreateManyInput;

/** The audio/media file the live store already downloaded for this message, copied (hard-linked) into the chat folder. */
async function adoptLocalMedia(ctx: Ctx, folder: string, m: Message): Promise<Partial<NewRow>> {
    if (!wantsMedia(m.type, ctx.includeMedia)) return { mediaState: "skipped" };
    const name = m.mediaUrl ? path.basename(m.mediaUrl) : null;
    const src = name ? path.join(process.cwd(), "data", "media", name) : null;
    const st = src ? await fs.stat(src).catch(() => null) : null;
    if (!src || !st) return { mediaState: "unavailable", mediaError: "O arquivo não foi baixado quando a mensagem chegou e o WhatsApp não guarda a mídia original por muito tempo." };
    const rel = mediaRelPath(m.type, m.timestamp, m.keyId, null, name!);
    await placeFile(src, path.join(chatDir(ctx.dbId, folder), rel));
    return { mediaState: "saved", mediaFile: rel, mediaSize: st.size };
}

async function ingestLocal(ctx: Ctx, rows: Message[]) {
    rows = rows.filter(r => !skipJid(r.remoteJid));
    if (!rows.length) return;
    const chats = await ensureChats(ctx, [...new Set(rows.map(r => r.remoteJid))]);
    const existing = new Map(
        (await prisma.archiveMessage.findMany({ where: { sessionId: ctx.dbId, keyId: { in: rows.map(r => r.keyId) } }, select: { id: true, keyId: true, mediaState: true } })).map(e => [e.keyId, e]),
    );
    const senders = [...new Set(rows.map(r => r.senderJid).filter(Boolean) as string[])];
    const contacts = new Map(
        (await prisma.contact.findMany({ where: { sessionId: ctx.dbId, jid: { in: senders } }, select: { jid: true, name: true, notify: true } })).map(c => [c.jid, c.name || c.notify]),
    );
    const data: NewRow[] = [];
    for (const m of rows) {
        const chat = chats.get(m.remoteJid)!;
        const isMedia = MEDIA_TYPES.includes(m.type);
        const old = existing.get(m.keyId);
        if (old) {
            // a later run with "incluir mídias" ligado: fotos, vídeos e documentos que antes foram pulados
            if (isMedia && old.mediaState === "skipped" && ctx.includeMedia) await prisma.archiveMessage.update({ where: { id: old.id }, data: await adoptLocalMedia(ctx, chat.folder, m) });
            continue;
        }
        data.push({
            chatId: chat.id, sessionId: ctx.dbId, keyId: m.keyId, fromMe: m.fromMe, senderJid: m.fromMe ? null : m.senderJid ?? m.remoteJid,
            senderName: m.fromMe ? null : m.pushName || (m.senderJid && contacts.get(m.senderJid)) || null,
            type: m.type, text: m.content ?? "", timestamp: m.timestamp, quotedId: m.quoteId,
            ...(isMedia ? await adoptLocalMedia(ctx, chat.folder, m) : {}),
        });
    }
    if (data.length) await prisma.archiveMessage.createMany({ data, skipDuplicates: true });
}

async function phaseScan(job: Job, ctx: Ctx) {
    await setPhase(job.id, "scan");
    // Media that was skipped earlier but whose raw message was kept becomes downloadable when the switch is on now
    if (ctx.includeMedia) await prisma.archiveMessage.updateMany({ where: { sessionId: ctx.dbId, chat: chatScope(ctx), mediaState: "skipped", raw: { not: null } }, data: { mediaState: "pending" } });
    let cursor: string | null = (job.cursor as { scan?: string } | null)?.scan ?? null;
    for (;;) {
        await alive(job.id);
        const rows = await prisma.message.findMany({ where: { sessionId: ctx.dbId, ...(ctx.jids ? { remoteJid: { in: ctx.jids } } : {}), ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: "asc" }, take: SCAN_BATCH });
        if (!rows.length) return;
        await ingestLocal(ctx, rows);
        cursor = rows[rows.length - 1].id;
        await prisma.archiveJob.update({ where: { id: job.id }, data: { cursor: { scan: cursor } } });
    }
}

// ---- phase 2: older messages from the phone --------------------------------

const waiters = new Map<string, Set<(jid: string) => void>>();
const notify = (waId: string, jid: string) => waiters.get(waId)?.forEach(fn => fn(jid));
function waitFor(waId: string, jid: string, ms: number) {
    const set = waiters.get(waId) ?? waiters.set(waId, new Set()).get(waId)!;
    let fn!: (j: string) => void;
    let timer!: NodeJS.Timeout;
    const done = new Promise<boolean>(res => {
        fn = j => { if (j === jid) { clearTimeout(timer); set.delete(fn); res(true); } };
        timer = setTimeout(() => { set.delete(fn); res(false); }, ms);
        set.add(fn);
    });
    return { done, cancel: () => { clearTimeout(timer); set.delete(fn); } };
}

const toMs = (t: unknown) => 1000 * (typeof t === "number" ? t : (t as { toNumber?: () => number })?.toNumber ? (t as { toNumber: () => number }).toNumber() : Number(t));

/** Messages that arrive from the phone (history sync): text, audio and, for media, the raw message so it can be downloaded later. */
export async function ingestWAMessages(ctx: Ctx, msgs: WAMessage[]) {
    const prepared: { jid: string; row: Omit<NewRow, "chatId"> }[] = [];
    for (const msg of msgs) {
        const d = describeMessage(msg);
        const keyId = msg.key?.id;
        let rj = msg.key?.remoteJid;
        if (!d || !keyId || !rj) continue;
        const alt = (msg.key as { remoteJidAlt?: string }).remoteJidAlt;
        if (isLidJid(rj)) rj = await resolveToPhoneJid(rj, ctx.dbId, alt);
        const jid = normalizeJid(rj);
        if (skipJid(jid)) continue;
        let sender: string | null = null;
        if (!msg.key.fromMe) {
            sender = jid.endsWith("@g.us") ? msg.key.participant || msg.participant || null : jid;
            if (sender && isLidJid(sender)) sender = await resolveToPhoneJid(sender, ctx.dbId, alt);
            sender = sender ? normalizeJid(sender) : null;
        }
        const isMedia = MEDIA_TYPES.includes(d.type);
        prepared.push({
            jid,
            row: {
                sessionId: ctx.dbId, keyId, fromMe: !!msg.key.fromMe, senderJid: sender, senderName: msg.key.fromMe ? null : msg.pushName || null,
                type: d.type, text: d.text, timestamp: new Date(toMs(msg.messageTimestamp) || Date.now()), quotedId: d.quotedId,
                ...(isMedia ? { raw: JSON.stringify(msg, BufferJSON.replacer), mediaMime: d.mime, mediaState: wantsMedia(d.type, ctx.includeMedia) ? "pending" : "skipped" } : {}),
            },
        });
    }
    if (!prepared.length) return new Set<string>();
    const chats = await ensureChats(ctx, [...new Set(prepared.map(p => p.jid))]);
    await prisma.archiveMessage.createMany({ skipDuplicates: true, data: prepared.map(p => ({ ...p.row, chatId: chats.get(p.jid)!.id }) as NewRow) });
    return new Set(prepared.map(p => p.jid));
}

function bindHistory(sock: WASocket, ctx: Ctx) {
    const handler = async ({ messages }: { messages?: WAMessage[] }) => {
        try { for (const jid of await ingestWAMessages(ctx, messages ?? [])) notify(ctx.waId, jid); }
        catch (e) { logger.error("Archive", "could not save history batch", e); }
    };
    sock.ev.on("messaging-history.set", handler as never);
    return () => sock.ev.off("messaging-history.set", handler as never);
}

async function backfillChat(job: Job, ctx: Ctx, chatId: string, getSock: () => Promise<WASocket>) {
    const chat = (await prisma.archiveChat.findUnique({ where: { id: chatId } }))!;
    const done = (note: string) => prisma.archiveChat.update({ where: { id: chat.id }, data: { backfillDone: true, backfillNote: note } });
    let empty = 0;
    for (;;) {
        await alive(job.id);
        const oldest = await prisma.archiveMessage.findFirst({ where: { chatId: chat.id }, orderBy: [{ timestamp: "asc" }, { id: "asc" }], select: { keyId: true, fromMe: true, timestamp: true } });
        if (!oldest) return void await done("Sem mensagens salvas para servir de ponto de partida.");
        const before = await prisma.archiveMessage.count({ where: { chatId: chat.id } });
        const sock = await getSock();
        const wait = waitFor(ctx.waId, chat.jid, WAIT_MS);
        try {
            await sock.fetchMessageHistory(BACKFILL_PAGE, { remoteJid: chat.jid, id: oldest.keyId, fromMe: oldest.fromMe }, oldest.timestamp.getTime());
        } catch (e) {
            wait.cancel();
            return void await prisma.archiveChat.update({ where: { id: chat.id }, data: { backfillError: (e as Error)?.message || "Falha ao pedir o histórico ao celular" } });
        }
        await wait.done;
        const after = await prisma.archiveMessage.count({ where: { chatId: chat.id } });
        empty = after > before ? 0 : empty + 1;
        if (empty >= MAX_EMPTY) return void await done("O celular não devolveu mensagens mais antigas (início da conversa ou histórico não disponível).");
        await sleep(PACE_MS);
    }
}

async function phaseBackfill(job: Job, ctx: Ctx, deps: Deps) {
    await setPhase(job.id, "backfill");
    const queue = (await prisma.archiveChat.findMany({ where: { ...chatScope(ctx), backfillDone: false, backfillError: null }, select: { id: true }, orderBy: { id: "asc" } })).map(c => c.id);
    if (!queue.length) return;
    let bound: { sock: WASocket; off: () => void } | null = null;
    const getSock = async () => {
        const sock = await deps.getSocket(ctx.waId);
        if (!sock) throw new Pause("O WhatsApp desta sessão está desconectado. Reconecte e retome para buscar o histórico mais antigo.");
        if (bound?.sock !== sock) { bound?.off(); bound = { sock, off: bindHistory(sock, ctx) }; }
        return sock;
    };
    try {
        await getSock();
        const worker = async () => { for (let id = queue.shift(); id; id = queue.shift()) await backfillChat(job, ctx, id, getSock); };
        const results = await Promise.allSettled(Array.from({ length: WORKERS }, worker));
        const failed = results.find(r => r.status === "rejected") as PromiseRejectedResult | undefined;
        if (failed) throw failed.reason;
    } finally { (bound as { off: () => void } | null)?.off(); }
}

// ---- phase 3: media files ---------------------------------------------------

async function phaseMedia(job: Job, ctx: Ctx, deps: Deps) {
    await setPhase(job.id, "media");
    for (;;) {
        await alive(job.id);
        const rows = await prisma.archiveMessage.findMany({ where: { sessionId: ctx.dbId, chat: chatScope(ctx), mediaState: "pending", raw: { not: null } }, orderBy: { id: "asc" }, take: 25, include: { chat: { select: { folder: true } } } });
        if (!rows.length) return;
        const sock = await deps.getSocket(ctx.waId);
        if (!sock) throw new Pause("O WhatsApp desta sessão está desconectado. Reconecte e retome para baixar os áudios e arquivos pendentes.");
        for (const r of rows) {
            await alive(job.id);
            try {
                const buf = await deps.download(JSON.parse(r.raw!, BufferJSON.reviver) as WAMessage, sock);
                const rel = mediaRelPath(r.type, r.timestamp, r.keyId, r.mediaMime, r.type === "DOCUMENT" ? r.text ?? undefined : undefined);
                const dst = path.join(chatDir(ctx.dbId, r.chat.folder), rel);
                await fs.mkdir(path.dirname(dst), { recursive: true });
                await fs.writeFile(dst, buf);
                await prisma.archiveMessage.update({ where: { id: r.id }, data: { mediaState: "saved", mediaFile: rel, mediaSize: buf.length, mediaError: null } });
            } catch (e) {
                const code = (e as { output?: { statusCode?: number } }).output?.statusCode ?? (e as { status?: number }).status;
                const gone = code === 404 || code === 410;
                await prisma.archiveMessage.update({
                    where: { id: r.id },
                    data: { mediaState: gone ? "unavailable" : "error", mediaError: gone ? "O arquivo não está mais disponível no WhatsApp (expirou ou foi apagado)." : (e as Error)?.message || "Erro ao baixar" },
                });
            }
        }
    }
}

// ---- job lifecycle -----------------------------------------------------------

const setPhase = (id: string, phase: string) => prisma.archiveJob.update({ where: { id }, data: { phase } });

/** Items that still need attention: media that failed to download and chats whose history request failed. */
export async function countErrors(ctx: Pick<Ctx, "dbId" | "jids">) {
    const [media, chats] = await Promise.all([
        prisma.archiveMessage.count({ where: { sessionId: ctx.dbId, chat: chatScope(ctx), mediaState: "error" } }),
        prisma.archiveChat.count({ where: { ...chatScope(ctx), backfillError: { not: null } } }),
    ]);
    return media + chats;
}

export async function runArchiveJob(jobId: string, deps: Deps = realDeps) {
    if (running.has(jobId)) return;
    running.add(jobId);
    let waId: string | null = null;
    try {
        const job = await prisma.archiveJob.findUnique({ where: { id: jobId } });
        if (!job || job.status !== "running") return;
        const session = await prisma.session.findUnique({ where: { id: job.sessionId }, select: { id: true, sessionId: true } });
        if (!session) throw new Error("Sessão não encontrada");
        waId = session.sessionId;
        policy.set(waId, job.includeMedia);
        const ctx: Ctx = { dbId: session.id, waId, userId: job.userId, includeMedia: job.includeMedia, jids: jidsOf(job) };
        await phaseScan(job, ctx);
        await phaseBackfill(job, ctx, deps);
        await phaseMedia(job, ctx, deps);
        const errors = await countErrors(ctx);
        await prisma.archiveJob.updateMany({
            where: { id: jobId, status: "running" },
            data: { status: errors ? "completed_with_errors" : "completed", phase: "done", completedAt: new Date(), note: errors ? `${errors} item(ns) com erro. Use "Tentar novamente".` : null },
        });
    } catch (e) {
        if (e instanceof Stop) return;
        const pause = e instanceof Pause;
        if (!pause) logger.error("Archive", `job ${jobId} failed`, e);
        await prisma.archiveJob.updateMany({ where: { id: jobId, status: "running" }, data: { status: "paused", note: pause ? (e as Error).message : `Erro interno: ${(e as Error)?.message}. Você pode retomar.` } });
    } finally {
        running.delete(jobId);
        if (waId) policy.delete(waId);
    }
}

export async function startArchive(userId: string, session: { id: string; sessionId: string }, opts: { jids: string[] | null; includeMedia: boolean }) {
    const active = await prisma.archiveJob.findFirst({ where: { sessionId: session.id, status: { in: ["running", "paused"] } } });
    if (active) return { error: "Já existe uma importação em andamento ou pausada nesta sessão. Retome ou cancele antes de iniciar outra." };
    const { waManager } = await import("@/modules/whatsapp/manager");
    const me = waManager.getInstance(session.sessionId)?.socket?.user?.id;
    const job = await prisma.archiveJob.create({ data: { userId, sessionId: session.id, includeMedia: opts.includeMedia, chatJids: opts.jids ?? undefined, accountJid: me ? me.replace(/:\d+@/, "@") : null } });
    void runArchiveJob(job.id);
    return { job };
}

export async function controlArchive(jobId: string, action: "pause" | "resume" | "cancel" | "retry", deps: Deps = realDeps) {
    const job = await prisma.archiveJob.findUnique({ where: { id: jobId } });
    if (!job) return { error: "Importação não encontrada" };
    const open = job.status === "running" || job.status === "paused";
    if (action === "pause") {
        if (job.status !== "running") return { error: "A importação não está em andamento" };
        await prisma.archiveJob.update({ where: { id: jobId }, data: { status: "paused", note: "Pausada por você." } });
    } else if (action === "resume") {
        if (job.status !== "paused") return { error: "A importação não está pausada" };
        await prisma.archiveJob.update({ where: { id: jobId }, data: { status: "running", note: null } });
        void runArchiveJob(jobId, deps);
    } else if (action === "cancel") {
        if (!open) return { error: "Esta importação já terminou" };
        await prisma.archiveJob.update({ where: { id: jobId }, data: { status: "cancelled", completedAt: new Date() } });
    } else {
        if (job.status !== "completed_with_errors" && job.status !== "paused") return { error: "Não há itens com erro para tentar de novo" };
        const scope = { dbId: job.sessionId, jids: jidsOf(job) };
        await prisma.archiveMessage.updateMany({ where: { sessionId: job.sessionId, chat: chatScope(scope), mediaState: "error", raw: { not: null } }, data: { mediaState: "pending", mediaError: null } });
        await prisma.archiveChat.updateMany({ where: { ...chatScope(scope), backfillError: { not: null } }, data: { backfillError: null } });
        await prisma.archiveJob.update({ where: { id: jobId }, data: { status: "running", phase: "scan", note: null, completedAt: null } });
        void runArchiveJob(jobId, deps);
    }
    return { status: (await prisma.archiveJob.findUnique({ where: { id: jobId } }))!.status };
}

/**
 * A restart leaves jobs "running" in the database with nobody running them: they become "paused" (resumable).
 * Only jobs untouched since this process started count: starting or resuming a job writes it, so a job that is
 * really running here is never paused, even when dev mode evaluates the WhatsApp manager again in the same process.
 */
export async function pauseOrphanedArchives(onlySessionId?: string) {
    const bootedAt = new Date(Date.now() - process.uptime() * 1000);
    const res = await prisma.archiveJob.updateMany({ where: { status: "running", updatedAt: { lt: bootedAt }, id: { notIn: [...running] }, ...(onlySessionId ? { sessionId: onlySessionId } : {}) }, data: { status: "paused", note: "Interrompida pelo reinício do servidor. Retome para continuar." } });
    if (res.count) logger.info("Archive", `${res.count} importação(ões) interrompida(s) pelo reinício ficaram pausadas`);
}

export async function archiveStats(dbId: string, jids: string[] | null) {
    const scope = { dbId, jids };
    const [chats, messages, media, pendingChats, errorChats] = await Promise.all([
        prisma.archiveChat.count({ where: chatScope(scope) }),
        prisma.archiveMessage.count({ where: { sessionId: dbId, chat: chatScope(scope) } }),
        prisma.archiveMessage.groupBy({ by: ["mediaState"], where: { sessionId: dbId, chat: chatScope(scope) }, _count: true }),
        prisma.archiveChat.count({ where: { ...chatScope(scope), backfillDone: false, backfillError: null } }),
        prisma.archiveChat.count({ where: { ...chatScope(scope), backfillError: { not: null } } }),
    ]);
    const m = Object.fromEntries(media.map(x => [x.mediaState, x._count])) as Record<string, number>;
    return {
        chats, messages, pendingChats, errorChats,
        media: { saved: m.saved ?? 0, pending: m.pending ?? 0, skipped: m.skipped ?? 0, unavailable: m.unavailable ?? 0, error: m.error ?? 0 },
    };
}

export const jobJids = jidsOf;
