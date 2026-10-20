import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string }> };

/** Bot fields ("Campos do robô") with their current values. Empty value = pending configuration. */
export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const [fields, values] = await Promise.all([
        prisma.fieldDefinition.findMany({ where: { sessionId: r.session.id, scope: "BOT" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
        prisma.botVariable.findMany({ where: { sessionId: r.session.id } }),
    ]);
    return ok(fields.map(f => ({ key: f.key, label: f.label, description: f.description, value: values.find(v => v.key === f.key)?.value ?? "" })));
}

/** Saves values: { values: { [key]: string } }. Only keys of existing bot fields; empty string clears. */
export async function PUT(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    if (!body.values || typeof body.values !== "object") return fail("Valores inválidos");
    const keys = new Set((await prisma.fieldDefinition.findMany({ where: { sessionId: r.session.id, scope: "BOT" }, select: { key: true } })).map(f => f.key));
    const entries = Object.entries(body.values as Record<string, unknown>).filter(([k]) => keys.has(k));
    for (const [key, raw] of entries) {
        const value = String(raw ?? "").trim().slice(0, 4000);
        if (!value) await prisma.botVariable.deleteMany({ where: { sessionId: r.session.id, key } });
        else await prisma.botVariable.upsert({ where: { sessionId_key: { sessionId: r.session.id, key } }, create: { sessionId: r.session.id, key, value }, update: { value } });
    }
    return ok({ saved: entries.length }, "Configurações salvas");
}
