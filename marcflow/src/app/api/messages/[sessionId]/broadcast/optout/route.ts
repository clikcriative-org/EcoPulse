import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string }> };

/** PUT { jid, optedOut } — marks a contact as unsubscribed from broadcasts (or reactivates it). */
export async function PUT(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const jid = String(body.jid || "");
    if (!/@(s\.whatsapp\.net|lid)$/.test(jid)) return fail("Contato inválido");
    if (body.optedOut) await prisma.broadcastOptOut.upsert({ where: { sessionId_jid: { sessionId, jid } }, create: { sessionId, jid }, update: {} });
    else await prisma.broadcastOptOut.deleteMany({ where: { sessionId, jid } });
    return ok({ jid, optedOut: !!body.optedOut }, body.optedOut ? "Contato descadastrado das transmissões" : "Contato reativado para transmissões");
}
