"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquarePlus, Search, MessageCircle, X, Tag, Info, Check, Paperclip, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getChatCounts, getChatsStatus } from "@/app/dashboard/chat/actions";
import { useSocket } from "./socket-context";
import { toast } from "sonner";

interface ChatContact {
    jid: string;
    name: string | null;
    notify: string | null;
    profilePic: string | null;
    unreadCount?: number;
    lastMessage?: {
        content: string | null;
        timestamp: string;
        type: string;
    };
}

interface LabelData {
    id: string;
    name: string;
    colorHex: string;
}

type ChatLabelDot = { labelId: string; colorHex: string; labelName?: string };
type Filter = "all" | "unread" | "groups";

interface ChatListProps {
    sessionId: string;
    onSelectChat: (jid: string, name?: string) => void;
    selectedJid?: string;
}

const PAGE_SIZE = parseInt(process.env.NEXT_PUBLIC_CHAT_PAGE_SIZE || "50", 10);

const MEDIA_LABEL: Record<string, string> = {
    IMAGE: "Imagem", VIDEO: "Vídeo", AUDIO: "Áudio", DOCUMENT: "Documento", STICKER: "Figurinha", LOCATION: "Localização", CONTACT: "Contato",
};

function getDisplayName(chat: ChatContact): string {
    return chat.name || chat.notify || chat.jid.split('@')[0];
}

function MessagePreview({ chat }: { chat: ChatContact }) {
    const m = chat.lastMessage;
    if (!m?.content && (!m || m.type === "TEXT")) return <>Nenhuma mensagem ainda</>;
    if (m.type !== "TEXT") {
        return <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5 shrink-0" />{m.content && m.type !== "AUDIO" && m.type !== "STICKER" ? m.content : MEDIA_LABEL[m.type] || "Mídia"}</span>;
    }
    return <>{m.content}</>;
}

