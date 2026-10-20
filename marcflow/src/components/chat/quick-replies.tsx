"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
    Archive, ArchiveRestore, ArrowLeft, Ban, Clock, Contact, Copy, Eye, File, FileText, GripVertical, Hash, Image as ImageIcon, LayoutGrid,
    Mic, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, SendHorizontal, Sticker, Tag, Trash2, Users, Video, X, Zap, MailWarning, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ACTION_GROUPS, ACTION_LABEL, GENERAL_TAGS, defaultAction, type ActionType, type QuickReplyAction } from "@/modules/quick-replies/types";

interface Category { id: string; name: string; color: string }
interface Reply { id: string; title: string; categoryId: string | null; category: Category | null; actions: QuickReplyAction[]; usageCount: number }
interface Meta { labels: { id: string; name: string; colorHex: string }[]; fields: { key: string; label: string }[]; groups: { jid: string; subject: string | null }[] }
type View = { kind: "list" } | { kind: "form"; mode: "create" | "edit" | "send"; reply?: Reply } | { kind: "categories" };
type Filter = { kind: "all" | "none" | "top" } | { kind: "type"; value: string } | { kind: "category"; value: string };

const ICON: Record<ActionType, typeof Zap> = {
    text: FileText, image: ImageIcon, video: Video, audio: Mic, document: File, sticker: Sticker, contact: Contact, groupInvite: Users,
    wait: Clock, typing: Pencil, recording: Mic, addLabel: Tag, removeLabel: Tag, removeAllLabels: Tag,
    archive: Archive, unarchive: ArchiveRestore, pin: Pin, unpin: PinOff, markUnread: MailWarning, block: Ban,
};
const ACCEPT: Partial<Record<ActionType, string>> = { image: "image/jpeg,image/png,image/webp", video: "video/mp4,video/3gpp", audio: "audio/*", document: "*/*", sticker: "image/webp" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
    const isForm = init?.body instanceof FormData;
    const res = await fetch(url, { ...init, headers: init?.body && !isForm ? { "Content-Type": "application/json" } : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status === false) throw new Error(json.message || "Falha na requisição");
    return json.data as T;
}

/** Progress of the quick reply running in this chat, pushed by the server over socket.io. */
export function useQuickReplyProgress(getSocket: () => { on: (e: string, f: (p: Progress) => void) => void; off: (e: string, f: (p: Progress) => void) => void } | null, jid: string) {
    const [progress, setProgress] = useState<Progress | null>(null);
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const onProgress = (p: Progress) => {
            if (p.jid !== jid) return;
            if (p.done) {
                setProgress(null);
                if (p.error) toast.error(`"${p.title}": ${p.error}`);
            } else setProgress(p);
        };
        socket.on("quickreply.progress", onProgress);
        return () => socket.off("quickreply.progress", onProgress);
    }, [getSocket, jid]);
    return progress;
}
export interface Progress { jid: string; title: string; step: number; total: number; done?: boolean; error?: string }

