"use client";

import { memo, useEffect, type ReactNode } from "react";
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import {
    AlertTriangle, Clock, Contact, Copy, File, Filter, Image as ImageIcon, LayoutGrid, MessageSquareText, Mic, PowerOff,
    Rocket, Shuffle, Star, Trash2, Video, Workflow, Zap, type LucideIcon,
} from "lucide-react";
import {
    ANSWER_TYPES, BLOCKS, WEEKDAYS, outputsOf, type ConditionData, type ContentItem, type FlowAction, type FlowCondition,
    type FlowNode, type MenuData, type NodeDataMap, type NodeType, type RandomizerData, type SmartDelayData,
} from "@/modules/flows/types";
import { useEditor, type FlowMeta } from "./editor-context";
import { PreviewText } from "./text-field";

export const BLOCK_ICONS: Record<NodeType, LucideIcon> = {
    start: Rocket, content: Star, menu: LayoutGrid, action: Zap, condition: Filter,
    flowLink: Workflow, randomizer: Shuffle, smartDelay: Clock,
};

const UNIT: Record<string, string> = { seconds: "seg", minutes: "min", hours: "h", days: "dias" };

export function fieldLabel(meta: FlowMeta, key?: string) {
    if (!key) return "";
    return meta.systemFields.find(f => f.key === key)?.label || meta.fields.find(f => f.key === key)?.label || key;
}

