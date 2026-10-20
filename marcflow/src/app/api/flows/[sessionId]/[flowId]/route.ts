import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveFlow } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string; flowId: string }> };
const TRIGGER_TYPES = ["KEYWORD", "FIRST_MESSAGE", "ANY_MESSAGE"];
const MATCH_TYPES = ["EXACT", "WORD", "CONTAINS", "REGEX"];

export async function GET(request: NextRequest, { params }: P) {
    const { sessionId, flowId } = await params;
    const r = await resolveFlow(request, sessionId, flowId);
    if (r instanceof NextResponse) return r;
    const [triggers, stats] = await Promise.all([
        prisma.flowTrigger.findMany({ where: { flowId }, orderBy: { priority: "desc" } }),
        prisma.flowNodeStat.findMany({ where: { flowId } }),
    ]);
    return ok({ ...r.flow, triggers, stats });
}

export async function PATCH(request: NextRequest, { params }: P) {
    const { sessionId, flowId } = await params;
    const r = await resolveFlow(request, sessionId, flowId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const data: { name?: string; status?: "ACTIVE" | "PAUSED" | "DRAFT" } = {};

    if (body.name !== undefined) {
        const name = String(body.name).trim().slice(0, 120);
        if (!name) return fail("O nome não pode ficar vazio");
        data.name = name;
    }
    if (body.status !== undefined) {
        if (!["ACTIVE", "PAUSED"].includes(body.status)) return fail("Status inválido");
        if (body.status === "ACTIVE" && !r.flow.publishedGraph) return fail("Publique o fluxo antes de ativar");
        data.status = body.status;
    }
    if (body.triggers !== undefined) {
        if (!Array.isArray(body.triggers)) return fail("Gatilhos inválidos");
        const triggers = body.triggers.map((t: { type?: string; keyword?: string; matchType?: string; priority?: number }) => ({
            type: String(t.type), keyword: t.keyword ? String(t.keyword).slice(0, 200) : null,
            matchType: t.type === "KEYWORD" ? String(t.matchType || "EXACT") : null, priority: Number(t.priority) || 0,
        }));
        for (const t of triggers) {
            if (!TRIGGER_TYPES.includes(t.type)) return fail("Tipo de gatilho inválido");
            if (t.type === "KEYWORD" && (!t.keyword || !MATCH_TYPES.includes(t.matchType!))) return fail("Gatilho de palavra-chave incompleto");
            if (t.matchType === "REGEX") { try { new RegExp(t.keyword!); } catch { return fail(`Expressão regular inválida: ${t.keyword}`); } }
        }
        await prisma.$transaction([
            prisma.flowTrigger.deleteMany({ where: { flowId } }),
            prisma.flowTrigger.createMany({ data: triggers.map((t: object) => ({ ...t, flowId })) }),
        ]);
    }
    const flow = Object.keys(data).length ? await prisma.flow.update({ where: { id: flowId }, data }) : r.flow;
    const triggers = await prisma.flowTrigger.findMany({ where: { flowId }, orderBy: { priority: "desc" } });
    return ok({ ...flow, triggers }, "Fluxo atualizado");
}

export async function DELETE(request: NextRequest, { params }: P) {
    const { sessionId, flowId } = await params;
    const r = await resolveFlow(request, sessionId, flowId);
    if (r instanceof NextResponse) return r;
    await prisma.$transaction([
        prisma.flowNodeStat.deleteMany({ where: { flowId } }),
        prisma.flow.delete({ where: { id: flowId } }),
    ]);
    return ok(null, "Fluxo excluído");
}
