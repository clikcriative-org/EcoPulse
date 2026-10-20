"use client";

import { useState, useEffect } from "react";
import { ChatList } from "./chat-list";
import { ChatWindow } from "./chat-window";
import { MessageCircle } from "lucide-react";
import { chatJidFromPath, chatPathFromJid } from "@/lib/jid-utils";

interface ChatLayoutClientProps {
    sessionId: string;
    initialJid?: string;
    /** Set when opened from another screen (e.g. Grupos): the chat shows a way back to it. */
    returnTo?: string;
}

interface SelectedChat {
    jid: string;
    name?: string;
}

export function ChatLayoutClient({ sessionId, initialJid, returnTo }: ChatLayoutClientProps) {
    const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(
        initialJid ? { jid: initialJid } : null
    );

    // Sync selected chat to URL pathname
    useEffect(() => {
        if (typeof window === "undefined") return;
        const base = "/dashboard/chat";
        if (selectedChat) {
            const newPath = `${base}/${chatPathFromJid(selectedChat.jid)}`;
            if (window.location.pathname !== newPath) {
                window.history.replaceState(window.history.state, "", newPath + window.location.search);
            }
        } else {
            if (window.location.pathname !== base) {
                window.history.replaceState(null, "", base);
            }
        }
    }, [selectedChat]);

    // Handle browser back/forward
    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname;
            if (path.startsWith("/dashboard/chat/")) {
                setSelectedChat({ jid: chatJidFromPath(path.replace("/dashboard/chat/", "")) });
            } else {
                setSelectedChat(null);
            }
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    const handleSelectChat = (jid: string, name?: string) => {
        setSelectedChat({ jid, name });
    };

    const handleBack = () => {
        setSelectedChat(null);
        if (typeof window !== "undefined") {
            window.history.replaceState(null, "", "/dashboard/chat");
        }
    };

    return (
        // Outer: flex row, full height, overflow hidden — containment chain root
        <div className="flex h-full bg-background rounded-2xl border border-border/40 shadow-sm overflow-hidden min-h-0">
            {/* Chat List Panel */}
            <div className={`w-full md:w-[340px] lg:w-[380px] xl:w-[420px] border-r border-border/40 overflow-hidden shrink-0 flex flex-col
                ${selectedChat ? "hidden md:flex" : "flex"}`}
            >
                {/* Inner flex-col: header fixed + virtuoso fills rest */}
                <ChatList
                    sessionId={sessionId}
                    onSelectChat={handleSelectChat}
                    selectedJid={selectedChat?.jid}
                />
            </div>

            {/* Chat Window Panel */}
            <div className={`flex-1 overflow-hidden flex flex-col min-w-0
                ${!selectedChat ? "hidden md:flex" : "flex"}`}
            >
                {selectedChat ? (
                    <ChatWindow
                        key={selectedChat.jid}
                        sessionId={sessionId}
                        jid={selectedChat.jid}
                        name={selectedChat.name}
                        onBack={handleBack}
                        returnTo={returnTo}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center min-w-0 min-h-0">
                        <div className="text-center p-6">
                            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Selecione uma conversa para começar a enviar mensagens
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
