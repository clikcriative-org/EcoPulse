// Broadcast message variables, shared by the preview (client) and the sender (server).

export const BROADCAST_VARIABLES = [
    { key: "nome", label: "Nome completo" },
    { key: "primeiro_nome", label: "Primeiro nome" },
    { key: "telefone", label: "Telefone" },
] as const;

export const MAX_MESSAGE_LENGTH = 4096;

/** "5521999998888@s.whatsapp.net" -> "5521999998888"; LIDs have no visible number. */
export const phoneOf = (jid: string) => (jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0].split(":")[0] : "");

/** Replaces {{nome}}, {{primeiro_nome}} and {{telefone}}; unknown {{...}} stay as typed. */
export function renderBroadcast(text: string, contact: { name?: string | null; jid: string }): string {
    const full = (contact.name || "").trim();
    const vars: Record<string, string> = { nome: full, primeiro_nome: full.split(/\s+/)[0] || "", telefone: phoneOf(contact.jid) };
    return text.replace(/\{\{\s*([\w]+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

/** Phone numbers found in pasted text or an imported file (CSV/TXT): 10-15 digits each, deduplicated. */
export function parsePhones(text: string): string[] {
    const out = new Set<string>();
    for (const raw of text.split(/[\n,;\t]+/)) {
        const digits = raw.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 15) out.add(digits);
    }
    return [...out];
}
