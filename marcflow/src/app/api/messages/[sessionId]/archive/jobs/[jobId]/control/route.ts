import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { controlArchive } from "@/modules/archive/import";

type P = { params: Promise<{ sessionId: string; jobId: string }> };
const MESSAGES = { pause: "Importação pausada", resume: "Importação retomada", cancel: "Importação cancelada", retry: "Tentando de novo os itens com erro" };

/** POST { action: "pause" | "resume" | "cancel" | "retry" } */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId, jobId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    if (!(await prisma.archiveJob.findFirst({ where: { id: jobId, sessionId: r.session.id } }))) return fail("Importação não encontrada", 404);
    const action = (await request.json().catch(() => ({}))).action as keyof typeof MESSAGES;
    if (!(action in MESSAGES)) return fail("Ação inválida");
    const res = await controlArchive(jobId, action);
    if (res.error) return fail(res.error, 409);
    return ok({ status: res.status }, MESSAGES[action]);
}
