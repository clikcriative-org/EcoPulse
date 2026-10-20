import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { fail, resolveSession } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string; assetId: string }> };

/** Authenticated preview of an uploaded flow asset. */
export async function GET(request: NextRequest, { params }: P) {
    const { sessionId, assetId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const asset = await prisma.flowAsset.findFirst({ where: { id: assetId, sessionId: r.session.id } });
    if (!asset) return fail("Arquivo não encontrado", 404);
    const data = await fs.readFile(asset.path).catch(() => null);
    if (!data) return fail("Arquivo não encontrado no disco", 404);
    return new NextResponse(new Uint8Array(data), {
        headers: { "Content-Type": asset.mime, "Content-Disposition": `inline; filename="${encodeURIComponent(asset.originalName)}"`, "Cache-Control": "private, max-age=3600" },
    });
}
