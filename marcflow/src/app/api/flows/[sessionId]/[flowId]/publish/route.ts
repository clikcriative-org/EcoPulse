import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveFlow } from "@/lib/flow-api";
import { validateGraph, type FlowGraph } from "@/modules/flows/types";

type P = { params: Promise<{ sessionId: string; flowId: string }> };

/** Copies the draft into the published graph and activates the flow. Conversations in progress keep their snapshot. */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId, flowId } = await params;
    const r = await resolveFlow(request, sessionId, flowId);
    if (r instanceof NextResponse) return r;
    const graph = r.flow.draftGraph as unknown as FlowGraph;
    const issues = validateGraph(graph);
    if (issues.some(i => i.level === "error")) return fail("Corrija os erros antes de publicar", 422, { issues });
    const flow = await prisma.flow.update({
        where: { id: flowId },
        data: { publishedGraph: graph as object, publishedAt: new Date(), status: "ACTIVE" },
    });
    return ok({ ...flow, issues }, "Fluxo publicado e ativado");
}
