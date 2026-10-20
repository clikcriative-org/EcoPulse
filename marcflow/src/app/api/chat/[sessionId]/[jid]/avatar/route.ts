import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, canAccessSession } from "@/lib/api-auth";
import { getAvatar } from "@/modules/whatsapp/avatars";

// GET: profile picture bytes of a contact or group (cached on disk, fetched from WhatsApp on demand)
export async function GET(request: NextRequest, { params }: { params: Promise<{ sessionId: string; jid: string }> }) {
    const user = await getAuthenticatedUser(request);
    if (!user) return new NextResponse(null, { status: 401 });
    const { sessionId, jid } = await params;
    if (!(await canAccessSession(user.id, user.role, sessionId))) return new NextResponse(null, { status: 403 });

    const buf = await getAvatar(sessionId, decodeURIComponent(jid));
    if (!buf) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, max-age=3600" } });
    return new NextResponse(new Uint8Array(buf), {
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
}
