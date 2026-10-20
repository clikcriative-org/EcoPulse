import { auth } from "@/lib/auth";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChatLayoutClient } from "@/components/chat/chat-layout-client";
import { cookies } from "next/headers";
import { canAccessSession } from "@/lib/api-auth";
import { SessionGuard } from "@/components/dashboard/session-guard";
import { chatJidFromPath } from "@/lib/jid-utils";

export default async function ChatWithJidPage({
    params,
    searchParams,
}: {
    params: Promise<{ jid: string }>;
    searchParams: Promise<{ from?: string }>;
}) {
    const { jid: rawJid } = await params;
    const { from } = await searchParams;
    const session = await auth();

    if (!session?.user?.id) return <div>Não autorizado</div>;

    const resolvedJid = chatJidFromPath(rawJid);

    const cookieStore = await cookies();
    const sessionId = cookieStore.get("sessionId")?.value;
    let validSessionId: string | null = null;

    if (sessionId) {
        const hasAccess = await canAccessSession(session.user.id, session.user.role, sessionId);
        if (hasAccess) {
            validSessionId = sessionId;
        }
    }

    if (!validSessionId) {
        return (
            <SessionGuard>
                <ChatInterface sessionId={null} />
            </SessionGuard>
        );
    }

    return (
        <div className="h-[calc(100vh-6.5rem)] sm:h-[calc(100vh-6rem)]">
            <ChatLayoutClient
                key={`${validSessionId}-${resolvedJid}`}
                sessionId={validSessionId}
                initialJid={resolvedJid}
                returnTo={from === "groups" ? "/dashboard/groups" : undefined}
            />
        </div>
    );
}
