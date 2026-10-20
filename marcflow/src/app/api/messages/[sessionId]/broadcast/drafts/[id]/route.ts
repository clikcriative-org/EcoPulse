import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { draftData } from "../shape";

type P = { params: Promise<{ sessionId: string; id: string }> };

export async function PUT(request: NextRequest, { params }: P) {
    const { sessionId, id } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    if (!(await prisma.broadcastDraft.findFirst({ where: { id, sessionId } }))) return fail("Rascunho não encontrado", 404);
    const parsed = draftData(await request.json().catch(() => ({})));
    if ("error" in parsed) return fail(parsed.error);
    return ok(await prisma.broadcastDraft.update({ where: { id }, data: parsed.data }), "Rascunho salvo");
}

export async function DELETE(request: NextRequest, { params }: P) {
    const { sessionId, id } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const res = await prisma.broadcastDraft.deleteMany({ where: { id, sessionId } });
    return res.count ? ok(null, "Rascunho excluído") : fail("Rascunho não encontrado", 404);
}
