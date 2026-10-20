import { NextResponse, NextRequest } from "next/server";
import { validCloudSignature } from "@/modules/whatsapp/cloud/api";
import { handleCloudChange } from "@/modules/whatsapp/cloud/inbound";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Webhook da WhatsApp Cloud API.
 * Configure no painel da Meta (WhatsApp > Configuração):
 *   URL de callback: https://SEU-DOMINIO/api/whatsapp/cloud/webhook
 *   Token de verificação: o valor de WA_CLOUD_VERIFY_TOKEN
 *   Campo assinado: messages
 */

// Meta checks the URL once, when it is saved in the panel
export async function GET(request: NextRequest) {
    const p = request.nextUrl.searchParams;
    const expected = process.env.WA_CLOUD_VERIFY_TOKEN;
    if (expected && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === expected) {
        return new NextResponse(p.get("hub.challenge") || "", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
    const raw = await request.text();
    const secret = process.env.WA_CLOUD_APP_SECRET;
    if (!secret) {
        logger.error("Cloud", "WA_CLOUD_APP_SECRET is not set: refusing webhook (anyone could fake messages)");
        return new NextResponse("Server not configured", { status: 500 });
    }
    if (!validCloudSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
        return new NextResponse("Invalid signature", { status: 401 });
    }

    let body: any;
    try {
        body = JSON.parse(raw);
    } catch {
        return new NextResponse("Bad JSON", { status: 400 });
    }
    if (body?.object !== "whatsapp_business_account") return NextResponse.json({ ok: true });

    // Answer fast: Meta retries (and eventually disables the webhook) when replies take too long
    const changes = (body.entry || []).flatMap((e: any) => e.changes || []).filter((c: any) => c.field === "messages");
    (async () => {
        for (const c of changes) {
            await handleCloudChange(c.value).catch(e => logger.error("Cloud", "webhook change failed", e));
        }
    })();

    return NextResponse.json({ ok: true });
}
