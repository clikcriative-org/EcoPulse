"use client";

import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
    ArrowDown, ArrowUp, Contact, Copy, File, Image as ImageIcon, Loader2, MessageSquareText, Mic, Plus, PowerOff, Timer,
    Trash2, Type, Upload, Video, X, HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    ANSWER_TYPES, BLOCKS, POLL_MAX_OPTIONS, POLL_MAX_QUESTION, WEEKDAYS, newId, type AnswerType, type ConditionData, type ConditionOp, type ConditionSource,
    type ContentItem, type FieldScope, type FieldType, type FlowAction, type FlowCondition, type FlowNode, type MediaKind,
    type MenuData, type NodeDataMap, type RandomizerData, type SmartDelayData, type TimeUnit,
} from "@/modules/flows/types";
import { BLOCK_ICONS, formatHms } from "./block-node";
import { useEditor } from "./editor-context";
import { TextField } from "./text-field";

// ---------- small building blocks ----------
function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
    return (
        <div className="space-y-2">
            <Label className="text-[13px] font-semibold">{title}</Label>
            {children}
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    );
}

function Card({ color, title, onUp, onDown, onCopy, onDelete, children }: { color: string; title: string; onUp?: () => void; onDown?: () => void; onCopy?: () => void; onDelete: () => void; children: ReactNode }) {
    return (
        <div className="group space-y-2 rounded-xl border p-3" style={{ borderColor: `${color}40`, background: `${color}06` }}>
            <div className="flex items-center gap-1">
                <span className="mr-auto text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>{title}</span>
                {onUp && <IconBtn title="Subir" onClick={onUp}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>}
                {onDown && <IconBtn title="Descer" onClick={onDown}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>}
                {onCopy && <IconBtn title="Duplicar" onClick={onCopy}><Copy className="h-3.5 w-3.5" /></IconBtn>}
                <IconBtn title="Excluir" danger onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
            </div>
            {children}
        </div>
    );
}