function OutRow({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
    return (
        <div className={`relative flex min-h-6 items-center justify-end pr-3 text-[11px] ${className}`}>
            {children}
            <Handle type="source" position={Position.Right} id={id} className="!-right-[7px] !h-3.5 !w-3.5 !border-2 !border-white !bg-primary dark:!border-card" />
        </div>
    );
}

function Item({ color, children }: { color: string; children: ReactNode }) {
    return <div className="rounded-md px-2 py-1.5 text-[12px] leading-snug" style={{ background: `${color}12` }}>{children}</div>;
}

const empty = (t: string) => <span className="text-muted-foreground">{t}</span>;

function contentItem(it: ContentItem, color: string, meta: FlowMeta) {
    const media: Record<string, [LucideIcon, string]> = { image: [ImageIcon, "Imagem"], video: [Video, "Vídeo"], audio: [Mic, "Áudio"], file: [File, "Arquivo"] };
    switch (it.kind) {
        case "text": return <Item color={color}>{it.text ? <PreviewText text={it.text} className="line-clamp-4 whitespace-pre-wrap break-words" /> : empty("Escreva o texto")}</Item>;
        case "image": case "video": case "audio": case "file": {
            const [Icon, label] = media[it.kind];
            return <Item color={color}><span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />{it.assetId || it.url ? (it.fileName || label) : empty(`Envie ${label.toLowerCase()}`)}</span></Item>;
        }
        case "delay": return <Item color={color}><span className="text-[10px] font-semibold uppercase" style={{ color }}>Atraso</span><br />{it.typing ? "Digitando " : "Espera "}{it.seconds} seg</Item>;
        case "autoOff": return <Item color={color}><span className="flex items-center gap-1.5"><PowerOff className="h-3.5 w-3.5" style={{ color }} />Resposta automática desligada por {formatHms(it.seconds)}</span></Item>;
        case "vcard": return <Item color={color}><span className="flex items-center gap-1.5"><Contact className="h-3.5 w-3.5" style={{ color }} />{it.name || empty("Cartão de contato")}</span></Item>;
        case "input": return (
            <div className="rounded-md py-1.5 pl-2 text-[12px]" style={{ background: `${color}12` }}>
                <span className="text-[10px] font-semibold uppercase" style={{ color }}>Pergunta</span>
                <div className="pr-2">{it.question ? <PreviewText text={it.question} className="line-clamp-3 whitespace-pre-wrap" /> : empty("Escreva a pergunta")}</div>
                <div className="mt-1 pr-2 text-[11px] text-muted-foreground">
                    {ANSWER_TYPES.find(a => a.value === it.answerType)?.label} → {it.fieldKey ? <b>{fieldLabel(meta, it.fieldKey)}</b> : <span className="text-amber-600">escolha o campo</span>}
                </div>
                <OutRow id={`input:${it.id}:valid`}><Zap className="mr-1 h-3 w-3 text-amber-500" />Resposta válida</OutRow>
                <OutRow id={`input:${it.id}:timeout`} className="text-muted-foreground">Se não responder</OutRow>
            </div>
        );
    }
}

export function formatHms(total: number) {
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
}

function actionText(a: FlowAction, meta: FlowMeta): ReactNode {
    const tag = (id?: string) => meta.labels.find(l => l.id === id)?.name;
    switch (a.type) {
        case "addTag": return <>Adicionar etiqueta {tag(a.labelId) ? <b>{tag(a.labelId)}</b> : <Pend />}</>;
        case "removeTag": return <>Remover etiqueta {tag(a.labelId) ? <b>{tag(a.labelId)}</b> : <Pend />}</>;
        case "setField": return <>Definir {a.fieldKey ? <b>{fieldLabel(meta, a.fieldKey)}</b> : <Pend />} = <PreviewText text={a.value || "(vazio)"} /></>;
        case "clearField": return <>Limpar {a.fieldKey ? <b>{fieldLabel(meta, a.fieldKey)}</b> : <Pend />}</>;
        case "notify": return <>Notificar equipe {a.phones ? <b>{a.phones}</b> : <Pend />}</>;
        case "pauseAutomation": return <>Pausar automações {a.forever ? "indefinidamente" : `por ${a.value} ${UNIT[a.unit]}`}</>;
        case "resumeAutomation": return <>Reativar automações</>;
        case "optOut": return <>Bloquear transmissões para o contato</>;
    }
}

const OP_LABEL: Record<string, string> = {
    is: "é", isNot: "não é", contains: "contém", notContains: "não contém", startsWith: "começa com", hasValue: "tem valor", containsAny: "contém alguma de",
    gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=", neq: "≠", after: "depois de", before: "antes de", on: "em",
};

export function conditionText(c: FlowCondition, meta: FlowMeta): ReactNode {
    const op = OP_LABEL[c.op];
    switch (c.source) {
        case "tag": return <>Etiqueta {op} <b>{meta.labels.find(l => l.id === c.value)?.name || "?"}</b></>;
        case "weekday": return <>Dia da semana {op} <b>{WEEKDAYS[Number(c.value)] ?? "?"}</b></>;
        case "time": return <>Hora {op} <b>{c.value || "?"}</b></>;
        case "field": return <><b>{fieldLabel(meta, c.fieldKey) || "?"}</b> {op} {c.op !== "hasValue" && <b>{c.value || "?"}</b>}</>;
    }
}

function Pend() { return <span className="text-amber-600">selecione</span>; }

function Body({ node, color }: { node: FlowNode; color: string }) {
    const { meta, stat } = useEditor();
    switch (node.type) {
        case "start":
            return <p className="px-3 text-[12px] text-muted-foreground">Seu fluxo começa por este bloco. Conecte-o a outro bloco.</p>;
        case "content": {
            const d = node.data as NodeDataMap["content"];
            return <div className="space-y-1.5 px-3">{d.items.length ? d.items.map(it => <div key={it.id}>{contentItem(it, color, meta)}</div>) : <Item color={color}>{empty("Adicione mensagens, mídias ou perguntas")}</Item>}</div>;
        }
        case "menu": {
            const d = node.data as MenuData;
            const sent = stat(node.id, "sent");
            const clicked = d.options.reduce((s, o) => s + stat(node.id, `option:${o.id}`), 0);
            return (
                <div className="space-y-1.5 pl-3">
                    <div className="mr-3 grid grid-cols-2 overflow-hidden rounded-md border text-center" style={{ borderColor: `${color}33` }}>
                        <div className="py-1"><b className="text-sm" style={{ color }}>{sent}</b><p className="text-[9px] text-muted-foreground">Enviado</p></div>
                        <div className="border-l py-1" style={{ borderColor: `${color}33` }}><b className="text-sm" style={{ color }}>{sent ? Math.round((clicked / sent) * 100) : 0}%</b><p className="text-[9px] text-muted-foreground">Respondido</p></div>
                    </div>
                    <div className="mr-3 text-[12px]">
                        {d.mode === "poll" && <span className="mb-1 inline-block rounded px-1.5 text-[10px] font-semibold" style={{ background: `${color}18`, color }}>📊 Enquete</span>}
                        {d.question ? <PreviewText text={d.question} className="line-clamp-3 whitespace-pre-wrap" /> : empty("Escreva a pergunta")}
                    </div>
                    {d.options.map((o, i) => (
                        <div key={o.id} className="mr-0 rounded-l-md py-1 pl-2" style={{ background: `${color}12` }}>
                            <OutRow id={`option:${o.id}`}>
                                <span className="mr-auto text-[12px]"><b style={{ color }}>{d.mode === "poll" ? "○" : `${i + 1}.`}</b> {o.text || empty("Resposta")}</span>
                                <span className="ml-2 rounded bg-background px-1 text-[9px] text-muted-foreground">{sent ? Math.round((stat(node.id, `option:${o.id}`) / sent) * 100) : 0}%</span>
                            </OutRow>
                        </div>
                    ))}
                    {d.maxErrors > 0 && <OutRow id="error" className="text-muted-foreground">Saída de erro (após {d.maxErrors} erros)</OutRow>}
                    <OutRow id="timeout" className="text-muted-foreground">Se não responder</OutRow>
                </div>
            );
        }
        case "action": {
            const d = node.data as NodeDataMap["action"];
            return <div className="space-y-1.5 px-3">{d.actions.length ? d.actions.map(a => <Item key={a.id} color={color}>{actionText(a, meta)}</Item>) : <Item color={color}>{empty("Qual ação deve ser tomada?")}</Item>}</div>;
        }
        case "condition": {
            const d = node.data as ConditionData;
            return (
                <div className="space-y-1.5 pl-3">
                    <p className="mr-3 text-[11px] text-muted-foreground">{d.logic === "and" ? "Todas as condições abaixo" : "Pelo menos uma condição abaixo"}</p>
                    {d.conditions.length ? d.conditions.map(c => <div key={c.id} className="mr-3"><Item color={color}>{conditionText(c, meta)}</Item></div>) : <div className="mr-3"><Item color={color}>{empty("Adicione uma condição")}</Item></div>}
                    <OutRow id="true" className="font-medium text-emerald-600">Verdadeiro</OutRow>
                    <OutRow id="false" className="font-medium text-rose-600">Falso</OutRow>
                </div>
            );
        }
        case "randomizer": {
            const d = node.data as RandomizerData;
            return (
                <div className="space-y-1.5 pl-3">
                    {d.options.length < 2 && <p className="mr-3 text-[11px] text-muted-foreground">Adicione pelo menos duas opções</p>}
                    {d.options.map((o, i) => (
                        <div key={o.id} className="rounded-l-md py-1 pl-2" style={{ background: `${color}12` }}>
                            <OutRow id={`option:${o.id}`}><span className="mr-auto text-[12px]">Opção {i + 1}</span>{d.mode === "random" && <b className="ml-2" style={{ color }}>{o.weight}%</b>}</OutRow>
                        </div>
                    ))}
                    {d.mode === "sequential" && <p className="mr-3 text-[10px] text-muted-foreground">Sequencial: uma opção por vez, em rodízio</p>}
                </div>
            );
        }
        case "smartDelay": {
            const d = node.data as SmartDelayData;
            return (
                <div className="px-3">
                    <Item color={color}>{d.mode === "duration"
                        ? (d.value > 0 ? <>Continua após <b>{d.value} {UNIT[d.unit]}</b></> : empty("Defina o tempo de espera"))
                        : (d.datetime ? <>Continua em <b>{new Date(d.datetime).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</b></> : empty("Escolha data e hora"))}</Item>
                </div>
            );
        }
        case "flowLink": {
            const d = node.data as NodeDataMap["flowLink"];
            const f = meta.flows.find(x => x.id === d.flowId);
            return <div className="px-3"><Item color={color}>{f ? <>Inicia o fluxo <b>{f.name}</b></> : empty("Selecione o fluxo que será iniciado")}</Item></div>;
        }
    }
}

function BlockNodeImpl({ id, type, data, selected }: NodeProps) {
    const t = type as NodeType;
    const node = { id, type: t, data, position: { x: 0, y: 0 } } as FlowNode;
    const { color, label } = BLOCKS[t];
    const Icon = BLOCK_ICONS[t];
    const { issuesByNode, requestDelete, duplicateNode } = useEditor();
    const errors = (issuesByNode[id] || []).filter(i => i.level === "error");
    const outs = outputsOf(node);
    const updateInternals = useUpdateNodeInternals();
    const outKey = outs.map(o => o.id).join("|");
    useEffect(() => { updateInternals(id); }, [id, outKey, updateInternals]);

    return (
        <div
            className="group w-[250px] rounded-xl border bg-card pb-2 shadow-[0_3px_5px_rgba(0,0,0,0.05)] transition-shadow"
            style={{
                borderColor: selected ? color : errors.length ? "#F59E0B99" : `${color}55`,
                backgroundImage: `linear-gradient(${color}08, ${color}08)`,
                boxShadow: selected ? `0 0 0 3px ${color}26, 0 3px 5px rgba(0,0,0,.05)` : undefined,
            }}
        >
            {t !== "start" && (
                <Handle type="target" position={Position.Left} className="!left-[-7px] !top-[19px] !h-3.5 !w-3.5 !border-2 !border-primary !bg-white dark:!bg-card" />
            )}
            <div className="flex h-10 items-center gap-2 px-3">
                <Icon className="h-4 w-4 shrink-0" style={{ color: t === "start" ? undefined : color }} />
                <span className="truncate text-[14px] font-bold" title={(data as { name?: string }).name ? label : undefined}>{(data as { name?: string }).name || label}</span>
                {t !== "start" && (
                    <div className={`nodrag ml-auto flex gap-0.5 ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                        <button type="button" title="Duplicar" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={e => { e.stopPropagation(); duplicateNode(id); }}><Copy className="h-3.5 w-3.5" /></button>
                        <button type="button" title="Excluir" className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={e => { e.stopPropagation(); requestDelete(id); }}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                )}
            </div>
            <Body node={node} color={color} />
            {(t === "start" || t === "content" || t === "action" || t === "smartDelay") && (
                <OutRow id="next" className="mt-1.5 text-muted-foreground">{t === "start" ? "Início" : "Próximo passo"}</OutRow>
            )}
            {errors.length > 0 && (
                <p className="mx-3 mt-1.5 flex items-center gap-1 text-[10px] font-medium text-amber-600" title={errors.map(e => e.message).join("\n")}>
                    <AlertTriangle className="h-3 w-3" /> Configuração pendente
                </p>
            )}
            {t === "flowLink" && <p className="mx-3 mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><MessageSquareText className="h-3 w-3" />Encerra este fluxo</p>}
        </div>
    );
}

export const BlockNode = memo(BlockNodeImpl);
