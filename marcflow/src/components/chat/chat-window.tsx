"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, ArrowLeft, FileText, Image as ImageIcon, Music, Video, Download, ArrowDown, CornerUpLeft, Copy, Trash2, Info, X, Search, Phone, MoreVertical, Smile, Mic, Check, CheckCheck, Clock, UserRound, RefreshCw, MailOpen, Zap } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BotPausedBanner } from "./bot-paused-banner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getChatMessages, markChatRead, sendChatMessage, sendMediaMessage, sendVoiceMessage, subscribePresence } from "@/app/dashboard/chat/actions";
import { AudioPlayer } from "./audio-player";
import { QuickReplyPanel, useQuickReplyProgress } from "./quick-replies";
import { useSocket } from "./socket-context";
import { useRouter } from "next/navigation";

interface Message {
    id: string;
    keyId: string;
    content: string;
    fromMe: boolean;
    timestamp: string;
    type: string;
    status: string;
    pushName?: string;
    senderJid?: string | null;
    mediaUrl?: string;
    remoteJid?: string;
    quoteId?: string | null;
    quoted?: {
        keyId: string;
        content: string | null;
        fromMe: boolean;
        senderJid: string | null;
        pushName: string | null;
    } | null;
}

interface ChatWindowProps {
    sessionId: string;
    jid: string;
    name?: string;
    onBack?: () => void;
    /** Screen this chat was opened from; shows a back button that returns there with its filters intact. */
    returnTo?: string;
}

const PAGE_LIMIT = 50;

// ─── Lazy media (unchanged) ────────
function LazyMedia({ src, alt }: { src: string; alt: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { rootMargin: "200px" });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return (
        <div ref={ref} className="mb-1.5 overflow-hidden rounded-xl">
            {visible ? <img src={src} alt={alt} className={`max-w-full max-h-60 object-cover rounded-xl transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`} onLoad={() => setLoaded(true)} loading="lazy" />
                : <div className="h-40 bg-muted/30 rounded-xl animate-pulse" />}
        </div>
    );
}
function LazyVideo({ src }: { src: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { rootMargin: "200px" });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return (
        <div ref={ref} className="mb-1.5 overflow-hidden rounded-xl">
            {visible ? <video src={src} controls className="max-w-full max-h-60 rounded-xl" preload="none" />
                : <div className="h-32 bg-muted/30 rounded-xl animate-pulse flex items-center justify-center"><Video className="h-6 w-6 text-muted-foreground/50" /></div>}
        </div>
    );
}

function useDateLabel() {
    const cache = useRef(new Map<string, string>());
    return (timestamp: string): string => {
        const cached = cache.current.get(timestamp);
        if (cached) return cached;
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        let label: string;
        if (diffDays === 0) label = "Hoje";
        else if (diffDays === 1) label = "Ontem";
        else label = date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
        cache.current.set(timestamp, label);
        return label;
    };
}

function handleDownload(url: string, fileName: string) {
    toast.info("Baixando...");
    fetch(url).then(res => { if (!res.ok) throw new Error(); return res.blob(); }).then(blob => {
        const dlUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = dlUrl; link.download = fileName;
        document.body.appendChild(link);
        link.click(); link.remove();
        window.URL.revokeObjectURL(dlUrl);
    }).catch(() => toast.error("Falha no download!"));
}

// ─── Context Menu ──────────────────
interface ContextMenuState {
    x: number;
    y: number;
    msg: Message;
}
function ContextMenu({ state, onClose, onReply, onDelete }: { state: ContextMenuState; onClose: () => void; onReply: (msg: Message) => void; onDelete: (msg: Message) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    const items = [
        { label: "Responder", icon: CornerUpLeft, action: () => { onReply(state.msg); onClose(); } },
        { label: "Copiar", icon: Copy, action: () => { navigator.clipboard.writeText(state.msg.content || "").then(() => toast.success("Copiado!")).catch(() => {}); onClose(); } },
        { label: "Excluir", icon: Trash2, action: () => { onDelete(state.msg); onClose(); }, dangerous: true },
        { label: "Informações", icon: Info, action: () => { toast.info(`ID: ${state.msg.keyId}\nStatus: ${state.msg.status}\nHorário: ${new Date(state.msg.timestamp).toLocaleString()}`); onClose(); } },
    ];

    // Adjust position to not overflow viewport
    const style: React.CSSProperties = { position: "fixed", top: state.y, left: state.x, zIndex: 9999 };
    if (state.x > window.innerWidth - 180) style.left = state.x - 180;
    if (state.y > window.innerHeight - 200) style.top = state.y - 180;

    return (
        <div ref={ref} style={style} className="w-44 rounded-xl bg-popover border shadow-xl py-1 animate-in fade-in zoom-in-95 origin-top-left">
            {items.map((item, i) => (
                <button key={i} onClick={item.action} className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors cursor-pointer",
                    item.dangerous ? "text-red-500 hover:bg-red-500/10" : "text-foreground hover:bg-muted"
                )}>
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                </button>
            ))}
        </div>
    );
}

