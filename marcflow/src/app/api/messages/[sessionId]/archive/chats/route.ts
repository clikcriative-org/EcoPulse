import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, resolveSession } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string }> };

/**
 * Conversations of the connected account, live from what the system holds (no import needed), latest activity first.
 * GET ?q=&page=1&pageSize=50   or   ?ids=1 for the jid of every conversation (used by "Selecionar todas").
 */
export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const url = request.nextUrl.searchParams;
    const dbId = r.session.id;
    const q = (url.get("q") || "").trim();
    let named: string[] = [];
    if (q) {
        const [contacts, groups] = await Promise.all([
            prisma.contact.findMany({ where: { sessionId: dbId, OR: [{ name: { contains: q } }, { notify: { contains: q } }, { verifiedName: { contains: q } }] }, select: { jid: true }, take: 2000 }),
            prisma.group.findMany({ where: { sessionId: dbId, subject: { contains: q } }, select: { jid: true }, take: 2000 }),
        ]);
        named = [...contacts, ...groups].map(c => c.jid);
    }
    const where = {
        sessionId: dbId,
        NOT: [{ remoteJid: "status@broadcast" }, { remoteJid: { endsWith: "@newsletter" } }],
        ...(q ? { OR: [{ remoteJid: { contains: q } }, { remoteJid: { in: named } }] } : {}),
    };
    const all = await prisma.message.groupBy({ by: ["remoteJid"], where, _max: { timestamp: true }, orderBy: { _max: { timestamp: "desc" } } });
    if (url.get("ids")) return ok({ jids: all.map(c => c.remoteJid) });

    const pageSize = Math.min(100, Math.max(1, Number(url.get("pageSize")) || 50));
    const page = Math.max(1, Number(url.get("page")) || 1);
    const slice = all.slice((page - 1) * pageSize, page * pageSize).map(c => c.remoteJid);
    const [counts, audios, contacts, groups] = await Promise.all([
        prisma.message.groupBy({ by: ["remoteJid"], where: { sessionId: dbId, remoteJid: { in: slice } }, _count: true, _min: { timestamp: true }, _max: { timestamp: true } }),
        prisma.message.groupBy({ by: ["remoteJid"], where: { sessionId: dbId, remoteJid: { in: slice }, type: "AUDIO" }, _count: true }),
        prisma.contact.findMany({ where: { sessionId: dbId, jid: { in: slice } }, select: { jid: true, name: true, notify: true, verifiedName: true } }),
        prisma.group.findMany({ where: { sessionId: dbId, jid: { in: slice } }, select: { jid: true, subject: true } }),
    ]);
    const c = new Map(counts.map(x => [x.remoteJid, x]));
    const a = new Map(audios.map(x => [x.remoteJid, x._count]));
    const names = new Map<string, string>();
    for (const x of contacts) { const n = x.name || x.verifiedName || x.notify; if (n) names.set(x.jid, n); }
    for (const x of groups) if (x.subject) names.set(x.jid, x.subject);
    return ok({
        total: all.length, page, pageSize,
        chats: slice.map(jid => ({ jid, name: names.get(jid) ?? null, isGroup: jid.endsWith("@g.us"), messages: c.get(jid)?._count ?? 0, audios: a.get(jid) ?? 0, first: c.get(jid)?._min.timestamp ?? null, last: c.get(jid)?._max.timestamp ?? null })),
    });
}
