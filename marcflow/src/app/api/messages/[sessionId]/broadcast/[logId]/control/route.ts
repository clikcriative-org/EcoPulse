import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { controlBroadcast } from "@/modules/broadcast/runner";

type P = { params: Promise<{ sessionId: string; logId: string }> };

/** POST { action: "pause" | "resume" | "cancel" } */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId, logId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    if (!(await prisma.broadcastLog.findFirst({ where: { id: logId, sessionId } }))) return fail("Transmissão não encontrada", 404);
    const body = await request.json().catch(() => ({}));
    const action = body.action;
    if (!["pause", "resume", "cancel"].includes(action)) return fail("Ação inválida");
    const res = await controlBroadcast(logId, action);
    if (res.error) return fail(res.error, 409);
    return ok({ status: res.status }, action === "pause" ? "Transmissão pausada" : action === "resume" ? "Transmissão retomada" : "Transmissão cancelada");
}
