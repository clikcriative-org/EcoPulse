import type { WASocket } from "@whiskeysockets/baileys";

type Participant = { id?: string; lid?: string; admin?: string | null };

/** "5521...:12@s.whatsapp.net" -> "5521...@s.whatsapp.net" (participants are listed without the device part). */
const bare = (jid?: string | null) => (jid ? jid.replace(/:\d+(?=@)/, "") : "");

/** Our own account as it may appear in a participant list: phone JID and LID. */
export function myJids(sock: Pick<WASocket, "user"> | null | undefined): Set<string> {
    const u = sock?.user as { id?: string; lid?: string } | undefined;
    return new Set([bare(u?.id), bare(u?.lid)].filter(Boolean));
}

export function participantsOf(raw: unknown): Participant[] {
    return Array.isArray(raw) ? (raw as Participant[]) : [];
}

export function isMe(p: Participant, me: Set<string>) {
    return me.has(bare(p.id)) || me.has(bare(p.lid));
}

export function amAdmin(raw: unknown, me: Set<string>): boolean {
    return participantsOf(raw).some(p => isMe(p, me) && (p.admin === "admin" || p.admin === "superadmin"));
}
