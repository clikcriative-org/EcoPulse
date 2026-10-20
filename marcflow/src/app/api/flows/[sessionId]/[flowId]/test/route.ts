import { NextRequest, NextResponse } from "next/server";
import { ok, fail, resolveFlow } from "@/lib/flow-api";
import { validateGraph, type FlowGraph } from "@/modules/flows/types";
import { startTestRun } from "@/modules/flows/engine";
import { waManager } from "@/modules/whatsapp/manager";
import { logger } from "@/lib/logger";

type P = { params: Promise<{ sessionId: string; flowId: string }> };

/** Runs the DRAFT for one phone number. Sends real WhatsApp messages. */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId, flowId } = await params;
    const r = await resolveFlow(request, sessionId, flowId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const digits = String(body.phone || "").replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return fail("Informe o número com DDI e DDD, ex.: 5521999999999");
    const graph = r.flow.draftGraph as unknown as FlowGraph;
    const issues = validateGraph(graph);
    if (issues.some(i => i.level === "error")) return fail("Corrija os erros antes de testar", 422, { issues });
    const inst = waManager.getInstance(sessionId);
    if (!inst?.socket || inst.status !== "CONNECTED") return fail("A sessão do WhatsApp não está conectada", 409);

    startTestRun({ flowId, graph, dbSessionId: r.session.id, sessionId, jid: `${digits}@s.whatsapp.net` })
        .catch(e => logger.error("Flow", "test run failed", e));
    return ok({ phone: digits }, "Teste iniciado: as mensagens estão sendo enviadas");
}
