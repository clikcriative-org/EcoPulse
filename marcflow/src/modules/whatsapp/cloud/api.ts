// Thin client for the WhatsApp Cloud API (Meta Graph API). No SDK: plain fetch.
import crypto from "crypto";

// read at call time: the server imports this module before loading .env; the URL is overridable for tests
const graphUrl = () => process.env.WA_CLOUD_GRAPH_URL || "https://graph.facebook.com";
const version = () => process.env.WA_CLOUD_API_VERSION || "v23.0";

export interface CloudCreds {
    phoneNumberId: string;
    accessToken: string;
    wabaId?: string | null;
}

export class CloudApiError extends Error {
    code?: number;
    status: number;
    constructor(message: string, status: number, code?: number) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

/** Meta's error codes that operators hit the most, explained in Portuguese. */
const FRIENDLY: Record<number, string> = {
    131047: "Janela de 24h fechada: este contato só pode receber uma mensagem de template aprovado",
    131026: "Número não tem WhatsApp ou não pode receber mensagens",
    131056: "Muitas mensagens para o mesmo contato em pouco tempo",
    130429: "Limite de envio da API atingido, tente mais devagar",
    132001: "Template não existe ou não foi aprovado neste idioma",
    190: "Token de acesso inválido ou expirado",
};

async function graph<T = any>(creds: CloudCreds, path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${graphUrl()}/${version()}/${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${creds.accessToken}`, ...(init.headers || {}) },
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body?.error) {
        const err = body?.error || {};
        const code = err.code as number | undefined;
        const detail = err.error_data?.details || err.message || res.statusText;
        throw new CloudApiError(code && FRIENDLY[code] ? `${FRIENDLY[code]} (${code})` : `Cloud API: ${detail}`, res.status, code);
    }
    return body as T;
}

/** POST /{phone-number-id}/messages; returns the wamid of the new message. */
export async function sendCloudMessage(creds: CloudCreds, payload: Record<string, unknown>): Promise<string> {
    const body = await graph<{ messages?: { id: string }[] }>(creds, `${creds.phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
    });
    const id = body.messages?.[0]?.id;
    if (!id) throw new CloudApiError("Cloud API não devolveu o id da mensagem", 500);
    return id;
}

/** Uploads a file and returns its media id (valid for 30 days on Meta's side). */
export async function uploadCloudMedia(creds: CloudCreds, buf: Buffer, mime: string, fileName = "arquivo"): Promise<string> {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mime);
    form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), fileName);
    const body = await graph<{ id: string }>(creds, `${creds.phoneNumberId}/media`, { method: "POST", body: form });
    return body.id;
}

/** Downloads an incoming media file (two steps: id → temporary url → bytes). */
export async function downloadCloudMedia(creds: CloudCreds, mediaId: string): Promise<{ buffer: Buffer; mime: string }> {
    const meta = await graph<{ url: string; mime_type: string }>(creds, mediaId);
    const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${creds.accessToken}` } });
    if (!res.ok) throw new CloudApiError(`Falha ao baixar mídia (${res.status})`, res.status);
    return { buffer: Buffer.from(await res.arrayBuffer()), mime: meta.mime_type };
}

/** Marks an incoming message as read; with typing=true also shows "digitando..." for up to 25s. */
export async function markCloudRead(creds: CloudCreds, messageId: string, typing = false) {
    await graph(creds, `${creds.phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            status: "read",
            message_id: messageId,
            ...(typing ? { typing_indicator: { type: "text" } } : {}),
        }),
    });
}

/** Checks the credentials and returns the number shown to customers. */
export async function getCloudPhoneInfo(creds: CloudCreds) {
    return graph<{ display_phone_number: string; verified_name: string; quality_rating?: string }>(
        creds,
        `${creds.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    );
}

export interface CloudTemplate {
    name: string;
    language: string;
    status: string;
    category: string;
    components: any[];
}

export async function listCloudTemplates(creds: CloudCreds): Promise<CloudTemplate[]> {
    if (!creds.wabaId) throw new CloudApiError("Informe o WABA ID da sessão para listar templates", 400);
    const body = await graph<{ data: CloudTemplate[] }>(creds, `${creds.wabaId}/message_templates?fields=name,language,status,category,components&limit=200`);
    return body.data;
}

/** Validates X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the Meta app secret). */
export function validCloudSignature(rawBody: string, header: string | null, appSecret: string): boolean {
    if (!header?.startsWith("sha256=")) return false;
    const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
    const got = header.slice(7);
    return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** "5511999999999@s.whatsapp.net" → "5511999999999" */
export const jidToWaId = (jid: string) => jid.split("@")[0].split(":")[0].replace(/\D/g, "");
export const waIdToJid = (waId: string) => `${waId.replace(/\D/g, "")}@s.whatsapp.net`;
