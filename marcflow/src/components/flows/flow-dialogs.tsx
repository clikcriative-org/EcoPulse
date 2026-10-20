"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Bot, Loader2, Plus, RefreshCw, RotateCcw, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BLOCKS, type GraphIssue, type NodeType } from "@/modules/flows/types";

// ---------- triggers ----------
export interface Trigger { type: string; keyword?: string | null; matchType?: string | null; priority?: number }

export function TriggersDialog({ open, onOpenChange, sessionId, flowId, initial, onSaved }: {
    open: boolean; onOpenChange: (o: boolean) => void; sessionId: string; flowId: string; initial: Trigger[]; onSaved: (t: Trigger[]) => void;
}) {
    // mounted only while open, so the initial state is always fresh
    const [list, setList] = useState<Trigger[]>(() => initial.length ? initial : [{ type: "KEYWORD", keyword: "", matchType: "EXACT", priority: 0 }]);
    const [busy, setBusy] = useState(false);

    const save = async () => {
        setBusy(true);
        const res = await fetch(`/api/flows/${sessionId}/${flowId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ triggers: list.filter(t => t.type !== "KEYWORD" || t.keyword?.trim()) }) });
        const json = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return toast.error(json.message || "Falha ao salvar os gatilhos");
        onSaved(json.data.triggers);
        toast.success("Gatilhos salvos");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Quando este fluxo começa</DialogTitle>
                    <DialogDescription>O fluxo só dispara depois de publicado e ativo. Se vários fluxos baterem, vence a palavra-chave de maior prioridade; depois &quot;primeira mensagem&quot;; por último &quot;qualquer mensagem&quot;.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    {list.map((t, i) => (
                        <div key={i} className="space-y-2 rounded-lg border p-3">
                            <div className="flex gap-2">
                                <Select value={t.type} onValueChange={type => setList(list.map((x, k) => k === i ? { ...x, type } : x))}>
                                    <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="KEYWORD">Palavra-chave</SelectItem>
                                        <SelectItem value="FIRST_MESSAGE">Primeira mensagem do contato</SelectItem>
                                        <SelectItem value="ANY_MESSAGE">Qualquer mensagem (fluxo padrão)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => setList(list.filter((_, k) => k !== i))}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                            {t.type === "KEYWORD" && (
                                <div className="flex gap-2">
                                    <Select value={t.matchType || "EXACT"} onValueChange={matchType => setList(list.map((x, k) => k === i ? { ...x, matchType } : x))}>
                                        <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="EXACT">É igual a</SelectItem>
                                            <SelectItem value="WORD">Palavra isolada</SelectItem>
                                            <SelectItem value="CONTAINS">Contém</SelectItem>
                                            <SelectItem value="REGEX">Regex</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Input className="h-9 flex-1" placeholder="Ex.: oi, menu, preço" value={t.keyword || ""} onChange={e => setList(list.map((x, k) => k === i ? { ...x, keyword: e.target.value } : x))} />
                                    <Input className="h-9 w-20" type="number" title="Prioridade" value={t.priority ?? 0} onChange={e => setList(list.map((x, k) => k === i ? { ...x, priority: Number(e.target.value) || 0 } : x))} />
                                </div>
                            )}
                        </div>
                    ))}
                    <Button variant="outline" className="w-full border-dashed" onClick={() => setList([...list, { type: "KEYWORD", keyword: "", matchType: "EXACT", priority: 0 }])}><Plus className="h-4 w-4" /> Adicionar gatilho</Button>
                    <p className="text-[11px] text-muted-foreground">Palavra-chave ignora maiúsculas e acentos. &quot;Palavra isolada&quot; aceita pontuação e emojis em volta (&quot;Oi!&quot;, &quot;Oi, tudo bem?&quot;) e não confunde com &quot;Foi&quot;. Grupos e mensagens enviadas por você nunca disparam fluxos.</p>
                </div>
                <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Salvar gatilhos</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------- test ----------
export function TestDialog({ open, onOpenChange, onRun }: { open: boolean; onOpenChange: (o: boolean) => void; onRun: (phone: string) => Promise<boolean> }) {
    const [phone, setPhone] = useState(() => { try { return localStorage.getItem("flow-test-phone") || ""; } catch { return ""; } });
    const [busy, setBusy] = useState(false);
    const run = async () => {
        setBusy(true);
        try { localStorage.setItem("flow-test-phone", phone); } catch { /* storage blocked */ }
        const okRun = await onRun(phone);
        setBusy(false);
        if (okRun) onOpenChange(false);
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Testar o rascunho</DialogTitle>
                    <DialogDescription>Envia o fluxo de verdade pelo WhatsApp conectado para o número abaixo. Responda pelo celular para seguir a conversa. Use um número seu.</DialogDescription>
                </DialogHeader>
                <Input autoFocus placeholder="5521999999999" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && run()} />
                <DialogFooter><Button onClick={run} disabled={busy || phone.replace(/\D/g, "").length < 10}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar teste</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------- issues ----------
export function IssuesList({ issues, onPick }: { issues: GraphIssue[]; onPick: (nodeId?: string) => void }) {
    if (!issues.length) return <p className="p-3 text-sm text-emerald-600">Tudo certo para publicar.</p>;
    return (
        <ul className="max-h-72 space-y-1 overflow-y-auto p-1">
            {issues.map((i, k) => (
                <li key={k}>
                    <button type="button" onClick={() => onPick(i.nodeId)} className="flex w-full gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i.level === "error" ? "bg-destructive" : "bg-amber-500"}`} />{i.message}
                    </button>
                </li>
            ))}
        </ul>
    );
}

