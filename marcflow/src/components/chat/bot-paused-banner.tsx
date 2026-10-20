"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Loader2 } from "lucide-react";

/** Shown while flows/auto-reply are paused for this contact (a flow handed the chat to a human). */
export function BotPausedBanner({ sessionId, jid }: { sessionId: string; jid: string }) {
    const [paused, setPaused] = useState(false);
    const [busy, setBusy] = useState(false);
    const url = `/api/flows/${sessionId}/contact-automation?jid=${encodeURIComponent(jid)}`;

    useEffect(() => {
        let alive = true;
        const load = () => fetch(url).then(r => r.json()).then(j => alive && setPaused(!!j?.data?.paused)).catch(() => undefined);
        load();
        const t = setInterval(load, 30_000); // a flow may hand the chat over while it is open
        return () => { alive = false; clearInterval(t); };
    }, [url]);

    if (!paused) return null;
    const resume = async () => {
        setBusy(true);
        const res = await fetch(url, { method: "DELETE" });
        const json = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return toast.error(json.message || "Falha ao reativar");
        setPaused(false);
        toast.success(json.message);
    };
    return (
        <div className="mb-2 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs">
            <Bot className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="min-w-0 flex-1">Robô pausado: este contato está em atendimento humano. Fluxos e respostas automáticas não respondem.</span>
            <button type="button" onClick={resume} disabled={busy} className="shrink-0 rounded-full bg-background px-3 py-1 font-semibold hover:bg-muted disabled:opacity-50">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Reativar robô"}
            </button>
        </div>
    );
}
