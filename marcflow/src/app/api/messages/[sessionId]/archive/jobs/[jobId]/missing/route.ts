import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { listMissing, paramsFromJob } from "@/modules/archive/export";

type P = { params: Promise<{ sessionId: string; jobId: string }> };

/** GET ?tz= — exactly what is missing, unavailable or failed in this export (first 300; the full list is RELATORIO.txt in the ZIP). */
export async function GET(request: NextRequest, { params }: P) {
    const { sessionId, jobId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const job = await prisma.archiveJob.findFirst({ where: { id: jobId, sessionId: r.session.id } });
    if (!job) return fail("Exportação não encontrada", 404);
    return ok(await listMissing(paramsFromJob(job, request.nextUrl.searchParams.get("tz") || "America/Sao_Paulo"), 300));
}
