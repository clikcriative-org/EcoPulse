// Quick replies: modelled on WaSeller's "raio" (docs/waseller-respostas-rapidas.md).
// Pix, List, Link banner, CRM and attendant transfer are left out: Baileys can't send them
// reliably on non-official accounts, or MarcFlow has no such feature.

export type MediaKind = "image" | "video" | "audio" | "document" | "sticker";

export type QuickReplyAction =
    | { type: "text"; typing: number; text: string; wait: number }
    | { type: MediaKind; assetId: string; fileName?: string; caption?: string }
    | { type: "contact"; name: string; phone: string }
    | { type: "groupInvite"; groupJid: string }
    | { type: "wait" | "typing" | "recording"; seconds: number }
    | { type: "addLabel" | "removeLabel"; labelId: string }
    | { type: "removeAllLabels" | "archive" | "unarchive" | "pin" | "unpin" | "markUnread" | "block" };

export type ActionType = QuickReplyAction["type"];

export const MAX_ACTIONS = 30;
export const MAX_SECONDS = 60;

export const ACTION_GROUPS: { label: string; items: { type: ActionType; label: string }[] }[] = [
    {
        label: "Enviar mensagem", items: [
            { type: "text", label: "Texto" }, { type: "image", label: "Imagem" }, { type: "video", label: "Vídeo" },
            { type: "audio", label: "Áudio (voz)" }, { type: "document", label: "Documento" }, { type: "sticker", label: "Figurinha" },
            { type: "contact", label: "Contato" }, { type: "groupInvite", label: "Convite para grupo" },
        ],
    },
    {
        label: "Etiquetas", items: [
            { type: "addLabel", label: "Adicionar etiqueta" }, { type: "removeLabel", label: "Remover etiqueta" },
            { type: "removeAllLabels", label: "Remover todas as etiquetas" },
        ],
    },
    {
        label: "Temporizadores", items: [
            { type: "wait", label: "Esperar" }, { type: "typing", label: "Mostrar \"digitando…\"" }, { type: "recording", label: "Mostrar \"gravando áudio…\"" },
        ],
    },
    {
        label: "Utilitários", items: [
            { type: "archive", label: "Arquivar conversa" }, { type: "unarchive", label: "Desarquivar conversa" },
            { type: "pin", label: "Fixar conversa" }, { type: "unpin", label: "Desfixar conversa" },
            { type: "markUnread", label: "Marcar como não lida" }, { type: "block", label: "Bloquear contato" },
        ],
    },
];

export const ACTION_LABEL = Object.fromEntries(ACTION_GROUPS.flatMap(g => g.items.map(i => [i.type, i.label]))) as Record<ActionType, string>;

export function defaultAction(type: ActionType): QuickReplyAction {
    switch (type) {
        case "text": return { type, typing: 3, text: "", wait: 2 };
        case "image": case "video": case "audio": case "document": case "sticker": return { type, assetId: "" };
        case "contact": return { type, name: "", phone: "" };
        case "groupInvite": return { type, groupJid: "" };
        case "wait": case "typing": case "recording": return { type, seconds: 5 };
        case "addLabel": case "removeLabel": return { type, labelId: "" };
        default: return { type } as QuickReplyAction;
    }
}

export const GENERAL_TAGS = ["nome", "primeiroNome", "numero", "periodo-dia", "saudação"] as const;