// ---------- runs ----------
interface RunRow { id: string; contactJid: string; contactName: string | null; status: string; isTest: boolean; startedAt: string; updatedAt: string; error: string | null; resumeAt: string | null }
interface RunLog { id: string; nodeId: string | null; event: string; detail: Record<string, unknown> | null; createdAt: string }

const RUN_STATUS: Record<string, { label: string; className: string }> = {
    RUNNING: { label: "Executando", className: "bg-blue-500/15 text-blue-600" },
    WAITING_INPUT: { label: "Aguardando resposta", className: "bg-violet-500/15 text-violet-600" },
    WAITING_DELAY: { label: "Em espera", className: "bg-orange-500/15 text-orange-600" },
    COMPLETED: { label: "Concluído", className: "bg-emerald-500/15 text-emerald-600" },
    FAILED: { label: "Falhou", className: "bg-destructive/15 text-destructive" },
    CANCELLED: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
    EXPIRED: { label: "Sem resposta", className: "bg-muted text-muted-foreground" },
};

const EVENT: Record<string, string> = {
    START: "Início", ENTER: "Entrou no bloco", SEND: "Enviou", WAIT: "Aguardando", INPUT: "Resposta recebida", INVALID: "Resposta inválida",
    BRANCH: "Decisão", ACTION: "Ação", ERROR: "Erro", END: "Fim",
};

function describe(l: RunLog, nodes: { id: string; type: string }[]): string {
    const d = l.detail || {};
    const type = nodes.find(n => n.id === l.nodeId)?.type as NodeType | undefined;
    if (l.event === "ENTER") return type ? BLOCKS[type].label : "";
    if (l.event === "SEND") return String(d.summary || "") + (d.to ? ` → ${d.to}` : "");
    if (l.event === "WAIT") return d.until ? `até ${new Date(String(d.until)).toLocaleString("pt-BR")}` : "";
    if (l.event === "INPUT") return d.option ? `opção ${d.option} (${d.text})` : `${d.field ? d.field + " = " : ""}${d.value ?? ""}`;
    if (l.event === "INVALID") return `"${d.answer}" (${d.attempts ?? d.errors}ª)`;
    if (l.event === "BRANCH") return d.result !== undefined ? (d.result ? "Verdadeiro" : "Falso") : d.option ? `Opção ${d.option}` : String(d.path || d.skipped || "");
    if (l.event === "ERROR") return String(d.error || "");
    if (l.event === "END") return RUN_STATUS[String(d.status)]?.label || String(d.status || "");
    if (l.event === "START") return d.test ? "teste" : "";
    return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(", ");
}

