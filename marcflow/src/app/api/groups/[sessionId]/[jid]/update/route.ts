import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { logger } from "@/lib/logger";
import { waManager } from "@/modules/whatsapp/manager";
import { amAdmin, myJids } from "@/modules/whatsapp/group-admin";

type P = { params: Promise<{ sessionId: string; jid: string }> };
type Field = "subject" | "description" | "announce" | "restrict" | "ephemeral";
const EPHEMERAL = [0, 86400, 604800, 7776000]; // off, 24 h, 7 days, 90 days — the values WhatsApp offers

/**
 * POST { subject?, description? (null clears), announce?, restrict?, ephemeral? }
 * Applies only the fields present, one WhatsApp call each, and reports every field separately.
 * Settings need admin; name/description also need admin when the group is locked to admins.
 */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId, jid: rawJid } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const jid = decodeURIComponent(rawJid);
    if (!jid.endsWith("@g.us")) return fail("Grupo inválido");
    const sock = waManager.getInstance(sessionId)?.socket;
    if (!sock) return fail("Sessão do WhatsApp desconectada", 503);
    const body = await request.json().catch(() => ({}));

    let meta;
    try { meta = await sock.groupMetadata(jid); }
    catch { return fail("Você não participa mais deste grupo", 404); }
    const admin = amAdmin(meta.participants, myJids(sock));
    const needsAdmin = (f: Field) => f === "announce" || f === "restrict" || f === "ephemeral" || !!meta.restrict;

    const tasks: { field: Field; run: () => Promise<unknown> }[] = [];
    if (body.subject !== undefined) {
        const subject = String(body.subject).trim();
        if (!subject) return fail("O nome do grupo não pode ficar vazio");
        if (subject.length > 100) return fail("O nome do grupo pode ter no máximo 100 caracteres");
        tasks.push({ field: "subject", run: () => sock.groupUpdateSubject(jid, subject) });
    }
    if (body.description !== undefined) {
        const description = body.description === null ? undefined : String(body.description);
        if (description && description.length > 2048) return fail("A descrição pode ter no máximo 2048 caracteres");
        tasks.push({ field: "description", run: () => sock.groupUpdateDescription(jid, description) });
    }
    if (typeof body.announce === "boolean") tasks.push({ field: "announce", run: () => sock.groupSettingUpdate(jid, body.announce ? "announcement" : "not_announcement") });
    if (typeof body.restrict === "boolean") tasks.push({ field: "restrict", run: () => sock.groupSettingUpdate(jid, body.restrict ? "locked" : "unlocked") });
    if (body.ephemeral !== undefined) {
        if (!EPHEMERAL.includes(Number(body.ephemeral))) return fail("Duração de mensagens temporárias inválida");
        tasks.push({ field: "ephemeral", run: () => sock.groupToggleEphemeral(jid, Number(body.ephemeral)) });
    }
    if (!tasks.length) return fail("Nenhum campo para alterar");

    const results: { field: Field; ok: boolean; error?: string }[] = [];
    for (const t of tasks) {
        if (needsAdmin(t.field) && !admin) { results.push({ field: t.field, ok: false, error: "Requer administrador do grupo" }); continue; }
        try { await t.run(); results.push({ field: t.field, ok: true }); }
        catch (e) {
            logger.warn("Groups", `update ${t.field} on ${jid} failed`, e);
            results.push({ field: t.field, ok: false, error: /not-authorized|forbidden|403/i.test(String((e as Error)?.message)) ? "Sem permissão no WhatsApp" : String((e as Error)?.message || e) });
        }
    }

    // Mirror what WhatsApp accepted, so the list is right before the next sync
    const done = new Set(results.filter(x => x.ok).map(x => x.field));
    const data: { subject?: string; description?: string | null; announce?: boolean; restrict?: boolean } = {};
    if (done.has("subject")) data.subject = String(body.subject).trim();
    if (done.has("description")) data.description = body.description === null ? null : String(body.description);
    if (done.has("announce")) data.announce = body.announce;
    if (done.has("restrict")) data.restrict = body.restrict;
    if (Object.keys(data).length) await prisma.group.updateMany({ where: { sessionId: r.session.id, jid }, data });

    const failed = results.filter(x => !x.ok);
    return ok({ results, updated: data }, failed.length ? `${failed.length} alteração(ões) não aplicada(s)` : "Grupo atualizado");
}
