import { NextResponse, NextRequest } from "next/server";
import { waManager } from "@/modules/whatsapp/manager";
import { createGroupSchema } from "@/lib/validations";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { saveGroup } from "@/modules/whatsapp/store/groups";

// POST: Create a new group
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await params;
        const body = await request.json();

        // Inject sessionId into body for validation using existing schema
        const payload = { ...body, sessionId };
        
        const parseResult = createGroupSchema.safeParse(payload);
        if (!parseResult.success) {
            const msg = parseResult.error.issues[0]?.message || "Dados inválidos";
            return NextResponse.json({ status: false, message: msg, error: parseResult.error.flatten() }, { status: 400 });
        }

        const { subject, participants } = parseResult.data;

        // Check if user can access this session
        const canAccess = await canAccessSession(user.id, user.role, sessionId);
        if (!canAccess) {
            return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
        }

        const instance = waManager.getInstance(sessionId);
        if (!instance?.socket) {
            return NextResponse.json({ status: false, message: "Session not ready", error: "Session not ready" }, { status: 503 });
        }

        // WhatsApp needs at least one participant; with none given, the account itself is the member
        const me = (instance.socket.user?.id || "").replace(/:\d+(?=@)/, "");
        const group = await instance.socket.groupCreate(subject, participants.length ? participants : [me]);
        const session = await prisma.session.findUnique({ where: { sessionId }, select: { id: true } });
        if (session) await saveGroup(session.id, group).catch(e => logger.warn("Groups", `could not save new group ${group.id}`, e));
        
        return NextResponse.json({ status: true, message: "Operation successful", data: { group } });

    } catch (e) {
        logger.error("Groups", "create group failed", e);
        const msg = `Não foi possível criar o grupo: ${(e as Error)?.message || "erro desconhecido"}`;
        return NextResponse.json({ status: false, message: msg, error: msg }, { status: 500 });
    }
}