function IconBtn({ children, danger, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
    return <button type="button" className={`rounded-md p-1 text-muted-foreground hover:bg-muted ${danger ? "hover:text-destructive" : "hover:text-foreground"}`} {...p}>{children}</button>;
}

function AddButton({ color, children, onClick }: { color: string; children: ReactNode; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-[14px] font-semibold transition-colors hover:brightness-95"
            style={{ borderColor: `${color}80`, background: `${color}10`, color }}>
            <Plus className="h-4 w-4" />{children}
        </button>
    );
}

function Pick({ value, onChange, options, placeholder, className }: { value?: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; className?: string }) {
    return (
        <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger className={`h-9 w-full ${className || ""}`}><SelectValue placeholder={placeholder || "Selecione"} /></SelectTrigger>
            <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
    );
}

const UNITS: { value: TimeUnit; label: string }[] = [
    { value: "seconds", label: "Segundos" }, { value: "minutes", label: "Minutos" }, { value: "hours", label: "Horas" }, { value: "days", label: "Dias" },
];

function Expire({ value, unit, onChange }: { value: number; unit: TimeUnit; onChange: (v: number, u: TimeUnit) => void }) {
    return (
        <div className="flex gap-2">
            <Input type="number" min={1} className="h-9 w-24" value={value} onChange={e => onChange(Math.max(1, Number(e.target.value) || 1), unit)} />
            <Pick value={unit} onChange={u => onChange(value, u as TimeUnit)} options={UNITS} />
        </div>
    );
}

// ---------- field picker with "create field" ----------
function FieldPicker({ fieldKey, scope, onChange, includeSystem }: { fieldKey?: string; scope?: FieldScope; onChange: (key: string, scope: FieldScope, type: FieldType) => void; includeSystem?: boolean }) {
    const { meta, sessionId, reloadMeta } = useEditor();
    const [open, setOpen] = useState(false);
    const [label, setLabel] = useState("");
    const [type, setType] = useState<FieldType>("TEXT");
    const [newScope, setNewScope] = useState<FieldScope>("CONTACT");
    const [busy, setBusy] = useState(false);
    const value = fieldKey ? `${scope === "BOT" ? "BOT" : includeSystem && meta.systemFields.some(f => f.key === fieldKey) ? "SYS" : "CONTACT"}:${fieldKey}` : undefined;

    const choose = (v: string) => {
        if (v === "__new") { setLabel(""); setOpen(true); return; }
        const [s, key] = [v.slice(0, v.indexOf(":")), v.slice(v.indexOf(":") + 1)];
        const t = s === "SYS" ? meta.systemFields.find(f => f.key === key)?.type : meta.fields.find(f => f.key === key && f.scope === s)?.type;
        onChange(key, s === "BOT" ? "BOT" : "CONTACT", t || "TEXT");
    };

    const create = async () => {
        setBusy(true);
        const res = await fetch(`/api/flows/${sessionId}/fields`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, type, scope: newScope }) });
        const json = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return toast.error(json.message || "Falha ao criar o campo");
        await reloadMeta();
        onChange(json.data.key, newScope, type);
        setOpen(false);
        toast.success("Campo criado");
    };

    const contact = meta.fields.filter(f => f.scope === "CONTACT");
    const bot = meta.fields.filter(f => f.scope === "BOT");
    return (
        <>
            <Select value={value} onValueChange={choose}>
                <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Escolha o campo" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="__new" className="font-medium text-primary">+ Criar novo campo</SelectItem>
                    {includeSystem && <><SelectSeparator /><SelectGroup><SelectLabel>Campos do sistema</SelectLabel>{meta.systemFields.map(f => <SelectItem key={f.key} value={`SYS:${f.key}`}>{f.label}</SelectItem>)}</SelectGroup></>}
                    {contact.length > 0 && <><SelectSeparator /><SelectGroup><SelectLabel>Campos do contato</SelectLabel>{contact.map(f => <SelectItem key={f.id} value={`CONTACT:${f.key}`}>{f.label}</SelectItem>)}</SelectGroup></>}
                    {bot.length > 0 && <><SelectSeparator /><SelectGroup><SelectLabel>Campos do robô</SelectLabel>{bot.map(f => <SelectItem key={f.id} value={`BOT:${f.key}`}>{f.label}</SelectItem>)}</SelectGroup></>}
                </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>Criar campo</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <Input autoFocus placeholder="Nome (ex.: E-mail, Cidade)" value={label} onChange={e => setLabel(e.target.value)} />
                        <Pick value={type} onChange={v => setType(v as FieldType)} options={[{ value: "TEXT", label: "Texto" }, { value: "NUMBER", label: "Número" }, { value: "DATE", label: "Data" }, { value: "DATETIME", label: "Data e hora" }]} />
                        <Pick value={newScope} onChange={v => setNewScope(v as FieldScope)} options={[{ value: "CONTACT", label: "Do contato (um valor por pessoa)" }, { value: "BOT", label: "Do robô (um valor para todos)" }]} />
                    </div>
                    <DialogFooter><Button onClick={create} disabled={busy || !label.trim()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Criar campo</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ---------- media upload ----------
const ACCEPT: Record<MediaKind, string> = { image: "image/jpeg,image/png,image/webp", video: "video/mp4", audio: "audio/mpeg,audio/ogg,audio/mp4,audio/aac", file: "*/*" };
const MEDIA_HINT: Record<MediaKind, string> = { image: "JPG, PNG ou WEBP até 5 MB", video: "MP4 até 16 MB", audio: "MP3, OGG ou M4A até 16 MB", file: "Qualquer arquivo até 16 MB" };

function MediaEditor({ item, onChange, color }: { item: Extract<ContentItem, { kind: MediaKind }>; onChange: (it: ContentItem) => void; color: string }) {
    const { sessionId } = useEditor();
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const upload = async (file: File) => {
        setBusy(true);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", item.kind);
        const res = await fetch(`/api/flows/${sessionId}/assets`, { method: "POST", body: fd });
        const json = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return toast.error(json.message || "Falha no envio");
        onChange({ ...item, assetId: json.data.id, url: undefined, fileName: json.data.originalName });
    };
    return (
        <div className="space-y-2">
            <input ref={input} type="file" accept={ACCEPT[item.kind]} className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
            {item.assetId ? (
                <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
                    {item.kind === "image"
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={`/api/flows/${sessionId}/assets/${item.assetId}`} alt="" className="h-12 w-12 rounded object-cover" />
                        : <File className="h-5 w-5" style={{ color }} />}
                    <span className="flex-1 truncate text-sm">{item.fileName}</span>
                    <IconBtn title="Trocar" onClick={() => input.current?.click()}><Upload className="h-3.5 w-3.5" /></IconBtn>
                </div>
            ) : (
                <button type="button" onClick={() => input.current?.click()} disabled={busy}
                    className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed bg-background py-4 text-sm" style={{ borderColor: `${color}80`, color }}>
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    <span className="font-medium underline">Enviar arquivo</span>
                    <span className="text-[11px] text-muted-foreground">{MEDIA_HINT[item.kind]}</span>
                </button>
            )}
            {!item.assetId && (
                <Input className="h-9" placeholder="ou cole um link público (https://...)" value={item.url || ""} onChange={e => onChange({ ...item, url: e.target.value || undefined })} />
            )}
            {item.kind === "file" && <Input className="h-9" placeholder="Nome do arquivo para o contato" value={item.fileName || ""} onChange={e => onChange({ ...item, fileName: e.target.value })} />}
            {item.kind !== "audio" && <TextField value={item.caption || ""} onChange={v => onChange({ ...item, caption: v })} placeholder="Legenda (opcional)" rows={2} accent={color} />}
        </div>
    );
}

// ---------- per-type editors ----------
const CONTENT_ADD: { kind: ContentItem["kind"]; label: string; icon: typeof Type }[] = [
    { kind: "text", label: "Texto", icon: Type }, { kind: "image", label: "Imagem", icon: ImageIcon }, { kind: "video", label: "Vídeo", icon: Video },
    { kind: "file", label: "Arquivo", icon: File }, { kind: "audio", label: "Áudio", icon: Mic }, { kind: "input", label: "Pergunta", icon: HelpCircle },
    { kind: "delay", label: "Atraso", icon: Timer }, { kind: "autoOff", label: "AutoOff", icon: PowerOff }, { kind: "vcard", label: "Contato", icon: Contact },
];

function newContentItem(kind: ContentItem["kind"]): ContentItem {
    const id = newId();
    switch (kind) {
        case "text": return { id, kind, text: "" };
        case "delay": return { id, kind, seconds: 3, typing: true };
        case "autoOff": return { id, kind, seconds: 3600 };
        case "vcard": return { id, kind, name: "", phone: "" };
        case "input": return { id, kind, question: "", answerType: "text", expireValue: 1, expireUnit: "days", errorMessage: "Não entendi sua resposta. Pode tentar de novo?", maxAttempts: 3 };
        default: return { id, kind } as ContentItem;
    }
}

const ITEM_TITLE: Record<ContentItem["kind"], string> = { text: "Texto", image: "Imagem", video: "Vídeo", audio: "Áudio", file: "Arquivo", delay: "Atraso", autoOff: "Desligar resposta automática", vcard: "Cartão de contato", input: "Pergunta (salvar resposta)" };

function ContentEditor({ node, set, color }: { node: FlowNode<"content">; set: (d: NodeDataMap["content"]) => void; color: string }) {
    const items = node.data.items;
    const update = (i: number, it: ContentItem) => set({ items: items.map((x, k) => (k === i ? it : x)) });
    const move = (i: number, d: number) => { const a = [...items]; [a[i], a[i + d]] = [a[i + d], a[i]]; set({ items: a }); };
    return (
        <div className="space-y-3">
            {items.map((it, i) => (
                <Card key={it.id} color={color} title={ITEM_TITLE[it.kind]}
                    onUp={i > 0 ? () => move(i, -1) : undefined} onDown={i < items.length - 1 ? () => move(i, 1) : undefined}
                    onCopy={() => set({ items: [...items.slice(0, i + 1), { ...structuredClone(it), id: newId() }, ...items.slice(i + 1)] })}
                    onDelete={() => set({ items: items.filter((_, k) => k !== i) })}>
                    <ItemEditor item={it} onChange={x => update(i, x)} color={color} />
                </Card>
            ))}
            <div className="grid grid-cols-3 gap-2 pt-1">
                {CONTENT_ADD.map(a => (
                    <button key={a.kind} type="button" onClick={() => set({ items: [...items, newContentItem(a.kind)] })}
                        className="flex flex-col items-center gap-1 rounded-xl border border-dashed py-3 text-[13px] transition-colors hover:brightness-95"
                        style={{ borderColor: `${color}66`, background: `${color}0D`, color }}>
                        <a.icon className="h-5 w-5" />{a.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function ItemEditor({ item, onChange, color }: { item: ContentItem; onChange: (it: ContentItem) => void; color: string }) {
    switch (item.kind) {
        case "text": return <TextField value={item.text} onChange={text => onChange({ ...item, text })} placeholder="Digite a mensagem" accent={color} rows={4} />;
        case "image": case "video": case "audio": case "file": return <MediaEditor item={item} onChange={onChange} color={color} />;
        case "delay": return (
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <Slider min={0} max={30} step={1} value={[item.seconds]} onValueChange={([v]) => onChange({ ...item, seconds: v })} className="flex-1" />
                    <span className="w-14 text-right text-sm font-medium">{item.seconds} seg</span>
                </div>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={item.typing} onCheckedChange={v => onChange({ ...item, typing: !!v })} />Mostrar &quot;digitando...&quot;</label>
            </div>
        );
        case "autoOff": return (
            <div className="space-y-1">
                <Input type="time" step={1} className="h-9 w-36" value={formatHms(item.seconds)} onChange={e => { const [h, m, s] = e.target.value.split(":").map(Number); onChange({ ...item, seconds: (h || 0) * 3600 + (m || 0) * 60 + (s || 0) }); }} />
                <p className="text-[11px] text-muted-foreground">Durante esse tempo a resposta automática não responde este contato.</p>
            </div>
        );
        case "vcard": return (
            <div className="space-y-2">
                <Input className="h-9" placeholder="Nome" value={item.name} onChange={e => onChange({ ...item, name: e.target.value })} />
                <Input className="h-9" placeholder="Telefone com DDI (5521999999999)" value={item.phone} onChange={e => onChange({ ...item, phone: e.target.value })} />
                <Input className="h-9" placeholder="Empresa (opcional)" value={item.org || ""} onChange={e => onChange({ ...item, org: e.target.value })} />
            </div>
        );
        case "input": return (
            <div className="space-y-3">
                <TextField value={item.question} onChange={question => onChange({ ...item, question })} placeholder="Ex.: Qual é o seu e-mail?" accent={color} />
                <Section title="Tipo de resposta"><Pick value={item.answerType} onChange={v => onChange({ ...item, answerType: v as AnswerType })} options={ANSWER_TYPES} /></Section>
                <Section title="Salvar a resposta no campo"><FieldPicker fieldKey={item.fieldKey} scope={item.fieldScope} onChange={(fieldKey, fieldScope) => onChange({ ...item, fieldKey, fieldScope })} /></Section>
                <Section title="Mensagem se a resposta for inválida"><TextField value={item.errorMessage} onChange={errorMessage => onChange({ ...item, errorMessage })} rows={2} accent={color} /></Section>
                <Section title="Tentativas" hint="Depois disso, segue pela saída 'Se não responder'.">
                    <Pick value={String(item.maxAttempts)} onChange={v => onChange({ ...item, maxAttempts: Number(v) })} options={[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n} ${n === 1 ? "vez" : "vezes"}` }))} />
                </Section>
                <Section title="Se não responder em"><Expire value={item.expireValue} unit={item.expireUnit} onChange={(expireValue, expireUnit) => onChange({ ...item, expireValue, expireUnit })} /></Section>
            </div>
        );
    }
}

function MenuEditor({ node, set, color }: { node: FlowNode<"menu">; set: (d: MenuData) => void; color: string }) {
    const d = node.data;
    const opts = d.options;
    const poll = d.mode === "poll";
    const full = poll && opts.length >= POLL_MAX_OPTIONS;
    return (
        <div className="space-y-4">
            <Section title="Como o contato responde">
                <RadioGroup value={poll ? "poll" : "number"} onValueChange={v => set({ ...d, mode: v as "poll" | "number" })} className="gap-2">
                    <label className="flex cursor-pointer items-start gap-2.5">
                        <RadioGroupItem value="poll" className="mt-0.5" />
                        <span className="text-[13px]"><b>Enquete</b> — toca na opção<span className="block text-[11px] text-muted-foreground">Até {POLL_MAX_OPTIONS} respostas. Funciona no Android, iPhone e WhatsApp Web.</span></span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2.5">
                        <RadioGroupItem value="number" className="mt-0.5" />
                        <span className="text-[13px]"><b>Número</b> — digita o número<span className="block text-[11px] text-muted-foreground">Pergunta e opções numeradas numa mensagem de texto.</span></span>
                    </label>
                </RadioGroup>
                <p className="text-[11px] text-muted-foreground">Botão de lista (&quot;Ver opções&quot;) não está disponível: o WhatsApp só entrega listas e botões para a API oficial, e esta conexão usa o WhatsApp Web.</p>
            </Section>
            <Section title={poll ? "Pergunta da enquete" : "Pergunta"} hint={poll
                ? `Até ${POLL_MAX_QUESTION} caracteres. Quem não tocar ainda pode digitar o número ou o texto da opção.`
                : "As respostas são enviadas numeradas. O contato pode responder com o número ou com o texto da opção."}>
                <TextField value={d.question} onChange={question => set({ ...d, question })} placeholder="Ex.: Como posso ajudar?" accent={color} />
                {poll && d.question.length > POLL_MAX_QUESTION && <p className="text-[11px] text-destructive">{d.question.length}/{POLL_MAX_QUESTION} caracteres</p>}
            </Section>
            <Section title={poll ? `Respostas (${opts.length}/${POLL_MAX_OPTIONS})` : "Respostas"}>
                <div className="space-y-2">
                    {opts.map((o, i) => (
                        <div key={o.id} className="flex items-center gap-2">
                            <span className="w-5 text-sm font-bold" style={{ color }}>{poll ? "○" : `${i + 1}.`}</span>
                            <Input className="h-9" autoFocus={i === opts.length - 1 && !o.text} placeholder={`Resposta ${i + 1}`} value={o.text} maxLength={100} onChange={e => set({ ...d, options: opts.map(x => x.id === o.id ? { ...x, text: e.target.value } : x) })} />
                            <IconBtn title="Subir" disabled={i === 0} onClick={() => { const a = [...opts]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set({ ...d, options: a }); }}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                            <IconBtn title="Excluir" danger onClick={() => set({ ...d, options: opts.filter(x => x.id !== o.id) })}><X className="h-3.5 w-3.5" /></IconBtn>
                        </div>
                    ))}
                    {full
                        ? <p className="text-center text-[11px] text-muted-foreground">A enquete do WhatsApp aceita até {POLL_MAX_OPTIONS} respostas.</p>
                        : <AddButton color={color} onClick={() => set({ ...d, options: [...opts, { id: newId(), text: "" }] })}>Adicionar resposta</AddButton>}
                </div>
            </Section>
            <Section title="Texto para resposta inválida"><TextField value={d.invalidText} onChange={invalidText => set({ ...d, invalidText })} rows={2} accent={color} /></Section>
            <Section title="Saída de erro depois de quantos erros" hint="0 = nunca sai pela saída de erro; continua pedindo a resposta.">
                <Input type="number" min={0} max={100} className="h-9 w-24" value={d.maxErrors} onChange={e => set({ ...d, maxErrors: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
            </Section>
            <Section title="Se não responder em"><Expire value={d.expireValue} unit={d.expireUnit} onChange={(expireValue, expireUnit) => set({ ...d, expireValue, expireUnit })} /></Section>
        </div>
    );
}

const ACTIONS: { type: FlowAction["type"]; label: string }[] = [
    { type: "addTag", label: "Adicionar etiqueta" }, { type: "removeTag", label: "Remover etiqueta" },
    { type: "setField", label: "Definir valor de um campo" }, { type: "clearField", label: "Limpar valor de um campo" },
    { type: "notify", label: "Notificar equipe por WhatsApp" }, { type: "pauseAutomation", label: "Pausar automações do contato" },
    { type: "resumeAutomation", label: "Reativar automações do contato" },
    { type: "optOut", label: "Bloquear transmissões para o contato" },
];

function newAction(type: FlowAction["type"]): FlowAction {
    const id = newId();
    switch (type) {
        case "setField": return { id, type, value: "" };
        case "notify": return { id, type, phones: "", message: "Novo contato no fluxo: {nome-completo} ({telefone})" };
        case "pauseAutomation": return { id, type, forever: false, value: 30, unit: "minutes" };
        default: return { id, type } as FlowAction;
    }
}

function ActionEditor({ node, set, color }: { node: FlowNode<"action">; set: (d: NodeDataMap["action"]) => void; color: string }) {
    const { meta } = useEditor();
    const acts = node.data.actions;
    const upd = (i: number, a: FlowAction) => set({ actions: acts.map((x, k) => (k === i ? a : x)) });
    return (
        <div className="space-y-3">
            {acts.map((a, i) => (
                <Card key={a.id} color={color} title={ACTIONS.find(x => x.type === a.type)?.label || a.type}
                    onUp={i > 0 ? () => { const x = [...acts]; [x[i - 1], x[i]] = [x[i], x[i - 1]]; set({ actions: x }); } : undefined}
                    onDelete={() => set({ actions: acts.filter((_, k) => k !== i) })}>
                    {(a.type === "addTag" || a.type === "removeTag") && (
                        meta.labels.length
                            ? <Pick value={a.labelId} onChange={labelId => upd(i, { ...a, labelId })} options={meta.labels.map(l => ({ value: l.id, label: l.name }))} placeholder="Escolha a etiqueta" />
                            : <p className="text-[12px] text-muted-foreground">Nenhuma etiqueta. Crie em Contatos → Etiquetas.</p>
                    )}
                    {(a.type === "setField" || a.type === "clearField") && (
                        <FieldPicker fieldKey={a.fieldKey} scope={a.fieldScope} onChange={(fieldKey, fieldScope) => upd(i, { ...a, fieldKey, fieldScope })} />
                    )}
                    {a.type === "setField" && <TextField value={a.value} onChange={value => upd(i, { ...a, value })} placeholder="Valor (aceita variáveis)" rows={2} formatting={false} accent={color} maxLength={1000} />}
                    {a.type === "notify" && (
                        <>
                            <Input className="h-9" placeholder="Números com DDI, separados por vírgula" value={a.phones} onChange={e => upd(i, { ...a, phones: e.target.value })} />
                            <TextField value={a.message} onChange={message => upd(i, { ...a, message })} rows={2} accent={color} />
                        </>
                    )}
                    {a.type === "pauseAutomation" && (
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm"><Checkbox checked={a.forever} onCheckedChange={v => upd(i, { ...a, forever: !!v })} />Pausar indefinidamente</label>
                            {!a.forever && <Expire value={a.value} unit={a.unit} onChange={(value, unit) => upd(i, { ...a, value, unit })} />}
                            <p className="text-[11px] text-muted-foreground">Durante a pausa, nenhum fluxo novo nem resposta automática atende este contato. O fluxo atual continua.</p>
                        </div>
                    )}
                    {a.type === "resumeAutomation" && <p className="text-[12px] text-muted-foreground">Remove a pausa de automações deste contato.</p>}
                    {a.type === "optOut" && <p className="text-[12px] text-muted-foreground">Coloca o contato na lista de quem pediu para sair. Transmissões com &quot;pular quem pediu para sair&quot; não enviam para ele.</p>}
                </Card>
            ))}
            <Select value="" onValueChange={t => set({ actions: [...acts, newAction(t as FlowAction["type"])] })}>
                <SelectTrigger className="h-11 w-full justify-center border-dashed font-semibold" style={{ borderColor: `${color}80`, background: `${color}10`, color }}>
                    <span className="flex items-center gap-1.5"><Plus className="h-4 w-4" />Adicionar ação</span>
                </SelectTrigger>
                <SelectContent>{ACTIONS.map(a => <SelectItem key={a.type} value={a.type}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    );
}

const OPS: Record<string, { value: ConditionOp; label: string }[]> = {
    tag: [{ value: "is", label: "tem a etiqueta" }, { value: "isNot", label: "não tem a etiqueta" }],
    weekday: [{ value: "is", label: "é" }, { value: "isNot", label: "não é" }],
    time: [{ value: "after", label: "depois de" }, { value: "before", label: "antes de" }],
    TEXT: [{ value: "is", label: "é" }, { value: "isNot", label: "não é" }, { value: "contains", label: "contém" }, { value: "notContains", label: "não contém" }, { value: "startsWith", label: "começa com" }, { value: "containsAny", label: "contém alguma destas palavras" }, { value: "hasValue", label: "tem algum valor" }],
    NUMBER: [{ value: "gt", label: "maior que" }, { value: "gte", label: "maior ou igual a" }, { value: "lt", label: "menor que" }, { value: "lte", label: "menor ou igual a" }, { value: "eq", label: "igual a" }, { value: "neq", label: "diferente de" }, { value: "hasValue", label: "tem algum valor" }],
    DATE: [{ value: "after", label: "depois de" }, { value: "before", label: "antes de" }, { value: "on", label: "em" }, { value: "hasValue", label: "tem algum valor" }],
};

function ConditionEditor({ node, set, color }: { node: FlowNode<"condition">; set: (d: ConditionData) => void; color: string }) {
    const { meta } = useEditor();
    const d = node.data;
    const upd = (i: number, c: FlowCondition) => set({ ...d, conditions: d.conditions.map((x, k) => (k === i ? c : x)) });
    const add = (source: ConditionSource) => set({ ...d, conditions: [...d.conditions, { id: newId(), source, op: OPS[source === "field" ? "TEXT" : source][0].value, value: source === "time" ? "09:00" : "", fieldType: "TEXT" }] });
    return (
        <div className="space-y-4">
            <Tabs value={d.logic} onValueChange={v => set({ ...d, logic: v as "and" | "or" })}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="or">Qualquer condição</TabsTrigger>
                    <TabsTrigger value="and">Todas as condições</TabsTrigger>
                </TabsList>
            </Tabs>
            <p className="text-[12px] text-muted-foreground">O contato sai por <b className="text-emerald-600">Verdadeiro</b> quando {d.logic === "and" ? "todas as condições" : "pelo menos uma condição"} for atendida; senão, por <b className="text-rose-600">Falso</b>.</p>
            {d.conditions.map((c, i) => {
                const typeKey = c.source === "field" ? (c.fieldType === "DATETIME" ? "DATE" : c.fieldType || "TEXT") : c.source;
                return (
                    <Card key={c.id} color={color} title={{ tag: "Etiqueta", weekday: "Dia da semana", time: "Hora", field: "Campo" }[c.source]} onDelete={() => set({ ...d, conditions: d.conditions.filter((_, k) => k !== i) })}>
                        {c.source === "field" && <FieldPicker includeSystem fieldKey={c.fieldKey} scope={c.fieldScope} onChange={(fieldKey, fieldScope, fieldType) => upd(i, { ...c, fieldKey, fieldScope, fieldType, op: OPS[fieldType === "DATETIME" ? "DATE" : fieldType][0].value, value: "" })} />}
                        <Pick value={c.op} onChange={op => upd(i, { ...c, op: op as ConditionOp })} options={OPS[typeKey]} />
                        {c.op !== "hasValue" && (
                            c.source === "tag" ? <Pick value={c.value} onChange={value => upd(i, { ...c, value })} options={meta.labels.map(l => ({ value: l.id, label: l.name }))} placeholder="Escolha a etiqueta" />
                                : c.source === "weekday" ? <Pick value={c.value} onChange={value => upd(i, { ...c, value })} options={WEEKDAYS.map((w, k) => ({ value: String(k), label: w }))} placeholder="Escolha o dia" />
                                    : c.source === "time" ? <Input type="time" className="h-9 w-32" value={c.value} onChange={e => upd(i, { ...c, value: e.target.value })} />
                                        : typeKey === "DATE" ? <Input type="date" className="h-9" value={c.value} onChange={e => upd(i, { ...c, value: e.target.value })} />
                                            : c.op === "containsAny" ? <textarea rows={3} className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40" placeholder="Palavras ou frases separadas por vírgula. Use * no fim para prefixo (reembols*)" value={c.value} onChange={e => upd(i, { ...c, value: e.target.value })} />
                                                : <Input className="h-9" inputMode={typeKey === "NUMBER" ? "decimal" : undefined} placeholder="Valor (aceita {campo})" value={c.value} onChange={e => upd(i, { ...c, value: e.target.value })} />
                        )}
                    </Card>
                );
            })}
            <Select value="" onValueChange={v => add(v as ConditionSource)}>
                <SelectTrigger className="h-11 w-full justify-center border-dashed font-semibold" style={{ borderColor: `${color}80`, background: `${color}10`, color }}>
                    <span className="flex items-center gap-1.5"><Plus className="h-4 w-4" />Adicionar condição</span>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="tag">Etiqueta</SelectItem>
                    <SelectItem value="weekday">Dia da semana ao passar por aqui</SelectItem>
                    <SelectItem value="time">Hora ao passar por aqui</SelectItem>
                    <SelectItem value="field">Valor de um campo</SelectItem>
                </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Dia e hora usam o fuso configurado em Configurações.</p>
        </div>
    );
}

function RandomizerEditor({ node, set, color }: { node: FlowNode<"randomizer">; set: (d: RandomizerData) => void; color: string }) {
    const d = node.data;
    const sum = d.options.reduce((s, o) => s + (Number(o.weight) || 0), 0);
    const rebalance = (options: RandomizerData["options"]) => {
        const base = Math.floor(100 / options.length);
        return options.map((o, i) => ({ ...o, weight: i === options.length - 1 ? 100 - base * (options.length - 1) : base }));
    };
    return (
        <div className="space-y-4">
            <Tabs value={d.mode} onValueChange={v => set({ ...d, mode: v as RandomizerData["mode"] })}>
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="random">Aleatório</TabsTrigger><TabsTrigger value="sequential">Sequencial</TabsTrigger></TabsList>
            </Tabs>
            <p className="text-[12px] text-muted-foreground">{d.mode === "random" ? "Cada contato cai numa opção conforme a chance definida." : "Cada contato vai para a próxima opção, em rodízio, começando pela primeira."}</p>
            {d.options.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: `${color}40` }}>
                    <span className="mr-auto text-sm">Opção {i + 1}</span>
                    {d.mode === "random" && <><Input type="number" min={0} max={100} className="h-8 w-20 text-right" value={o.weight} onChange={e => set({ ...d, options: d.options.map(x => x.id === o.id ? { ...x, weight: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } : x) })} /><span className="text-sm">%</span></>}
                    <IconBtn title="Excluir" danger onClick={() => set({ ...d, options: rebalance(d.options.filter(x => x.id !== o.id)) })}><X className="h-3.5 w-3.5" /></IconBtn>
                </div>
            ))}
            {d.mode === "random" && d.options.length > 0 && sum !== 100 && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">A soma dos percentuais deve ser 100% (agora: {sum}%). <button type="button" className="underline" onClick={() => set({ ...d, options: rebalance(d.options) })}>Dividir igualmente</button></p>
            )}
            <AddButton color={color} onClick={() => set({ ...d, options: rebalance([...d.options, { id: newId(), weight: 0 }]) })}>Adicionar opção</AddButton>
        </div>
    );
}

function DelayEditor({ node, set }: { node: FlowNode<"smartDelay">; set: (d: SmartDelayData) => void }) {
    const d = node.data;
    return (
        <div className="space-y-4">
            <Tabs value={d.mode} onValueChange={v => set({ ...d, mode: v as SmartDelayData["mode"] })}>
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="duration">Atraso</TabsTrigger><TabsTrigger value="datetime">Data e hora</TabsTrigger></TabsList>
            </Tabs>
            {d.mode === "duration" ? (
                <Section title="Duração do atraso" hint="Máximo de 30 dias. A conversa fica parada e continua sozinha depois desse tempo.">
                    <div className="flex gap-2">
                        <Input type="number" min={1} className="h-9 w-24" value={d.value} onChange={e => set({ ...d, value: Math.max(0, Number(e.target.value) || 0) })} />
                        <Pick value={d.unit} onChange={u => set({ ...d, unit: u as SmartDelayData["unit"] })} options={UNITS.filter(u => u.value !== "seconds") as { value: string; label: string }[]} />
                    </div>
                </Section>
            ) : (
                <Section title="Continuar em" hint="Usa o fuso das Configurações. Se a data já tiver passado quando o contato chegar aqui, a etapa é pulada.">
                    <Input type="datetime-local" className="h-9" value={d.datetime || ""} onChange={e => set({ ...d, datetime: e.target.value })} />
                </Section>
            )}
        </div>
    );
}

function FlowLinkEditor({ node, set }: { node: FlowNode<"flowLink">; set: (d: NodeDataMap["flowLink"]) => void }) {
    const { meta, flowId } = useEditor();
    const others = meta.flows.filter(f => f.id !== flowId);
    return (
        <Section title="Fluxo que será iniciado" hint="Este fluxo termina aqui e o contato passa para o fluxo escolhido. O fluxo de destino precisa estar ativo.">
            {others.length ? <Pick value={node.data.flowId} onChange={flowId => set({ flowId })} options={others.map(f => ({ value: f.id, label: `${f.name}${f.status !== "ACTIVE" ? " (não ativo)" : ""}` }))} placeholder="Selecione o fluxo" />
                : <p className="text-[12px] text-muted-foreground">Crie outro fluxo para poder conectá-lo aqui.</p>}
        </Section>
    );
}

// ---------- panel shell ----------
export function BlockPanel({ node, onClose }: { node: FlowNode; onClose: () => void }) {
    const { updateNode, issuesByNode } = useEditor();
    const { color, label } = BLOCKS[node.type];
    const Icon = BLOCK_ICONS[node.type];
    const name = node.data.name;
    // editors rebuild their own data object; keep the block name across those edits
    const set = (data: unknown) => updateNode(node.id, { ...(name ? { name } : {}), ...(data as object) } as never);
    const errors = (issuesByNode[node.id] || []).filter(i => i.level === "error");
    return (
        <aside className="nowheel absolute inset-y-0 left-0 z-20 flex w-[380px] max-w-[92vw] flex-col border-r bg-card shadow-xl">
            <header className="flex h-14 items-center gap-2 border-b px-4">
                <Icon className="h-5 w-5" style={{ color }} />
                <h2 className="text-[17px] font-bold">{label}</h2>
                <button type="button" onClick={onClose} className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Fechar"><X className="h-5 w-5" /></button>
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <Input className="h-9" placeholder="Nome do bloco (opcional)" value={name || ""} maxLength={60}
                    onChange={e => updateNode(node.id, { ...node.data, name: e.target.value || undefined } as never)} />
                {errors.length > 0 && (
                    <ul className="space-y-1 rounded-lg bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
                        {errors.map((e, i) => <li key={i}>• {e.message.replace(/^[^:]+: /, "")}</li>)}
                    </ul>
                )}
                {node.type === "start" && <p className="flex gap-2 text-sm text-muted-foreground"><MessageSquareText className="h-4 w-4 shrink-0" />O fluxo começa aqui. Puxe a saída deste bloco até o primeiro bloco da conversa. Os gatilhos (quando o fluxo começa) ficam no botão &quot;Gatilhos&quot; no topo.</p>}
                {node.type === "content" && <ContentEditor node={node as FlowNode<"content">} set={set} color={color} />}
                {node.type === "menu" && <MenuEditor node={node as FlowNode<"menu">} set={set} color={color} />}
                {node.type === "action" && <ActionEditor node={node as FlowNode<"action">} set={set} color={color} />}
                {node.type === "condition" && <ConditionEditor node={node as FlowNode<"condition">} set={set} color={color} />}
                {node.type === "randomizer" && <RandomizerEditor node={node as FlowNode<"randomizer">} set={set} color={color} />}
                {node.type === "smartDelay" && <DelayEditor node={node as FlowNode<"smartDelay">} set={set} />}
                {node.type === "flowLink" && <FlowLinkEditor node={node as FlowNode<"flowLink">} set={set} />}
            </div>
        </aside>
    );
}
