import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { parseActions } from "@/modules/quick-replies/logic";
import { runQuickReply } from "@/modules/quick-replies/run";
import type { QuickReplyAction } from "@/modules/quick-replies/types";

type P = { params: Promise<{ sessionId: string }> };

/** Sends a saved reply ({ replyId, jid }) or an edited one-off copy ({ replyId?, jid, actions }) to a chat. */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const jid = String(body.jid || "");
    if (!/@(s\.whatsapp\.net|g\.us|lid)$/.test(jid)) return fail("Conversa inválida");

    const reply = body.replyId ? await prisma.quickReply.findFirst({ where: { id: String(body.replyId), sessionId: r.session.id } }) : null;
    if (body.replyId && !reply) return fail("Resposta rápida não encontrada", 404);
    let actions: QuickReplyAction[];
    try { actions = body.actions !== undefined ? parseActions(body.actions) : parseActions(reply?.actions); } catch (e) { return fail((e as Error).message); }

    if (reply) await prisma.quickReply.update({ where: { id: reply.id }, data: { usageCount: { increment: 1 } } });
    runQuickReply({ sessionId, dbSessionId: r.session.id, jid, title: reply?.title || String(body.title || "Resposta rápida"), actions });
    return ok({ total: actions.length }, "Enviando resposta rápida");
}