export function QuickReplyPanel({ sessionId, jid, onClose }: { sessionId: string; jid: string; onClose: () => void }) {
    const base = `/api/quick-replies/${sessionId}`;
    const [replies, setReplies] = useState<Reply[] | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [meta, setMeta] = useState<Meta>({ labels: [], fields: [], groups: [] });
    const [view, setView] = useState<View>({ kind: "list" });
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>({ kind: "all" });
    const [toDelete, setToDelete] = useState<Reply | null>(null);

    const load = useCallback(() => Promise.all([api<Reply[]>(base), api<Category[]>(`${base}/categories`)])
        .then(([r, c]) => { setReplies(r); setCategories(c); })
        .catch(e => { toast.error((e as Error).message); setReplies([]); }), [base]);
    useEffect(() => {
        Promise.all([api<Reply[]>(base), api<Category[]>(`${base}/categories`)])
            .then(([r, c]) => { setReplies(r); setCategories(c); })
            .catch(e => { toast.error((e as Error).message); setReplies([]); });
        api<Meta>(`${base}/meta`).then(setMeta).catch(() => undefined);
    }, [base]);

    const send = async (actions: QuickReplyAction[] | undefined, reply?: Reply) => {
        try {
            await api(`${base}/send`, { method: "POST", body: JSON.stringify({ jid, replyId: reply?.id, actions, title: reply?.title }) });
            setReplies(rs => rs?.map(r => r.id === reply?.id ? { ...r, usageCount: r.usageCount + 1 } : r) ?? rs);
            return true;
        } catch (e) { toast.error((e as Error).message); return false; }
    };

    const duplicate = async (r: Reply) => {
        try {
            await api(base, { method: "POST", body: JSON.stringify({ title: `${r.title} (cópia)`.slice(0, 120), actions: r.actions, categoryId: r.categoryId }) });
            toast.success("Resposta duplicada"); load();
        } catch (e) { toast.error((e as Error).message); }
    };

    const remove = async (r: Reply) => {
        try { await api(`${base}/${r.id}`, { method: "DELETE" }); toast.success("Resposta rápida excluída"); load(); }
        catch (e) { toast.error((e as Error).message); }
    };

    const q = search.trim().toLowerCase();
    const shown = (replies || [])
        .filter(r => !q || r.title.toLowerCase().includes(q))
        .filter(r => filter.kind === "none" ? !r.categoryId
            : filter.kind === "type" ? r.actions.some(a => a.type === filter.value)
            : filter.kind === "category" ? r.categoryId === filter.value
            : filter.kind === "top" ? r.usageCount > 0 : true)
        .sort((a, b) => filter.kind === "top" ? b.usageCount - a.usageCount : 0);

    return (
        <aside className="absolute inset-0 z-40 flex flex-col border-l border-border/60 bg-background md:static md:w-[320px] md:shrink-0">
            <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border/60 px-3">
                {view.kind !== "list" && (
                    <button type="button" title="Voltar" onClick={() => setView({ kind: "list" })} className="rounded-full p-2 text-primary hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
                )}
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="flex-1 truncate text-[15px] font-semibold">
                    {view.kind === "list" ? "Respostas rápidas" : view.kind === "categories" ? "Categorias"
                        : view.mode === "create" ? "Criar resposta rápida" : view.mode === "edit" ? "Editar resposta rápida" : "Editar e enviar"}
                </h2>
                <button type="button" title="Fechar" onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            {view.kind === "list" && (
                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="space-y-2 border-b border-border/40 p-3">
                        <div className="flex items-center gap-2">
                            <div className="flex flex-1 items-center gap-2 rounded-full bg-muted/60 px-3">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar resposta rápida"
                                    className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button type="button" title="Criar" className="rounded-full p-2 text-primary hover:bg-muted"><LayoutGrid className="h-5 w-5" /></button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-52 p-1">
                                    <MenuBtn icon={Zap} onClick={() => setView({ kind: "form", mode: "create" })}>Nova resposta rápida</MenuBtn>
                                    <MenuBtn icon={Tag} onClick={() => setView({ kind: "categories" })}>Categorias</MenuBtn>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            <Chip active={filter.kind === "all"} onClick={() => setFilter({ kind: "all" })}>Tudo</Chip>
                            <ChipSelect active={filter.kind === "type"} label="Por tipo" value={filter.kind === "type" ? filter.value : ""}
                                onChange={v => setFilter(v ? { kind: "type", value: v } : { kind: "all" })}
                                options={ACTION_GROUPS[0].items.map(i => ({ value: i.type, label: i.label }))} />
                            <Chip active={filter.kind === "none"} onClick={() => setFilter({ kind: "none" })}>Sem categoria</Chip>
                            <ChipSelect active={filter.kind === "category"} label="Por categoria" value={filter.kind === "category" ? filter.value : ""}
                                onChange={v => setFilter(v ? { kind: "category", value: v } : { kind: "all" })}
                                options={categories.map(c => ({ value: c.id, label: c.name }))} />
                            <Chip active={filter.kind === "top"} onClick={() => setFilter({ kind: "top" })}>Mais usadas</Chip>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {replies === null ? (
                            <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        ) : !replies.length ? (
                            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                                <Zap className="h-8 w-8 text-primary" />
                                <p className="text-sm text-muted-foreground">Crie modelos de resposta com uma sequência de ações e envie com um clique para a conversa aberta.</p>
                                <button type="button" onClick={() => setView({ kind: "form", mode: "create" })}
                                    className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-105">Criar resposta rápida</button>
                            </div>
                        ) : !shown.length ? (
                            <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma resposta encontrada.</p>
                        ) : shown.map(r => {
                            const Icon = ICON[r.actions[0]?.type] || Zap;
                            return (
                                <div key={r.id} className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/60">
                                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{r.title}</p>
                                        <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                                            {r.category && <><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.category.color }} />{r.category.name} · </>}
                                            {r.actions.length} {r.actions.length === 1 ? "ação" : "ações"}{r.usageCount ? ` · usada ${r.usageCount}×` : ""}
                                        </p>
                                    </div>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button type="button" title="Mais opções" className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><MoreHorizontal className="h-4 w-4" /></button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" className="w-48 p-1">
                                            <MenuBtn icon={Copy} onClick={() => duplicate(r)}>Duplicar</MenuBtn>
                                            <MenuBtn icon={Pencil} onClick={() => setView({ kind: "form", mode: "edit", reply: r })}>Editar</MenuBtn>
                                            <MenuBtn icon={Eye} onClick={() => setView({ kind: "form", mode: "send", reply: r })}>Editar e enviar</MenuBtn>
                                            <MenuBtn icon={Trash2} danger onClick={() => setToDelete(r)}>Excluir</MenuBtn>
                                        </PopoverContent>
                                    </Popover>
                                    <button type="button" title="Editar e enviar" onClick={() => setView({ kind: "form", mode: "send", reply: r })}
                                        className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><Eye className="h-4 w-4" /></button>
                                    <button type="button" title="Enviar agora" onClick={() => send(undefined, r)}
                                        className="rounded-full p-1.5 text-primary hover:bg-background"><SendHorizontal className="h-4 w-4" /></button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {view.kind === "form" && (
                <ReplyForm key={`${view.mode}:${view.reply?.id ?? "new"}`} mode={view.mode} reply={view.reply} sessionId={sessionId} categories={categories} meta={meta}
                    onSave={async (data) => {
                        try {
                            if (view.mode === "send") {
                                if (await send(data.actions, view.reply)) setView({ kind: "list" });
                                return;
                            }
                            await api(view.mode === "edit" ? `${base}/${view.reply!.id}` : base, { method: view.mode === "edit" ? "PATCH" : "POST", body: JSON.stringify(data) });
                            toast.success(view.mode === "edit" ? "Resposta rápida salva" : "Resposta rápida criada");
                            setView({ kind: "list" }); load();
                        } catch (e) { toast.error((e as Error).message); }
                    }} />
            )}

            {view.kind === "categories" && <Categories base={base} categories={categories} onChange={load} />}

            <AlertDialog open={!!toDelete} onOpenChange={o => { if (!o) setToDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir resposta rápida?</AlertDialogTitle>
                        <AlertDialogDescription>&quot;{toDelete?.title}&quot; será excluída. Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (toDelete) remove(toDelete); setToDelete(null); }}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </aside>
    );
}

function ReplyForm({ mode, reply, sessionId, categories, meta, onSave }: {
    mode: "create" | "edit" | "send"; reply?: Reply; sessionId: string; categories: Category[]; meta: Meta;
    onSave: (data: { title: string; actions: QuickReplyAction[]; categoryId: string | null }) => Promise<void>;
}) {
    const [title, setTitle] = useState(reply?.title ?? "");
    const [actions, setActions] = useState<QuickReplyAction[]>(() => reply?.actions.map(a => ({ ...a })) ?? []);
    const [categoryId, setCategoryId] = useState(reply?.categoryId ?? "");
    const [saving, setSaving] = useState(false);
    const [drag, setDrag] = useState<number | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    // Last focused text box, so #Tags can be inserted where the cursor is
    const focused = useRef<{ index: number; key: "text" | "caption"; el: HTMLTextAreaElement | HTMLInputElement } | null>(null);

    const update = (i: number, patch: Partial<QuickReplyAction>) => setActions(list => list.map((a, j) => j === i ? { ...a, ...patch } as QuickReplyAction : a));
    const move = (from: number, to: number) => setActions(list => { const l = [...list]; const [x] = l.splice(from, 1); l.splice(to, 0, x); return l; });

    const insertTag = (tag: string) => {
        const f = focused.current;
        if (!f) { toast.info("Clique primeiro no texto onde a tag deve entrar"); return; }
        const cur = String((actions[f.index] as Record<string, unknown>)?.[f.key] ?? "");
        const start = f.el.selectionStart ?? cur.length, end = f.el.selectionEnd ?? cur.length;
        update(f.index, { [f.key]: cur.slice(0, start) + `#${tag}` + cur.slice(end) } as Partial<QuickReplyAction>);
        requestAnimationFrame(() => { f.el.focus(); const p = start + tag.length + 1; f.el.setSelectionRange(p, p); });
    };

    const submit = async () => {
        if (mode !== "send" && !title.trim()) { toast.error("Informe o título"); return; }
        if (!actions.length) { toast.error("Adicione pelo menos uma ação"); return; }
        setSaving(true);
        try { await onSave({ title: title.trim(), actions, categoryId: categoryId || null }); } finally { setSaving(false); }
    };

    const tags = [...GENERAL_TAGS, ...meta.fields.map(f => f.key)];

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-3">
                {mode !== "send" && (
                    <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Título</span>
                        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Ex.: Boas-vindas"
                            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                    </label>
                )}

                <div className="space-y-2 rounded-xl border border-border/70 p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Ações</span>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button type="button" className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"><Hash className="h-3.5 w-3.5" />Tags</button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="max-h-72 w-60 overflow-y-auto p-2">
                                <p className="px-1 pb-1 text-xs text-muted-foreground">Clique para inserir no texto selecionado</p>
                                {tags.map(t => (
                                    <button key={t} type="button" onClick={() => insertTag(t)} className="block w-full rounded px-2 py-1 text-left font-mono text-xs hover:bg-muted">#{t}</button>
                                ))}
                            </PopoverContent>
                        </Popover>
                    </div>

                    {!actions.length && <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma ação ainda. As ações rodam de cima para baixo.</p>}

                    {actions.map((a, i) => {
                        const Icon = ICON[a.type];
                        return (
                            <div key={i} draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)}
                                onDragOver={e => e.preventDefault()} onDrop={() => { if (drag !== null && drag !== i) move(drag, i); setDrag(null); }}
                                className={cn("group rounded-lg border border-border/70 bg-muted/20 p-2.5", drag === i && "opacity-50")}>
                                <div className="flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                                    <Icon className={cn("h-4 w-4", a.type === "block" ? "text-destructive" : "text-muted-foreground")} />
                                    <span className={cn("flex-1 text-[13px] font-medium", a.type === "block" && "text-destructive")}>{ACTION_LABEL[a.type]}</span>
                                    <button type="button" title="Remover ação" onClick={() => setActions(l => l.filter((_, j) => j !== i))}
                                        className="rounded p-1 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
                                </div>
                                <ActionFields a={a} i={i} sessionId={sessionId} meta={meta} update={update} focused={focused} />
                            </div>
                        );
                    })}

                    <Popover open={addOpen} onOpenChange={setAddOpen}>
                        <PopoverTrigger asChild>
                            <button type="button" className="mx-auto flex items-center gap-1.5 rounded-full border border-primary px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/5">
                                <Plus className="h-4 w-4" />Adicionar ação
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="max-h-80 w-64 overflow-y-auto p-1">
                            {ACTION_GROUPS.map(g => (
                                <div key={g.label} className="py-1">
                                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                                    {g.items.map(it => (
                                        <MenuBtn key={it.type} icon={ICON[it.type]} onClick={() => { setActions(l => [...l, defaultAction(it.type)]); setAddOpen(false); }}>{it.label}</MenuBtn>
                                    ))}
                                </div>
                            ))}
                        </PopoverContent>
                    </Popover>
                </div>

                {mode !== "send" && (
                    <label className="block space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Categoria</span>
                        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                            className="h-10 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary">
                            <option value="">Sem categoria</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                )}
            </div>
            <div className="border-t border-border/60 p-3">
                <button type="button" onClick={submit} disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-105 disabled:opacity-60">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "send" ? <SendHorizontal className="h-4 w-4" /> : null}
                    {mode === "send" ? "Enviar para esta conversa" : mode === "edit" ? "Salvar" : "Criar"}
                </button>
            </div>
        </div>
    );
}

function ActionFields({ a, i, sessionId, meta, update, focused }: {
    a: QuickReplyAction; i: number; sessionId: string; meta: Meta;
    update: (i: number, patch: Partial<QuickReplyAction>) => void;
    focused: React.MutableRefObject<{ index: number; key: "text" | "caption"; el: HTMLTextAreaElement | HTMLInputElement } | null>;
}) {
    const [uploading, setUploading] = useState(false);
    const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary";
    const secs = (value: number, onChange: (n: number) => void) => (
        <input type="number" min={0} max={60} value={value} onChange={e => onChange(Number(e.target.value))}
            className="mx-1 w-14 rounded-md border border-border bg-background px-1.5 py-0.5 text-center text-sm outline-none focus:border-primary" />
    );

    switch (a.type) {
        case "text":
            return (
                <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                    <div>Mostrar &quot;digitando…&quot; por{secs(a.typing, n => update(i, { typing: n }))}s</div>
                    <textarea value={a.text} rows={3} placeholder="Digite o texto (use #primeiroNome, #saudação…)"
                        onChange={e => update(i, { text: e.target.value })} onFocus={e => { focused.current = { index: i, key: "text", el: e.target }; }}
                        className={cn(inputCls, "resize-y text-foreground")} />
                    <div>Aguardar{secs(a.wait, n => update(i, { wait: n }))}s antes da próxima ação</div>
                </div>
            );
        case "image": case "video": case "audio": case "document": case "sticker": {
            const upload = async (file: File) => {
                setUploading(true);
                try {
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("kind", a.type === "document" ? "file" : a.type);
                    const asset = await api<{ id: string; originalName: string }>(`/api/flows/${sessionId}/assets`, { method: "POST", body: fd });
                    update(i, { assetId: asset.id, fileName: asset.originalName });
                } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
            };
            return (
                <div className="mt-2 space-y-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-2 text-xs hover:border-primary">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 text-primary" />}
                        <span className="truncate">{a.assetId ? a.fileName || "Arquivo enviado" : a.type === "audio" ? "Escolher áudio (vai como mensagem de voz)" : "Escolher arquivo"}</span>
                        <input type="file" accept={ACCEPT[a.type]} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
                    </label>
                    {(a.type === "image" || a.type === "video" || a.type === "document") && (
                        <input value={a.caption || ""} placeholder="Legenda (opcional)" onChange={e => update(i, { caption: e.target.value })}
                            onFocus={e => { focused.current = { index: i, key: "caption", el: e.target }; }} className={inputCls} />
                    )}
                </div>
            );
        }
        case "contact":
            return (
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <input value={a.name} placeholder="Nome" onChange={e => update(i, { name: e.target.value })} className={inputCls} />
                    <input value={a.phone} placeholder="Telefone com DDD" inputMode="tel" onChange={e => update(i, { phone: e.target.value })} className={inputCls} />
                </div>
            );
        case "groupInvite":
            return (
                <select value={a.groupJid} onChange={e => update(i, { groupJid: e.target.value })} className={cn(inputCls, "mt-2")}>
                    <option value="">Escolha o grupo (precisa ser admin)</option>
                    {meta.groups.map(g => <option key={g.jid} value={g.jid}>{g.subject || g.jid}</option>)}
                </select>
            );
        case "wait": case "typing": case "recording":
            return <div className="mt-2 text-xs text-muted-foreground">{a.type === "wait" ? "Esperar" : "Durante"}{secs(a.seconds, n => update(i, { seconds: n }))}segundos</div>;
        case "addLabel": case "removeLabel":
            return (
                <select value={a.labelId} onChange={e => update(i, { labelId: e.target.value })} className={cn(inputCls, "mt-2")}>
                    <option value="">{meta.labels.length ? "Escolha a etiqueta" : "Nenhuma etiqueta criada"}</option>
                    {meta.labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
            );
        default:
            return null;
    }
}

function Categories({ base, categories, onChange }: { base: string; categories: Category[]; onChange: () => void }) {
    const [name, setName] = useState("");
    const [color, setColor] = useState("#25D366");
    const create = async () => {
        try { await api(`${base}/categories`, { method: "POST", body: JSON.stringify({ name, color }) }); setName(""); onChange(); }
        catch (e) { toast.error((e as Error).message); }
    };
    const remove = async (id: string) => {
        try { await api(`${base}/categories?id=${encodeURIComponent(id)}`, { method: "DELETE" }); onChange(); }
        catch (e) { toast.error((e as Error).message); }
    };
    return (
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
            <div className="flex items-center gap-2">
                <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Nome da categoria" onKeyDown={e => { if (e.key === "Enter" && name.trim()) create(); }}
                    className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                <input type="color" value={color} onChange={e => setColor(e.target.value)} title="Cor" className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-background p-1" />
                <button type="button" onClick={create} disabled={!name.trim()} className="h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">Salvar</button>
            </div>
            {!categories.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma categoria criada.</p>}
            {categories.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/60">
                    <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                    <span className="flex-1 text-sm">{c.name}</span>
                    <button type="button" title="Excluir categoria" onClick={() => remove(c.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
            ))}
        </div>
    );
}

function MenuBtn({ icon: Icon, onClick, children, danger }: { icon: typeof Zap; onClick: () => void; children: ReactNode; danger?: boolean }) {
    return (
        <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted", danger && "text-destructive")}>
            <Icon className="h-4 w-4 shrink-0" />{children}
        </button>
    );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" onClick={onClick} className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition",
            active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/15")}>{children}</button>
    );
}

function ChipSelect({ active, label, value, options, onChange }: { active: boolean; label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
    return (
        <select value={value} onChange={e => onChange(e.target.value)} className={cn("cursor-pointer rounded-full px-2 py-1 text-xs font-medium outline-none",
            active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/15")}>
            <option value="">{label}</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    );
}
