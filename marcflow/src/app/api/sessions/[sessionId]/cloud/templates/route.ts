import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { listCloudTemplates } from "@/modules/whatsapp/cloud/api";

export const dynamic = "force-dynamic";

// GET: message templates of the WhatsApp Business Account (only APPROVED ones can be sent)
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
    const { sessionId } = await params;
    if (!(await canAccessSession(user.id, user.role, sessionId))) {
        return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
    }
    const session = await prisma.session.findUnique({ where: { sessionId }, include: { cloudCredential: true } });
    if (!session?.cloudPhoneNumberId || !session.cloudCredential) {
        return NextResponse.json({ status: false, message: "Sessão sem credenciais da Cloud API", error: "Not configured" }, { status: 400 });
    }
    try {
        const templates = await listCloudTemplates({ phoneNumberId: session.cloudPhoneNumberId, accessToken: session.cloudCredential.accessToken, wabaId: session.cloudWabaId });
        const onlyApproved = request.nextUrl.searchParams.get("all") !== "true";
        return NextResponse.json({ status: true, message: "Templates retrieved", data: onlyApproved ? templates.filter(t => t.status === "APPROVED") : templates });
    } catch (e: any) {
        return NextResponse.json({ status: false, message: e.message, error: e.message }, { status: 502 });
    }
}
