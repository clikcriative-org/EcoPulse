import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { emptyGraph } from "@/modules/flows/types";

type P = { params: Promise<{ sessionId: string }> };

export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const flows = await prisma.flow.findMany({
        where: { sessionId: r.session.id },
        select: { id: true, name: true, status: true, publishedAt: true, createdAt: true, updatedAt: true, triggers: true },
        orderBy: { updatedAt: "desc" },
    });
    const active = await prisma.flowRun.groupBy({
        by: ["flowId"],
        where: { sessionId: r.session.id, status: { in: ["RUNNING", "WAITING_INPUT", "WAITING_DELAY"] } },
        _count: true,
    });
    return ok(flows.map(f => ({ ...f, activeRuns: active.find(a => a.flowId === f.id)?._count ?? 0 })));
}

export async function POST(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) return fail("Informe o nome do fluxo");
    const flow = await prisma.flow.create({ data: { sessionId: r.session.id, name, draftGraph: emptyGraph() as object } });
    return ok(flow, "Fluxo criado");
}
