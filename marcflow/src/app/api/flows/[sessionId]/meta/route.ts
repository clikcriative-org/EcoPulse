import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, resolveSession } from "@/lib/flow-api";
import { SYSTEM_FIELDS } from "@/modules/flows/types";

type P = { params: Promise<{ sessionId: string }> };

/** Everything the editor pickers need in one call: labels, fields and other flows. */
export async function GET(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const [labels, fields, flows] = await Promise.all([
        prisma.label.findMany({ where: { sessionId }, select: { id: true, name: true, colorHex: true }, orderBy: { name: "asc" } }),
        prisma.fieldDefinition.findMany({ where: { sessionId: r.session.id }, orderBy: { label: "asc" } }),
        prisma.flow.findMany({ where: { sessionId: r.session.id }, select: { id: true, name: true, status: true }, orderBy: { name: "asc" } }),
    ]);
    return ok({ labels, fields, systemFields: SYSTEM_FIELDS, flows });
}
