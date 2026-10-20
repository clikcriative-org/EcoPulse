import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { SYSTEM_FIELDS } from "@/modules/flows/types";

type P = { params: Promise<{ sessionId: string }> };

/** Creates a contact ("CONTACT") or bot ("BOT") field. Key is derived from the label. */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const label = String(body.label || "").trim().slice(0, 60);
    const type = String(body.type || "TEXT");
    const scope = String(body.scope || "CONTACT");
    if (!label) return fail("Informe o nome do campo");
    if (!["TEXT", "NUMBER", "DATE", "DATETIME"].includes(type)) return fail("Tipo inválido");
    if (!["CONTACT", "BOT"].includes(scope)) return fail("Escopo inválido");
    const key = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!key) return fail("Nome do campo inválido");
    if (SYSTEM_FIELDS.some(f => f.key === key)) return fail("Esse nome é reservado para um campo do sistema");
    const exists = await prisma.fieldDefinition.findUnique({ where: { sessionId_scope_key: { sessionId: r.session.id, scope, key } } });
    if (exists) return fail("Já existe um campo com esse nome", 409);
    const field = await prisma.fieldDefinition.create({
        data: { sessionId: r.session.id, key, label, type, scope, description: body.description ? String(body.description).slice(0, 300) : null },
    });
    return ok(field, "Campo criado");
}

export async function DELETE(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const id = request.nextUrl.searchParams.get("id") || "";
    const res = await prisma.fieldDefinition.deleteMany({ where: { id, sessionId: r.session.id } });
    return res.count ? ok(null, "Campo excluído") : fail("Campo não encontrado", 404);
}
