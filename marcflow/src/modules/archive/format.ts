export interface Row {
    id: string; keyId: string; fromMe: boolean; senderJid: string | null; senderName: string | null; type: string; text: string | null;
    timestamp: Date; quotedId: string | null; mediaState: string; mediaFile: string | null; mediaMime: string | null; mediaSize: number | null; mediaError: string | null;
    quote?: Row | null;
}
export interface ChatInfo { id: string; jid: string; name: string | null; isGroup: boolean; folder: string }

const TYPE_LABEL: Record<string, string> = { AUDIO: "áudio", IMAGE: "imagem", VIDEO: "vídeo", DOCUMENT: "documento", STICKER: "figurinha", LOCATION: "localização", CONTACT: "contato", TEXT: "texto" };
export const typeLabel = (t: string) => TYPE_LABEL[t] ?? t.toLowerCase();

const formatters = new Map<string, Intl.DateTimeFormat>();
/** 18/10/2026 14:03:22 in the viewer's time zone (invalid zones fall back to UTC). */
export function stamp(d: Date, tz: string) {
    let f = formatters.get(tz);
    if (!f) {
        const opts = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" } as const;
        try { f = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, ...opts }); } catch { f = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opts }); }
        formatters.set(tz, f);
    }
    const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
    return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

export const phone = (jid: string | null) => (jid ? "+" + jid.split("@")[0] : "");
export const chatTitle = (c: Pick<ChatInfo, "name" | "jid">) => c.name || (c.jid.endsWith("@g.us") ? `Grupo ${c.jid.split("@")[0]}` : phone(c.jid));
export const senderLabel = (r: Row, c: ChatInfo) => (r.fromMe ? "Você" : r.senderName || phone(r.senderJid) || chatTitle(c));

/** What the conversation shows in place of a file: where it is, or why it isn't there. */
export function mediaMarker(r: Row) {
    const t = typeLabel(r.type);
    switch (r.mediaState) {
        case "saved": return `[${t}: ${r.mediaFile}]`;
        case "skipped": return `[${t} (mídia não incluída na exportação)]`;
        case "unavailable": return `[${t} indisponível: ${r.mediaError ?? "arquivo não disponível"}]`;
        case "error": return `[${t} com erro ao baixar: ${r.mediaError ?? "erro desconhecido"}]`;
        case "pending": return `[${t} com download pendente]`;
        default: return null;
    }
}

const snippet = (s: string) => (s.length > 80 ? s.slice(0, 80).trimEnd() + "…" : s).replace(/\s+/g, " ");

/**
 * [18/10/2026 14:03:22] Maria: texto
 *     ↪ em resposta a João: "trecho da mensagem respondida"
 * Continuation lines are indented so a message never looks like a new one.
 */
export function formatLine(r: Row, c: ChatInfo, tz: string) {
    const text = r.text ?? "";
    const body = [mediaMarker(r), text].filter(Boolean).join(" ") || "(mensagem vazia)";
    let out = `[${stamp(r.timestamp, tz)}] ${senderLabel(r, c)}: ${body.replace(/\r?\n/g, "\n    ")}`;
    if (r.quotedId) {
        const q = r.quote;
        out += q
            ? `\n    ↪ em resposta a ${senderLabel(q, c)}: “${snippet(q.text || mediaMarker(q) || "")}”`
            : "\n    ↪ em resposta a uma mensagem que não está no histórico";
    }
    return out;
}

export const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`);
