"use server";

import { prisma } from "@/lib/prisma";
import { ChatService } from "@/modules/whatsapp/chat.service";
import { waManager } from "@/modules/whatsapp/manager";
import { toOggOpus } from "@/modules/whatsapp/voice";
import { getAuthenticatedUserForAction } from "@/lib/server-action-auth";
import { canAccessSession } from "@/lib/api-auth";

const CHAT_PAGE_SIZE = parseInt(process.env.NEXT_PUBLIC_CHAT_PAGE_SIZE || "50", 10);

// Fetch chat list with cursor-based pagination & search
export async function getChatsStatus(
    sessionId: string,
    limit = CHAT_PAGE_SIZE,
    before?: string,
    search?: string,
    filter: "all" | "unread" | "groups" = "all"
) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    const session = await prisma.session.findUnique({
        where: { sessionId },
        select: { id: true }
    });

    if (!session) throw new Error("Session not found");

    return await ChatService.getChatsList(session.id, limit, before, search, filter);
}

// Fetch messages for a specific chat with cursor pagination
export async function getChatMessages(
    sessionId: string,
    jid: string,
    limit = 50,
    before?: string
) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    const session = await prisma.session.findUnique({
        where: { sessionId },
        select: { id: true }
    });

    if (!session) throw new Error("Session not found");

    const { messages, hasMore } = await ChatService.getMessages(session.id, jid, limit, before);

    return {
        messages: messages.map((msg: any) => ({
            ...msg,
            timestamp: msg.timestamp instanceof Date
                ? msg.timestamp.toISOString()
                : String(msg.timestamp)
        })),
        hasMore
    };
}

// Send a basic text message
export async function sendChatMessage(sessionId: string, jid: string, text: string, quotedMessageId?: string) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    try {
        await ChatService.sendTextMessage(sessionId, jid, { text }, undefined, quotedMessageId);
        return { success: true };
    } catch (error: any) {
        throw new Error(`Failed to send message: ${error.message}`);
    }
}

// Upload and Send Media
export async function sendMediaMessage(formData: FormData) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");

    const sessionId = formData.get("sessionId") as string;
    const jid = formData.get("jid") as string;
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;
    const caption = formData.get("caption") as string || "";

    if (!sessionId || !jid || !file || !type) {
        throw new Error("Missing required fields");
    }

    const canAccess = await canAccessSession(user.id, user.role, sessionId);
    if (!canAccess) throw new Error("Forbidden");

    try {
        const buffer = Buffer.from(await file.arrayBuffer());

        await ChatService.sendMediaMessage(
            sessionId,
            jid,
            buffer,
            type,
            file.type,
            file.name,
            caption
        );

        return { success: true };
    } catch (error: any) {
        console.error("Media send error:", error);
        throw new Error(`Failed to send media: ${error.message}`);
    }
}

// Resolves the DB session after checking access (shared by the helpers below)
async function sessionFor(sessionId: string) {
    const user = await getAuthenticatedUserForAction();
    if (!user) throw new Error("Unauthorized");
    if (!(await canAccessSession(user.id, user.role, sessionId))) throw new Error("Forbidden");
    const session = await prisma.session.findUnique({ where: { sessionId }, select: { id: true } });
    if (!session) throw new Error("Session not found");
    return session.id;
}

// Counters for the "Não lidas" and "Grupos" filter chips
export async function getChatCounts(sessionId: string) {
    const id = await sessionFor(sessionId);
    const [unread, groups] = await Promise.all([
        prisma.chatState.count({ where: { sessionId: id, unreadCount: { gt: 0 } } }),
        prisma.$queryRawUnsafe<{ n: bigint }[]>("SELECT COUNT(DISTINCT remoteJid) AS n FROM `Message` WHERE sessionId = ? AND remoteJid LIKE '%@g.us'", id),
    ]);
    return { unread, groups: Number(groups[0]?.n ?? 0) };
}

// Opening a chat in the dashboard marks it read here and on WhatsApp
export async function markChatRead(sessionId: string, jid: string) {
    const id = await sessionFor(sessionId);
    const state = await prisma.chatState.findUnique({ where: { sessionId_jid: { sessionId: id, jid } } });
    if (!state?.unreadCount) return;
    await prisma.chatState.update({ where: { sessionId_jid: { sessionId: id, jid } }, data: { unreadCount: 0 } });
    const sock = waManager.getInstance(sessionId)?.socket;
    if (!sock) return;
    const last = await prisma.message.findMany({
        where: { sessionId: id, remoteJid: jid, fromMe: false },
        orderBy: { timestamp: "desc" }, take: Math.min(state.unreadCount, 50),
        select: { keyId: true, senderJid: true },
    });
    if (last.length) {
        await sock.readMessages(last.map(m => ({ remoteJid: jid, id: m.keyId, participant: jid.endsWith("@g.us") ? m.senderJid || undefined : undefined })))
            .catch(() => undefined);
    }
}

// Ask WhatsApp to push online/typing updates for this contact
export async function subscribePresence(sessionId: string, jid: string) {
    await sessionFor(sessionId);
    if (jid.endsWith("@g.us")) return;
    await waManager.getInstance(sessionId)?.socket?.presenceSubscribe(jid).catch(() => undefined);
}

// Voice note recorded in the browser: converted to Ogg/Opus and sent as a real WhatsApp voice message
export async function sendVoiceMessage(formData: FormData) {
    const sessionId = formData.get("sessionId") as string;
    const jid = formData.get("jid") as string;
    const file = formData.get("file") as File | null;
    if (!sessionId || !jid || !file) throw new Error("Dados incompletos");
    await sessionFor(sessionId);
    if (file.size > 16 * 1024 * 1024) throw new Error("Áudio grande demais");
    const ogg = await toOggOpus(Buffer.from(await file.arrayBuffer()));
    await ChatService.sendMediaMessage(sessionId, jid, ogg, "voice", "audio/ogg; codecs=opus", "voz.ogg", "");
    return { success: true };
}