export function RunsSheet({ open, onOpenChange, sessionId, flowId }: { open: boolean; onOpenChange: (o: boolean) => void; sessionId: string; flowId: string }) {
    const [runs, setRuns] = useState<RunRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<(RunRow & { logs: RunLog[]; nodes: { id: string; type: string }[] }) | null>(null);

    const load = useCallback(async () => {
        const res = await fetch(`/api/flows/${sessionId}/${flowId}/runs`);
        const json = await res.json().catch(() => ({}));
        setLoading(false);
        if (res.ok) setRuns(json.data);
    }, [sessionId, flowId]);

    const openRun = async (id: string) => {
        const res = await fetch(`/api/flows/${sessionId}/runs/${id}`);
        const json = await res.json().catch(() => ({}));
        if (res.ok) setDetail(json.data);
    };

    const cancel = async (id: string) => {
        const res = await fetch(`/api/flows/${sessionId}/runs/${id}`, { method: "DELETE" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return toast.error(json.message);
        toast.success("Execução cancelada");
        load();
        if (detail?.id === id) openRun(id);
    };

    useEffect(() => { // mounted only while open
        let alive = true;
        fetch(`/api/flows/${sessionId}/${flowId}/runs`).then(r => r.json().then(j => ({ ok: r.ok, j })))
            .then(({ ok, j }) => { if (!alive) return; setLoading(false); if (ok) setRuns(j.data); })
            .catch(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [sessionId, flowId]);

    const active = (s: string) => ["RUNNING", "WAITING_INPUT", "WAITING_DELAY"].includes(s);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2 pr-8">
                        {detail && <button type="button" onClick={() => setDetail(null)} className="rounded p-1 hover:bg-muted"><ArrowLeft className="h-4 w-4" /></button>}
                        {detail ? (detail.contactName || detail.contactJid.split("@")[0]) : "Execuções"}
                        {!detail && <Button size="icon" variant="ghost" className="ml-auto h-8 w-8" onClick={() => { setLoading(true); load(); }}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>}
                    </SheetTitle>
                </SheetHeader>
                {!detail ? (
                    <div className="mt-4 space-y-2 px-4 pb-4">
                        {!runs.length && !loading && <p className="text-sm text-muted-foreground">Nenhuma execução ainda. Publique o fluxo e mande a palavra-chave, ou use o botão Testar.</p>}
                        {runs.map(r => (
                            <button key={r.id} type="button" onClick={() => openRun(r.id)} className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-muted/50">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{r.contactName || r.contactJid.split("@")[0]} {r.isTest && <Badge variant="outline" className="ml-1 text-[10px]">teste</Badge>}</p>
                                    <p className="text-[11px] text-muted-foreground">{new Date(r.startedAt).toLocaleString("pt-BR")}</p>
                                    {r.error && <p className="truncate text-[11px] text-destructive">{r.error}</p>}
                                </div>
                                <Badge variant="secondary" className={RUN_STATUS[r.status]?.className}>{RUN_STATUS[r.status]?.label || r.status}</Badge>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="mt-4 space-y-3 px-4 pb-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={RUN_STATUS[detail.status]?.className}>{RUN_STATUS[detail.status]?.label}</Badge>
                            {detail.resumeAt && active(detail.status) && <span className="text-[12px] text-muted-foreground">até {new Date(detail.resumeAt).toLocaleString("pt-BR")}</span>}
                            {active(detail.status) && <Button size="sm" variant="outline" className="ml-auto text-destructive" onClick={() => cancel(detail.id)}><X className="h-3.5 w-3.5" />Cancelar</Button>}
                        </div>
                        {detail.error && <p className="rounded-md bg-destructive/10 p-2 text-[12px] text-destructive">{detail.error}</p>}
                        <ol className="relative space-y-2 border-l pl-4">
                            {detail.logs.map(l => (
                                <li key={l.id} className="text-[13px]">
                                    <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${l.event === "ERROR" ? "bg-destructive" : l.event === "INVALID" ? "bg-amber-500" : "bg-primary/60"}`} />
                                    <span className="font-medium">{EVENT[l.event] || l.event}</span> <span className="text-muted-foreground">{describe(l, detail.nodes)}</span>
                                    <span className="ml-1 text-[10px] text-muted-foreground">{new Date(l.createdAt).toLocaleTimeString("pt-BR")}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

// ---------- bot settings ("Campos do robô" values) ----------
interface BotVar { key: string; label: string; description: string | null; value: string }

export function BotVarsDialog({ open, onOpenChange, sessionId }: { open: boolean; onOpenChange: (o: boolean) => void; sessionId: string }) {
    const [vars, setVars] = useState<BotVar[] | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => { // mounted only while open
        let alive = true;
        fetch(`/api/flows/${sessionId}/bot-vars`).then(r => r.json()).then(j => alive && setVars(j.data || [])).catch(() => alive && setVars([]));
        return () => { alive = false; };
    }, [sessionId]);

    const save = async () => {
        if (!vars) return;
        setBusy(true);
        const res = await fetch(`/api/flows/${sessionId}/bot-vars`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: Object.fromEntries(vars.map(v => [v.key, v.value])) }) });
        const json = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return toast.error(json.message || "Falha ao salvar");
        toast.success("Configurações salvas");
        onOpenChange(false);
    };

    const pending = vars?.filter(v => !v.value.trim()).length ?? 0;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="grid-cols-[minmax(0,1fr)] sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Configurações do robô</DialogTitle>
                    <DialogDescription>Valores usados nas mensagens como {"{CHAVE}"}. Campo vazio fica pendente: o fluxo não mostra o valor e oferece confirmação pela equipe.{pending > 0 && <> <b className="text-amber-600">{pending} pendente(s).</b></>}</DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                    {!vars && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
                    {vars?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum campo do robô criado ainda. Crie em qualquer bloco, no seletor de campos, com o escopo &quot;Robô&quot;.</p>}
                    {vars?.map((v, i) => (
                        <div key={v.key} className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{v.label}</span>
                                <code className="text-[11px] text-muted-foreground">{`{${v.key}}`}</code>
                                {!v.value.trim() && <Badge variant="outline" className="ml-auto border-amber-500/40 text-[10px] text-amber-600">Pendente</Badge>}
                            </div>
                            {v.description && <p className="text-[11px] text-muted-foreground">{v.description}</p>}
                            <textarea rows={v.value.length > 60 || v.value.includes("\n") ? 3 : 1} value={v.value}
                                onChange={e => setVars(vars.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))}
                                className="w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
                        </div>
                    ))}
                </div>
                <DialogFooter><Button onClick={save} disabled={busy || !vars}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------- chat simulator (draft, nothing goes to WhatsApp) ----------
type SimMsg = { kind: "me" | "bot" | "internal" | "error" | "note"; text: string; block?: string };

const SIM_NOTE: Record<string, string> = {
    "no-trigger": "Essa mensagem não aciona o gatilho do fluxo.",
    paused: "Robô pausado para este contato (atendimento humano). Reinicie para começar de novo.",
    waiting: "O fluxo está numa espera programada e não lê mensagens agora.",
};

export function SimulatorSheet({ open, onOpenChange, sessionId, flowId, beforeSend }: {
    open: boolean; onOpenChange: (o: boolean) => void; sessionId: string; flowId: string; beforeSend: () => Promise<boolean>;
}) {
    const [msgs, setMsgs] = useState<SimMsg[]>([]);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const end = useRef<HTMLDivElement>(null);
    useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);

    const call = async (body: object) => {
        const res = await fetch(`/api/flows/${sessionId}/${flowId}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        return { res, json: await res.json().catch(() => ({})) };
    };

    const send = async () => {
        const t = text.trim();
        if (!t || busy) return;
        setBusy(true);
        if (!(await beforeSend())) { setBusy(false); return; }
        setText("");
        setMsgs(m => [...m, { kind: "me", text: t }]);
        const { res, json } = await call({ text: t });
        setBusy(false);
        if (!res.ok) { setMsgs(m => [...m, { kind: "error", text: json.message || "Falha na simulação" }]); return; }
        const d = json.data as { outcome: string; status: string | null; messages: SimMsg[] };
        const extra: SimMsg[] = [...d.messages];
        if (SIM_NOTE[d.outcome]) extra.push({ kind: "note", text: SIM_NOTE[d.outcome] });
        else if (d.status === "COMPLETED" || d.status === "EXPIRED") extra.push({ kind: "note", text: "Conversa encerrada pelo fluxo." });
        else if (d.status === "FAILED") extra.push({ kind: "error", text: "O fluxo falhou. Veja os detalhes em Execuções." });
        setMsgs(m => [...m, ...extra]);
    };

    const reset = async () => {
        setBusy(true);
        const { res, json } = await call({ reset: true });
        setBusy(false);
        if (!res.ok) return toast.error(json.message);
        setMsgs([]);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
                <SheetHeader className="border-b p-4">
                    <SheetTitle className="flex items-center gap-2 pr-8"><Bot className="h-4 w-4" />Simular conversa
                        <Button size="sm" variant="ghost" className="ml-auto h-8" onClick={reset} disabled={busy} title="Apaga campos, etiquetas e pausa do contato simulado"><RotateCcw className="h-3.5 w-3.5" />Reiniciar</Button>
                    </SheetTitle>
                    <p className="text-[12px] text-muted-foreground">Usa o rascunho atual. Nada é enviado pelo WhatsApp: notificações para a equipe aparecem só aqui.</p>
                </SheetHeader>
                <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-4">
                    {!msgs.length && <p className="text-center text-[12px] text-muted-foreground">Escreva como se fosse o contato. Comece pela palavra do gatilho.</p>}
                    {msgs.map((m, i) => (
                        m.kind === "note" || m.kind === "error"
                            ? <p key={i} className={`text-center text-[11px] ${m.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>{m.text}</p>
                            : <div key={i} className={`flex ${m.kind === "me" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-[13px] shadow-sm ${m.kind === "me" ? "bg-primary text-primary-foreground" : m.kind === "internal" ? "border border-dashed border-amber-500/50 bg-amber-500/10" : "bg-card"}`}>
                                    {m.kind === "internal" && <p className="mb-1 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">Notificação interna (não enviada)</p>}
                                    {m.text}
                                    {m.block && <p className="mt-1 text-[10px] opacity-60">{m.block}</p>}
                                </div>
                            </div>
                    ))}
                    <div ref={end} />
                </div>
                <form className="flex gap-2 border-t p-3" onSubmit={e => { e.preventDefault(); send(); }}>
                    <Input value={text} onChange={e => setText(e.target.value)} placeholder="Mensagem do contato" disabled={busy} autoFocus />
                    <Button type="submit" size="icon" disabled={busy || !text.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                </form>
            </SheetContent>
        </Sheet>
    );
}
