import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { parseActions } from "@/modules/quick-replies/logic";

type P = { params: Promise<{ sessionId: string }> };

export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const replies = await prisma.quickReply.findMany({ where: { sessionId: r.session.id }, include: { category: true }, orderBy: { title: "asc" } });
    return ok(replies);
}

export async function POST(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const title = String(body.title || "").trim().slice(0, 120);
    if (!title) return fail("Informe o título da resposta rápida");
    let actions;
    try { actions = parseActions(body.actions); } catch (e) { return fail((e as Error).message); }
    const categoryId = body.categoryId ? String(body.categoryId) : null;
    if (categoryId && !(await prisma.quickReplyCategory.findFirst({ where: { id: categoryId, sessionId: r.session.id } }))) return fail("Categoria não encontrada");
    const reply = await prisma.quickReply.create({ data: { sessionId: r.session.id, title, categoryId, actions }, include: { category: true } });
    return ok(reply, "Resposta rápida criada");
}
