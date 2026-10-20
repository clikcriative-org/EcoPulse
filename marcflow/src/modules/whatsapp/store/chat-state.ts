import type { WASocket } from "@whiskeysockets/baileys";
import type { Server } from "socket.io";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const skip = (jid?: string | null) => !jid || jid === "status@broadcast" || jid.endsWith("@newsletter");

/** A new incoming message bumps the counter; a message sent by us means the chat was answered (read). */
export async function trackUnread(dbSessionId: string, jid: string, fromMe: boolean) {
    if (skip(jid)) return;
    await prisma.chatState.upsert({
        where: { sessionId_jid: { sessionId: dbSessionId, jid } },
        create: { sessionId: dbSessionId, jid, unreadCount: fromMe ? 0 : 1 },
        update: fromMe ? { unreadCount: 0 } : { unreadCount: { increment: 1 } },
    }).catch(e => logger.debug("ChatState", "trackUnread failed", e));
}

export async function resetUnread(dbSessionId: string, jid: string) {
    await prisma.chatState.updateMany({ where: { sessionId: dbSessionId, jid }, data: { unreadCount: 0 } });
}

/** Keeps counters in sync with WhatsApp (reads on the phone) and relays presence to the dashboard. */
export function bindChatState(sock: WASocket, sessionId: string, io: Server | null) {
    let dbSessionId: string | null = null;
    const dbId = async () => (dbSessionId ??= (await prisma.session.findUnique({ where: { sessionId }, select: { id: true } }))?.id ?? null);

    // History sync carries the absolute unread count of each chat
    sock.ev.on("messaging-history.set", async ({ chats }) => {
        const id = await dbId();
        if (!id || !chats?.length) return;
        for (const c of chats) {
            const jid = c.id;
            if (!jid || skip(jid) || c.unreadCount === undefined || c.unreadCount === null) continue;
            await prisma.chatState.upsert({
                where: { sessionId_jid: { sessionId: id, jid } },
                create: { sessionId: id, jid, unreadCount: Math.max(0, c.unreadCount) },
                update: { unreadCount: Math.max(0, c.unreadCount) },
            }).catch(() => undefined);
        }
    });

    // Positive values are deltas already counted by trackUnread; 0 means the chat was read elsewhere
    sock.ev.on("chats.update", async (updates) => {
        const id = await dbId();
        if (!id) return;
        for (const u of updates) {
            if (u.id && u.unreadCount === 0) {
                await resetUnread(id, u.id);
                io?.to(sessionId).emit("chat.read", { jid: u.id });
            }
        }
    });

    sock.ev.on("presence.update", ({ id, presences }) => {
        io?.to(sessionId).emit("presence.update", { id, presences });
    });
}
