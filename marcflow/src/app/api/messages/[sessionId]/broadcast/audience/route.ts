import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, resolveSession } from "@/lib/flow-api";
import { phoneOf } from "@/modules/broadcast/template";

type P = { params: Promise<{ sessionId: string }> };

/**
 * Real contacts to pick broadcast recipients from.
 * GET ?q=&label=&page=1&limit=50 -> { items, total, labels }   ·   GET ...&all=1 -> { jids } (every match, for "select all")
 * A person known both by phone and by LID is listed once, by phone.
 */
export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const sp = request.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const labelId = sp.get("label") || "";
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 50));

    const [contacts, labels, optOuts] = await Promise.all([
        prisma.contact.findMany({
            where: { sessionId: r.session.id, OR: [{ jid: { endsWith: "@s.whatsapp.net" } }, { jid: { endsWith: "@lid" } }] },
            select: { jid: true, lid: true, name: true, notify: true, verifiedName: true },
        }),
        prisma.label.findMany({ where: { sessionId }, select: { id: true, name: true, colorHex: true, chatLabels: { select: { chatJid: true } } }, orderBy: { name: "asc" } }),
        prisma.broadcastOptOut.findMany({ where: { sessionId }, select: { jid: true } }),
    ]);
    const lidsWithPhone = new Set(contacts.filter(c => c.jid.endsWith("@s.whatsapp.net") && c.lid).map(c => c.lid!.replace(/:\d+(?=@)/, "")));
    const labelsByJid = new Map<string, { id: string; name: string; colorHex: string }[]>();
    for (const l of labels) for (const cl of l.chatLabels) labelsByJid.set(cl.chatJid, [...(labelsByJid.get(cl.chatJid) || []), { id: l.id, name: l.name, colorHex: l.colorHex }]);
    const opted = new Set(optOuts.map(o => o.jid));

    const people = contacts
        .map(c => ({ jid: c.jid, name: c.name || c.verifiedName || c.notify || "" }))
        // LID-only entries without a name are group members we never talked to: not a broadcast audience
        .filter(c => c.jid.endsWith("@s.whatsapp.net") || (!lidsWithPhone.has(c.jid) && c.name))
        .filter(c => !labelId || labelsByJid.get(c.jid)?.some(l => l.id === labelId))
        .filter(c => !q || c.name.toLowerCase().includes(q) || (qDigits.length >= 3 && phoneOf(c.jid).includes(qDigits)))
        // People with a visible number first, then by name ignoring leading symbols/emoji ("_ ~ Daan" sorts as "Daan")
        .map(c => ({ ...c, sortKey: c.name.replace(/^[^\p{L}\p{N}]+/u, "").toLocaleLowerCase("pt-BR") }))
        .sort((a, b) => (phoneOf(a.jid) ? 0 : 1) - (phoneOf(b.jid) ? 0 : 1) || (a.sortKey ? 0 : 1) - (b.sortKey ? 0 : 1) || a.sortKey.localeCompare(b.sortKey, "pt-BR"));

    if (sp.get("all") === "1") return ok({ jids: people.map(p => p.jid) });
    const items = people.slice((page - 1) * limit, page * limit).map(p => ({
        jid: p.jid, name: p.name, phone: phoneOf(p.jid), labels: labelsByJid.get(p.jid) || [], optedOut: opted.has(p.jid),
    }));
    return ok({ items, total: people.length, page, limit, labels: labels.map(({ chatLabels, ...l }) => ({ ...l, count: chatLabels.length })) });
}
