// Menu block in both modes ("poll" = WhatsApp poll the contact taps, "number" = numbered text), against a throwaway
// session and a fake WhatsApp socket: nothing is sent. Votes are encrypted exactly like WhatsApp does.
// Run: npx tsx scripts/test-menu-poll.ts
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const ME = { id: "5500000000000:7@s.whatsapp.net", lid: "11112222333344:7@lid" };
const sent: { to: string; payload: any; id: string }[] = [];
const fakeSock = {
    user: ME,
    sendMessage: async (to: string, payload: any) => { const id = "3EB0" + crypto.randomBytes(6).toString("hex").toUpperCase(); sent.push({ to, payload, id }); return { key: { id, remoteJid: to, fromMe: true } }; },
    sendPresenceUpdate: async () => undefined,
};
const SESSION = "menupoll-" + Date.now();
(global as any).waManager = { getInstance: (id: string) => (id === SESSION ? { status: "CONNECTED", socket: fakeSock } : undefined) };
const report: string[] = [];

async function main() {
    const { prisma } = await import("../src/lib/prisma");
    const engine = await import("../src/modules/flows/engine");
    const { validateGraph, defaultData } = await import("../src/modules/flows/types");
    const { aesEncryptGCM, hmacSign, proto } = await import("@whiskeysockets/baileys");
    const user = await prisma.user.findFirst({ select: { id: true } });
    assert.ok(user, "precisa de um usuário no banco");
    const session = await prisma.session.create({ data: { userId: user.id, name: "Teste menu", sessionId: SESSION, status: "CONNECTED" } });
    const dbSessionId = session.id;
    const scenario = async (n: number, title: string, fn: () => Promise<void>) => { await fn(); report.push(`✔ ${n}. ${title}`); };

    const OPTIONS = [{ id: "o-conhecer", text: "Conhecer o produto" }, { id: "o-aluno", text: "Já sou aluno" }, { id: "o-suporte", text: "Falar com o suporte" }];
    const graphFor = (mode: "poll" | "number") => ({
        nodes: [
            { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
            { id: "m", type: "menu", position: { x: 0, y: 0 }, data: { ...defaultData("menu"), mode, question: "Olá {primeiro-nome}! Como posso te ajudar?", invalidText: "Toque numa opção ou digite o número.", maxErrors: 2, options: OPTIONS.map(o => ({ ...o })) } },
            ...OPTIONS.map(o => ({ id: `p-${o.id}`, type: "content", position: { x: 0, y: 0 }, data: { items: [{ id: `t-${o.id}`, kind: "text", text: `caminho ${o.id}` }] } })),
            { id: "err", type: "content", position: { x: 0, y: 0 }, data: { items: [{ id: "t-err", kind: "text", text: "caminho erro" }] } },
        ],
        edges: [
            { id: "e0", source: "start", sourceHandle: "next", target: "m" },
            ...OPTIONS.map(o => ({ id: `e-${o.id}`, source: "m", sourceHandle: `option:${o.id}`, target: `p-${o.id}` })),
            { id: "e-err", source: "m", sourceHandle: "error", target: "err" },
        ],
    }) as any;

    const flow = await prisma.flow.create({ data: { sessionId: dbSessionId, name: "Menu teste", draftGraph: graphFor("poll") } });
    const lastRun = (jid: string) => prisma.flowRun.findFirstOrThrow({ where: { sessionId: dbSessionId, contactJid: jid }, orderBy: { startedAt: "desc" } });
    const start = async (jid: string, mode: "poll" | "number") => {
        sent.length = 0;
        await prisma.contact.upsert({ where: { sessionId_jid: { sessionId: dbSessionId, jid } }, create: { sessionId: dbSessionId, jid, name: "Maria Souza" }, update: {} });
        await engine.startTestRun({ flowId: flow.id, graph: graphFor(mode), dbSessionId, sessionId: SESSION, jid });
        return lastRun(jid);
    };
    const vote = (pollId: string, secretB64: string, creator: string, voter: string, choice: string | null, key: { remoteJid: string; remoteJidAlt?: string; id?: string }, poll = { id: pollId }) => {
        const selected = choice === null ? [] : [crypto.createHash("sha256").update(choice).digest()];
        const sign = Buffer.concat([Buffer.from(pollId), Buffer.from(creator), Buffer.from(voter), Buffer.from("Poll Vote"), new Uint8Array([1])]);
        const decKey = hmacSign(sign, hmacSign(Buffer.from(secretB64, "base64"), new Uint8Array(32), "sha256"), "sha256");
        const encIv = crypto.randomBytes(12);
        const encPayload = aesEncryptGCM(proto.Message.PollVoteMessage.encode({ selectedOptions: selected }).finish(), decKey, encIv, Buffer.from(`${pollId}\u0000${voter}`));
        return engine.onPollVote(SESSION, dbSessionId, {
            key: { fromMe: false, id: key.id || "VOTE" + crypto.randomBytes(4).toString("hex"), remoteJid: key.remoteJid, remoteJidAlt: key.remoteJidAlt } as any,
            message: { pollUpdateMessage: { pollCreationMessageKey: { id: poll.id, remoteJid: key.remoteJid, fromMe: true }, vote: { encPayload, encIv } } },
        });
    };
    const lastSentText = () => { const p = sent[sent.length - 1]?.payload; return p?.text ?? ""; };

    try {
        await scenario(1, "Modo enquete envia uma enquete real de escolha única", async () => {
            const jid = "5511987650001@s.whatsapp.net";
            const run = await start(jid, "poll");
            assert.equal(sent.length, 1);
            assert.deepEqual(sent[0].payload.poll.values, OPTIONS.map(o => o.text));
            assert.equal(sent[0].payload.poll.name, "Olá Maria! Como posso te ajudar?");
            assert.equal(sent[0].payload.poll.selectableCount, 1);
            assert.equal(sent[0].payload.poll.messageSecret.length, 32);
            assert.equal(run.status, "WAITING_INPUT");
            const poll = (run.wait as any).poll;
            assert.equal(poll.id, sent[0].id);
            assert.deepEqual(poll.creators, ["5500000000000@s.whatsapp.net", "11112222333344@lid"]);
        });

        await scenario(2, "Toque na 2ª opção segue só o caminho dela", async () => {
            const jid = "5511987650002@s.whatsapp.net";
            const run = await start(jid, "poll");
            const poll = (run.wait as any).poll;
            await vote(poll.id, poll.secret, "5500000000000@s.whatsapp.net", jid, "Já sou aluno", { remoteJid: jid });
            assert.equal(lastSentText(), "caminho o-aluno");
            assert.equal(sent.length, 2, "nenhum outro caminho");
            assert.equal((await prisma.flowRun.findUniqueOrThrow({ where: { id: run.id } })).status, "COMPLETED");
        });

        await scenario(3, "Voto de conversa endereçada por LID também é lido", async () => {
            const jid = "5511987650003@s.whatsapp.net", lid = "99887766554433@lid";
            const run = await start(jid, "poll");
            const poll = (run.wait as any).poll;
            await vote(poll.id, poll.secret, "11112222333344@lid", lid, "Falar com o suporte", { remoteJid: lid, remoteJidAlt: jid });
            assert.equal(lastSentText(), "caminho o-suporte");
        });

        await scenario(4, "Voto falso, de outra enquete ou retirado não move a conversa", async () => {
            const jid = "5511987650004@s.whatsapp.net";
            const run = await start(jid, "poll");
            const poll = (run.wait as any).poll;
            await vote(poll.id, crypto.randomBytes(32).toString("base64"), "5500000000000@s.whatsapp.net", jid, "Já sou aluno", { remoteJid: jid }); // wrong key
            await vote("OUTRA-ENQUETE", poll.secret, "5500000000000@s.whatsapp.net", jid, "Já sou aluno", { remoteJid: jid });
            await vote(poll.id, poll.secret, "5500000000000@s.whatsapp.net", jid, null, { remoteJid: jid }); // vote withdrawn
            await vote(poll.id, poll.secret, "5500000000000@s.whatsapp.net", jid, "Opção que não existe", { remoteJid: jid });
            assert.equal(sent.length, 1, "nada enviado depois da enquete");
            const fresh = await prisma.flowRun.findUniqueOrThrow({ where: { id: run.id } });
            assert.equal(fresh.status, "WAITING_INPUT");
            assert.equal((fresh.wait as any).errors, 0, "voto ilegível não conta como erro");
        });

        await scenario(5, "Na enquete, quem digita o número ou o texto também segue; resposta inválida não avança", async () => {
            const jid = "5511987650005@s.whatsapp.net";
            await start(jid, "poll");
            const say = async (text: string, keyId: string) => {
                await prisma.message.create({ data: { sessionId: dbSessionId, remoteJid: jid, fromMe: false, keyId, type: "TEXT", content: text, status: "PENDING", timestamp: new Date() } });
                engine.onIncomingMessage(SESSION, dbSessionId, { remoteJid: jid, keyId, fromMe: false, type: "TEXT", content: text, mediaUrl: null });
                await new Promise(r => setTimeout(r, 400));
            };
            await say("quero falar com alguém", `K5a${Date.now()}`);
            assert.equal(lastSentText(), "Toque numa opção ou digite o número.");
            await say("conhecer o produto", `K5b${Date.now()}`);
            assert.equal(lastSentText(), "caminho o-conhecer");
        });

        await scenario(6, "Modo número envia texto numerado e segue pelo número", async () => {
            const jid = "5511987650006@s.whatsapp.net";
            const run = await start(jid, "number");
            assert.match(lastSentText(), /^Olá Maria! Como posso te ajudar\?\n\n1\. Conhecer o produto\n2\. Já sou aluno\n3\. Falar com o suporte$/);
            assert.equal((run.wait as any).poll, undefined);
            await prisma.message.create({ data: { sessionId: dbSessionId, remoteJid: jid, fromMe: false, keyId: "K6", type: "TEXT", content: "3", status: "PENDING", timestamp: new Date() } });
            engine.onIncomingMessage(SESSION, dbSessionId, { remoteJid: jid, keyId: "K6", fromMe: false, type: "TEXT", content: "3", mediaUrl: null });
            await new Promise(r => setTimeout(r, 400));
            assert.equal(lastSentText(), "caminho o-suporte");
        });

        await scenario(7, "Simulador (@sim): a enquete aparece como texto e o toque é simulado", async () => {
            const jid = "menu-poll@sim";
            sent.length = 0;
            await engine.simulateIncoming({ flowId: flow.id, graph: graphFor("poll"), triggers: [], dbSessionId, sessionId: SESSION, jid, text: "oi" });
            assert.equal(sent.length, 0, "nada no WhatsApp");
            const run = await lastRun(jid);
            const log = await prisma.flowRunLog.findFirstOrThrow({ where: { runId: run.id, event: "SEND" } });
            assert.match((log.detail as any).text, /^📊 Olá ! Como posso te ajudar\?\n\n○ Conhecer o produto\n○ Já sou aluno\n○ Falar com o suporte$/);
            const poll = (run.wait as any).poll;
            await vote(poll.id, poll.secret, "simulador@sim", jid, "Já sou aluno", { remoteJid: jid });
            assert.equal((await prisma.flowRunLog.findFirstOrThrow({ where: { runId: run.id, event: "SEND" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }).then(l => (l.detail as any).text)), "caminho o-aluno");
        });

        await scenario(8, "Validação antes de ativar: limites da enquete, respostas iguais e caminhos sem conexão", async () => {
            const msgs = (g: any) => validateGraph(g).filter(i => i.level === "error").map(i => i.message).join(" | ");
            assert.equal(msgs(graphFor("poll")), "");
            assert.equal(msgs(graphFor("number")), "");
            const many = graphFor("poll");
            many.nodes[1].data.options = Array.from({ length: 13 }, (_, i) => ({ id: `x${i}`, text: `Opção ${i + 1}` }));
            many.edges.push(...many.nodes[1].data.options.map((o: any) => ({ id: `ex${o.id}`, source: "m", sourceHandle: `option:${o.id}`, target: "err" })));
            assert.match(msgs(many), /no máximo 12 respostas/);
            many.nodes[1].data.mode = "number";
            assert.doesNotMatch(msgs(many), /no máximo 12/, "o limite é só da enquete");
            const dup = graphFor("poll");
            dup.nodes[1].data.options[1].text = " conhecer o produto ";
            assert.match(msgs(dup), /duas respostas iguais/);
            const loose = graphFor("number");
            loose.edges = loose.edges.filter((e: any) => e.sourceHandle !== "option:o-aluno");
            assert.match(msgs(loose), /resposta sem caminho conectado/);
            const long = graphFor("poll");
            long.nodes[1].data.question = "x".repeat(256);
            assert.match(msgs(long), /passa de 255 caracteres/);
        });

        await scenario(9, "Modo, pergunta, respostas e conexões continuam iguais depois de salvar e reabrir", async () => {
            const g = graphFor("poll");
            g.nodes[1].data.options = [OPTIONS[2], OPTIONS[0], OPTIONS[1]]; // reordered: ids (and so connections) travel with the text
            await prisma.flow.update({ where: { id: flow.id }, data: { draftGraph: g } });
            const back = (await prisma.flow.findUniqueOrThrow({ where: { id: flow.id } })).draftGraph as any;
            const m = back.nodes.find((n: any) => n.id === "m");
            assert.equal(m.data.mode, "poll");
            assert.deepEqual(m.data.options.map((o: any) => o.id), ["o-suporte", "o-conhecer", "o-aluno"]);
            assert.equal(back.edges.find((e: any) => e.sourceHandle === "option:o-aluno").target, "p-o-aluno");
            const jid = "5511987650009@s.whatsapp.net";
            sent.length = 0;
            await engine.startTestRun({ flowId: flow.id, graph: back, dbSessionId, sessionId: SESSION, jid });
            const poll = ((await lastRun(jid)).wait as any).poll;
            assert.deepEqual(sent[0].payload.poll.values, ["Falar com o suporte", "Conhecer o produto", "Já sou aluno"]);
            await vote(poll.id, poll.secret, "5500000000000@s.whatsapp.net", jid, "Já sou aluno", { remoteJid: jid });
            assert.equal(lastSentText(), "caminho o-aluno", "reordenar não troca a conexão");
        });

        console.log(report.join("\n"));
        console.log(`\nmenu (enquete + número): ${report.length} cenários aprovados`);
    } finally {
        await prisma.flowRun.deleteMany({ where: { sessionId: dbSessionId } });
        await prisma.contactFlowData.deleteMany({ where: { sessionId: dbSessionId } });
        await prisma.message.deleteMany({ where: { sessionId: dbSessionId } });
        await prisma.session.delete({ where: { id: dbSessionId } });
        await prisma.$disconnect();
    }
}

main().catch(e => { console.error(report.join("\n")); console.error(e); process.exit(1); });
