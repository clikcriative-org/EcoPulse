import { MAX_ACTIONS, MAX_SECONDS, type ActionType, type QuickReplyAction } from "./types";

const MEDIA = new Set(["image", "video", "audio", "document", "sticker"]);
const TIMERS = new Set(["wait", "typing", "recording"]);
const BARE = new Set(["removeAllLabels", "archive", "unarchive", "pin", "unpin", "markUnread", "block"]);

const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const secs = (v: unknown) => Math.min(MAX_SECONDS, Math.max(0, Math.round(Number(v) || 0)));

/** Validates actions coming from the client. Throws a user-facing message on the first problem. */
export function parseActions(raw: unknown): QuickReplyAction[] {
    if (!Array.isArray(raw) || !raw.length) throw new Error("Adicione pelo menos uma ação");
    if (raw.length > MAX_ACTIONS) throw new Error(`No máximo ${MAX_ACTIONS} ações`);
    return raw.map((a, i): QuickReplyAction => {
        const type = String(a?.type) as ActionType;
        const n = `Ação ${i + 1}`;
        if (type === "text") {
            const text = str(a.text, 4096);
            if (!text.trim()) throw new Error(`${n}: escreva o texto`);
            return { type, text, typing: secs(a.typing), wait: secs(a.wait) };
        }
        if (MEDIA.has(type)) {
            if (!a.assetId) throw new Error(`${n}: envie o arquivo`);
            return { type: type as "image", assetId: str(a.assetId, 40), fileName: a.fileName ? str(a.fileName, 200) : undefined, caption: a.caption ? str(a.caption, 1024) : undefined };
        }
        if (type === "contact") {
            const phone = str(a.phone, 20).replace(/\D/g, "");
            if (!str(a.name, 100).trim() || phone.length < 8) throw new Error(`${n}: informe nome e telefone do contato`);
            return { type, name: str(a.name, 100).trim(), phone };
        }
        if (type === "groupInvite") {
            if (!String(a.groupJid || "").endsWith("@g.us")) throw new Error(`${n}: escolha o grupo`);
            return { type, groupJid: str(a.groupJid, 80) };
        }
        if (TIMERS.has(type)) return { type: type as "wait", seconds: secs(a.seconds) || 1 };
        if (type === "addLabel" || type === "removeLabel") {
            if (!a.labelId) throw new Error(`${n}: escolha a etiqueta`);
            return { type, labelId: str(a.labelId, 40) };
        }
        if (BARE.has(type)) return { type: type as "block" };
        throw new Error(`${n}: tipo de ação desconhecido`);
    });
}

/** "Bom dia" / "Boa tarde" / "Boa noite" and the matching period, from the hour in the system timezone. */
export function dayPeriod(hour: number) {
    if (hour >= 5 && hour < 12) return { periodo: "manhã", saudacao: "Bom dia" };
    if (hour >= 12 && hour < 18) return { periodo: "tarde", saudacao: "Boa tarde" };
    return { periodo: "noite", saudacao: "Boa noite" };
}

/** Replaces #tag tokens that have a value. Unknown hashtags stay untouched, so "#promo" survives. */
export function renderTags(text: string, vars: Record<string, string | undefined>): string {
    return text.replace(/#([\p{L}\p{N}_-]+)/gu, (m, key: string) => vars[key] ?? m);
}

export function contactVars(name: string, jid: string, hour: number, fields: Record<string, string> = {}): Record<string, string> {
    const full = name.trim();
    const { periodo, saudacao } = dayPeriod(hour);
    return {
        ...fields,
        nome: full,
        primeiroNome: full.split(/\s+/)[0] || "",
        numero: jid.split("@")[0].split(":")[0],
        "periodo-dia": periodo,
        "saudação": saudacao,
        saudacao,
    };
}
