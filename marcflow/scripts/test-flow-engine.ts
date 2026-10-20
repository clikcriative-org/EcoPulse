// End-to-end check of the flow engine against the real database with a fake WhatsApp socket.
// Creates a throwaway session + flow, simulates incoming messages, asserts what was "sent", then cleans up.
// Run: npx tsx scripts/test-flow-engine.ts
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const sent: { to: string; payload: any }[] = [];
const fakeSock = { sendMessage: async (to: string, payload: any) => { sent.push({ to, payload }); }, sendPresenceUpdate: async () => undefined };
(global as any).waManager = { getInstance: (id: string) => (id === SESSION ? { status: "CONNECTED", socket: fakeSock } : undefined) };

const SESSION = "flowtest-" + Date.now();
const JID = "5500000000001@s.whatsapp.net";
const texts = () => sent.map(s => s.payload.text ?? JSON.stringify(s.payload));
const lastText = () => texts()[texts().length - 1];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    const { prisma } = await import("../src/lib/prisma");
    const engine = await import("../src/modules/flows/engine");
    const user = await prisma.user.findFirst({ select: { id: true } });
    assert.ok(user, "precisa de um usuário no banco");
    const session = await prisma.session.create({ data: { userId: user.id, name: "Teste de fluxo", sessionId: SESSION, status: "CONNECTED" } });
    const label = await prisma.label.create({ data: { sessionId: SESSION, name: "Cliente teste" } });
    let msgN = 0;
    const incoming = async (text: string) => {
        const keyId = `K${++msgN}`;
        await prisma.message.create({ data: { sessionId: session.id, remoteJid: JID, fromMe: false, keyId, type: "TEXT", content: text, status: "PENDING", timestamp: new Date() } });
        engine.onIncomingMessage(SESSION, session.id, { remoteJid: JID, keyId, fromMe: false, type: "TEXT", content: text, mediaUrl: null });
        await sleep(700);
        return keyId;
    };

    try {
        const graph = {
            nodes: [
                { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
                { id: "c1", type: "content", position: { x: 0, y: 0 }, data: { items: [
                    { id: "t1", kind: "text", text: "Olá {primeiro-nome}!" },
                    { id: "d1", kind: "delay", seconds: 1, typing: true },
                    { id: "q1", kind: "input", question: "Qual seu e-mail?", answerType: "email", fieldKey: "email", fieldScope: "CONTACT", expireValue: 1, expireUnit: "days", errorMessage: "E-mail inválido", maxAttempts: 3 },
                    { id: "t2", kind: "text", text: "Anotado: {email}" },
                ] } },
                { id: "a1", type: "action", position: { x: 0, y: 0 }, data: { actions: [
                    { id: "x1", type: "addTag", labelId: label.id },
                    { id: "x2", type: "setField", fieldKey: "origem", fieldScope: "CONTACT", value: "fluxo {email}" },
                ] } },
                { id: "cond", type: "condition", position: { x: 0, y: 0 }, data: { logic: "and", conditions: [{ id: "k1", source: "tag", op: "is", value: label.id }] } },
                { id: "m1", type: "menu", position: { x: 0, y: 0 }, data: { question: "Escolha:", invalidText: "Inválido", maxErrors: 2, options: [{ id: "o1", text: "Preços" }, { id: "o2", text: "Esperar" }], expireValue: 1, expireUnit: "days" } },
                { id: "p1", type: "content", position: { x: 0, y: 0 }, data: { items: [{ id: "t3", kind: "text", text: "Preços: R$10 ({origem})" }] } },
                { id: "w1", type: "smartDelay", position: { x: 0, y: 0 }, data: { mode: "duration", value: 5, unit: "minutes" } },
                { id: "v1", type: "content", position: { x: 0, y: 0 }, data: { items: [{ id: "t4", kind: "text", text: "Voltei" }] } },
                { id: "no", type: "content", position: { x: 0, y: 0 }, data: { items: [{ id: "t5", kind: "text", text: "Sem etiqueta" }] } },
                { id: "err", type: "content", position: { x: 0, y: 0 }, data: { items: [{ id: "t6", kind: "text", text: "Muitos erros" }] } },
            ],
            edges: [
                { id: "e1", source: "start", sourceHandle: "next", target: "c1" },
                { id: "e2", source: "c1", sourceHandle: "next", target: "a1" },
                { id: "e3", source: "a1", sourceHandle: "next", target: "cond" },
                { id: "e4", source: "cond", sourceHandle: "true", target: "m1" },
                { id: "e5", source: "cond", sourceHandle: "false", target: "no" },
                { id: "e6", source: "m1", sourceHandle: "option:o1", target: "p1" },
                { id: "e7", source: "m1", sourceHandle: "option:o2", target: "w1" },
                { id: "e8", source: "w1", sourceHandle: "next", target: "v1" },
                { id: "e9", source: "m1", sourceHandle: "error", target: "err" },
            ],
        };
        const flow = await prisma.flow.create({ data: { sessionId: session.id, name: "Fluxo de teste", status: "ACTIVE", draftGraph: graph, publishedGraph: graph, publishedAt: new Date() } });
        await prisma.flowTrigger.create({ data: { flowId: flow.id, type: "KEYWORD", keyword: "oi", matchType: "EXACT" } });

        // 1) unrelated text does not start the flow
        await incoming("bom dia");
        assert.equal(sent.length, 0, "texto sem gatilho não deve iniciar fluxo");
        assert.equal(await engine.shouldSuppressAutoReply(SESSION, [JID], "bom dia"), false);
        assert.equal(await engine.shouldSuppressAutoReply(SESSION, [JID], "Oi"), true, "auto-reply deve calar quando a palavra-chave é de um fluxo");

        // 2) keyword (case/accent-insensitive) starts it; greeting + question, then waits
        await incoming("OI");
        await sleep(1500); // 1 s typing delay
        assert.deepEqual(texts(), ["Olá !", "Qual seu e-mail?"]);
        let run = await prisma.flowRun.findFirstOrThrow({ where: { flowId: flow.id } });
        assert.equal(run.status, "WAITING_INPUT");
        assert.equal(await engine.shouldSuppressAutoReply(SESSION, [JID], "qualquer"), true, "auto-reply deve calar com execução ativa");

        // 3) invalid answer -> error message, still waiting
        await incoming("nao sei");
        assert.equal(lastText(), "E-mail inválido");

        // 4) valid answer -> saved, rest of the block, actions, condition true -> menu
        await incoming("Ana@Mail.com");
        assert.ok(texts().includes("Anotado: ana@mail.com"), texts().join(" | "));
        assert.ok(lastText().startsWith("Escolha:\n\n1. Preços\n2. Esperar"), lastText());
        const fd = await prisma.contactFlowData.findUniqueOrThrow({ where: { sessionId_contactJid: { sessionId: session.id, contactJid: JID } } });
        assert.equal((fd.fields as any).email, "ana@mail.com");
        assert.equal((fd.fields as any).origem, "fluxo ana@mail.com");
        assert.equal(await prisma.chatLabel.count({ where: { labelId: label.id, chatJid: JID } }), 1, "etiqueta aplicada");

        // 5) menu: invalid once, then option by text
        await incoming("9");
        assert.equal(lastText(), "Inválido");
        await incoming("preços");
        assert.equal(lastText(), "Preços: R$10 (fluxo ana@mail.com)");
        run = await prisma.flowRun.findUniqueOrThrow({ where: { id: run.id } });
        assert.equal(run.status, "COMPLETED");
        const optStat = await prisma.flowNodeStat.findUnique({ where: { flowId_nodeId_key: { flowId: flow.id, nodeId: "m1", key: "option:o1" } } });
        assert.equal(optStat?.count, 1, "estatística da opção");

        // 6) new run: menu error exit after 2 errors
        sent.length = 0;
        await incoming("oi"); await sleep(1500);
        await incoming("x@y.com");
        await incoming("abc"); await incoming("def");
        assert.equal(lastText(), "Muitos erros");

        // 7) new run: smart delay waits, then resumes via tick
        sent.length = 0;
        await incoming("oi"); await sleep(1500);
        await incoming("x@y.com");
        await incoming("2");
        run = await prisma.flowRun.findFirstOrThrow({ where: { flowId: flow.id }, orderBy: { startedAt: "desc" } });
        assert.equal(run.status, "WAITING_DELAY");
        await incoming("mensagem durante a espera"); // ignored
        assert.ok(!texts().includes("Voltei"));
        await prisma.flowRun.update({ where: { id: run.id }, data: { resumeAt: new Date(Date.now() - 1000) } });
        await engine.tick(); await sleep(500);
        assert.equal(lastText(), "Voltei");
        assert.equal((await prisma.flowRun.findUniqueOrThrow({ where: { id: run.id } })).status, "COMPLETED");

        // 8) input timeout path: no edge -> EXPIRED
        sent.length = 0;
        await incoming("oi"); await sleep(1500);
        run = await prisma.flowRun.findFirstOrThrow({ where: { flowId: flow.id }, orderBy: { startedAt: "desc" } });
        await prisma.flowRun.update({ where: { id: run.id }, data: { resumeAt: new Date(Date.now() - 1000) } });
        await engine.tick(); await sleep(300);
        assert.equal((await prisma.flowRun.findUniqueOrThrow({ where: { id: run.id } })).status, "EXPIRED");

        // 9) loop protection
        const loop = { nodes: [
            { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
            { id: "r", type: "action", position: { x: 0, y: 0 }, data: { actions: [{ id: "z", type: "resumeAutomation" }] } },
        ], edges: [{ id: "a", source: "start", sourceHandle: "next", target: "r" }, { id: "b", source: "r", sourceHandle: "next", target: "r" }] };
        const loopFlow = await prisma.flow.create({ data: { sessionId: session.id, name: "Loop", draftGraph: loop } });
        await engine.startTestRun({ flowId: loopFlow.id, graph: loop as any, dbSessionId: session.id, sessionId: SESSION, jid: "5500000000002@s.whatsapp.net" });
        const lr = await prisma.flowRun.findFirstOrThrow({ where: { flowId: loopFlow.id } });
        assert.equal(lr.status, "FAILED");
        assert.match(lr.error || "", /ciclo|Limite/);

        // 10) logs exist
        assert.ok(await prisma.flowRunLog.count({ where: { runId: run.id } }) > 2);

        console.log("flow engine: all end-to-end checks passed");
    } finally {
        await prisma.contactFlowData.deleteMany({ where: { sessionId: session.id } });
        await prisma.flowRun.deleteMany({ where: { sessionId: session.id } }); // explicit: do not rely on cascade alone
        await prisma.flowNodeStat.deleteMany({ where: { flowId: { in: (await prisma.flow.findMany({ where: { sessionId: session.id }, select: { id: true } })).map(f => f.id) } } });
        await prisma.chatLabel.deleteMany({ where: { labelId: label.id } });
        await prisma.label.delete({ where: { id: label.id } });
        await prisma.message.deleteMany({ where: { sessionId: session.id } });
        await prisma.session.delete({ where: { id: session.id } }); // cascades flows, triggers, runs, logs
        await prisma.$disconnect();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