// ─── Main Component ─────────────────
export function ChatWindow({ sessionId, jid, name, onBack, returnTo }: ChatWindowProps) {
    const router = useRouter();
    const goBack = () => (window.history.length > 1 ? router.back() : router.push(returnTo || "/dashboard/chat"));

    // Groups locked to admins (or left) can't receive our messages: say why instead of failing on send
    const [sendBlocked, setSendBlocked] = useState<string | null>(null);
    const [groupSubject, setGroupSubject] = useState<string | null>(null);
    useEffect(() => {
        if (!jid.endsWith("@g.us")) return;
        let alive = true;
        fetch(`/api/groups/${sessionId}/${encodeURIComponent(jid)}`)
            .then(async r => {
                const j = await r.json().catch(() => ({}));
                if (!alive) return;
                if (r.ok && j.subject) setGroupSubject(j.subject);
                if (r.status === 404) setSendBlocked("Você não participa mais deste grupo, então não é possível enviar mensagens.");
                else if (r.ok && j.announce && !j.meAdmin) setSendBlocked("Somente administradores podem enviar mensagens neste grupo.");
            })
            .catch(() => undefined);
        return () => { alive = false; };
    }, [sessionId, jid]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [uploadType, setUploadType] = useState<string>("image");
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [newMsgBadge, setNewMsgBadge] = useState(false);

    // Delete confirmation
    const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<Message | null>(null);

    // Reply state
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    // Presence ("Online", "digitando...") and in-chat search
    const [presence, setPresence] = useState<{ state: string; lastSeen?: number } | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Own profile picture (shown on voice notes we sent)
    const [myPic, setMyPic] = useState<string | undefined>();
    useEffect(() => {
        fetch(`/api/profile/${sessionId}`).then(r => r.json()).then(j => setMyPic(j?.data?.pictureUrl || undefined)).catch(() => undefined);
    }, [sessionId]);

    // Voice recording
    const [recSecs, setRecSecs] = useState<number | null>(null);
    const [sendingVoice, setSendingVoice] = useState(false);
    const recorder = useRef<MediaRecorder | null>(null);
    const recStream = useRef<MediaStream | null>(null);
    const recChunks = useRef<Blob[]>([]);
    const recCancel = useRef(false);
    const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const recStart = useRef(0);

    const { getSocket, joinSession } = useSocket();
    const [qrOpen, setQrOpen] = useState(false);
    const qrProgress = useQuickReplyProgress(getSocket, jid);
    const getDateLabel = useDateLabel();

    const scrollToBottom = useCallback((smooth = true) => {
        bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    }, []);

    const fetchMessages = useCallback(async (before?: string) => {
        try {
            if (!before) setLoading(true);
            else setLoadingMore(true);
            const data: any = await getChatMessages(sessionId, jid, PAGE_LIMIT, before);
            if (!before) { setMessages(data.messages || []); setAutoScroll(true); }
            else if (data.messages?.length > 0) setMessages(prev => [...(data.messages || []), ...prev]);
            setHasMore(data.hasMore);
            if (data.messages?.length > 0) setOldestTimestamp(data.messages[0].timestamp);
        } catch (e) { console.error("Failed to load messages", e); }
        finally { setLoading(false); setLoadingMore(false); }
    }, [sessionId, jid]);

    useEffect(() => { setMessages([]); setOldestTimestamp(null); setHasMore(false); fetchMessages(); }, [fetchMessages]);

    // Opening the chat marks it read and asks WhatsApp for online/typing updates
    useEffect(() => {
        markChatRead(sessionId, jid).catch(() => undefined);
        subscribePresence(sessionId, jid).catch(() => undefined);
        return () => { if (readTimer.current) clearTimeout(readTimer.current); };
    }, [sessionId, jid]);

    // Auto focus input when chat changes and finished loading
    useEffect(() => {
        if (!loading && inputRef.current) {
            // A tiny delay ensures React has fully flushed the DOM for the new chat
            setTimeout(() => {
                inputRef.current?.focus();
            }, 10);
        }
    }, [jid, loading]);

    // Socket real-time
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const onConnect = () => joinSession(sessionId);
        if (socket.connected) joinSession(sessionId);
        socket.on("connect", onConnect);
        const normalizedJid = jid.endsWith("@c.us") ? jid.replace("@c.us", "@s.whatsapp.net") : jid;
        const handler = (newMessages: Message[]) => {
            setMessages(prev => {
                const relevant = newMessages.filter(m => m.remoteJid === normalizedJid || prev.some(p => p.remoteJid === m.remoteJid));
                if (relevant.length === 0) return prev;
                if (relevant.some(m => !m.fromMe)) {
                    if (readTimer.current) clearTimeout(readTimer.current);
                    readTimer.current = setTimeout(() => { markChatRead(sessionId, jid).catch(() => undefined); }, 800);
                }
                const combined = [...prev, ...relevant];
                const unique = Array.from(new Map(combined.map(m => [m.keyId, m])).values());
                return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            });
        };
        const onPresence = ({ id, presences }: { id: string; presences: Record<string, { lastKnownPresence: string; lastSeen?: number }> }) => {
            if (id !== normalizedJid) return;
            const p = Object.values(presences || {})[0];
            if (p) setPresence({ state: p.lastKnownPresence, lastSeen: p.lastSeen });
        };
        socket.on("message.update", handler);
        socket.on("presence.update", onPresence);
        return () => { socket.off("connect", onConnect); socket.off("message.update", handler); socket.off("presence.update", onPresence); };
    }, [sessionId, jid, getSocket, joinSession]);

    useEffect(() => { if (autoScroll) scrollToBottom(false); }, [messages, autoScroll, scrollToBottom]);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        setAutoScroll(atBottom);
        if (atBottom) setNewMsgBadge(false);
        if (el.scrollTop < 100 && hasMore && !loadingMore && oldestTimestamp) {
            const prevHeight = el.scrollHeight;
            fetchMessages(oldestTimestamp).then(() => {
                requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight; });
            });
        }
    }, [hasMore, loadingMore, oldestTimestamp, fetchMessages]);

    const stopStream = () => {
        if (recTimer.current) clearInterval(recTimer.current);
        recTimer.current = null;
        recStream.current?.getTracks().forEach(t => t.stop());
        recStream.current = null;
    };
    useEffect(() => () => { recCancel.current = true; if (recorder.current?.state === "recording") recorder.current.stop(); stopStream(); }, []);

    const startRecording = async () => {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { toast.error("Este navegador não permite gravar áudio"); return; }
        let stream: MediaStream;
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
        catch { toast.error("Permita o acesso ao microfone para gravar áudio"); return; }
        const mimeType = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"].find(t => MediaRecorder.isTypeSupported(t));
        const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recStream.current = stream;
        recorder.current = mr;
        recChunks.current = [];
        recCancel.current = false;
        mr.ondataavailable = e => { if (e.data.size) recChunks.current.push(e.data); };
        mr.onstop = async () => {
            const secs = (Date.now() - recStart.current) / 1000;
            stopStream();
            setRecSecs(null);
            if (recCancel.current) return;
            if (secs < 1) { toast.info("Áudio muito curto"); return; }
            const blob = new Blob(recChunks.current, { type: mr.mimeType || "audio/webm" });
            const fd = new FormData();
            fd.append("file", new File([blob], mr.mimeType.includes("ogg") ? "voz.ogg" : "voz.webm", { type: blob.type }));
            fd.append("sessionId", sessionId);
            fd.append("jid", jid);
            setSendingVoice(true);
            try {
                await sendVoiceMessage(fd);
                setTimeout(() => fetchMessages(), 1000);
            } catch (e) { toast.error((e as Error).message || "Falha ao enviar o áudio"); }
            finally { setSendingVoice(false); }
        };
        recStart.current = Date.now();
        mr.start(250);
        setRecSecs(0);
        recTimer.current = setInterval(() => setRecSecs(Math.floor((Date.now() - recStart.current) / 1000)), 250);
    };

    const stopRecording = (send: boolean) => {
        recCancel.current = !send;
        if (recorder.current?.state === "recording") recorder.current.stop();
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        try {
            await sendChatMessage(sessionId, jid, input, replyingTo?.keyId);
            setInput("");
            setReplyingTo(null);
            setTimeout(() => fetchMessages(), 800);
        } catch (e: any) { toast.error(e.message || "Falha ao enviar"); }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    // Focus input when replying
    useEffect(() => {
        if (replyingTo && inputRef.current) {
            inputRef.current.focus();
        }
    }, [replyingTo]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Escape: cancel reply
            if (e.key === "Escape" && replyingTo) {
                e.preventDefault();
                setReplyingTo(null);
                return;
            }
            // ? : show shortcuts
            if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                toast.success("Atalhos", {
                    description: "Enter: Enviar\nShift+Enter: Nova linha\nEsc: Cancelar resposta\n?: Mostrar esta ajuda"
                });
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [replyingTo]);

    const processFileUpload = async (file: File, explicitType?: string) => {
        const formData = new FormData();
        formData.append("file", file);
        let type = explicitType;
        if (!type || type === '*') {
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            else if (file.type.startsWith('audio/')) type = 'audio';
            else type = 'document';
        }
        formData.append("type", type);
        formData.append("sessionId", sessionId);
        formData.append("jid", jid);
        try {
            toast.info(`Enviando ${file.name}...`);
            await sendMediaMessage(formData);
            toast.success("Enviado!");
            setTimeout(() => fetchMessages(), 800);
        } catch (error: any) { toast.error(error.message || "Falha ao enviar a mídia"); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processFileUpload(file, uploadType);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const triggerUpload = (type: string) => {
        setUploadType(type);
        if (fileInputRef.current) {
            fileInputRef.current.accept = type === 'image' ? "image/*" : type === 'video' ? "video/*" : type === 'audio' ? "audio/*" : "*/*";
            fileInputRef.current.click();
        }
    };

    // Right-click handler
    const handleContextMenu = useCallback((e: React.MouseEvent, msg: Message) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, msg });
    }, []);


    const displayName = name || groupSubject || jid.split('@')[0];
    const isGroup = jid.endsWith("@g.us");
    const phone = jid.split("@")[0];
    const avatarSrc = `/api/chat/${sessionId}/${encodeURIComponent(jid)}/avatar`;
    const q = searchQuery.trim().toLowerCase();
    const visibleMessages = q ? messages.filter(m => (m.content || "").toLowerCase().includes(q)) : messages;

    const insertAtCursor = (text: string) => {
        const el = inputRef.current;
        const start = el?.selectionStart ?? input.length;
        const end = el?.selectionEnd ?? input.length;
        setInput(input.slice(0, start) + text + input.slice(end));
        requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + text.length, start + text.length); });
    };

    return (
        <div className="relative flex flex-1 min-w-0 min-h-0">
        <div
            className="flex-1 flex flex-col min-w-0 min-h-0 relative bg-[#EFEAE2] dark:bg-[#0B141A]"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
                e.preventDefault(); setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) processFileUpload(f);
            }}
        >
            {contextMenu && (
                <ContextMenu
                    state={contextMenu}
                    onClose={() => setContextMenu(null)}
                    onReply={(msg) => { setReplyingTo(msg); scrollToBottom(true); }}
                    onDelete={(msg) => setDeleteConfirmMsg(msg)}
                />
            )}

            {isDragging && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary flex items-center justify-center flex-col gap-3 rounded-lg m-2">
                    <Paperclip className="h-8 w-8 text-primary" />
                    <p className="text-lg font-semibold text-primary">Solte os arquivos aqui</p>
                </div>
            )}

            <AlertDialog open={!!deleteConfirmMsg} onOpenChange={(open) => { if (!open) setDeleteConfirmMsg(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
                        <AlertDialogDescription>A mensagem será excluída para todos. Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                const msg = deleteConfirmMsg;
                                if (!msg) return;
                                fetch(`/api/messages/${sessionId}/${jid}/${msg.keyId}`, { method: "DELETE" })
                                    .then(() => { setMessages(p => p.filter(m => m.keyId !== msg.keyId)); toast.success("Excluída"); })
                                    .catch(() => toast.error("Falha ao excluir"));
                                setDeleteConfirmMsg(null);
                            }}
                        >Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Header */}
            <div className="shrink-0 z-10 flex items-center gap-3.5 border-b border-border/40 bg-background px-4 py-3 sm:px-5">
                {returnTo && (
                    <Button variant="ghost" size="sm" className="h-9 shrink-0 gap-1.5 px-2 text-muted-foreground hover:text-foreground" onClick={goBack} title="Voltar para Grupos">
                        <ArrowLeft className="h-5 w-5" /><span className="hidden sm:inline">Grupos</span>
                    </Button>
                )}
                {onBack && !returnTo && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden shrink-0 text-muted-foreground hover:text-foreground" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}
                <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={avatarSrc} alt="" className="object-cover" />
                    <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-primary/20 to-blue-500/20 text-primary">
                        {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="truncate text-lg font-semibold text-foreground">{displayName}</h3>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button type="button" title="Dados do contato" className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><UserRound className="h-4 w-4" /></button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-72 space-y-3">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-14 w-14"><AvatarImage src={avatarSrc} alt="" className="object-cover" /><AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                                    <div className="min-w-0"><p className="truncate font-semibold">{displayName}</p><p className="text-xs text-muted-foreground">{isGroup ? "Grupo" : formatPhone(phone)}</p></div>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-2 font-mono text-[11px] break-all">{jid}</div>
                                <Button variant="outline" size="sm" className="w-full" onClick={() => navigator.clipboard.writeText(isGroup ? jid : phone).then(() => toast.success("Copiado!"))}>
                                    <Copy className="h-3.5 w-3.5" />{isGroup ? "Copiar ID do grupo" : "Copiar número"}
                                </Button>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <StatusLine presence={presence} isGroup={isGroup} phone={phone} />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <HeaderBtn title="Buscar na conversa" active={searchOpen} onClick={() => { setSearchOpen(o => !o); setSearchQuery(""); }}><Search className="h-5 w-5" /></HeaderBtn>
                    <HeaderBtn title="Chamadas não são suportadas pela conexão do WhatsApp Web" disabled><Phone className="h-5 w-5" /></HeaderBtn>
                    <HeaderBtn title="Chamadas de vídeo não são suportadas pela conexão do WhatsApp Web" disabled><Video className="h-5 w-5" /></HeaderBtn>
                    <Popover>
                        <PopoverTrigger asChild>
                            <button type="button" title="Mais opções" className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><MoreVertical className="h-5 w-5" /></button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-52 p-1">
                            <MenuItem icon={MailOpen} onClick={() => markChatRead(sessionId, jid).then(() => toast.success("Marcada como lida")).catch(() => toast.error("Falha ao marcar como lida"))}>Marcar como lida</MenuItem>
                            <MenuItem icon={RefreshCw} onClick={() => fetchMessages()}>Atualizar mensagens</MenuItem>
                            <MenuItem icon={Copy} onClick={() => navigator.clipboard.writeText(isGroup ? jid : phone).then(() => toast.success("Copiado!"))}>{isGroup ? "Copiar ID do grupo" : "Copiar número"}</MenuItem>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {searchOpen && (
                <div className="shrink-0 z-10 flex items-center gap-2 border-b border-border/40 bg-background px-4 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar nas mensagens carregadas..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                    {q && <span className="text-xs text-muted-foreground">{visibleMessages.length} resultado{visibleMessages.length === 1 ? "" : "s"}</span>}
                    <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
                </div>
            )}

            {loadingMore && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border text-xs flex items-center gap-2">
                    <div className="h-3 w-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    Carregando mensagens anteriores...
                </div>
            )}

            {/* Messages over a wallpaper */}
            <div className="relative flex-1 min-h-0">
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.045] dark:opacity-[0.04] dark:invert" style={{ backgroundImage: WALLPAPER, backgroundSize: "220px 220px" }} />
                <div ref={scrollRef} className="absolute inset-0 overflow-y-auto px-4 py-4 sm:px-8 styled-scrollbar" onScroll={handleScroll}>
                    <div className="flex flex-col max-w-4xl mx-auto">
                        {loading && messages.length === 0 && (
                            <div className="flex-1 flex items-center justify-center py-32">
                                <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            </div>
                        )}
                        {!hasMore && messages.length > 0 && !q && (
                            <div className="text-center py-3"><span className="rounded-lg bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">Início da conversa</span></div>
                        )}
                        {messages.length === 0 && !loading && (
                            <div className="flex-1 flex items-center justify-center py-16"><span className="rounded-lg bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">Nenhuma mensagem ainda</span></div>
                        )}
                        {q && visibleMessages.length === 0 && (
                            <div className="flex justify-center py-10"><span className="rounded-lg bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">Nada encontrado para &quot;{searchQuery}&quot;</span></div>
                        )}
                        {visibleMessages.map((msg, idx) => {
                            const prev = visibleMessages[idx - 1];
                            const showDate = !prev || getDateLabel(msg.timestamp) !== getDateLabel(prev.timestamp);
                            const sameSender = !!prev && !showDate && prev.fromMe === msg.fromMe && (!isGroup || prev.pushName === msg.pushName);
                            const showAvatar = !msg.fromMe && !sameSender;
                            return (
                                <div key={msg.keyId} id={`msg-${msg.keyId}`} className={cn("rounded-xl transition-colors", sameSender ? "mt-1" : "mt-4")}>
                                    {showDate && (
                                        <div className="flex justify-center my-3">
                                            <span className="rounded-lg bg-background/95 px-4 py-1.5 text-[13px] font-medium text-foreground/80 shadow-sm dark:bg-[#182229]">{getDateLabel(msg.timestamp)}</span>
                                        </div>
                                    )}
                                    <div className={cn("flex items-end gap-2 group", msg.fromMe ? "justify-end" : "justify-start")}>
                                        {!msg.fromMe && (
                                            showAvatar ? (
                                                <Avatar className="h-9 w-9 shrink-0 self-start">
                                                    {!isGroup && <AvatarImage src={avatarSrc} alt="" className="object-cover" />}
                                                    <AvatarFallback className="text-[10px] font-semibold bg-gradient-to-br from-primary/20 to-blue-500/20 text-primary">
                                                        {(isGroup ? msg.pushName || "?" : displayName).slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                            ) : <span className="w-9 shrink-0" />
                                        )}
                                        {msg.fromMe && (
                                            <button onClick={() => { setReplyingTo(msg); scrollToBottom(true); }} title="Responder"
                                                className="self-center p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-background/70 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0">
                                                <CornerUpLeft className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                        <div className={cn(
                                            "flex max-w-[85%] flex-col overflow-hidden rounded-2xl px-3.5 py-2 shadow-[0_1px_1px_rgba(0,0,0,0.08)] sm:max-w-[65%] cursor-context-menu",
                                            msg.type === 'AUDIO' && "sm:max-w-[85%]",
                                            msg.fromMe
                                                ? "rounded-tr-md bg-[#D9FDD3] text-[#111B21] dark:bg-[#005C4B] dark:text-[#E9EDEF]"
                                                : "rounded-tl-md bg-white text-[#111B21] dark:bg-[#202C33] dark:text-[#E9EDEF]"
                                        )} onContextMenu={(e) => handleContextMenu(e, msg)}>
                                            {!msg.fromMe && isGroup && (msg.pushName || msg.senderJid) && !sameSender && (
                                                <span className="mb-0.5 block text-[12px] font-semibold text-primary">{msg.pushName || formatPhone(msg.senderJid!.split("@")[0].split(":")[0])}</span>
                                            )}
                                            {msg.quoted && (
                                                <div className="mb-1.5 cursor-pointer select-none rounded-lg border-l-4 border-primary bg-black/5 px-2 py-1 text-left text-xs hover:bg-black/10 dark:bg-white/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const target = document.getElementById(`msg-${msg.quoted?.keyId}`);
                                                        if (target) {
                                                            target.scrollIntoView({ behavior: "smooth", block: "center" });
                                                            target.classList.add("bg-primary/10");
                                                            setTimeout(() => target.classList.remove("bg-primary/10"), 1500);
                                                        } else toast.info("A mensagem original não está carregada na tela");
                                                    }}>
                                                    <span className="block text-[11px] font-semibold text-primary">
                                                        {msg.quoted.fromMe ? "Você" : (msg.quoted.pushName || msg.quoted.senderJid?.split('@')[0] || "Contato")}
                                                    </span>
                                                    <span className="line-clamp-2 block break-words opacity-80">{msg.quoted.content || "Mídia"}</span>
                                                </div>
                                            )}
                                            {msg.type === 'IMAGE' && msg.mediaUrl && (
                                                <div className="relative group/media">
                                                    <LazyMedia src={msg.mediaUrl} alt="Imagem" />
                                                    <Button size="icon" variant="secondary" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                                                        onClick={() => handleDownload(msg.mediaUrl!, `IMAGE-${msg.keyId}.jpg`)}><Download className="h-4 w-4" /></Button>
                                                </div>
                                            )}
                                            {msg.type === 'VIDEO' && msg.mediaUrl && (
                                                <div className="relative group/media">
                                                    <LazyVideo src={msg.mediaUrl} />
                                                    <Button size="icon" variant="secondary" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm z-10"
                                                        onClick={() => handleDownload(msg.mediaUrl!, `VIDEO-${msg.keyId}.mp4`)}><Download className="h-4 w-4" /></Button>
                                                </div>
                                            )}
                                            {msg.type === 'AUDIO' && msg.mediaUrl && (
                                                <AudioPlayer src={msg.mediaUrl} fromMe={msg.fromMe}
                                                    avatarSrc={msg.fromMe ? myPic : isGroup ? undefined : avatarSrc}
                                                    fallback={(msg.fromMe ? "Eu" : isGroup ? msg.pushName || "?" : displayName).slice(0, 2).toUpperCase()}
                                                    meta={<>{new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}{msg.fromMe && <StatusTicks status={msg.status} />}</>} />
                                            )}
                                            {msg.type === 'STICKER' && msg.mediaUrl && (
                                                <div className="relative group/media mb-1">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={msg.mediaUrl} alt="Figurinha" className="max-h-32 object-contain rounded-lg" loading="lazy" />
                                                </div>
                                            )}
                                            {msg.type !== 'TEXT' && msg.type !== 'IMAGE' && msg.type !== 'STICKER' && msg.type !== 'VIDEO' && msg.type !== 'AUDIO' && (
                                                <div className="mb-1 flex items-center justify-between gap-2 rounded-lg bg-black/5 px-2 py-1.5 dark:bg-white/10">
                                                    <div className="flex min-w-0 items-center gap-2 truncate">
                                                        <FileText className="h-4 w-4 shrink-0" />
                                                        <span className="truncate text-xs font-medium">{msg.type === "DOCUMENT" ? "Documento" : msg.type === "LOCATION" ? "Localização" : msg.type === "CONTACT" ? "Contato" : "Mensagem"}</span>
                                                    </div>
                                                    {msg.mediaUrl && <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full shrink-0" onClick={() => handleDownload(msg.mediaUrl!, `${msg.type}-${msg.keyId}`)}><Download className="h-3.5 w-3.5" /></Button>}
                                                </div>
                                            )}
                                            {!(msg.type === 'AUDIO' && msg.mediaUrl) && <div className="flex items-end gap-3">
                                                {msg.content && <span className="flex-1 whitespace-pre-wrap break-words text-[15px] leading-snug"><Highlight text={msg.content} q={q} /></span>}
                                                <span className="ml-auto flex shrink-0 translate-y-1 items-center gap-1 text-[11px] leading-none text-[#667781] dark:text-[#8696A0]">
                                                    {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                                                    {msg.fromMe && <StatusTicks status={msg.status} />}
                                                </span>
                                            </div>}
                                        </div>
                                        {!msg.fromMe && (
                                            <button onClick={() => { setReplyingTo(msg); scrollToBottom(true); }} title="Responder"
                                                className="self-center p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-background/70 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0">
                                                <CornerUpLeft className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={bottomRef} className="h-2" />
                    </div>
                </div>
            </div>

            {newMsgBadge && (
                <button onClick={() => { scrollToBottom(true); setNewMsgBadge(false); }}
                    className="absolute bottom-[100px] right-6 z-20 flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all animate-bounce">
                    <ArrowDown className="h-4 w-4" /> Novas mensagens
                </button>
            )}

            {/* Composer */}
            <div className="shrink-0 px-4 pb-4 pt-2 sm:px-6">
                <div className="mx-auto max-w-4xl">
                    {replyingTo && (
                        <div className="mb-2 flex items-start gap-2 overflow-hidden rounded-xl border-l-4 border-primary bg-background px-3 py-2 text-xs shadow-sm animate-in slide-in-from-bottom-1">
                            <div className="min-w-0 flex-1">
                                <span className="block text-[11px] font-semibold text-primary">Respondendo a {replyingTo.fromMe ? "você" : (replyingTo.pushName || displayName)}</span>
                                <span className="block truncate text-muted-foreground">{replyingTo.content || "Mídia"}</span>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                        </div>
                    )}
                    {!isGroup && <BotPausedBanner sessionId={sessionId} jid={jid.endsWith("@c.us") ? jid.replace("@c.us", "@s.whatsapp.net") : jid} />}
                    {qrProgress && (
                        <div className="mb-2 flex items-center gap-3 rounded-2xl bg-background/95 px-4 py-2 text-xs shadow-sm">
                            <Zap className="h-4 w-4 shrink-0 text-primary" />
                            <span className="min-w-0 flex-1 truncate">Enviando &quot;{qrProgress.title}&quot; — ação {qrProgress.step} de {qrProgress.total}</span>
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(qrProgress.step / qrProgress.total) * 100}%` }} /></div>
                        </div>
                    )}
                    {sendBlocked ? (
                        <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border border-border/50 bg-background px-4 py-3 text-center text-sm text-muted-foreground shadow-sm">
                            <Info className="h-4 w-4 shrink-0" />{sendBlocked}
                        </div>
                    ) : recSecs !== null || sendingVoice ? (
                        <div className="flex items-center gap-3 rounded-[28px] border border-border/50 bg-background px-3 py-2 shadow-sm">
                            <button type="button" title="Cancelar gravação" disabled={sendingVoice} onClick={() => stopRecording(false)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"><Trash2 className="h-5 w-5" /></button>
                            <span className="relative flex h-3 w-3">
                                {!sendingVoice && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />}
                                <span className={cn("relative inline-flex h-3 w-3 rounded-full", sendingVoice ? "bg-muted-foreground" : "bg-red-500")} />
                            </span>
                            <span className="flex-1 text-[15px] tabular-nums text-foreground">
                                {sendingVoice ? "Enviando áudio…" : `Gravando… ${Math.floor((recSecs || 0) / 60)}:${String((recSecs || 0) % 60).padStart(2, "0")}`}
                            </span>
                            <button type="button" title="Enviar áudio" disabled={sendingVoice} onClick={() => stopRecording(true)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:brightness-105 disabled:opacity-50">
                                {sendingVoice ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="h-5 w-5" />}
                            </button>
                        </div>
                    ) : (
                    <div className="flex items-end gap-1.5 rounded-[28px] border border-border/50 bg-background px-2 py-2 shadow-sm">
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                        <Popover>
                            <PopoverTrigger asChild>
                                <button type="button" title="Anexar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Paperclip className="h-5 w-5" /></button>
                            </PopoverTrigger>
                            <PopoverContent className="w-44 p-1.5" side="top" align="start">
                                <div className="flex flex-col gap-0.5">
                                    <Button variant="ghost" size="sm" className="justify-start gap-2 h-9 text-sm" onClick={() => triggerUpload('image')}><ImageIcon className="h-4 w-4 text-blue-500" /> Imagem</Button>
                                    <Button variant="ghost" size="sm" className="justify-start gap-2 h-9 text-sm" onClick={() => triggerUpload('video')}><Video className="h-4 w-4 text-purple-500" /> Vídeo</Button>
                                    <Button variant="ghost" size="sm" className="justify-start gap-2 h-9 text-sm" onClick={() => triggerUpload('audio')}><Music className="h-4 w-4 text-orange-500" /> Áudio</Button>
                                    <Button variant="ghost" size="sm" className="justify-start gap-2 h-9 text-sm" onClick={() => triggerUpload('document')}><FileText className="h-4 w-4 text-emerald-500" /> Documento</Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button type="button" title="Emojis" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Smile className="h-5 w-5" /></button>
                            </PopoverTrigger>
                            <PopoverContent side="top" align="start" className="w-72 p-2">
                                <div className="grid grid-cols-8 gap-1">
                                    {EMOJIS.map(e => (
                                        <button key={e} type="button" onClick={() => insertAtCursor(e)} className="flex h-8 w-8 items-center justify-center rounded-md text-xl hover:bg-muted">{e}</button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <textarea ref={inputRef} value={input}
                            onChange={(e) => { setInput(e.target.value); const el = e.target; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; }}
                            onKeyDown={handleKeyDown} placeholder="Digite uma mensagem..." rows={1} style={{ minHeight: "44px", maxHeight: "140px" }}
                            className="flex-1 resize-none rounded-[22px] bg-muted/50 px-4 py-2.5 text-[15px] leading-normal text-foreground placeholder:text-muted-foreground focus:outline-none" />
                        <button type="button" title="Respostas rápidas" onClick={() => setQrOpen(o => !o)}
                            className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-muted", qrOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}><Zap className="h-5 w-5" /></button>
                        <button type="button" title="Gravar áudio" onClick={startRecording}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Mic className="h-5 w-5" /></button>
                        <button type="button" onClick={handleSend} disabled={!input.trim()} title="Enviar (Enter)"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:brightness-105 disabled:opacity-50">
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                    )}
                </div>
            </div>
        </div>
        {qrOpen && <QuickReplyPanel sessionId={sessionId} jid={jid} onClose={() => setQrOpen(false)} />}
        </div>
    );
}

// ─── Small pieces ───────────────────
const EMOJIS = ["😀", "😂", "😊", "😍", "🥰", "😘", "😉", "😎", "🤩", "🤔", "😅", "😢", "😭", "😡", "😱", "🙏", "👍", "👎", "👏", "🙌", "💪", "🤝", "👋", "✌️", "❤️", "🧡", "💛", "💚", "💙", "💜", "🔥", "✨", "🎉", "✅", "❌", "⚠️", "📌", "📍", "💰", "🛒", "📦", "🚚", "⏰", "📅", "📞", "💬", "👀", "🚀"];

// Original doodle tile (simple outline icons); not WhatsApp's wallpaper.
const WALLPAPER = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220' fill='none' stroke='#000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M24 30h34a7 7 0 0 1 7 7v16a7 7 0 0 1-7 7H40l-9 8v-8h-7a7 7 0 0 1-7-7V37a7 7 0 0 1 7-7z'/><path d='M150 44c-4-7-16-5-16 4 0 8 16 17 16 17s16-9 16-17c0-9-12-11-16-4z'/><path d='M70 112l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z'/><circle cx='168' cy='128' r='14'/><path d='M162 132c3 4 9 4 12 0'/><path d='M163 123h.5M173 123h.5'/><path d='M30 170v-22l18-4v22'/><circle cx='26' cy='172' r='5'/><circle cx='44' cy='168' r='5'/><rect x='110' y='168' width='34' height='24' rx='5'/><circle cx='127' cy='180' r='6'/><path d='M118 168l3-5h12l3 5'/><path d='M196 196l8-8M200 186l4 2'/><path d='M100 30l6 6-6 6'/></svg>`)}")`;

function formatPhone(digits: string) {
    if (!/^\d+$/.test(digits)) return digits;
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        const ddd = digits.slice(2, 4), rest = digits.slice(4);
        return `+55 (${ddd}) ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
    }
    return `+${digits}`;
}

function StatusLine({ presence, isGroup, phone }: { presence: { state: string; lastSeen?: number } | null; isGroup: boolean; phone: string }) {
    if (presence?.state === "composing") return <p className="text-[13px] font-medium text-primary">digitando…</p>;
    if (presence?.state === "recording") return <p className="text-[13px] font-medium text-primary">gravando áudio…</p>;
    if (presence?.state === "available") return <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" />Online</p>;
    if (presence?.lastSeen) {
        const d = new Date(presence.lastSeen * 1000);
        const today = new Date().toDateString() === d.toDateString();
        return <p className="text-[13px] text-muted-foreground">visto por último {today ? "hoje" : d.toLocaleDateString("pt-BR")} às {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>;
    }
    return <p className="truncate text-[13px] text-muted-foreground">{isGroup ? "Grupo" : formatPhone(phone)}</p>;
}

function StatusTicks({ status }: { status: string }) {
    if (status === "READ") return <CheckCheck className="h-4 w-4 text-[#53BDEB]" />;
    if (status === "DELIVERED") return <CheckCheck className="h-4 w-4" />;
    if (status === "FAILED") return <X className="h-3.5 w-3.5 text-destructive" />;
    if (status === "PENDING") return <Clock className="h-3 w-3" />;
    return <Check className="h-4 w-4" />;
}

function Highlight({ text, q }: { text: string; q: string }) {
    if (!q) return <>{text}</>;
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return <>{text}</>;
    return <>{text.slice(0, i)}<mark className="rounded bg-yellow-300/70 px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

function HeaderBtn({ children, active, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
    return (
        <button type="button" {...p}
            className={cn("flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
                active && "bg-muted text-foreground")}>
            {children}
        </button>
    );
}

function MenuItem({ icon: Icon, children, onClick }: { icon: typeof Info; children: React.ReactNode; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />{children}
        </button>
    );
}
