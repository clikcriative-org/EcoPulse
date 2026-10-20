/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Self-check of "Exportar conversas" against the dev database, with a fake WhatsApp socket:
 *   ARCHIVE_WAIT_MS=300 ARCHIVE_PACE_MS=10 npx tsx scripts/archive-selfcheck.ts
 * Creates a throwaway user/session, prepares an export for ONE of two chats (sync -> retry -> media upgrade),
 * downloads the ZIPs, asserts their content, then cleans up.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { prisma } from "../src/lib/prisma";
import { controlArchive, ingestWAMessages, pauseOrphanedArchives, runArchiveJob, archiveStats, type Deps } from "../src/modules/archive/import";
import { listMissing, paramsFromJob, planExport, zipPart } from "../src/modules/archive/export";

const T0 = Date.UTC(2026, 9, 10, 12, 0, 0); // 10/10/2026 12:00 UTC
const ANA = "5511900000001@s.whatsapp.net", GRP = "120363000000000001@g.us";
const waId = "archive-selfcheck";
const mediaDir = path.join(process.cwd(), "data", "media");

const wa = (id: string, jid: string, tsSec: number, message: object, fromMe = false): WAMessage =>
    ({ key: { remoteJid: jid, id, fromMe }, messageTimestamp: tsSec, pushName: "Ana Teste", message } as unknown as WAMessage);
const audio = (id: string, jid: string, tsSec: number) => wa(id, jid, tsSec, { audioMessage: { mimetype: "audio/ogg; codecs=opus", mediaKey: Buffer.from("k".repeat(32)), directPath: "/x", seconds: 3 } });
async function drain(s: NodeJS.ReadableStream) { const b: Buffer[] = []; for await (const c of s) b.push(Buffer.from(c)); return Buffer.concat(b); }
async function waitDone(id: string) {
    for (let i = 0; i < 150; i++) { const j = (await prisma.archiveJob.findUnique({ where: { id } }))!; if (j.status !== "running") return j; await new Promise(r => setTimeout(r, 100)); }
    throw new Error("job did not finish");
}

