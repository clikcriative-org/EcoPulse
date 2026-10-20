import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, resolveSession } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string }> };

/** What the quick reply editor pickers need: labels, contact fields (#tags) and groups. */
export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const [labels, fields, groups] = await Promise.all([
        prisma.label.findMany({ where: { sessionId }, select: { id: true, name: true, colorHex: true }, orderBy: { name: "asc" } }),
        prisma.fieldDefinition.findMany({ where: { sessionId: r.session.id, scope: "CONTACT" }, select: { key: true, label: true }, orderBy: { label: "asc" } }),
        prisma.group.findMany({ where: { sessionId: r.session.id }, select: { jid: true, subject: true }, orderBy: { subject: "asc" } }),
    ]);
    return ok({ labels, fields, groups });
}
