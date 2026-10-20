// End-to-end check of the quick reply executor against the real database with a fake WhatsApp socket.
// Creates a throwaway session, runs every action kind, asserts what reached the socket/DB, then cleans up.
// Run: npx tsx scripts/test-quick-reply-run.ts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const calls: { fn: string; args: any[] }[] = [];
const rec = (fn: string, ret?: unknown) => async (...args: any[]) => { calls.push({ fn, args }); return ret; };
const fakeSock: any = {
    sendMessage: rec("sendMessage"), sendPresenceUpdate: rec("presence"), chatModify: rec("chatModify"),
    updateBlockStatus: rec("block"), groupInviteCode: rec("invite", "ABC123"),
};
const SESSION = "qrtest-" + Date.now();
const JID = "5500000000009@s.whatsapp.net";

async function main() {
    const { prisma } = await import("../src/lib/prisma");
    const { runActions } = await import("../src/modules/quick-replies/run");
    const { parseActions } = await import("../src/modules/quick-replies/logic");
    const user = await prisma.user.findFirst({ select: { id: true } });
    assert.ok(user, "precisa de um usuário no banco");
    const session = await prisma.session.create({ data: { userId: user.id, name: "Teste resposta rápida", sessionId: SESSION, status: "CONNECTED" } });
    const label = await prisma.label.create({ data: { sessionId: SESSION, name: "QR teste" } });
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "qrtest-"));
    try {
        await prisma.contact.create({ data: { sessionId: session.id, jid: JID, name: "Joana Teste" } });
        await prisma.contactFlowData.create({ data: { sessionId: session.id, contactJid: JID, fields: { cidade: "Recife" } } });
        await prisma.message.create({ data: { sessionId: session.id, remoteJid: JID, fromMe: false, keyId: "LAST1", type: "TEXT", content: "oi", status: "PENDING", timestamp: new Date() } });
        const wav = path.join(tmp, "a.wav");
        execFileSync(process.env.FFMPEG_PATH || "ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "sine=duration=1", wav]);
        const asset = await prisma.flowAsset.create({ data: { sessionId: session.id, path: wav, mime: "audio/wav", size: 1, originalName: "a.wav" } });

        const actions = parseActions([
            { type: "text", text: "#saudação, #primeiroNome de #cidade #promo", typing: 0, wait: 0 },
            { type: "audio", assetId: asset.id },
            { type: "contact", name: "Suporte", phone: "+55 21 98888-7777" },
            { type: "groupInvite", groupJid: "123-456@g.us" },
            { type: "addLabel", labelId: label.id },
            { type: "addLabel", labelId: "nao-existe" },
            { type: "pin" },
            { type: "markUnread" },
            { type: "archive" },
            { type: "block" },
        ]);
        const errors = await runActions(fakeSock, { sessionId: SESSION, dbSessionId: session.id, jid: JID, title: "Teste", actions });

        const sends = calls.filter(c => c.fn === "sendMessage").map(c => c.args[1]);
        assert.match(sends[0].text, /^(Bom dia|Boa tarde|Boa noite), Joana de Recife #promo$/);
        assert.equal(sends[1].ptt, true);
        assert.equal(sends[1].mimetype, "audio/ogg; codecs=opus");
        assert.equal(sends[1].audio.subarray(0, 4).toString(), "OggS");
        assert.match(sends[2].contacts.contacts[0].vcard, /waid=5521988887777:\+5521988887777/);
        assert.equal(sends[3].text, "https://chat.whatsapp.com/ABC123");
        assert.ok(await prisma.chatLabel.findFirst({ where: { labelId: label.id, chatJid: JID } }), "etiqueta aplicada");
        assert.deepEqual(errors, ["Ação 6: Etiqueta não encontrada"]);
        const mods = calls.filter(c => c.fn === "chatModify").map(c => c.args[0]);
        assert.deepEqual(mods[0], { pin: true });
        assert.equal(mods[1].markRead, false);
        assert.equal(mods[1].lastMessages[0].key.id, "LAST1");
        assert.equal(mods[2].archive, true);
        assert.deepEqual(calls.find(c => c.fn === "block")?.args, [JID, "block"]);
        assert.ok(calls.every(c => c.args[0] === JID || c.fn === "invite" || c.fn === "chatModify" || c.fn === "presence"), "tudo foi para a conversa certa");

        // removeAllLabels clears only this chat's labels
        await runActions(fakeSock, { sessionId: SESSION, dbSessionId: session.id, jid: JID, title: "Limpa", actions: parseActions([{ type: "removeAllLabels" }]) });
        assert.equal(await prisma.chatLabel.count({ where: { chatJid: JID, labelId: label.id } }), 0);

        console.log("quick reply executor: all checks passed");
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
        await prisma.flowAsset.deleteMany({ where: { sessionId: session.id } });
        await prisma.contactFlowData.deleteMany({ where: { sessionId: session.id } });
        await prisma.chatLabel.deleteMany({ where: { labelId: label.id } });
        await prisma.label.delete({ where: { id: label.id } });
        await prisma.message.deleteMany({ where: { sessionId: session.id } });
        await prisma.contact.deleteMany({ where: { sessionId: session.id } });
        await prisma.session.delete({ where: { id: session.id } });
        await prisma.$disconnect();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
