import { prisma } from "@/lib/prisma";
import type { WASocket, GroupMetadata } from "@whiskeysockets/baileys";
import { logger } from "@/lib/logger";

/** Upserts one group's metadata (sync, and right after creating a group so it shows without waiting for the next sync). */
export async function saveGroup(dbSessionId: string, g: GroupMetadata) {
    const data = {
        subject: g.subject,
        description: g.desc,
        ownerJid: g.owner,
        restrict: g.restrict,
        announce: g.announce,
        participants: g.participants as any,
        metadata: g as any,
        isCommunity: g.isCommunity || false,
        linkedParentJid: g.linkedParent || null,
    };
    await prisma.group.upsert({
        where: { sessionId_jid: { sessionId: dbSessionId, jid: g.id } },
        create: { sessionId: dbSessionId, jid: g.id, creation: g.creation ? new Date(g.creation * 1000) : undefined, ...data },
        update: data,
    });
}

export async function syncGroups(sock: WASocket, sessionId: string) {
    try {
        // Verify session exists and get the actual database ID
        const session = await prisma.session.findUnique({
            where: { sessionId },
            select: { id: true }
        });
        
        if (!session) {
            logger.error("Store", `Session ${sessionId} does not exist, cannot sync groups`);
            return;
        }

        // Use session.id (cuid) for foreign key, not sessionId string
        const dbSessionId = session.id;

        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.values(groups);

        logger.info("Store", `Found ${groupList.length} groups for session ${sessionId}`);

        for (const g of groupList) {
            try { await saveGroup(dbSessionId, g); }
            catch (e) { console.error(`Failed to sync group ${g.id}`, e); }
        }
        // Groups we left (on the phone or elsewhere) are no longer returned: drop them so they don't linger in the panel
        const stale = await prisma.group.findMany({ where: { sessionId: dbSessionId, jid: { notIn: groupList.map(g => g.id) } }, select: { jid: true } });
        if (stale.length) {
            const jids = stale.map(g => g.jid);
            await prisma.groupCategoryLink.deleteMany({ where: { sessionId: dbSessionId, groupJid: { in: jids } } });
            await prisma.group.deleteMany({ where: { sessionId: dbSessionId, jid: { in: jids } } });
            logger.info("Store", `Removed ${stale.length} group(s) the account no longer participates in`);
        }
        logger.success("Store", `Synced ${groupList.length} groups for session ${sessionId}`);
    } catch (e) {
        logger.error("Store", "Failed to sync groups", e);
    }
}
