import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { ok, fail, resolveSession } from "@/lib/flow-api";
import { waManager } from "@/modules/whatsapp/manager";
import { renderBroadcast, MAX_MESSAGE_LENGTH } from "@/modules/broadcast/template";

type P = { params: Promise<{ sessionId: string }> };

/** POST { message, mediaAssetId? } — sends the broadcast message only to the connected account itself. */
export async function POST(request: NextRequest, { params }: P) {
    const { sessionId } = await params;
    const r = await resolveSession(request, sessionId);
    if (r instanceof NextResponse) return r;
    const sock = waManager.getInstance(sessionId)?.socket;
    const me = sock?.user?.id?.replace(/:\d+(?=@)/, "");
    if (!sock || !me) return fail("Sessão do WhatsApp desconectada", 503);
    const body = await request.json().catch(() => ({}));
    const message = String(body.message || "");
    if (!message.trim() && !body.mediaAssetId) return fail("Escreva a mensagem antes de testar");
    if (message.length > MAX_MESSAGE_LENGTH) return fail(`A mensagem pode ter no máximo ${MAX_MESSAGE_LENGTH} caracteres`);
    const text = renderBroadcast(message, { jid: me, name: sock.user?.name || "" });
    try {
        if (body.mediaAssetId) {
            const asset = await prisma.flowAsset.findFirst({ where: { id: String(body.mediaAssetId), sessionId: r.session.id } });
            if (!asset) return fail("Anexo não encontrado", 404);
            const buf = await fs.readFile(asset.path);
            const caption = text.trim() ? `[TESTE] ${text}` : "[TESTE]";
            if (asset.mime.startsWith("image/")) await sock.sendMessage(me, { image: buf, caption });
            else if (asset.mime.startsWith("video/")) await sock.sendMessage(me, { video: buf, caption });
            else await sock.sendMessage(me, { document: buf, mimetype: asset.mime, fileName: asset.originalName, caption });
        } else {
            await sock.sendMessage(me, { text: `[TESTE] ${text}` });
        }
    } catch (e) { return fail(`Não foi possível enviar o teste: ${(e as Error).message}`, 500); }
    return ok(null, "Teste enviado para o seu próprio WhatsApp");
}
