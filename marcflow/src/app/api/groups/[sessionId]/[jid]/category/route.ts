import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string; jid: string }> };

/** PUT { categoryId: string | null } — sets or clears the group's category (internal to MarcFlow). */
export async function PUT(request: NextRequest, { params }: P) {
    const { sessionId, jid: rawJid } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const groupJid = decodeURIComponent(rawJid);
    if (!groupJid.endsWith("@g.us")) return fail("Grupo inválido");
    const body = await request.json().catch(() => ({}));
    const categoryId = body.categoryId ? String(body.categoryId) : null;

    if (!categoryId) {
        await prisma.groupCategoryLink.deleteMany({ where: { sessionId: r.session.id, groupJid } });
        return ok({ groupJid, categoryId: null }, "Grupo sem categoria");
    }
    const cat = await prisma.groupCategory.findFirst({ where: { id: categoryId, sessionId: r.session.id } });
    if (!cat) return fail("Categoria não encontrada", 404);
    await prisma.groupCategoryLink.upsert({
        where: { sessionId_groupJid: { sessionId: r.session.id, groupJid } },
        create: { sessionId: r.session.id, groupJid, categoryId },
        update: { categoryId },
    });
    return ok({ groupJid, categoryId }, `Grupo movido para "${cat.name}"`);
}