(async () => {
    const user = await prisma.user.create({ data: { email: `selfcheck-${Date.now()}@example.invalid`, password: "x", name: "Self check" } });
    const session = await prisma.session.create({ data: { userId: user.id, name: "Selfcheck", sessionId: waId, status: "CONNECTED" } });
    const files = [path.join(mediaDir, "selfcheck-audio.ogg"), path.join(mediaDir, "selfcheck-photo.jpg")];
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "archive-check-"));
    try {
        // --- what the system already stored: two chats ---
        await fs.mkdir(mediaDir, { recursive: true });
        await fs.writeFile(files[0], "OGG-LOCAL"); await fs.writeFile(files[1], "JPG-LOCAL");
        await prisma.contact.create({ data: { sessionId: session.id, jid: ANA, name: "Ana Teste" } });
        const rows: any[] = [];
        for (let i = 0; i < 30; i++) rows.push({ sessionId: session.id, remoteJid: ANA, senderJid: i % 2 ? null : ANA, fromMe: i % 2 === 1, keyId: `L${i}`, type: "TEXT", content: i === 4 ? "linha 1\nlinha 2" : i === 6 ? "respondendo 😀" : `mensagem ${i}`, quoteId: i === 6 ? "L1" : i === 8 ? "NAO-EXISTE" : null, timestamp: new Date(T0 + i * 60_000), pushName: i % 2 ? null : "Ana Teste" });
        rows.push({ sessionId: session.id, remoteJid: ANA, senderJid: ANA, fromMe: false, keyId: "L-audio", type: "AUDIO", content: "", mediaUrl: "/api/media/selfcheck-audio.ogg", timestamp: new Date(T0 + 40 * 60_000), pushName: "Ana Teste" });
        rows.push({ sessionId: session.id, remoteJid: ANA, senderJid: ANA, fromMe: false, keyId: "L-photo", type: "IMAGE", content: "foto", mediaUrl: "/api/media/selfcheck-photo.jpg", timestamp: new Date(T0 + 41 * 60_000), pushName: "Ana Teste" });
        for (let i = 0; i < 10; i++) rows.push({ sessionId: session.id, remoteJid: GRP, senderJid: "5511900000002@s.whatsapp.net", fromMe: false, keyId: `G${i}`, type: "TEXT", content: `grupo ${i}`, timestamp: new Date(T0 + i * 60_000), pushName: "Beto" });
        rows.push({ sessionId: session.id, remoteJid: "status@broadcast", senderJid: ANA, fromMe: false, keyId: "S1", type: "TEXT", content: "status", timestamp: new Date(T0) });
        await prisma.message.createMany({ data: rows });

        // --- fake phone: 150 older messages for Ana ---
        const sock = Object.assign(new EventEmitter(), {
            ev: undefined as unknown, calls: [] as string[],
            fetchMessageHistory: async (count: number, key: { remoteJid: string; id: string }) => {
                (sock as any).calls.push(`${key.remoteJid}:${key.id}`);
                assert.ok(count <= 50 && key.remoteJid === ANA, "only the selected chat is asked for");
                const k = (sock as any).calls.length - 1;
                if (k >= 3) return "id"; // nothing older: the phone stays silent
                const msgs: WAMessage[] = [];
                for (let i = k * 50; i < k * 50 + 50; i++) {
                    const ts = Math.floor(T0 / 1000) - (i + 1) * 60;
                    msgs.push(i === 7 ? audio("H-audio", ANA, ts) : i === 8 ? audio("H-audio-gone", ANA, ts) : i === 9 ? audio("H-audio-flaky", ANA, ts)
                        : i === 10 ? wa("H-photo", ANA, ts, { imageMessage: { mimetype: "image/jpeg", caption: "foto antiga", mediaKey: Buffer.from("k".repeat(32)) } })
                            : wa(`H${i}`, ANA, ts, { conversation: `antiga ${i}` }, i % 3 === 0));
                }
                setTimeout(() => sock.emit("messaging-history.set", { messages: msgs, chats: [], contacts: [], syncType: 6 }), 20);
                return "id";
            },
        });
        (sock as any).ev = sock;
        let flaky = 0;
        const deps: Deps = {
            getSocket: async () => sock as unknown as WASocket,
            download: async (msg) => {
                const id = msg.key.id!;
                if (id === "H-audio-gone") throw Object.assign(new Error("gone"), { output: { statusCode: 410 } });
                if (id === "H-audio-flaky" && flaky++ === 0) throw new Error("timed out");
                return Buffer.from(`bytes:${id}`);
            },
        };

        // --- export of ONE chat, photos off: sync runs by itself ---
        const job = await prisma.archiveJob.create({ data: { userId: user.id, sessionId: session.id, includeMedia: false, chatJids: [ANA] } });
        await runArchiveJob(job.id, deps);
        let j = (await prisma.archiveJob.findUnique({ where: { id: job.id } }))!;
        assert.equal(j.status, "completed_with_errors", `status ${j.status} / ${j.note}`);
        assert.equal(await prisma.archiveChat.count({ where: { sessionId: session.id } }), 1, "only the selected chat (no group, no status@broadcast)");
        let st = await archiveStats(session.id, [ANA]);
        assert.equal(st.messages, 32 + 150, "local + older messages");
        assert.deepEqual([st.media.saved, st.media.error, st.media.unavailable, st.media.skipped], [2, 1, 1, 2], "audio saved x2, flaky audio retryable, 410 audio unavailable, 2 photos left out");
        assert.equal((sock as any).calls.length, 5, "3 batches + 2 empty requests");

        // an unfinished job is downloadable but clearly marked incomplete, with the retryable error listed
        const early = paramsFromJob(j, "America/Sao_Paulo");
        assert.equal(early.complete, false);
        const part = await zipPart(early, 1);
        assert.match(part!.name, /INCOMPLETO/);
        await fs.writeFile(path.join(tmp, "inc.zip"), await drain(part!.stream));
        execFileSync("unzip", ["-q", "inc.zip", "-d", "inc"], { cwd: tmp });
        assert.match(await fs.readFile(path.join(tmp, "inc", "RELATORIO.txt"), "utf8"), /EXPORTAÇÃO INCOMPLETA[\s\S]*com erro ao baixar/);
        const miss = await listMissing(early, 10);
        assert.ok(miss.total >= 3 && miss.items.some(m => /indisponível/.test(m.what)) && miss.items.some(m => /erro ao baixar/.test(m.what)));

        // --- retry fixes the flaky audio, no duplicates ---
        assert.deepEqual(await controlArchive(job.id, "retry", deps), { status: "running" });
        j = await waitDone(job.id);
        assert.equal(j.status, "completed", `after retry: ${j.status}`);
        st = await archiveStats(session.id, [ANA]);
        assert.equal(st.messages, 182); assert.equal(st.media.error, 0);
        await ingestWAMessages({ dbId: session.id, waId, userId: user.id, includeMedia: false, jids: [ANA] }, [audio("H-audio", ANA, 1), wa("H0", ANA, 2, { conversation: "dup" })]);
        assert.equal((await archiveStats(session.id, [ANA])).messages, 182, "re-importing adds nothing");

        // --- the ZIP: folder per chat, TXT, audios, no photos ---
        const done = paramsFromJob(j, "America/Sao_Paulo");
        const plan = await planExport(done);
        assert.deepEqual([plan.chats, plan.messages, plan.parts.length], [1, 182, 1]);
        const zip = await zipPart(done, 1);
        assert.equal(zip!.name, "marcflow-conversas.zip");
        await fs.writeFile(path.join(tmp, "a.zip"), await drain(zip!.stream));
        execFileSync("unzip", ["-q", "a.zip", "-d", "a"], { cwd: tmp });
        const folder = (await fs.readdir(path.join(tmp, "a"))).find(f => f.startsWith("Ana-Teste__"))!;
        assert.ok(folder, "one folder per chat");
        assert.ok(!(await fs.readdir(path.join(tmp, "a"))).some(f => f.startsWith("grupo") || f.includes("120363")), "the group was not selected");
        const dir = path.join(tmp, "a", folder);
        assert.deepEqual((await fs.readdir(dir)).sort(), ["audios", "conversa.txt"], "no photo folder while the switch is off");
        const txt = await fs.readFile(path.join(dir, "conversa.txt"), "utf8");
        assert.match(txt, /\[10\/10\/2026 09:04:00\] Ana Teste: linha 1\n {4}linha 2/, "multi-line message stays together, time in São Paulo");
        assert.match(txt, /\] Ana Teste: respondendo 😀\n {4}↪ em resposta a Você: “mensagem 1”/, "emoji kept and reply linked to the original");
        assert.match(txt, /↪ em resposta a uma mensagem que não está no histórico/);
        const audios = await fs.readdir(path.join(dir, "audios"));
        assert.equal(audios.length, 3, "local, old and (after retry) flaky audio");
        for (const a of audios) assert.ok(txt.includes(`[áudio: audios/${a}]`), `TXT names ${a} at its message`);
        assert.equal(new Set(audios).size, audios.length);
        assert.equal(await fs.readFile(path.join(dir, "audios", audios.find(a => a.includes("Laudio"))!), "utf8"), "OGG-LOCAL", "original bytes");
        assert.match(txt, /\[imagem \(mídia não incluída na exportação\)\] foto/);
        assert.match(await fs.readFile(path.join(tmp, "a", "RELATORIO.txt"), "utf8"), /áudio indisponível[\s\S]*2 foto\(s\)/);
        assert.doesNotMatch(await fs.readFile(path.join(tmp, "a", "RELATORIO.txt"), "utf8"), /INCOMPLETA/);
        assert.ok(txt.indexOf("[10/10/2026 08:") < txt.indexOf("[10/10/2026 09:"), "chronological order");

        // --- second export of the same chat with photos on: skipped photos are fetched ---
        const job2 = await prisma.archiveJob.create({ data: { userId: user.id, sessionId: session.id, includeMedia: true, chatJids: [ANA] } });
        await runArchiveJob(job2.id, deps);
        const j2 = (await prisma.archiveJob.findUnique({ where: { id: job2.id } }))!;
        assert.equal(j2.status, "completed", "nothing left to retry; the 410 audio is permanently gone and is reported as missing");
        assert.ok((await listMissing(paramsFromJob(j2, "UTC"), 10)).items.some(m => /áudio indisponível/.test(m.what)));
        assert.equal((await archiveStats(session.id, [ANA])).media.saved, 5, "3 audios + 2 photos");
        const zip2 = await zipPart(paramsFromJob(j2, "America/Sao_Paulo"), 1);
        await fs.writeFile(path.join(tmp, "b.zip"), await drain(zip2!.stream));
        execFileSync("unzip", ["-q", "b.zip", "-d", "b"], { cwd: tmp });
        assert.equal((await fs.readdir(path.join(tmp, "b", folder, "midias"))).length, 2, "photos in midias/");
        // ...and the first job (switch off) still exports without them although they are saved now
        assert.ok(!(await zipPart(paramsFromJob(j, "UTC"), 1).then(async z => { await fs.writeFile(path.join(tmp, "c.zip"), await drain(z!.stream)); return execFileSync("unzip", ["-Z1", path.join(tmp, "c.zip")]).toString(); })).includes("midias/"));

        // --- small packages: every file lands in exactly one package, nothing cut ---
        process.env.ARCHIVE_MAX_PACKAGE_BYTES = String(4 * 1024); // tiny limit forces the split
        const parts = await planExport(paramsFromJob(j2, "UTC"));
        assert.ok(parts.parts.length > 1, "splits into numbered packages");
        let nFiles = 0, nTxt = 0;
        for (const p of parts.parts) {
            const z = await zipPart(paramsFromJob(j2, "UTC"), p.part);
            assert.match(z!.name, /pacote-\d{3}-de-\d{3}\.zip$/);
            const f = path.join(tmp, `p${p.part}.zip`);
            await fs.writeFile(f, await drain(z!.stream));
            const names = execFileSync("unzip", ["-Z1", f]).toString().split("\n");
            nFiles += names.filter(x => /\/(audios|midias)\//.test(x)).length; nTxt += names.filter(x => x.endsWith("conversa.txt")).length;
        }
        assert.deepEqual([nFiles, nTxt], [5, 1]);
        // --- a restart pauses only jobs nobody touched since boot, never one that is running now ---
        const fresh = await prisma.archiveJob.create({ data: { userId: user.id, sessionId: session.id, status: "running" } });
        const stale = await prisma.archiveJob.create({ data: { userId: user.id, sessionId: session.id, status: "running" } });
        await prisma.$executeRaw`UPDATE ArchiveJob SET updatedAt = '2020-01-01 00:00:00' WHERE id = ${stale.id}`;
        await pauseOrphanedArchives(session.id); // scoped: never touches a real job on this database
        assert.equal((await prisma.archiveJob.findUnique({ where: { id: fresh.id } }))!.status, "running", "a job started in this process is left alone");
        assert.equal((await prisma.archiveJob.findUnique({ where: { id: stale.id } }))!.status, "paused", "a job left by a previous process is paused");
        console.log("OK: archive self-check passed");
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
        await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined); // cascades chats and messages
        await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
        await prisma.archiveJob.deleteMany({ where: { sessionId: session.id } });
        await fs.rm(path.join(process.cwd(), "data", "archive", session.id), { recursive: true, force: true });
        for (const f of files) await fs.rm(f, { force: true });
        await prisma.$disconnect();
    }
})().catch(e => { console.error(e); process.exit(1); });
