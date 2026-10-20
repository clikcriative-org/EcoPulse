// End-to-end check of the broadcast queue against the real database with a fake WhatsApp socket (nothing is sent).
// Run: npx tsx scripts/test-broadcast-runner.ts
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const SESSION = "bctest-" + Date.now();
const sends: { jid: string; at: number; text?: string }[] = [];
let connected = true;
const fakeSock = { sendMessage: async (jid: string, m: { text?: string }) => { sends.push({ jid, at: Date.now(), text: m?.text }); if (jid.startsWith("999")) throw new Error("número inválido"); } };
(global as any).waManager = { getInstance: (id: string) => (id === SESSION ? { status: connected ? "CONNECTED" : "DISCONNECTED", socket: fakeSock } : undefined) };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    const { prisma } = await import("../src/lib/prisma");
    const { runBroadcast, controlBroadcast, clampInterval, pauseOrphanedBroadcasts } = await import("../src/modules/broadcast/runner");
    const { renderBroadcast, parsePhones } = await import("../src/modules/broadcast/template");
    const user = await prisma.user.findFirst({ select: { id: true } });
    assert.ok(user);
    const session = await prisma.session.create({ data: { userId: user.id, name: "Teste transmissão", sessionId: SESSION, status: "CONNECTED" } });
    await prisma.contact.create({ data: { sessionId: session.id, jid: "1@s.whatsapp.net", name: "Joana Silva" } });
    const ids: string[] = [];
    const mk = async (jids: string[], delay: number, extra: Record<string, unknown> = {}) => {
        const log = await prisma.broadcastLog.create({ data: { sessionId: SESSION, message: "Oi {{primeiro_nome}} ({{telefone}})", total: jids.length, delay, status: "running", recipients: { create: jids.map(jid => ({ jid })) }, ...extra } });
        ids.push(log.id);
        return log.id;
    };
    try {
        assert.equal(clampInterval(500), 2000, "floor of 2 s");
        assert.equal(clampInterval(10_000_000), 3_600_000, "cap of 1 h");
        assert.equal(renderBroadcast("Olá, {{nome}}! {{primeiro_nome}} {{x}}", { jid: "5521@s.whatsapp.net", name: "Ana Souza" }), "Olá, Ana Souza! Ana {{x}}");
        assert.deepEqual(parsePhones("5521999998888, 21 9999\n+55 (11) 98888-7777;5521999998888"), ["5521999998888", "5511988887777"]);

        // 1) exact interval, failures don't stop the queue, completes
        const a = await mk(["1@s.whatsapp.net", "999@s.whatsapp.net", "3@s.whatsapp.net"], 2000);
        await runBroadcast(a);
        const gaps = sends.slice(1).map((s, i) => s.at - sends[i].at);
        assert.ok(gaps.every(g => g >= 1950 && g < 3200), `gaps ~2 s, got ${gaps}`);
        let log = await prisma.broadcastLog.findUniqueOrThrow({ where: { id: a } });
        assert.equal(sends[0].text, "Oi Joana (1)", "variables use the contact name and number");
        assert.deepEqual([log.status, log.sent, log.failed], ["completed", 2, 1], JSON.stringify([log.status, log.sent, log.failed, sends.length]));

        // 2) pause takes effect during the wait, resume continues from where it stopped, no duplicates
        sends.length = 0;
        const b = await mk(["10@s.whatsapp.net", "11@s.whatsapp.net", "12@s.whatsapp.net", "13@s.whatsapp.net"], 2000);
        const run = runBroadcast(b);
        await sleep(500);
        assert.equal((await controlBroadcast(b, "pause")).status, "paused");
        await run; // runner exits on pause within ~1 s
        assert.equal(sends.length, 1, "only the first message before the pause");
        assert.equal((await controlBroadcast(b, "pause")).error, "A transmissão não está em andamento");
        await controlBroadcast(b, "resume");
        await sleep(2700);
        await controlBroadcast(b, "cancel");
        await sleep(1200);
        log = await prisma.broadcastLog.findUniqueOrThrow({ where: { id: b } });
        assert.equal(log.status, "cancelled");
        assert.ok(sends.length >= 2 && sends.length <= 3, `sent before cancel: ${sends.length}`);
        assert.equal(new Set(sends.map(s => s.jid)).size, sends.length, "nobody gets the message twice");
        assert.equal(await prisma.broadcastRecipient.count({ where: { broadcastLogId: b, status: "pending" } }), 4 - sends.length);

        // 3) dead session pauses instead of failing everyone; restart pauses orphans
        sends.length = 0;
        connected = false;
        const c = await mk(["20@s.whatsapp.net"], 2000);
        await runBroadcast(c);
        assert.equal((await prisma.broadcastLog.findUniqueOrThrow({ where: { id: c } })).status, "paused");
        assert.equal(sends.length, 0);
        const d = await mk(["30@s.whatsapp.net"], 2000);
        await pauseOrphanedBroadcasts();
        assert.equal((await prisma.broadcastLog.findUniqueOrThrow({ where: { id: d } })).status, "paused");

        // 4) opted-out contact is skipped without waiting; pause-on-failure stops at the first error
        connected = true;
        sends.length = 0;
        await prisma.broadcastOptOut.create({ data: { sessionId: SESSION, jid: "40@s.whatsapp.net" } });
        const e = await mk(["40@s.whatsapp.net", "999@s.whatsapp.net", "41@s.whatsapp.net"], 2000, { pauseOnFailure: true });
        await runBroadcast(e);
        const eLog = await prisma.broadcastLog.findUniqueOrThrow({ where: { id: e }, include: { recipients: true } });
        assert.equal(eLog.status, "paused", "paused on failure");
        assert.deepEqual(eLog.recipients.map(r => r.status).sort(), ["failed", "pending", "skipped"]);
        assert.deepEqual(sends.map(s => s.jid), ["999@s.whatsapp.net"], "opted-out never reached the socket");

        console.log("broadcast runner: all checks passed");
    } finally {
        await prisma.broadcastLog.deleteMany({ where: { id: { in: ids } } });
        await prisma.broadcastOptOut.deleteMany({ where: { sessionId: SESSION } });
        await prisma.contact.deleteMany({ where: { session: { sessionId: SESSION } } });
        await prisma.session.deleteMany({ where: { sessionId: SESSION } });
        await prisma.$disconnect();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
