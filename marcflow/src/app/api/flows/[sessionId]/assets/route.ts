import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";

type P = { params: Promise<{ sessionId: string }> };

const LIMITS: Record<string, { max: number; mimes: RegExp }> = {
    image: { max: 5 * 1024 * 1024, mimes: /^image\/(jpeg|png|webp)$/ },
    video: { max: 16 * 1024 * 1024, mimes: /^video\/(mp4|3gpp)$/ },
    audio: { max: 16 * 1024 * 1024, mimes: /^audio\/(mpeg|mp3|ogg|mp4|aac|x-m4a|wav)$/ },
    file: { max: 16 * 1024 * 1024, mimes: /.*/ },
    sticker: { max: 1024 * 1024, mimes: /^image\/webp$/ },
};

/** Upload of media used inside flow blocks. Stored privately; the engine sends the bytes directly. */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const kind = String(form?.get("kind") || "file");
    if (!(file instanceof File)) return fail("Envie um arquivo");
    const rule = LIMITS[kind];
    if (!rule) return fail("Tipo de mídia inválido");
    if (!rule.mimes.test(file.type)) return fail(`Formato não aceito para ${kind}: ${file.type || "desconhecido"}`);
    if (file.size > rule.max) return fail(`Arquivo maior que ${Math.round(rule.max / 1024 / 1024)} MB`);

    const dir = path.join(process.cwd(), "data", "flow-assets", r.session.id);
    await fs.mkdir(dir, { recursive: true });
    const asset = await prisma.flowAsset.create({
        data: { sessionId: r.session.id, path: "", mime: file.type || "application/octet-stream", size: file.size, originalName: file.name.slice(0, 200) },
    });
    const ext = path.extname(file.name).replace(/[^.\w]/g, "").slice(0, 8);
    const dest = path.join(dir, `${asset.id}${ext}`);
    await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));
    const saved = await prisma.flowAsset.update({ where: { id: asset.id }, data: { path: dest } });
    return ok({ id: saved.id, mime: saved.mime, size: saved.size, originalName: saved.originalName }, "Arquivo enviado");
}
