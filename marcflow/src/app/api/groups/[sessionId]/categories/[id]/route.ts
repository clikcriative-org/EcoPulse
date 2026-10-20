import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { categoryKey, cleanCategoryName, isCategoryIcon, isHexColor } from "@/modules/groups/categories";

type P = { params: Promise<{ sessionId: string; id: string }> };

async function resolve(request: NextRequest, params: P["params"]) {
    const { sessionId, id } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const cat = await prisma.groupCategory.findFirst({ where: { id, sessionId: r.session.id } });
    return cat ? { ...r, cat } : fail("Categoria não encontrada", 404);
}

export async function PATCH(request: NextRequest, { params }: P) {
    const r = await resolve(request, params);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const data: { name?: string; nameKey?: string; color?: string; icon?: string | null } = {};
    if (body.name !== undefined) {
        const name = cleanCategoryName(String(body.name)).slice(0, 40);
        if (!name) return fail("Informe o nome da categoria");
        const nameKey = categoryKey(name);
        if (["todos", "sem categoria"].includes(nameKey)) return fail("Esse nome é reservado pelo sistema");
        const clash = await prisma.groupCategory.findUnique({ where: { sessionId_nameKey: { sessionId: r.session.id, nameKey } } });
        if (clash && clash.id !== r.cat.id) return fail("Já existe uma categoria com esse nome", 409);
        Object.assign(data, { name, nameKey });
    }
    if (body.color !== undefined) {
        if (!isHexColor(body.color)) return fail("Cor inválida");
        data.color = body.color;
    }
    if (body.icon !== undefined) data.icon = isCategoryIcon(body.icon) ? body.icon : null;
    const cat = await prisma.groupCategory.update({ where: { id: r.cat.id }, data, include: { _count: { select: { links: true } } } });
    return ok({ id: cat.id, name: cat.name, color: cat.color, icon: cat.icon, groupCount: cat._count.links }, "Categoria salva");
}

/** Groups in it go back to "Sem categoria" (links cascade); nothing changes on WhatsApp. */
export async function DELETE(request: NextRequest, { params }: P) {
    const r = await resolve(request, params);
    if (r instanceof NextResponse) return r;
    const affected = await prisma.groupCategoryLink.count({ where: { categoryId: r.cat.id } });
    await prisma.groupCategory.delete({ where: { id: r.cat.id } });
    return ok({ affected }, "Categoria excluída");
}
