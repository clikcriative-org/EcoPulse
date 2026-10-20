"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FileText, Code, ExternalLink } from "lucide-react";

export default function ApiDocsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [filter, setFilter] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("Todas");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/auth/login");
        }
    }, [status, router]);

    const apiEndpoints = [
        // Sessions
        { category: "Sessões", method: "GET", path: "/api/sessions", description: "Listar todas as sessões", params: "-" },
        { category: "Sessões", method: "POST", path: "/api/sessions", description: "Criar nova sessão", params: "Body: { name, sessionId }" },
        { category: "Sessões", method: "GET", path: "/api/sessions/[sessionId]", description: "Obter detalhes da sessão", params: "Path: sessionId" },
        { category: "Sessões", method: "GET", path: "/api/sessions/[sessionId]/qr", description: "Obter QR Code", params: "Path: sessionId" },
        { category: "Sessões", method: "GET", path: "/api/sessions/[sessionId]/bot-config", description: "Obter configuração do bot", params: "Path: sessionId" },
        { category: "Sessões", method: "POST", path: "/api/sessions/[sessionId]/bot-config", description: "Atualizar configuração do bot", params: "Path: sessionId, Body: { enabled, botMode, ... }" },
        { category: "Sessões", method: "PATCH", path: "/api/sessions/[sessionId]/settings", description: "Atualizar configurações", params: "Path: sessionId, Body: { config }" },
        { category: "Sessões", method: "DELETE", path: "/api/sessions/[sessionId]/settings", description: "Excluir sessão", params: "Path: sessionId" },
        { category: "Sessões", method: "POST", path: "/api/sessions/[sessionId]/[action]", description: "Controlar sessão", params: "Path: sessionId, action (start|stop|restart|logout)" },

        // Groups
        { category: "Grupos", method: "GET", path: "/api/groups/[sessionId]", description: "Listar grupos", params: "Path: sessionId" },
        { category: "Grupos", method: "POST", path: "/api/groups/[sessionId]/create", description: "Criar grupo", params: "Path: sessionId, Body: { subject, participants }" },
        { category: "Grupos", method: "POST", path: "/api/groups/[sessionId]/invite/accept", description: "Aceitar convite", params: "Path: sessionId, Body: { code }" },
        { category: "Grupos", method: "PUT", path: "/api/groups/[sessionId]/[jid]/picture", description: "Atualizar foto do grupo", params: "Path: sessionId, jid, Body: { file } (multipart/form-data)" },
        { category: "Grupos", method: "DELETE", path: "/api/groups/[sessionId]/[jid]/picture", description: "Remover foto do grupo", params: "Path: sessionId, jid" },
        { category: "Grupos", method: "PUT", path: "/api/groups/[sessionId]/[jid]/subject", description: "Atualizar nome do grupo", params: "Path: sessionId, jid, Body: { subject }" },
        { category: "Grupos", method: "PUT", path: "/api/groups/[sessionId]/[jid]/description", description: "Atualizar descrição", params: "Path: sessionId, jid, Body: { description }" },
        { category: "Grupos", method: "GET", path: "/api/groups/[sessionId]/[jid]/invite", description: "Obter código de convite", params: "Path: sessionId, jid" },
        { category: "Grupos", method: "PUT", path: "/api/groups/[sessionId]/[jid]/invite/revoke", description: "Revogar convite", params: "Path: sessionId, jid" },
        { category: "Grupos", method: "PUT", path: "/api/groups/[sessionId]/[jid]/members", description: "Gerenciar membros", params: "Path: sessionId, jid, Body: { action, participants }" },
        { category: "Grupos", method: "PUT", path: "/api/groups/[sessionId]/[jid]/settings", description: "Atualizar configurações", params: "Path: sessionId, jid, Body: { settings }" },
        { category: "Grupos", method: "PUT", path: "/api/groups/[sessionId]/[jid]/ephemeral", description: "Ativar/desativar mensagens temporárias", params: "Path: sessionId, jid, Body: { ephemeral }" },
        { category: "Grupos", method: "POST", path: "/api/groups/[sessionId]/[jid]/leave", description: "Sair do grupo", params: "Path: sessionId, jid" },

        // Groups (Legacy)
        { category: "Grupos", method: "GET", path: "/api/groups", description: "Listar grupos [OBSOLETO]", params: "Query: sessionId" },
        { category: "Grupos", method: "POST", path: "/api/groups/create", description: "Criar grupo [OBSOLETO]", params: "Body: { sessionId, subject, participants }" },
        { category: "Grupos", method: "POST", path: "/api/groups/invite/accept", description: "Aceitar convite [OBSOLETO]", params: "Body: { sessionId, code }" },

        // Profile
        { category: "Perfil", method: "GET", path: "/api/profile/[sessionId]", description: "Obter o próprio perfil", params: "Path: sessionId" },
        { category: "Perfil", method: "PUT", path: "/api/profile/[sessionId]/name", description: "Atualizar nome", params: "Path: sessionId, Body: { name }" },
        { category: "Perfil", method: "PUT", path: "/api/profile/[sessionId]/status", description: "Atualizar status", params: "Path: sessionId, Body: { status }" },
        { category: "Perfil", method: "PUT", path: "/api/profile/[sessionId]/picture", description: "Atualizar foto", params: "Path: sessionId, Body: { image } (multipart/form-data)" },
        { category: "Perfil", method: "DELETE", path: "/api/profile/[sessionId]/picture", description: "Remover foto", params: "Path: sessionId" },

        // Profile (Legacy)
        { category: "Perfil", method: "GET", path: "/api/profile", description: "Obter perfil [OBSOLETO]", params: "Query: sessionId" },
        { category: "Perfil", method: "PUT", path: "/api/profile/name", description: "Atualizar nome [OBSOLETO]", params: "Body: { sessionId, name }" },
        { category: "Perfil", method: "PUT", path: "/api/profile/picture", description: "Atualizar foto [OBSOLETO]", params: "Body: { sessionId, image }" },
        { category: "Perfil", method: "DELETE", path: "/api/profile/picture", description: "Remover foto [OBSOLETO]", params: "Body: { sessionId }" },
        { category: "Perfil", method: "PUT", path: "/api/profile/status", description: "Atualizar status [OBSOLETO]", params: "Body: { sessionId, status }" },

        // Messaging
        { category: "Mensagens", method: "POST", path: "/api/messages/[sessionId]/[jid]/send", description: "Enviar mensagem", params: "Path: sessionId, jid, Body: { message }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/[sessionId]/[jid]/list", description: "Enviar mensagem de lista", params: "Path: sessionId, jid, Body: { ... }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/[sessionId]/[jid]/location", description: "Enviar localização", params: "Path: sessionId, jid, Body: { location }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/[sessionId]/[jid]/poll", description: "Enviar enquete", params: "Path: sessionId, jid, Body: { poll }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/[sessionId]/[jid]/spam", description: "Denunciar spam", params: "Path: sessionId, jid" },
        { category: "Mensagens", method: "POST", path: "/api/messages/[sessionId]/[jid]/sticker", description: "Enviar figurinha", params: "Path: sessionId, jid, Body: { file, pack, author, type, quality } (multipart/form-data)" },
        { category: "Mensagens", method: "POST", path: "/api/messages/[sessionId]/[jid]/[messageId]/react", description: "Enviar reação", params: "Path: sessionId, jid, messageId" },
        { category: "Mensagens", method: "POST", path: "/api/messages/[sessionId]/[jid]/contact", description: "Enviar contato", params: "Path: sessionId, jid, Body: { vcard }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/[sessionId]/[jid]/forward", description: "Encaminhar mensagem", params: "Path: sessionId, jid, Body: { messageId }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/[sessionId]/broadcast", description: "Enviar mensagem de transmissão", params: "Path: sessionId, Body: { recipients[], message, delay }" },
        { category: "Mensagens", method: "GET", path: "/api/messages/[sessionId]/broadcast/history", description: "Obter histórico de transmissões", params: "Path: sessionId, Query: limit, offset" },
        { category: "Mensagens", method: "GET", path: "/api/messages/[sessionId]/broadcast/history/[logId]", description: "Obter detalhes da transmissão", params: "Path: sessionId, logId" },
        { category: "Mensagens", method: "DELETE", path: "/api/messages/[sessionId]/[jid]/[messageId]", description: "Excluir mensagem", params: "Path: sessionId, jid, messageId" },

        { category: "Mensagens", method: "GET", path: "/api/messages/[sessionId]/download/[messageId]/media", description: "Baixar mídia", params: "Path: sessionId, messageId" },
        { category: "Mensagens", method: "GET", path: "/api/media/[filename]", description: "Servir arquivo de mídia", params: "Path: filename" },

        // Messaging (Legacy)
        { category: "Mensagens", method: "POST", path: "/api/messages/broadcast", description: "Enviar mensagem de transmissão [OBSOLETO]", params: "Body: { sessionId, jids[], message }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/contact", description: "Enviar contato [OBSOLETO]", params: "Body: { sessionId, jid, vcard }" },
        { category: "Mensagens", method: "DELETE", path: "/api/messages/delete", description: "Excluir mensagem [OBSOLETO]", params: "Body: { sessionId, jid, messageId }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/forward", description: "Encaminhar mensagem [OBSOLETO]", params: "Body: { sessionId, jid, messageId }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/list", description: "Enviar mensagem de lista [OBSOLETO]", params: "Body: { sessionId, jid, ... }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/location", description: "Enviar localização [OBSOLETO]", params: "Body: { sessionId, jid, location }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/poll", description: "Enviar enquete [OBSOLETO]", params: "Body: { sessionId, jid, poll }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/react", description: "Enviar reação [OBSOLETO]", params: "Body: { sessionId, jid, reaction }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/spam", description: "Denunciar spam [OBSOLETO]", params: "Body: { sessionId, jid }" },
        { category: "Mensagens", method: "POST", path: "/api/messages/sticker", description: "Enviar figurinha [OBSOLETO]", params: "Body: { sessionId, jid, sticker }" },

        // Chat
        { category: "Conversas", method: "GET", path: "/api/chat/[sessionId]", description: "Obter conversas", params: "Path: sessionId, Query: page, limit" },
        { category: "Conversas", method: "GET", path: "/api/chat/[sessionId]/[jid]", description: "Obter conversa específica", params: "Path: sessionId, jid, Query: limit" },
        { category: "Conversas", method: "POST", path: "/api/chat/[sessionId]/check", description: "Verificar números de WhatsApp", params: "Path: sessionId, Body: { phones[] }" },
        { category: "Conversas", method: "PUT", path: "/api/chat/[sessionId]/[jid]/read", description: "Marcar como lida", params: "Path: sessionId, jid" },
        { category: "Conversas", method: "POST", path: "/api/chat/[sessionId]/[jid]/archive", description: "Arquivar conversa", params: "Path: sessionId, jid, Body: { archive }" },
        { category: "Conversas", method: "POST", path: "/api/chat/[sessionId]/[jid]/presence", description: "Enviar presença", params: "Path: sessionId, jid, Body: { presence }" },
        { category: "Conversas", method: "POST", path: "/api/chat/[sessionId]/[jid]/profile-picture", description: "Obter foto de perfil", params: "Path: sessionId, jid" },
        { category: "Conversas", method: "PUT", path: "/api/chat/[sessionId]/[jid]/mute", description: "Silenciar conversa", params: "Path: sessionId, jid, Body: { mute }" },
        { category: "Conversas", method: "PUT", path: "/api/chat/[sessionId]/[jid]/pin", description: "Fixar conversa", params: "Path: sessionId, jid, Body: { pin }" },
        { category: "Conversas", method: "GET", path: "/api/chats/[sessionId]/by-label/[labelId]", description: "Filtrar por etiqueta", params: "Path: sessionId, labelId" },

        // Chat (Legacy)
        { category: "Conversas", method: "POST", path: "/api/chat/[sessionId]/send", description: "Enviar mensagem [OBSOLETO]", params: "Path: sessionId, Body: { jid, message }" },
        { category: "Conversas", method: "PUT", path: "/api/chat/archive", description: "Arquivar conversa [OBSOLETO]", params: "Body: { sessionId, jid, archive }" },
        { category: "Conversas", method: "POST", path: "/api/chat/check", description: "Verificar números de WhatsApp [OBSOLETO]", params: "Body: { sessionId, phones[] }" },
        { category: "Conversas", method: "PUT", path: "/api/chat/mute", description: "Silenciar conversa [OBSOLETO]", params: "Body: { sessionId, jid, mute }" },
        { category: "Conversas", method: "PUT", path: "/api/chat/pin", description: "Fixar conversa [OBSOLETO]", params: "Body: { sessionId, jid, pin }" },
        { category: "Conversas", method: "POST", path: "/api/chat/presence", description: "Enviar presença [OBSOLETO]", params: "Body: { sessionId, jid, presence }" },
        { category: "Conversas", method: "POST", path: "/api/chat/profile-picture", description: "Obter foto de perfil [OBSOLETO]", params: "Body: { sessionId, jid }" },
        { category: "Conversas", method: "PUT", path: "/api/chat/read", description: "Marcar como lida [OBSOLETO]", params: "Body: { sessionId, jid }" },
        { category: "Conversas", method: "POST", path: "/api/chat/send", description: "Enviar mensagem [OBSOLETO]", params: "Body: { sessionId, jid, message }" },
        { category: "Conversas", method: "GET", path: "/api/chats/by-label/[labelId]", description: "Filtrar por etiqueta [OBSOLETO]", params: "Path: labelId, Query: sessionId" },

        // Contacts
        { category: "Contatos", method: "GET", path: "/api/contacts/[sessionId]", description: "Listar contatos", params: "Path: sessionId, Query: search" },
        { category: "Contatos", method: "POST", path: "/api/contacts/[sessionId]/[jid]/block", description: "Bloquear contato", params: "Path: sessionId, jid" },
        { category: "Contatos", method: "POST", path: "/api/contacts/[sessionId]/[jid]/unblock", description: "Desbloquear contato", params: "Path: sessionId, jid" },

        // Contacts (Legacy)
        { category: "Contatos", method: "GET", path: "/api/contacts", description: "Listar contatos [OBSOLETO]", params: "Query: search" },
        { category: "Contatos", method: "POST", path: "/api/contacts/block", description: "Bloquear contato [OBSOLETO]", params: "Body: { sessionId, jid }" },
        { category: "Contatos", method: "POST", path: "/api/contacts/unblock", description: "Desbloquear contato [OBSOLETO]", params: "Body: { sessionId, jid }" },

        // Labels
        { category: "Etiquetas", method: "GET", path: "/api/labels/[sessionId]", description: "Listar etiquetas", params: "Path: sessionId" },
        { category: "Etiquetas", method: "POST", path: "/api/labels/[sessionId]", description: "Criar etiqueta", params: "Path: sessionId, Body: { name, color }" },
        { category: "Etiquetas", method: "PUT", path: "/api/labels/[sessionId]/[id]", description: "Atualizar etiqueta", params: "Path: sessionId, id, Body: { name, color }" },
        { category: "Etiquetas", method: "DELETE", path: "/api/labels/[sessionId]/[id]", description: "Excluir etiqueta", params: "Path: sessionId, id" },
        { category: "Etiquetas", method: "GET", path: "/api/labels/[sessionId]/chat-labels/[jid]", description: "Obter etiquetas da conversa", params: "Path: sessionId, jid" },
        { category: "Etiquetas", method: "PUT", path: "/api/labels/[sessionId]/chat-labels/[jid]", description: "Adicionar/remover etiquetas", params: "Path: sessionId, jid, Body: { labelIds[], action }" },

        // Labels (Legacy)
        { category: "Etiquetas", method: "GET", path: "/api/labels", description: "Listar etiquetas [OBSOLETO]", params: "Query: sessionId" },
        { category: "Etiquetas", method: "POST", path: "/api/labels", description: "Criar etiqueta [OBSOLETO]", params: "Body: { sessionId, name, color }" },
        { category: "Etiquetas", method: "GET", path: "/api/labels/chat-labels", description: "Obter etiquetas da conversa [OBSOLETO]", params: "Query: sessionId, jid" },
        { category: "Etiquetas", method: "PUT", path: "/api/labels/chat-labels", description: "Atualizar etiquetas da conversa [OBSOLETO]", params: "Body: { sessionId, jid, labelIds[], action }" },

        // Auto Reply
        { category: "Resposta automática", method: "GET", path: "/api/autoreplies/[sessionId]", description: "Listar respostas automáticas", params: "Path: sessionId" },
        { category: "Resposta automática", method: "POST", path: "/api/autoreplies/[sessionId]", description: "Criar resposta automática", params: "Path: sessionId, Body: { keyword, response, matchType }" },
        { category: "Resposta automática", method: "GET", path: "/api/autoreplies/[sessionId]/[id]", description: "Obter resposta automática", params: "Path: sessionId, id" },
        { category: "Resposta automática", method: "PUT", path: "/api/autoreplies/[sessionId]/[id]", description: "Atualizar resposta automática", params: "Path: sessionId, id, Body: { ... }" },
        { category: "Resposta automática", method: "DELETE", path: "/api/autoreplies/[sessionId]/[id]", description: "Excluir resposta automática", params: "Path: sessionId, id" },

        // Auto Reply (Legacy)
        { category: "Resposta automática", method: "GET", path: "/api/autoreplies", description: "Listar respostas automáticas [OBSOLETO]", params: "Query: sessionId" },
        { category: "Resposta automática", method: "POST", path: "/api/autoreplies", description: "Criar resposta automática [OBSOLETO]", params: "Body: { sessionId, keyword, ... }" },

        // Scheduler
        { category: "Agendador", method: "GET", path: "/api/scheduler/[sessionId]", description: "Listar agendamentos", params: "Path: sessionId" },
        { category: "Agendador", method: "POST", path: "/api/scheduler/[sessionId]", description: "Criar agendamento", params: "Path: sessionId, Body: { jid, content, sendAt }" },
        { category: "Agendador", method: "GET", path: "/api/scheduler/[sessionId]/[id]", description: "Obter agendamento", params: "Path: sessionId, id" },
        { category: "Agendador", method: "PUT", path: "/api/scheduler/[sessionId]/[id]", description: "Atualizar agendamento", params: "Path: sessionId, id, Body: { ... }" },
        { category: "Agendador", method: "DELETE", path: "/api/scheduler/[sessionId]/[id]", description: "Excluir agendamento", params: "Path: sessionId, id" },

        // Scheduler (Legacy)
        { category: "Agendador", method: "GET", path: "/api/scheduler", description: "Listar agendamentos [OBSOLETO]", params: "Query: sessionId" },
        { category: "Agendador", method: "POST", path: "/api/scheduler", description: "Criar agendamento [OBSOLETO]", params: "Body: { sessionId, content, ... }" },

        // Webhooks
        { category: "Webhooks", method: "GET", path: "/api/webhooks/[sessionId]", description: "Listar webhooks", params: "Path: sessionId" },
        { category: "Webhooks", method: "POST", path: "/api/webhooks/[sessionId]", description: "Criar webhook", params: "Path: sessionId, Body: { name, url, events[] }" },
        { category: "Webhooks", method: "PUT", path: "/api/webhooks/[sessionId]/[id]", description: "Atualizar webhook", params: "Path: sessionId, id, Body: { ... }" },
        { category: "Webhooks", method: "DELETE", path: "/api/webhooks/[sessionId]/[id]", description: "Excluir webhook", params: "Path: sessionId, id" },

        // Webhooks (Legacy)
        { category: "Webhooks", method: "GET", path: "/api/webhooks", description: "Listar webhooks [OBSOLETO]", params: "Query: sessionId" },
        { category: "Webhooks", method: "POST", path: "/api/webhooks", description: "Criar webhook [OBSOLETO]", params: "Body: { sessionId, url, ... }" },

        // Notifications
        { category: "Notificações", method: "GET", path: "/api/notifications", description: "Listar notificações", params: "-" },
        { category: "Notificações", method: "POST", path: "/api/notifications", description: "Criar notificação", params: "Body: { title, message, ... }" },
        { category: "Notificações", method: "PATCH", path: "/api/notifications/read", description: "Marcar como lida", params: "Body: { ids[] }" },
        { category: "Notificações", method: "DELETE", path: "/api/notifications/delete", description: "Excluir notificações", params: "Query: id" },

        // Users
        { category: "Usuários", method: "GET", path: "/api/users", description: "Listar usuários", params: "-" },
        { category: "Usuários", method: "POST", path: "/api/users", description: "Criar usuário", params: "Body: { name, email, password }" },
        { category: "Usuários", method: "GET", path: "/api/users/[id]", description: "Obter usuário", params: "Path: id" },
        { category: "Usuários", method: "PATCH", path: "/api/users/[id]", description: "Atualizar usuário", params: "Path: id, Body: { ... }" },
        { category: "Usuários", method: "DELETE", path: "/api/users/[id]", description: "Excluir usuário", params: "Path: id" },
        { category: "Usuários", method: "GET", path: "/api/user/api-key", description: "Obter chave de API", params: "-" },
        { category: "Usuários", method: "POST", path: "/api/user/api-key", description: "Gerar chave de API", params: "-" },
        { category: "Usuários", method: "DELETE", path: "/api/user/api-key", description: "Revogar chave de API", params: "-" },

        // System
        { category: "Sistema", method: "GET", path: "/api/settings/system", description: "Obter configurações do sistema", params: "-" },
        { category: "Sistema", method: "POST", path: "/api/settings/system", description: "Atualizar configurações do sistema", params: "Body: { appName, logoUrl, timezone }" },
        { category: "Sistema", method: "POST", path: "/api/status/[sessionId]/update", description: "Atualizar status", params: "Path: sessionId, Body: { status }" },
        { category: "Sistema", method: "GET", path: "/api/system/check-updates", description: "Verificar atualizações", params: "-" },
    ];


    const categories = ["Todas", ...Array.from(new Set(apiEndpoints.map(e => e.category)))];

    const filteredEndpoints = apiEndpoints.filter(endpoint => {
        const matchesFilter = endpoint.path.toLowerCase().includes(filter.toLowerCase()) ||
            endpoint.description.toLowerCase().includes(filter.toLowerCase());
        const matchesCategory = selectedCategory === "Todas" || endpoint.category === selectedCategory;
        return matchesFilter && matchesCategory;
    });

    const getMethodColor = (method: string) => {
        switch (method) {
            case "GET": return "bg-green-100 text-green-800 border-green-300";
            case "POST": return "bg-blue-100 text-blue-800 border-blue-300";
            case "PUT": return "bg-yellow-100 text-yellow-800 border-yellow-300";
            case "PATCH": return "bg-orange-100 text-orange-800 border-orange-300";
            case "DELETE": return "bg-red-100 text-red-800 border-red-300";
            default: return "bg-gray-100 text-gray-800 border-gray-300";
        }
    };

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-600">Carregando...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                            Documentação da API
                        </h1>
                        <p className="text-gray-500 mt-2">
                            Referência completa de todos os {apiEndpoints.length} endpoints da API.
                        </p>
                    </div>
                    <a
                        href="/docs"
                        target="_blank"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <Code className="w-4 h-4" />
                        Abrir Swagger UI
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>

                {/* Master Documentation Alert */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r shadow-sm mb-6">
                    <div className="flex items-start">
                        <div className="flex-shrink-0">
                            <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-blue-800">📘 Documentação do projeto disponível</h3>
                            <div className="mt-2 text-sm text-blue-700">
                                <p>
                                    Para entender a fundo a <strong>arquitetura do projeto</strong>, o <strong>esquema do banco de dados</strong> e as <strong>rotas do frontend</strong>,
                                    consulte o arquivo <a href="/docs/PROJECT_DOCUMENTATION.md" className="font-bold underline hover:text-blue-900">Documentação mestre do projeto</a> no seu código.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">Links rápidos</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <a
                            href="/docs"
                            target="_blank"
                            className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors group"
                        >
                            <Code className="w-10 h-10 text-blue-600 mr-4" />
                            <div className="flex-1">
                                <h3 className="font-medium text-gray-800 group-hover:text-blue-600">Swagger UI</h3>
                                <p className="text-sm text-gray-600">Testes interativos da API</p>
                            </div>
                            <ExternalLink className="w-5 h-5 text-gray-400" />
                        </a>
                        <a
                            href="/api/docs"
                            target="_blank"
                            className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors group"
                        >
                            <FileText className="w-10 h-10 text-green-600 mr-4" />
                            <div className="flex-1">
                                <h3 className="font-medium text-gray-800 group-hover:text-green-600">Especificação OpenAPI</h3>
                                <p className="text-sm text-gray-600">Especificação em JSON</p>
                            </div>
                            <ExternalLink className="w-5 h-5 text-gray-400" />
                        </a>
                        <div className="flex items-center p-4 border rounded-lg bg-gray-50">
                            <div className="flex-1">
                                <h3 className="font-medium text-gray-800">URL base</h3>
                                <p className="text-sm text-gray-600 font-mono break-all">{process.env.NEXT_PUBLIC_API_URL || '/api'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
                            <input
                                type="text"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                placeholder="Buscar endpoints..."
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Endpoints List */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parâmetros</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredEndpoints.map((endpoint, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getMethodColor(endpoint.method)}`}>
                                                {endpoint.method}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <code className="text-sm text-gray-900 font-mono">{endpoint.path}</code>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono text-gray-600 max-w-xs break-words">
                                            {endpoint.params || "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{endpoint.description}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                                {endpoint.category}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredEndpoints.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            Nenhum endpoint encontrado para os critérios informados
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-2xl font-bold text-blue-600">{apiEndpoints.length}</div>
                        <div className="text-sm text-gray-600">Total de endpoints</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-2xl font-bold text-green-600">{categories.length - 1}</div>
                        <div className="text-sm text-gray-600">Categorias</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-2xl font-bold text-yellow-600">{apiEndpoints.filter(e => e.method === "POST").length}</div>
                        <div className="text-sm text-gray-600">Endpoints POST</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-2xl font-bold text-purple-600">{apiEndpoints.filter(e => e.method === "GET").length}</div>
                        <div className="text-sm text-gray-600">Endpoints GET</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