function getTimeLabel(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.floor((startOfToday - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);
    if (diffDays <= 0) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ─── Label Assignment Popover ──────
function LabelAssignPopover({ sessionId, jid, children }: { sessionId: string; jid: string; children: React.ReactNode }) {
    const [labels, setLabels] = useState<LabelData[]>([]);
    const [assigned, setAssigned] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    const fetchLabels = useCallback(async () => {
        setLoading(true);
        try {
            const [labelRes, assignedRes] = await Promise.all([
                fetch(`/api/labels/${sessionId}`),
                fetch(`/api/labels/${sessionId}/chats?jid=${encodeURIComponent(jid)}`)
            ]);
            const labelData = await labelRes.json();
            const assignedData = await assignedRes.json();
            if (labelRes.ok) setLabels(labelData.data?.labels || []);
            if (assignedRes.ok) setAssigned(new Set((assignedData.data || []).map((cl: { labelId: string }) => cl.labelId)));
        } catch (e) {
            console.error("Failed to fetch labels", e);
        } finally {
            setLoading(false);
        }
    }, [sessionId, jid]);

    const toggleLabel = async (labelId: string) => {
        const isAssigned = assigned.has(labelId);
        try {
            const res = await fetch(`/api/labels/${sessionId}/chat/${encodeURIComponent(jid)}/labels`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ labelIds: [labelId], action: isAssigned ? "remove" : "add" })
            });
            if (res.ok) {
                setAssigned(prev => {
                    const next = new Set(prev);
                    if (isAssigned) next.delete(labelId); else next.add(labelId);
                    return next;
                });
                toast.success(isAssigned ? "Etiqueta removida" : "Etiqueta atribuída");
            }
        } catch {
            toast.error("Falha ao atualizar a etiqueta");
        }
    };

    return (
        <Popover onOpenChange={(open) => { if (open) fetchLabels(); }}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-56 p-1.5" side="right" align="start">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5">Atribuir etiquetas</div>
                {loading ? (
                    <div className="flex items-center justify-center py-4"><Skeleton className="h-4 w-24" /></div>
                ) : labels.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-2">Nenhuma etiqueta. Crie uma na página de Etiquetas.</p>
                ) : (
                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                        {labels.map(label => (
                            <button key={label.id} onClick={() => toggleLabel(label.id)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-muted transition-colors cursor-pointer text-left">
                                <div className={cn("h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                    assigned.has(label.id) ? "border-foreground" : "border-muted-foreground/30")}>
                                    {assigned.has(label.id) && <Check className="h-2.5 w-2.5" />}
                                </div>
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: label.colorHex }} />
                                <span className="truncate text-xs font-medium">{label.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

// ─── Context Menu ──────────────────
interface CtxMenuState { x: number; y: number; jid: string; name: string; }
function ChatContextMenu({ state, onClose, onSelect }: { state: CtxMenuState; onClose: () => void; onSelect: (jid: string, name?: string) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [onClose]);

    const items = [
        { label: "Abrir conversa", icon: MessageCircle, action: () => { onSelect(state.jid, state.name); onClose(); } },
        { label: "Copiar JID", icon: Info, action: () => { navigator.clipboard.writeText(state.jid).then(() => toast.success("JID copiado!")); onClose(); } },
    ];

    const style: React.CSSProperties = { position: "fixed", top: state.y, left: state.x, zIndex: 9999 };
    if (state.x > window.innerWidth - 180) style.left = state.x - 180;
    if (state.y > window.innerHeight - 120) style.top = state.y - 120;

    return (
        <div ref={ref} style={style} className="w-44 rounded-xl bg-popover border shadow-xl py-1 animate-in fade-in zoom-in-95 origin-top-left">
            {items.map((item, i) => (
                <button key={i} onClick={item.action} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors cursor-pointer text-foreground hover:bg-muted">
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                </button>
            ))}
        </div>
    );
}

// ─── Chat Row ──────────────────────
function ChatRow({ chat, isSelected, onSelect, sessionId, labelDots }: {
    chat: ChatContact; isSelected: boolean; onSelect: (jid: string, name?: string) => void; sessionId: string; labelDots: ChatLabelDot[];
}) {
    const displayName = getDisplayName(chat);
    const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
    const unread = chat.unreadCount || 0;

    return (
        <>
            {ctxMenu && <ChatContextMenu state={ctxMenu} onClose={() => setCtxMenu(null)} onSelect={onSelect} />}
            <div
                className={cn(
                    "relative mx-2 flex items-center gap-3.5 rounded-xl px-3 py-3 transition-colors duration-150 group cursor-pointer",
                    isSelected ? "bg-primary/10" : "hover:bg-muted/60"
                )}
                onClick={() => onSelect(chat.jid, displayName)}
                onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, jid: chat.jid, name: displayName }); }}
            >
                {isSelected && <span className="absolute -left-2 top-2 bottom-2 w-1 rounded-r-full bg-primary" />}
                <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={`/api/chat/${sessionId}/${encodeURIComponent(chat.jid)}/avatar`} alt="" className="object-cover" />
                    <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-primary/20 to-blue-500/20 text-primary">
                        {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                        <h4 className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold text-foreground">
                            <span className="truncate">{displayName}</span>
                            {labelDots.length > 0 && (
                                <span className="flex shrink-0 items-center gap-[2px]">
                                    {labelDots.map((d, i) => <span key={i} className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: d.colorHex }} title={d.labelName} />)}
                                </span>
                            )}
                        </h4>
                        {chat.lastMessage && (
                            <span className={cn("shrink-0 text-xs", unread ? "font-semibold text-primary" : "text-muted-foreground")}>{getTimeLabel(chat.lastMessage.timestamp)}</span>
                        )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                        <p className={cn("flex-1 truncate text-[13px]", unread ? "text-foreground" : "text-muted-foreground")}><MessagePreview chat={chat} /></p>
                        <LabelAssignPopover sessionId={sessionId} jid={chat.jid}>
                            <button type="button" title="Etiquetas"
                                className="h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground hidden group-hover:flex"
                                onClick={(e) => e.stopPropagation()}>
                                <Tag className="h-3.5 w-3.5" />
                            </button>
                        </LabelAssignPopover>
                        {unread > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                                {unread > 99 ? "99+" : unread}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

function SkeletonRow() {
    return (
        <div className="flex items-center gap-3.5 px-5 py-3">
            <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44" />
            </div>
        </div>
    );
}

function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
    return (
        <button type="button" onClick={onClick}
            className={cn("flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                active ? "border-primary/40 bg-primary/10 text-primary" : "border-transparent bg-muted/60 text-foreground hover:bg-muted")}>
            {children}
            {count !== undefined && count > 0 && (
                <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", active ? "bg-primary/15" : "bg-background text-muted-foreground")}>{count}</span>
            )}
        </button>
    );
}

// ─── Main ──────────────────────────
export function ChatList({ sessionId, onSelectChat, selectedJid }: ChatListProps) {
    const [chats, setChats] = useState<ChatContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [newChatNumber, setNewChatNumber] = useState("");
    const [hasMore, setHasMore] = useState(true);
    const [filter, setFilter] = useState<Filter>("all");
    const [counts, setCounts] = useState({ unread: 0, groups: 0 });
    const [labelFilter, setLabelFilter] = useState<string | null>(null);
    const [labels, setLabels] = useState<LabelData[]>([]);
    const [chatLabelMap, setChatLabelMap] = useState<Map<string, ChatLabelDot[]>>(new Map());

    const { getSocket, joinSession } = useSocket();
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const chatsRef = useRef<ChatContact[]>(chats);
    chatsRef.current = chats;
    const selectedRef = useRef(selectedJid);
    selectedRef.current = selectedJid;
    const fetchingRef = useRef(false);

    const refreshCounts = useCallback(() => {
        if (countsTimerRef.current) clearTimeout(countsTimerRef.current);
        countsTimerRef.current = setTimeout(() => { getChatCounts(sessionId).then(setCounts).catch(() => undefined); }, 400);
    }, [sessionId]);

    const fetchChats = useCallback(async (cursor?: string, append = false) => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        try {
            if (!cursor) setLoading(true);
            const rawChats = (await getChatsStatus(sessionId, PAGE_SIZE, cursor || undefined, searchQuery || undefined, filter)) as ChatContact[];
            const processChats = (newChatsList: ChatContact[], existingChatsList: ChatContact[] = []) => {
                const merged = new Map(existingChatsList.map(c => [c.jid, c]));
                (newChatsList || []).forEach(c => {
                    const existing = merged.get(c.jid);
                    if (!existing || (c.lastMessage?.timestamp && (!existing.lastMessage?.timestamp || new Date(c.lastMessage.timestamp) > new Date(existing.lastMessage.timestamp)))) {
                        merged.set(c.jid, c);
                    }
                });
                return Array.from(merged.values());
            };
            if (append) setChats(prev => processChats(rawChats, prev));
            else setChats(processChats(rawChats));
            setHasMore((rawChats || []).length >= PAGE_SIZE);
        } catch (error) {
            console.error("Failed to load chats", error);
        } finally {
            setLoading(false);
            fetchingRef.current = false;
        }
    }, [sessionId, searchQuery, filter]);

    useEffect(() => { setChats([]); setHasMore(true); fetchChats(); }, [fetchChats]);
    useEffect(() => { refreshCounts(); }, [refreshCounts]);

    // Opening a chat clears its badge locally (the window marks it read on the server)
    useEffect(() => {
        if (!selectedJid) return;
        setChats(prev => prev.some(c => c.jid === selectedJid && c.unreadCount) ? prev.map(c => c.jid === selectedJid ? { ...c, unreadCount: 0 } : c) : prev);
        refreshCounts();
    }, [selectedJid, refreshCounts]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const onConnect = () => joinSession(sessionId);
        if (socket.connected) joinSession(sessionId);
        socket.on("connect", onConnect);
        const handler = async (newMessages: { remoteJid: string; content: string | null; timestamp: string; type: string; fromMe: boolean }[]) => {
            let needsReload = false;
            setChats(prev => {
                const updated = [...prev];
                newMessages.forEach(msg => {
                    const idx = updated.findIndex(c => c.jid === msg.remoteJid);
                    if (idx === -1) { needsReload = true; return; }
                    const c = updated[idx];
                    const unread = msg.fromMe || msg.remoteJid === selectedRef.current ? 0 : (c.unreadCount || 0) + 1;
                    updated[idx] = { ...c, unreadCount: unread, lastMessage: { content: msg.content, timestamp: msg.timestamp, type: msg.type } };
                });
                updated.sort((a, b) => (b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0) - (a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0));
                return updated;
            });
            if (needsReload) fetchChats();
            refreshCounts();
        };
        const onRead = ({ jid }: { jid: string }) => {
            setChats(prev => prev.map(c => c.jid === jid ? { ...c, unreadCount: 0 } : c));
            refreshCounts();
        };
        socket.on("message.update", handler);
        socket.on("chat.read", onRead);
        return () => { socket.off("connect", onConnect); socket.off("message.update", handler); socket.off("chat.read", onRead); };
    }, [sessionId, getSocket, joinSession, fetchChats, refreshCounts]);

    // Label assignments (dots + label filter)
    useEffect(() => {
        if (!sessionId) return;
        (async () => {
            try {
                const [res, lres] = await Promise.all([fetch(`/api/labels/${sessionId}/chats`), fetch(`/api/labels/${sessionId}`)]);
                if (res.ok) {
                    const data = await res.json();
                    const map = new Map<string, ChatLabelDot[]>();
                    for (const cl of (data.data || []) as { chatJid: string; labelId: string; colorHex: string; labelName?: string }[]) {
                        if (!map.has(cl.chatJid)) map.set(cl.chatJid, []);
                        map.get(cl.chatJid)!.push({ labelId: cl.labelId, colorHex: cl.colorHex, labelName: cl.labelName });
                    }
                    setChatLabelMap(map);
                }
                if (lres.ok) setLabels((await lres.json()).data?.labels || []);
            } catch (e) {
                console.error("Failed to load label assignments", e);
            }
        })();
    }, [sessionId]);

    const handleSearchChange = (val: string) => {
        setSearchInput(val);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => setSearchQuery(val), 300);
    };

    const filteredChats = useMemo(() => {
        let list = chats;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(chat => (chat.name || chat.notify || "").toLowerCase().includes(q) || chat.jid.toLowerCase().includes(q));
        }
        // shortcut: label filter applies to the chats already loaded, not a server query
        if (labelFilter) list = list.filter(c => chatLabelMap.get(c.jid)?.some(d => d.labelId === labelFilter));
        return list;
    }, [chats, searchQuery, labelFilter, chatLabelMap]);

    const handleEndReached = useCallback(() => {
        if (hasMore && !loading && !searchQuery.trim()) {
            const last = chatsRef.current[chatsRef.current.length - 1];
            const c = last?.lastMessage?.timestamp;
            if (c) fetchChats(c, true);
        }
    }, [hasMore, loading, searchQuery, fetchChats]);

    const itemContent = useCallback(
        (_: number, chat: ChatContact) => <ChatRow key={chat.jid} chat={chat} isSelected={selectedJid === chat.jid} onSelect={onSelectChat} sessionId={sessionId} labelDots={chatLabelMap.get(chat.jid) || []} />,
        [selectedJid, onSelectChat, sessionId, chatLabelMap]
    );

    const handleStartNewChat = () => {
        if (!newChatNumber) return;
        const clean = newChatNumber.replace(/\D/g, '');
        if (clean.length < 10) { toast.error("Informe o número com DDI e DDD, ex.: 5521999999999"); return; }
        onSelectChat(`${clean}@s.whatsapp.net`);
        setIsNewChatOpen(false);
        setNewChatNumber("");
    };

    const activeLabel = labels.find(l => l.id === labelFilter);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background">
            {/* Header */}
            <div className="shrink-0 space-y-3 px-5 pb-3 pt-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        Conversas
                        {chats.length > 0 && <span className="ml-2 text-base font-normal text-muted-foreground">({chats.length})</span>}
                    </h2>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground" title="Nova conversa"
                        onClick={() => setIsNewChatOpen(!isNewChatOpen)}>
                        {isNewChatOpen ? <X className="h-5 w-5" /> : <MessageSquarePlus className="h-5 w-5" />}
                    </Button>
                </div>

                {isNewChatOpen && (
                    <div className="space-y-2 rounded-xl border border-border/50 bg-muted/30 p-3">
                        <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Número com DDI e DDD</Label>
                        <div className="flex gap-1.5">
                            <Input placeholder="5521999999999" value={newChatNumber} autoFocus
                                onChange={(e) => setNewChatNumber(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleStartNewChat()}
                                className="h-9 text-sm" />
                            <Button size="sm" className="h-9 px-4" onClick={handleStartNewChat}>Abrir</Button>
                        </div>
                    </div>
                )}

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Buscar conversas..." value={searchInput}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="h-11 rounded-full border-0 bg-muted/60 pl-11 text-sm focus-visible:ring-1" />
                </div>

                <div className="flex items-center gap-2">
                    <Chip active={filter === "all"} onClick={() => setFilter("all")}>Todas</Chip>
                    <Chip active={filter === "unread"} onClick={() => setFilter("unread")} count={counts.unread}>Não lidas</Chip>
                    <Chip active={filter === "groups"} onClick={() => setFilter("groups")} count={counts.groups}>Grupos</Chip>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" title="Filtrar por etiqueta"
                                className={cn("ml-auto h-9 w-9 rounded-full", labelFilter ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                                <SlidersHorizontal className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-56 p-1.5">
                            <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Filtrar por etiqueta</p>
                            <button type="button" onClick={() => setLabelFilter(null)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                                <span className="w-3.5">{!labelFilter && <Check className="h-3.5 w-3.5" />}</span>Todas as conversas
                            </button>
                            {labels.map(l => (
                                <button key={l.id} type="button" onClick={() => setLabelFilter(l.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                                    <span className="w-3.5">{labelFilter === l.id && <Check className="h-3.5 w-3.5" />}</span>
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.colorHex }} />
                                    <span className="truncate">{l.name}</span>
                                </button>
                            ))}
                            {!labels.length && <p className="px-2 py-2 text-xs text-muted-foreground">Nenhuma etiqueta criada.</p>}
                        </PopoverContent>
                    </Popover>
                </div>
                {activeLabel && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeLabel.colorHex }} />Etiqueta: {activeLabel.name}
                        <button type="button" className="underline" onClick={() => setLabelFilter(null)}>limpar</button>
                    </div>
                )}
            </div>

            {/* Chat list */}
            <div className="flex-1 min-h-0">
                {loading && chats.length === 0 ? (
                    <div>{[1, 2, 3, 4, 5, 6].map(i => <SkeletonRow key={i} />)}</div>
                ) : filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                            <MessageCircle className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {searchQuery ? "Nenhuma conversa corresponde à busca" : filter === "unread" ? "Nenhuma conversa não lida" : filter === "groups" ? "Nenhum grupo com mensagens" : "Nenhuma conversa ainda"}
                        </p>
                    </div>
                ) : (
                    <Virtuoso style={{ height: "100%" }} data={filteredChats}
                        computeItemKey={(_: number, chat: ChatContact) => chat.jid} itemContent={itemContent}
                        endReached={handleEndReached} increaseViewportBy={200}
                        components={{
                            Footer: () => hasMore && !loading ? (
                                <div className="py-4 text-center">
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Role para ver mais</span>
                                </div>
                            ) : <div className="h-2" />
                        }} />
                )}
            </div>
        </div>
    );
}
