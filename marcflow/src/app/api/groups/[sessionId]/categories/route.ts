import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { categoryKey, cleanCategoryName, isCategoryIcon, isHexColor } from "@/modules/groups/categories";

type P = { params: Promise<{ sessionId: string }> };

/** Categories of this session, with how many groups each holds. */
export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const cats = await prisma.groupCategory.findMany({ where: { sessionId: r.session.id }, include: { _count: { select: { links: true } } }, orderBy: { name: "asc" } });
    return ok(cats.map(c => ({ id: c.id, name: c.name, color: c.color, icon: c.icon, groupCount: c._count.links })));
}

export async function POST(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const name = cleanCategoryName(String(body.name || "")).slice(0, 40);
    if (!name) return fail("Informe o nome da categoria");
    if (["todos", "sem categoria"].includes(categoryKey(name))) return fail("Esse nome é reservado pelo sistema");
    const nameKey = categoryKey(name);
    if (await prisma.groupCategory.findUnique({ where: { sessionId_nameKey: { sessionId: r.session.id, nameKey } } })) return fail("Já existe uma categoria com esse nome", 409);
    const cat = await prisma.groupCategory.create({
        data: { sessionId: r.session.id, name, nameKey, color: isHexColor(body.color) ? body.color : "#10B981", icon: isCategoryIcon(body.icon) ? body.icon : null },
    });
    return ok({ id: cat.id, name: cat.name, color: cat.color, icon: cat.icon, groupCount: 0 }, "Categoria criada");
}
