"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ReactFlowProvider } from "@xyflow/react";
import { Loader2 } from "lucide-react";
import { useSession } from "@/components/dashboard/session-provider";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { Button } from "@/components/ui/button";
import { FlowEditor, type LoadedFlow } from "@/components/flows/flow-editor";
import type { FlowMeta } from "@/components/flows/editor-context";

export default function FlowEditorPage() {
    const { flowId } = useParams<{ flowId: string }>();
    const { sessionId } = useSession();
    const [flow, setFlow] = useState<LoadedFlow | null>(null);
    const [meta, setMeta] = useState<FlowMeta | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionId) return;
        let alive = true;
        Promise.all([
            fetch(`/api/flows/${sessionId}/${flowId}`).then(r => r.json().then(j => ({ ok: r.ok, j }))),
            fetch(`/api/flows/${sessionId}/meta`).then(r => r.json().then(j => ({ ok: r.ok, j }))),
        ]).then(([f, m]) => {
            if (!alive) return;
            if (!f.ok) return setError(f.j.message || "Fluxo não encontrado");
            if (!m.ok) return setError(m.j.message || "Falha ao carregar");
            setFlow(f.j.data);
            setMeta(m.j.data);
        }).catch(() => alive && setError("Falha ao carregar o fluxo"));
        return () => { alive = false; };
    }, [sessionId, flowId]);

    return (
        <SessionGuard>
            {error ? (
                <div className="flex flex-col items-center gap-3 p-10 text-center">
                    <p className="text-muted-foreground">{error}</p>
                    <Button asChild variant="outline"><Link href="/dashboard/flows">Voltar para os fluxos</Link></Button>
                </div>
            ) : !flow || !meta || !sessionId ? (
                <div className="flex h-full items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando o fluxo...</div>
            ) : (
                <ReactFlowProvider>
                    <FlowEditor key={flow.id} sessionId={sessionId} initial={flow} initialMeta={meta} />
                </ReactFlowProvider>
            )}
        </SessionGuard>
    );
}
