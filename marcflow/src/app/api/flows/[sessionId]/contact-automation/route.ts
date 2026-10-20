import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string }> };

async function contact(request: NextRequest, sessionId: string) {
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const jid = request.nextUrl.searchParams.get("jid") || "";
    if (!jid || jid.endsWith("@g.us")) return fail("Contato inválido");
    return { ...r, jid };
}

/** Whether flows and auto-reply are paused for a contact (e.g. a flow handed the chat to a human). */
export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await contact(request, sessionId);
    if (r instanceof NextResponse) return r;
    const fd = await prisma.contactFlowData.findUnique({ where: { sessionId_contactJid: { sessionId: r.session.id, contactJid: r.jid } }, select: { pausedUntil: true } });
    const paused = !!fd?.pausedUntil && fd.pausedUntil > new Date();
    return ok({ paused, pausedUntil: paused ? fd!.pausedUntil : null });
}

/** Attendant resumes automations for the contact. */
export async function DELETE(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await contact(request, sessionId);
    if (r instanceof NextResponse) return r;
    const where = { sessionId_contactJid: { sessionId: r.session.id, contactJid: r.jid } };
    const fd = await prisma.contactFlowData.findUnique({ where });
    if (!fd) return ok(null, "Automação já está ativa");
    const fields = { ...((fd.fields as Record<string, string>) || {}) };
    // flows that hand off to a human mark this field; clear it so their conditions see the bot as active again
    if ("atendimento_humano_ativo" in fields) fields.atendimento_humano_ativo = "nao";
    await prisma.contactFlowData.update({ where, data: { pausedUntil: null, fields } });
    return ok(null, "Robô reativado para este contato");
}
