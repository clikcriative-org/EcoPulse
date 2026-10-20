import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { cancelRun } from "@/modules/flows/engine";

type P = { params: Promise<{ sessionId: string; runId: string }> };

async function load(request: NextRequest, sessionId: string, runId: string) {
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const run = await prisma.flowRun.findFirst({ where: { id: runId, sessionId: r.session.id }, include: { logs: { orderBy: { createdAt: "asc" }, take: 500 } } });
    return run ?? fail("Execução não encontrada", 404);
}

export async function GET(request: NextRequest, { params }: P) {
    const { sessionId, runId } = await params;
    const run = await load(request, sessionId, runId);
    if (run instanceof NextResponse) return run;
    const { graph, ...rest } = run;
    return ok({ ...rest, nodes: (graph as { nodes?: { id: string; type: string }[] })?.nodes?.map(n => ({ id: n.id, type: n.type })) ?? [] });
}

/** Cancels an active run. */
export async function DELETE(request: NextRequest, { params }: P) {
    const { sessionId, runId } = await params;
    const run = await load(request, sessionId, runId);
    if (run instanceof NextResponse) return run;
    const done = await cancelRun(run.id);
    return done ? ok(null, "Execução cancelada") : fail("A execução já terminou");
}
