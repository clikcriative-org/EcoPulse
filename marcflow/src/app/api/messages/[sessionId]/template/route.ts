import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { waManager } from "@/modules/whatsapp/manager";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const schema = z.object({
    to: z.string().min(8),                       // "5511999999999" or a jid
    name: z.string().min(1),                     // template name in the Meta panel
    language: z.string().min(2).default("pt_BR"),
    components: z.array(z.any()).optional(),     // header/body/button parameters, as in the Cloud API
    preview: z.string().optional(),              // text shown in the MarcFlow inbox
});

// POST: send an approved template (the only thing allowed outside the 24h customer service window)
export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
    const { sessionId } = await params;
    if (!(await canAccessSession(user.id, user.role, sessionId))) {
        return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || "Dados inválidos";
        return NextResponse.json({ status: false, message: msg, error: msg }, { status: 400 });
    }
    const instance = waManager.getInstance(sessionId);
    if (!instance?.socket || instance.status !== "CONNECTED") {
        return NextResponse.json({ status: false, message: "Session not ready", error: "Session not ready" }, { status: 503 });
    }
    const { to, ...template } = parsed.data;
    const jid = to.includes("@") ? to : `${to.replace(/\D/g, "")}@s.whatsapp.net`;
    try {
        const sent: any = await instance.socket.sendMessage(jid, { template } as any);
        return NextResponse.json({ status: true, message: "Template sent", data: { id: sent?.key?.id } });
    } catch (e: any) {
        return NextResponse.json({ status: false, message: e.message, error: e.message }, { status: 400 });
    }
}
