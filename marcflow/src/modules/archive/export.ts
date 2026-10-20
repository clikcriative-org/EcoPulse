import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import archiver, { type ZipEntryData } from "archiver";
import { prisma } from "@/lib/prisma";
import { chatDir, wantsMedia } from "./extract";
import { chatTitle, formatLine, mediaMarker, phone, senderLabel, stamp, type Row } from "./format";

/**
 * The ZIP of an export job, streamed: one folder per chat with conversa.txt, audios/ and (when asked) midias/,
 * plus INDICE.txt and RELATORIO.txt. Packages are cut by size between files, never inside a message;
 * a single package is the normal case.
 */

export interface ExportParams { dbId: string; jids: string[] | null; includeMedia: boolean; /** false while the import is still running or paused */ complete: boolean; tz: string }
/** Export of what a job prepared: its chats, its media switch, and whether it ran to the end. */
export const paramsFromJob = (job: { sessionId: string; chatJids: unknown; includeMedia: boolean; status: string }, tz: string): ExportParams => ({
    dbId: job.sessionId, jids: Array.isArray(job.chatJids) ? (job.chatJids as string[]) : null, includeMedia: job.includeMedia, complete: job.status === "completed", tz,
});
const maxPackageBytes = () => Number(process.env.ARCHIVE_MAX_PACKAGE_BYTES) || 3500 * 1024 * 1024; // stays below the 4 GB ZIP limit

const SELECT = { id: true, keyId: true, fromMe: true, senderJid: true, senderName: true, type: true, text: true, timestamp: true, quotedId: true, mediaState: true, mediaFile: true, mediaMime: true, mediaSize: true, mediaError: true } as const;

/** Media saved by an earlier export with the switch on is not included now that it is off. */
const effective = (r: Row, includeMedia: boolean): Row => (r.mediaState === "saved" && !wantsMedia(r.type, includeMedia) ? { ...r, mediaState: "skipped", mediaFile: null } : r);

