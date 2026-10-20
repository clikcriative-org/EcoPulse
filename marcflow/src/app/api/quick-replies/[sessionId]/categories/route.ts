import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string }> };

export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    return ok(await prisma.quickReplyCategory.findMany({ where: { sessionId: r.session.id }, orderBy: { name: "asc" } }));
}

export async function POST(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim().slice(0, 60);
    if (!name) return fail("Informe o nome da categoria");
    const color = /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : "#25D366";
    if (await prisma.quickReplyCategory.findFirst({ where: { sessionId: r.session.id, name } })) return fail("Já existe uma categoria com esse nome");
    return ok(await prisma.quickReplyCategory.create({ data: { sessionId: r.session.id, name, color } }), "Categoria criada");
}

/** DELETE ?id=... — replies in it become "Sem categoria". */
export async function DELETE(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const id = request.nextUrl.searchParams.get("id") || "";
    const res = await prisma.quickReplyCategory.deleteMany({ where: { id, sessionId: r.session.id } });
    return res.count ? ok(null, "Categoria excluída") : fail("Categoria não encontrada", 404);
}
