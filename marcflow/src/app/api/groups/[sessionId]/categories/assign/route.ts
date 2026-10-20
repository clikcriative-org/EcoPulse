import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string }> };

/** PUT { jids: string[], categoryId: string | null } — one transaction for many groups (internal to MarcFlow). */
export async function PUT(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const jids: string[] = Array.isArray(body.jids) ? [...new Set(body.jids.map(String))] as string[] : [];
    if (!jids.length || jids.length > 1000 || jids.some(j => !j.endsWith("@g.us"))) return fail("Lista de grupos inválida");
    const categoryId = body.categoryId ? String(body.categoryId) : null;
    if (categoryId && !(await prisma.groupCategory.findFirst({ where: { id: categoryId, sessionId: r.session.id } }))) return fail("Categoria não encontrada", 404);

    await prisma.$transaction(async tx => {
        await tx.groupCategoryLink.deleteMany({ where: { sessionId: r.session.id, groupJid: { in: jids } } });
        if (categoryId) await tx.groupCategoryLink.createMany({ data: jids.map(groupJid => ({ sessionId: r.session.id, groupJid, categoryId })) });
    });
    return ok({ jids, categoryId }, categoryId ? `${jids.length} grupo(s) movido(s)` : `${jids.length} grupo(s) sem categoria`);
}
