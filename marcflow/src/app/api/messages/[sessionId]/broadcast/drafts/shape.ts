import { clampInterval } from "@/modules/broadcast/runner";
import { MAX_MESSAGE_LENGTH } from "@/modules/broadcast/template";

/** Validates a draft body; drafts may be incomplete, but never invalid. */
export function draftData(b: Record<string, unknown>): { error: string } | { data: DraftInput } {
    const recipients = Array.isArray(b.recipients) ? [...new Set(b.recipients.map(String).filter(j => /@(s\.whatsapp\.net|lid)$/.test(j)))] : [];
    const message = String(b.message ?? "");
    if (message.length > MAX_MESSAGE_LENGTH) return { error: `A mensagem pode ter no máximo ${MAX_MESSAGE_LENGTH} caracteres` };
    if (recipients.length > 10_000) return { error: "No máximo 10.000 destinatários" };
    const scheduledAt = b.scheduledAt ? new Date(String(b.scheduledAt)) : null;
    if (scheduledAt && isNaN(scheduledAt.getTime())) return { error: "Data de agendamento inválida" };
    return { data: {
        name: String(b.name ?? "").trim().slice(0, 120),
        message,
        recipients,
        mediaAssetId: b.mediaAssetId ? String(b.mediaAssetId) : null,
        intervalMs: clampInterval(Number(b.intervalMs) || 10_000),
        pauseOnFailure: !!b.pauseOnFailure,
        skipOptedOut: b.skipOptedOut !== false,
        scheduledAt,
    } };
}

interface DraftInput {
    name: string; message: string; recipients: string[]; mediaAssetId: string | null; intervalMs: number;
    pauseOnFailure: boolean; skipOptedOut: boolean; scheduledAt: Date | null;
}
