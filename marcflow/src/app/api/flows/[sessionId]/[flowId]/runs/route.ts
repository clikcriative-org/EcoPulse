import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, resolveFlow } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string; flowId: string }> };

export async function GET(request: NextRequest, { params }: P) {
    const { sessionId, flowId } = await params;
    const r = await resolveFlow(request, sessionId, flowId);
    if (r instanceof NextResponse) return r;
    const runs = await prisma.flowRun.findMany({
        where: { flowId },
        select: { id: true, contactJid: true, status: true, isTest: true, currentNodeId: true, resumeAt: true, error: true, startedAt: true, updatedAt: true },
        orderBy: { startedAt: "desc" },
        take: 100,
    });
    const contacts = await prisma.contact.findMany({
        where: { sessionId: r.session.id, jid: { in: [...new Set(runs.map(x => x.contactJid))] } },
        select: { jid: true, name: true, notify: true },
    });
    return ok(runs.map(x => {
        const c = contacts.find(c => c.jid === x.contactJid);
        return { ...x, contactName: c?.name || c?.notify || null };
    }));
}
