"use client";

import { useRef, useState } from "react";
import { Bold, Braces, Italic, Strikethrough } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useEditor, variableGroups } from "./editor-context";

interface Props {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    rows?: number;
    maxLength?: number;
    formatting?: boolean; // WhatsApp *bold* _italic_ ~strike~
    accent?: string;
}

/** Textarea with WhatsApp formatting buttons and a {variable} picker. */
export function TextField({ value, onChange, placeholder, rows = 3, maxLength = 4096, formatting = true, accent = "#94A3B8" }: Props) {
    const ref = useRef<HTMLTextAreaElement>(null);
    const { meta } = useEditor();
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");

    const insert = (before: string, after = "") => {
        const el = ref.current;
        const start = el?.selectionStart ?? value.length;
        const end = el?.selectionEnd ?? value.length;
        const next = value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end);
        onChange(next.slice(0, maxLength));
        requestAnimationFrame(() => {
            el?.focus();
            const pos = start + before.length + (end - start) + after.length;
            el?.setSelectionRange(pos, pos);
        });
    };

    const groups = variableGroups(meta)
        .map(g => ({ ...g, items: g.items.filter(i => !q || i.label.toLowerCase().includes(q.toLowerCase()) || i.key.includes(q.toLowerCase())) }))
        .filter(g => g.items.length);

    return (
        <div className="rounded-xl border bg-background transition-colors focus-within:ring-2 focus-within:ring-ring/30" style={{ borderColor: `${accent}66` }}>
            <textarea
                ref={ref}
                value={value}
                rows={rows}
                maxLength={maxLength}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
                className="block w-full resize-y rounded-t-xl bg-transparent px-3 pt-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-0.5 px-2 pb-1.5">
                {formatting && (
                    <>
                        <ToolBtn title="Negrito (*texto*)" onClick={() => insert("*", "*")}><Bold className="h-3.5 w-3.5" /></ToolBtn>
                        <ToolBtn title="Itálico (_texto_)" onClick={() => insert("_", "_")}><Italic className="h-3.5 w-3.5" /></ToolBtn>
                        <ToolBtn title="Tachado (~texto~)" onClick={() => insert("~", "~")}><Strikethrough className="h-3.5 w-3.5" /></ToolBtn>
                    </>
                )}
                <Popover open={open} onOpenChange={o => { setOpen(o); setQ(""); }}>
                    <PopoverTrigger asChild>
                        <button type="button" title="Inserir variável" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Braces className="h-3.5 w-3.5" /></button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-2">
                        <Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar campo" className="mb-2 h-8" />
                        <div className="max-h-60 overflow-y-auto">
                            {groups.map(g => (
                                <div key={g.label} className="mb-1">
                                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                                    {g.items.map(i => (
                                        <button key={i.key} type="button" className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                                            onClick={() => { insert(`{${i.key}}`); setOpen(false); }}>
                                            <span>{i.label}</span><span className="font-mono text-[10px] text-muted-foreground">{`{${i.key}}`}</span>
                                        </button>
                                    ))}
                                </div>
                            ))}
                            {!groups.length && <p className="p-2 text-sm text-muted-foreground">Nenhum campo encontrado</p>}
                        </div>
                    </PopoverContent>
                </Popover>
                <span className="ml-auto text-[10px] text-muted-foreground">{value.length}/{maxLength}</span>
            </div>
        </div>
    );
}

function ToolBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" {...p}>{children}</button>;
}

/** Renders WhatsApp markup + {vars} for card previews. */
export function PreviewText({ text, className }: { text: string; className?: string }) {
    const parts = text.split(/(\{[^}]+\}|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
    return (
        <span className={className}>
            {parts.map((p, i) => {
                if (/^\{[^}]+\}$/.test(p)) return <span key={i} className="font-semibold text-blue-600 dark:text-blue-400">{p}</span>;
                if (/^\*.+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>;
                if (/^_.+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
                if (/^~.+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>;
                return p;
            })}
        </span>
    );
}
