import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, resolveFlow } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string; flowId: string }> };

export async function POST(request: NextRequest, { params }: P) {
    const { sessionId, flowId } = await params;
    const r = await resolveFlow(request, sessionId, flowId);
    if (r instanceof NextResponse) return r;
    const copy = await prisma.flow.create({
        data: { sessionId: r.session.id, name: `${r.flow.name} (cópia)`.slice(0, 120), draftGraph: r.flow.draftGraph as object },
    });
    return ok(copy, "Fluxo duplicado");
}
