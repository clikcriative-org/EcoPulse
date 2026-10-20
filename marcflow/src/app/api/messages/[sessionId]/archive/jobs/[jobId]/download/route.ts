import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import { fail, resolveSession } from "@/lib/flow-api";
import { paramsFromJob, zipPart } from "@/modules/archive/export";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ sessionId: string; jobId: string }> };

/** GET ?part=1&tz= — streams the ZIP. Named "-INCOMPLETO" and flagged in RELATORIO.txt unless the job finished. */
export async function GET(request: NextRequest, { params }: P) {
    const { sessionId, jobId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const job = await prisma.archiveJob.findFirst({ where: { id: jobId, sessionId: r.session.id } });
    if (!job) return fail("Exportação não encontrada", 404);
    const q = request.nextUrl.searchParams;
    const out = await zipPart(paramsFromJob(job, q.get("tz") || "America/Sao_Paulo"), Number(q.get("part")) || 1);
    if (!out) return fail("Não há conversas salvas para baixar", 404);
    return new Response(Readable.toWeb(out.stream) as ReadableStream, {
        headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${out.name}"`, "Cache-Control": "no-store" },
    });
}