/** Messages of a chat in order, 2000 at a time, each with the message it replies to. */
async function* chatRows(chatId: string, p: Pick<ExportParams, "includeMedia">, pageSize = 2000): AsyncGenerator<Row> {
    let cursor: string | undefined;
    for (;;) {
        const rows: Row[] = await prisma.archiveMessage.findMany({ where: { chatId }, orderBy: [{ timestamp: "asc" }, { id: "asc" }], take: pageSize, select: SELECT, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        const byKey = new Map(rows.map(r => [r.keyId, r]));
        const missing = [...new Set(rows.map(r => r.quotedId).filter((id): id is string => !!id && !byKey.has(id)))];
        if (missing.length) for (const q of await prisma.archiveMessage.findMany({ where: { chatId, keyId: { in: missing } }, select: SELECT })) byKey.set(q.keyId, q);
        for (const r of rows) yield effective({ ...r, quote: r.quotedId ? byKey.get(r.quotedId) ?? null : null }, p.includeMedia);
        if (rows.length < pageSize) return;
        cursor = rows[rows.length - 1].id;
    }
}

async function loadChats(p: ExportParams) {
    return prisma.archiveChat.findMany({
        where: { sessionId: p.dbId, ...(p.jids ? { jid: { in: p.jids } } : {}) },
        orderBy: [{ name: "asc" }, { jid: "asc" }],
        select: { id: true, jid: true, name: true, isGroup: true, folder: true, backfillDone: true, backfillNote: true, backfillError: true },
    });
}
type Chat = Awaited<ReturnType<typeof loadChats>>[number];

async function account(dbId: string) {
    const [session, job] = await Promise.all([
        prisma.session.findUnique({ where: { id: dbId }, select: { name: true } }),
        prisma.archiveJob.findFirst({ where: { sessionId: dbId, accountJid: { not: null } }, orderBy: { createdAt: "desc" }, select: { accountJid: true } }),
    ]);
    return { name: session?.name ?? "", jid: job?.accountJid ?? null };
}
const accountLabel = (a: { name: string; jid: string | null }) => [a.name, a.jid ? `(${phone(a.jid)})` : ""].filter(Boolean).join(" ");

async function* chatTxt(chat: Chat, acc: Awaited<ReturnType<typeof account>>, p: ExportParams): AsyncGenerator<string> {
    const info = await prisma.archiveMessage.aggregate({ where: { chatId: chat.id }, _count: true, _min: { timestamp: true }, _max: { timestamp: true } });
    yield [
        `Conversa: ${chatTitle(chat)}${chat.isGroup ? " (grupo)" : ""} — ${chat.jid}`,
        `Conta: ${accountLabel(acc)}`,
        `Mensagens: ${info._count}${info._min.timestamp ? ` · de ${stamp(info._min.timestamp, p.tz)} até ${stamp(info._max.timestamp!, p.tz)}` : ""} · fuso ${p.tz}`,
        "Áudios e mídias aparecem entre colchetes, com o nome do arquivo dentro desta pasta.",
        "----------------------------------------------------------------------", "",
    ].join("\n");
    for await (const r of chatRows(chat.id, p)) yield formatLine(r, chat, p.tz) + "\n";
}

// ---- packing ---------------------------------------------------------------------------

interface Entry { kind: "txt" | "media"; chat: Chat; file?: string; size: number }

/** Greedy packing by estimated size: the TXT is estimated from text length, media files use their real size. */
async function planZip(p: ExportParams, chats: Chat[]): Promise<Entry[][]> {
    const stats = await prisma.$queryRaw<{ chatId: string; n: bigint; tl: bigint }[]>`SELECT chatId, COUNT(*) AS n, COALESCE(SUM(CHAR_LENGTH(text)), 0) AS tl FROM ArchiveMessage WHERE sessionId = ${p.dbId} GROUP BY chatId`;
    const st = new Map(stats.map(s => [s.chatId, { n: Number(s.n), tl: Number(s.tl) }]));
    const parts: Entry[][] = [[]];
    let size = 0;
    const add = (e: Entry) => {
        if (parts[parts.length - 1].length && size + e.size > maxPackageBytes()) { parts.push([]); size = 0; }
        parts[parts.length - 1].push(e);
        size += e.size;
    };
    for (const chat of chats) {
        const s = st.get(chat.id) ?? { n: 0, tl: 0 };
        add({ kind: "txt", chat, size: s.n * 120 + Math.round(s.tl * 1.1) + 400 });
        const media = await prisma.archiveMessage.findMany({
            where: { chatId: chat.id, mediaState: "saved", mediaFile: { not: null }, ...(p.includeMedia ? {} : { type: "AUDIO" }) },
            select: { mediaFile: true, mediaSize: true }, orderBy: [{ timestamp: "asc" }, { id: "asc" }],
        });
        for (const m of media) add({ kind: "media", chat, file: m.mediaFile!, size: m.mediaSize ?? 0 });
    }
    return parts.filter(x => x.length);
}

// ---- what is missing -----------------------------------------------------------------

export interface Missing { chat: string; folder: string; when: string | null; what: string }

/** Everything that is missing, failed or not fetched yet, so nothing disappears silently. */
async function* missingItems(p: ExportParams, chats: Chat[]): AsyncGenerator<Missing> {
    for (const chat of chats) {
        const base = { chat: chatTitle(chat), folder: chat.folder };
        if (chat.backfillError) yield { ...base, when: null, what: `Histórico antigo: erro ao pedir ao celular (${chat.backfillError})` };
        else if (!chat.backfillDone) yield { ...base, when: null, what: "Histórico antigo ainda não foi buscado no celular" };
        else if (chat.backfillNote) yield { ...base, when: null, what: `Histórico antigo: ${chat.backfillNote}` };
        for await (const r of chatRows(chat.id, p)) {
            if (r.mediaState === "unavailable" || r.mediaState === "error" || r.mediaState === "pending") yield { ...base, when: stamp(r.timestamp, p.tz), what: `${senderLabel(r, chat)} — ${mediaMarker(r)}` };
        }
        if (!p.includeMedia) {
            const left = await prisma.archiveMessage.count({ where: { chatId: chat.id, type: { in: ["IMAGE", "VIDEO", "DOCUMENT", "STICKER"] } } });
            if (left) yield { ...base, when: null, what: `${left} foto(s)/vídeo(s)/documento(s)/figurinha(s) não incluídos (a chave "Incluir fotos, vídeos e documentos" está desligada)` };
        }
    }
}

export async function listMissing(p: ExportParams, limit: number) {
    const items: Missing[] = [];
    let total = 0;
    for await (const m of missingItems(p, await loadChats(p))) { total++; if (items.length < limit) items.push(m); }
    return { total, items };
}

async function buildReport(p: ExportParams, chats: Chat[], missingFiles: string[]) {
    const out = ["RELATÓRIO DE ITENS FALTANTES, INDISPONÍVEIS OU COM ERRO", "=".repeat(60), ""];
    if (!p.complete) out.push("ATENÇÃO: EXPORTAÇÃO INCOMPLETA. A preparação ainda não terminou; o que não foi buscado está listado abaixo.", "");
    let any = false, last = "";
    for await (const m of missingItems(p, chats)) {
        any = true;
        if (m.folder !== last) { out.push("", `${m.chat} (${m.folder})`); last = m.folder; }
        out.push(`  ${m.when ? `[${m.when}] ` : ""}${m.what}`);
    }
    for (const f of missingFiles) { any = true; out.push("", `Arquivo ausente no disco: ${f}`); }
    if (!any) out.push("Nada faltando: todas as mensagens e áudios disponíveis foram incluídos.");
    return out.join("\n") + "\n";
}

// ---- plan and download -----------------------------------------------------------------

export interface PartSummary { part: number; label: string; chats: number; messages: number; files: number; bytes: number }

export async function planExport(p: ExportParams): Promise<{ parts: PartSummary[]; chats: number; messages: number }> {
    const chats = await loadChats(p);
    if (!chats.length) return { parts: [], chats: 0, messages: 0 };
    const counts = await prisma.archiveMessage.groupBy({ by: ["chatId"], where: { sessionId: p.dbId, chatId: { in: chats.map(c => c.id) } }, _count: true });
    const n = new Map(counts.map(c => [c.chatId, c._count]));
    const parts = await planZip(p, chats);
    return {
        chats: chats.length, messages: [...n.values()].reduce((a, b) => a + b, 0),
        parts: parts.map((es, i) => ({
            part: i + 1, label: parts.length > 1 ? `Pacote ${i + 1} de ${parts.length}` : "ZIP com todas as conversas",
            chats: new Set(es.map(e => e.chat.id)).size, messages: es.filter(e => e.kind === "txt").reduce((a, e) => a + (n.get(e.chat.id) ?? 0), 0),
            files: es.filter(e => e.kind === "media").length, bytes: es.reduce((a, e) => a + e.size, 0),
        })),
    };
}

const fileName = (p: ExportParams, part: number, total: number) => {
    const pad = (x: number) => String(x).padStart(3, "0");
    return `marcflow-conversas${p.complete ? "" : "-INCOMPLETO"}${total > 1 ? `-pacote-${pad(part)}-de-${pad(total)}` : ""}.zip`;
};

/** ZIP of one package (1-based). */
export async function zipPart(p: ExportParams, part: number): Promise<{ stream: Readable; name: string } | null> {
    const chats = await loadChats(p);
    const parts = await planZip(p, chats);
    const entries = parts[part - 1];
    if (!entries) return null;
    const acc = await account(p.dbId);
    const archive = archiver("zip", { zlib: { level: 6 } });
    (async () => {
        const inPart = new Map<string, { chat: Chat; files: string[] }>();
        const missing: string[] = [];
        for (const e of entries) {
            const entry = inPart.get(e.chat.id) ?? inPart.set(e.chat.id, { chat: e.chat, files: [] }).get(e.chat.id)!;
            const base = e.chat.folder;
            if (e.kind === "txt") { archive.append(Readable.from(chatTxt(e.chat, acc, p)), { name: `${base}/conversa.txt` }); entry.files.push("conversa.txt"); continue; }
            const src = path.join(chatDir(p.dbId, base), e.file!);
            if (!(await fs.stat(src).catch(() => null))) { missing.push(`${base}/${e.file}`); continue; }
            archive.file(src, { name: `${base}/${e.file}`, store: true } as ZipEntryData); // audio/photos are already compressed
            entry.files.push(e.file!);
        }
        const folders = [...inPart.values()];
        archive.append([
            `ÍNDICE — pacote ${part} de ${parts.length}${p.complete ? "" : " (EXPORTAÇÃO INCOMPLETA: veja RELATORIO.txt)"}`, `Conta: ${accountLabel(acc)}`, `Exportado em ${stamp(new Date(), p.tz)} (fuso ${p.tz})`,
            parts.length > 1 ? "As conversas podem continuar em outros pacotes: cada pacote traz o que couber, sem cortar mensagens." : "",
            "", ...folders.flatMap(f => [`${f.chat.folder}/  —  ${chatTitle(f.chat)}`, ...f.files.map(x => `    ${x}`)]), "",
        ].join("\n"), { name: "INDICE.txt" });
        const reportChats = folders.filter(f => f.files.includes("conversa.txt")).map(f => f.chat); // each chat is reported once, in the package with its text
        archive.append(await buildReport(p, reportChats, missing), { name: "RELATORIO.txt" });
        await archive.finalize();
    })().catch(e => archive.destroy(e as Error));
    return { stream: archive, name: fileName(p, part, parts.length) };
}
