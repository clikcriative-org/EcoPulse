import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";

export const ok = (data: unknown, message = "OK") => NextResponse.json({ status: true, message, data });
export const fail = (message: string, status = 400, data?: unknown) => NextResponse.json({ status: false, message, error: message, data }, { status });

/** Auth + session access + resolves the DB session. Returns a Response on failure. */
export async function resolveSession(request: NextRequest, sessionId: string) {
    const user = await getAuthenticatedUser(request);
    if (!user) return fail("Não autorizado", 401);
    if (!(await canAccessSession(user.id, user.role, sessionId))) return fail("Sem acesso a esta sessão", 403);
    const session = await prisma.session.findUnique({ where: { sessionId }, select: { id: true, sessionId: true } });
    if (!session) return fail("Sessão não encontrada", 404);
    return { user, session };
}

export async function resolveFlow(request: NextRequest, sessionId: string, flowId: string) {
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const flow = await prisma.flow.findFirst({ where: { id: flowId, sessionId: r.session.id } });
    if (!flow) return fail("Fluxo não encontrado", 404);
    return { ...r, flow };
}
