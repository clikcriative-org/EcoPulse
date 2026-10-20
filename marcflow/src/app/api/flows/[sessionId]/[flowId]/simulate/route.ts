import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveFlow } from "@/lib/flow-api";
import { validateGraph, type FlowGraph } from "@/modules/flows/types";
import { resetSimulation, simulateIncoming } from "@/modules/flows/engine";

type P = { params: Promise<{ sessionId: string; flowId: string }> };

/** Chat preview of the DRAFT: { text } sends one message as a simulated contact, { reset: true } starts over. Nothing goes to WhatsApp. */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId, flowId } = await params;
    const r = await resolveFlow(request, sessionId, flowId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const jid = `sim-${r.user.id}@sim`; // one simulated contact per user and session

    if (body.reset) {
        await resetSimulation(r.session.id, sessionId, jid);
        return ok(null, "Simulação reiniciada");
    }
    const text = String(body.text || "").trim().slice(0, 1000);
    if (!text) return fail("Escreva uma mensagem");
    const graph = r.flow.draftGraph as unknown as FlowGraph;
    if (validateGraph(graph).some(i => i.level === "error")) return fail("Corrija os erros do fluxo antes de simular", 422);

    const since = new Date();
    const triggers = await prisma.flowTrigger.findMany({ where: { flowId } });
    const outcome = await simulateIncoming({ flowId, graph, triggers, dbSessionId: r.session.id, sessionId, jid, text });
    const logs = await prisma.flowRunLog.findMany({
        where: { createdAt: { gte: since }, event: { in: ["SEND", "ERROR"] }, run: { sessionId: r.session.id, contactJid: jid } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const run = await prisma.flowRun.findFirst({ where: { sessionId: r.session.id, contactJid: jid }, orderBy: { startedAt: "desc" }, select: { status: true, error: true } });
    const names = new Map(graph.nodes.map(n => [n.id, n.data.name]));
    return ok({
        outcome,
        status: run?.status ?? null,
        error: run?.error ?? null,
        messages: logs.map(l => {
            const d = (l.detail || {}) as { text?: string; summary?: string; to?: string; error?: string };
            return { kind: l.event === "ERROR" ? "error" : d.to ? "internal" : "bot", text: d.error || d.text || d.summary || "", to: d.to, block: l.nodeId ? names.get(l.nodeId) : undefined };
        }),
    });
}
