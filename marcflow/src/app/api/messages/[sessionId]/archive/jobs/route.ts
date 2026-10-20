import { NextRequest, NextResponse } from "next/server";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { startArchive } from "@/modules/archive/import";

type P = { params: Promise<{ sessionId: string }> };

/** POST { jids: string[], includeMedia?: boolean } — prepares the export of the selected conversations (sync, then ZIP). */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const body = await request.json().catch(() => ({}));
    const jids = Array.isArray(body.jids) ? (body.jids as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0) : [];
    if (!jids.length) return fail("Selecione ao menos uma conversa");
    const res = await startArchive(r.user.id, r.session, { jids, includeMedia: body.includeMedia === true });
    if ("error" in res) return fail(res.error!, 409);
    return ok(res.job, "Exportação iniciada");
}
