"use client";

import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";
import { useSidebar } from "./sidebar-context";
import { LogOut, PanelLeftClose, PanelLeft, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { BRAND_TAGLINE, MarcFlowLogo } from "@/components/brand/marcflow-logo";

interface SidebarShellProps {
    appName: string;
    userName?: string | null;
    userEmail?: string | null;
    version: string;
}

export function SidebarShell({ appName, userName, userEmail, version }: SidebarShellProps) {
    const { isCollapsed, toggleCollapse } = useSidebar();
    const initial = userName?.charAt(0)?.toUpperCase() || "U";

    return (
        <aside
            className={`
                hidden md:flex flex-col h-full sticky left-0 top-0 z-20
                bg-[#0C1110] text-[#C9D1CE]
                transition-all duration-300 ease-in-out
                ${isCollapsed ? "w-[76px]" : "w-[286px]"}
            `}
        >
            {/* Logo / Brand */}
            <div className={`group relative flex items-center transition-all duration-300 ${isCollapsed ? "justify-center px-3 py-6" : "gap-3 px-6 py-6"}`}>
                <MarcFlowLogo className="h-11 w-11 shrink-0" />
                {!isCollapsed && (
                    <div className="min-w-0">
                        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-white">{appName}</h1>
                        <p className="truncate text-[12px] text-[#9AA5A1]">{BRAND_TAGLINE}</p>
                    </div>
                )}
                <button
                    onClick={toggleCollapse}
                    title={isCollapsed ? "Expandir menu" : "Recolher menu"}
                    className={`absolute rounded-md p-1 text-[#7C8783] opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100 focus:opacity-100 ${isCollapsed ? "-right-0 top-1" : "right-3 top-3"}`}
                >
                    {isCollapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
                </button>
            </div>

            {/* Navigation */}
            <SidebarNav />

            {/* User Footer */}
            <div suppressHydrationWarning={true} className={`border-t border-white/[0.07] ${isCollapsed ? "p-2" : "px-5 pt-4 pb-3"}`}>
                {isCollapsed ? (
                    <div suppressHydrationWarning={true} className="flex flex-col items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1DB46B] text-sm font-bold text-white">{initial}</div>
                        <button onClick={() => signOut({ callbackUrl: "/auth/login" })} title="Sair"
                            className="rounded-lg p-2 text-[#9AA5A1] transition-colors hover:bg-white/10 hover:text-white">
                            <LogOut size={17} />
                        </button>
                    </div>
                ) : (
                    <>
                        <div suppressHydrationWarning={true} className="flex items-center gap-3 pb-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1DB46B] text-base font-bold text-white">{initial}</div>
                            <div suppressHydrationWarning={true} className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-white">{userName || "Usuário"}</p>
                                <p className="truncate text-[11px] text-[#8E9894]">{userEmail}</p>
                            </div>
                            <Link href="/dashboard/settings" title="Configurações" className="rounded-lg p-1.5 text-[#9AA5A1] transition-colors hover:bg-white/10 hover:text-white">
                                <Settings size={18} />
                            </Link>
                        </div>
                        <div className="border-t border-white/[0.07] pt-2">
                            <button onClick={() => signOut({ callbackUrl: "/auth/login" })}
                                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-[15px] text-[#C9D1CE] transition-colors hover:bg-white/[0.06] hover:text-white">
                                <LogOut size={18} /> Sair
                            </button>
                        </div>
                        <p className="sr-only">v{version}</p>
                    </>
                )}
            </div>
        </aside>
    );
}
