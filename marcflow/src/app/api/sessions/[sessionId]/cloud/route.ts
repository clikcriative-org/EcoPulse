import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { waManager } from "@/modules/whatsapp/manager";
import { getAuthenticatedUser, canAccessSession, isSessionOwner } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getCloudPhoneInfo } from "@/modules/whatsapp/cloud/api";

export const dynamic = "force-dynamic";

const webhookUrl = (request: NextRequest) =>
    `${process.env.BASE_URL || request.nextUrl.origin}/api/whatsapp/cloud/webhook`;

// GET: Cloud API settings of the session (never returns the token itself)
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
    const { sessionId } = await params;
    if (!(await canAccessSession(user.id, user.role, sessionId))) {
        return NextResponse.json({ status: false, message: "Forbidden - Cannot access this session", error: "Forbidden - Cannot access this session" }, { status: 403 });
    }
    const session = await prisma.session.findUnique({
        where: { sessionId },
        select: { provider: true, cloudPhoneNumberId: true, cloudWabaId: true, cloudCredential: { select: { updatedAt: true } } },
    });
    if (!session) return NextResponse.json({ status: false, message: "Session not found", error: "Session not found" }, { status: 404 });
    return NextResponse.json({
        status: true,
        message: "Cloud API settings retrieved",
        data: {
            provider: session.provider,
            phoneNumberId: session.cloudPhoneNumberId,
            wabaId: session.cloudWabaId,
            hasToken: !!session.cloudCredential,
            tokenUpdatedAt: session.cloudCredential?.updatedAt ?? null,
            webhookUrl: webhookUrl(request),
            webhookReady: !!process.env.WA_CLOUD_APP_SECRET && !!process.env.WA_CLOUD_VERIFY_TOKEN,
        },
    });
}

const schema = z.object({
    phoneNumberId: z.string().regex(/^\d{5,30}$/, "Phone Number ID deve conter só números"),
    wabaId: z.string().regex(/^\d{5,30}$/, "WABA ID deve conter só números").optional().or(z.literal("")),
    // empty keeps the token already saved
    accessToken: z.string().trim().min(20, "Token de acesso inválido").optional().or(z.literal("")),
});

// PUT: save Cloud API credentials (owner only); validates them against Meta before saving
export async function PUT(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ status: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 });
    const { sessionId } = await params;
    if (!(await isSessionOwner(user.id, user.role, sessionId))) {
        return NextResponse.json({ status: false, message: "Only the session owner can change its credentials", error: "Forbidden" }, { status: 403 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || "Dados inválidos";
        return NextResponse.json({ status: false, message: msg, error: msg }, { status: 400 });
    }
    const { phoneNumberId, wabaId, accessToken } = parsed.data;

    const session = await prisma.session.findUnique({ where: { sessionId }, include: { cloudCredential: true } });
    if (!session) return NextResponse.json({ status: false, message: "Session not found", error: "Session not found" }, { status: 404 });

    const token = accessToken || session.cloudCredential?.accessToken;
    if (!token) return NextResponse.json({ status: false, message: "Informe o token de acesso", error: "Token required" }, { status: 400 });

    const taken = await prisma.session.findFirst({ where: { cloudPhoneNumberId: phoneNumberId, NOT: { id: session.id } }, select: { id: true } });
    if (taken) return NextResponse.json({ status: false, message: "Este número já está ligado a outra sessão", error: "Conflict" }, { status: 409 });

    let info;
    try {
        info = await getCloudPhoneInfo({ phoneNumberId, accessToken: token });
    } catch (e: any) {
        return NextResponse.json({ status: false, message: `A Meta recusou as credenciais: ${e.message}`, error: e.message }, { status: 400 });
    }

    await prisma.session.update({
        where: { id: session.id },
        data: {
            provider: "cloud",
            cloudPhoneNumberId: phoneNumberId,
            cloudWabaId: wabaId || null,
            cloudCredential: { upsert: { create: { accessToken: token }, update: { accessToken: token } } },
        },
    });
    // pick up the new credentials right away
    await waManager.restartSession(sessionId).catch(() => undefined);

    return NextResponse.json({
        status: true,
        message: "Credenciais salvas",
        data: { displayPhoneNumber: info.display_phone_number, verifiedName: info.verified_name, qualityRating: info.quality_rating ?? null },
    });
}
