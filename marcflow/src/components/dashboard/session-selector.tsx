"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "./session-provider";

export function SessionSelector() {
    const { sessions, sessionId, setSessionId, loading } = useSession();
    const selectedSession = sessions.find(s => s.sessionId === sessionId);

    return (
        <div className="flex items-center gap-1 sm:gap-2">
            <div className="w-[150px] sm:w-[170px]">
                <Select value={sessionId} onValueChange={setSessionId} disabled={loading || sessions.length === 0}>
                    <SelectTrigger className="h-11 border border-border/70 bg-background hover:bg-muted/30 transition-colors rounded-xl shadow-sm focus:ring-1 focus:ring-primary/20">
                        <SelectValue placeholder={loading ? "Carregando..." : "Selecionar sessão"}>
                            {selectedSession ? (
                                <div className="flex items-center gap-2 text-left">
                                    <span className="relative flex h-2 w-2">
                                        {selectedSession.status === "CONNECTED" && (
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        )}
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${selectedSession.status === "CONNECTED" ? "bg-emerald-500" : "bg-destructive"}`}></span>
                                    </span>
                                    <span className="truncate font-medium text-xs sm:text-sm">{selectedSession.name}</span>
                                </div>
                            ) : null}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-border/50 shadow-lg p-1">
                        {sessions.map((s) => (
                            <SelectItem key={s.sessionId} value={s.sessionId} className="rounded-lg py-2 focus:bg-muted/50 cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2 flex-shrink-0">
                                        {s.status === "CONNECTED" && (
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        )}
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${s.status === "CONNECTED" ? "bg-emerald-500" : "bg-destructive"}`}></span>
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm text-foreground">{s.name}</span>
                                        <span className="text-[10px] text-muted-foreground font-mono">{s.sessionId}</span>
                                    </div>
                                </div>
                            </SelectItem>
                        ))}
                        {sessions.length === 0 && !loading && (
                            <div className="py-6 px-2 text-xs text-muted-foreground text-center">
                                Nenhuma sessão conectada encontrada.
                            </div>
                        )}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
