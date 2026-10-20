import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, resolveSession } from "@/lib/flow-api";
import { archiveStats, jobJids } from "@/modules/archive/import";

type P = { params: Promise<{ sessionId: string }> };

/** Latest export job of the session with its progress numbers (scoped to the chats it selected). */
export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const { waManager } = await import("@/modules/whatsapp/manager");
    const job = await prisma.archiveJob.findFirst({ where: { sessionId: r.session.id }, orderBy: { createdAt: "desc" } });
    const stats = job ? await archiveStats(r.session.id, jobJids(job)) : null;
    return ok({ job: job && { ...job, selected: jobJids(job)?.length ?? null }, stats, connected: waManager.getInstance(sessionId)?.status === "CONNECTED" });
}
