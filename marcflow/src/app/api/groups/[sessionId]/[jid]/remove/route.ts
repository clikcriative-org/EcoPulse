import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { waManager } from "@/modules/whatsapp/manager";
import { logger } from "@/lib/logger";
import { proto, type WAMessage } from "@whiskeysockets/baileys";

type P = { params: Promise<{ sessionId: string; jid: string }> };

/**
 * POST { mode: "leave" | "delete" }
 * - leave: leaves the group; it stops showing here and you lose access to new messages.
 * - delete: leaves, then deletes the chat and its history for the connected account (WhatsApp + MarcFlow).
 * WhatsApp has no "delete the group for everyone": the other participants keep the group.
 */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId, jid: rawJid } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const jid = decodeURIComponent(rawJid);
    if (!jid.endsWith("@g.us")) return fail("Grupo inválido");
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === "delete" ? "delete" : "leave";
    const sock = waManager.getInstance(sessionId)?.socket;
    if (!sock) return fail("Sessão do WhatsApp desconectada", 503);

    // Catch the "you left" system message: its timestamp goes into the delete range (see below)
    const stubs: WAMessage[] = [];
    const onUpsert = ({ messages }: { messages: WAMessage[] }) => { for (const m of messages) if (m.key.remoteJid === jid && m.messageStubType) stubs.push(m); };
    if (mode === "delete") sock.ev.on("messages.upsert", onUpsert);
    try {
        // The reply alone is not trustworthy: it may error although the leave went through (or we were already out),
        // and a failed groupMetadata read doesn't prove we left. Only the list of groups we participate in does.
        const leaveError = await sock.groupLeave(jid).then(() => null, (e: Error) => e);
        if (leaveError) logger.warn("Groups", `groupLeave ${jid} replied with error`, leaveError);
        let stillMember = true;
        for (let attempt = 0; attempt < 3 && stillMember; attempt++) {
            if (attempt) await new Promise(res => setTimeout(res, 1500));
            stillMember = jid in (await sock.groupFetchAllParticipating());
        }
        if (stillMember) {
            logger.error("Groups", `leave ${jid} not applied by WhatsApp`, leaveError);
            return fail(`O WhatsApp não confirmou a saída do grupo${leaveError ? ` (${leaveError.message})` : ""}. O grupo continua na lista.`, 502);
        }
        if (mode === "delete") {
            for (let i = 0; i < 16 && !stubs.length; i++) await new Promise(res => setTimeout(res, 250));
            const sysTs = stubs.length ? Math.max(...stubs.map(m => Number(m.messageTimestamp || 0))) : Math.floor(Date.now() / 1000);
            const last = await prisma.message.findFirst({ where: { sessionId: r.session.id, remoteJid: jid }, orderBy: { timestamp: "desc" }, select: { keyId: true, fromMe: true, timestamp: true } });
            // Mirrors exactly what the phone sends when you delete a group chat after leaving (captured 18/10):
            //  - last message is ours  -> messages: [{ key: { remoteJid, fromMe: true, id }, timestamp }] + lastSystemMessageTimestamp
            //  - last message is not   -> no messages, only lastSystemMessageTimestamp
            // never lastMessageTimestamp, never a system message key. A hand-made range pointing at the "you left" stub
            // (fromMe false + @lid participant) made WhatsApp remove this linked device (401 device_removed).
            const mine = last?.fromMe ? [{ key: { remoteJid: jid, fromMe: true, id: last.keyId }, timestamp: Math.floor(last.timestamp.getTime() / 1000) }] : [];
            logger.info("Groups", `delete ${jid}: system message at ${sysTs}${stubs.length ? "" : " (not seen, using now)"}, ${mine.length ? "last message is ours" : "last message not ours"}`);
            try {
                await sock.appPatch({
                    syncAction: {
                        timestamp: Date.now(),
                        deleteChatAction: { messageRange: { lastSystemMessageTimestamp: sysTs, messages: mine } },
                    },
                    index: ["deleteChat", jid, "1"],
                    type: "regular_high",
                    apiVersion: 6,
                    operation: proto.SyncdMutation.SyncdOperation.SET,
                });
            } catch (e) {
                // The chat stays on the phone's list, but the group itself was left and is cleaned up here
                logger.warn("Groups", `could not delete chat ${jid} on WhatsApp`, e);
            }
            await prisma.message.deleteMany({ where: { sessionId: r.session.id, remoteJid: jid } });
            await prisma.chatState.deleteMany({ where: { sessionId: r.session.id, jid } });
        }
        await prisma.group.deleteMany({ where: { sessionId: r.session.id, jid } });
        await prisma.groupCategoryLink.deleteMany({ where: { sessionId: r.session.id, groupJid: jid } });
    } catch (e) {
        logger.error("Groups", `${mode} ${jid} failed`, e);
        return fail(`Não foi possível concluir: ${(e as Error).message}`, 500);
    } finally {
        sock.ev.off("messages.upsert", onUpsert);
    }
    return ok({ mode }, mode === "delete" ? "Você saiu e a conversa foi excluída" : "Você saiu do grupo");
}
