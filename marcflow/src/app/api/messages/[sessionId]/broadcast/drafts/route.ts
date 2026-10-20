import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { draftData } from "./shape";

type P = { params: Promise<{ sessionId: string }> };

export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    return ok(await prisma.broadcastDraft.findMany({ where: { sessionId }, orderBy: { updatedAt: "desc" } }));
}

export async function POST(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const parsed = draftData(await request.json().catch(() => ({})));
    if ("error" in parsed) return fail(parsed.error);
    return ok(await prisma.broadcastDraft.create({ data: { sessionId, ...parsed.data } }), "Rascunho salvo");
}
