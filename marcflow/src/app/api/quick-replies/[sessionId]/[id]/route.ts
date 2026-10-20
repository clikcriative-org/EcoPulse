import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { parseActions } from "@/modules/quick-replies/logic";

type P = { params: Promise<{ sessionId: string; id: string }> };

async function resolve(request: NextRequest, params: P["params"]) {
    const { sessionId, id } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const reply = await prisma.quickReply.findFirst({ where: { id, sessionId: r.session.id } });
    return reply ? { ...r, reply } : fail("Resposta rápida não encontrada", 404);
}

export async function PATCH(request: NextRequest, { params }: P) {
    const r = await resolve(request, params);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const data: { title?: string; actions?: object; categoryId?: string | null } = {};
    if (body.title !== undefined) {
        data.title = String(body.title).trim().slice(0, 120);
        if (!data.title) return fail("Informe o título da resposta rápida");
    }
    if (body.actions !== undefined) {
        try { data.actions = parseActions(body.actions); } catch (e) { return fail((e as Error).message); }
    }
    if (body.categoryId !== undefined) {
        data.categoryId = body.categoryId ? String(body.categoryId) : null;
        if (data.categoryId && !(await prisma.quickReplyCategory.findFirst({ where: { id: data.categoryId, sessionId: r.session.id } }))) return fail("Categoria não encontrada");
    }
    const reply = await prisma.quickReply.update({ where: { id: r.reply.id }, data, include: { category: true } });
    return ok(reply, "Resposta rápida salva");
}

export async function DELETE(request: NextRequest, { params }: P) {
    const r = await resolve(request, params);
    if (r instanceof NextResponse) return r;
    await prisma.quickReply.delete({ where: { id: r.reply.id } });
    return ok(null, "Resposta rápida excluída");
}
