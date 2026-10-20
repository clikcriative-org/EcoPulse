'use client';

import { useEffect, useState } from 'react';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, ShieldCheck, AlertTriangle } from "lucide-react";

type CloudInfo = {
    provider: string;
    phoneNumberId: string | null;
    wabaId: string | null;
    hasToken: boolean;
    webhookUrl: string;
    webhookReady: boolean;
};

/** Meta Cloud API credentials of a session: Phone Number ID, WABA ID and the permanent access token. */
export function CloudSettings({ sessionId, onSaved }: { sessionId: string; onSaved?: () => void }) {
    const [info, setInfo] = useState<CloudInfo | null>(null);
    const [phoneNumberId, setPhoneNumberId] = useState("");
    const [wabaId, setWabaId] = useState("");
    const [accessToken, setAccessToken] = useState("");
    const [saving, setSaving] = useState(false);

    const load = async () => {
        const res = await fetch(`/api/sessions/${sessionId}/cloud`);
        const body = await res.json().catch(() => null);
        if (!body?.data) return;
        setInfo(body.data);
        setPhoneNumberId(body.data.phoneNumberId || "");
        setWabaId(body.data.wabaId || "");
    };

    useEffect(() => { load(); }, [sessionId]);

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/sessions/${sessionId}/cloud`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phoneNumberId: phoneNumberId.trim(), wabaId: wabaId.trim(), accessToken: accessToken.trim() }),
            });
            const body = await res.json();
            if (!res.ok || !body.status) throw new Error(body.message || "Falha ao salvar");
            toast.success(`Conectado como ${body.data.verifiedName} (${body.data.displayPhoneNumber})`);
            setAccessToken("");
            await load();
            onSaved?.();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (!info) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /> API oficial do WhatsApp (Meta)</CardTitle>
                <CardDescription>
                    Dados do app em developers.facebook.com → WhatsApp → Configuração da API. Use um token permanente de usuário do sistema;
                    o token temporário do painel expira em 24h.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="cloud-phone-id">Phone Number ID</Label>
                        <Input id="cloud-phone-id" value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value.replace(/\D/g, ""))} placeholder="123456789012345" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cloud-waba-id">WhatsApp Business Account ID (para templates)</Label>
                        <Input id="cloud-waba-id" value={wabaId} onChange={e => setWabaId(e.target.value.replace(/\D/g, ""))} placeholder="987654321098765" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cloud-token">Token de acesso</Label>
                    <Input
                        id="cloud-token"
                        type="password"
                        autoComplete="off"
                        value={accessToken}
                        onChange={e => setAccessToken(e.target.value)}
                        placeholder={info.hasToken ? "•••••••• salvo (deixe vazio para manter)" : "EAAG..."}
                    />
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
                    <div className="font-medium">Webhook (cole no painel da Meta, campo "messages")</div>
                    <div className="flex items-center gap-2">
                        <code className="text-xs break-all">{info.webhookUrl}</code>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { navigator.clipboard.writeText(info.webhookUrl); toast.success("Copiado"); }}>
                            <Copy className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">Token de verificação: o valor de WA_CLOUD_VERIFY_TOKEN no .env do servidor.</div>
                    {!info.webhookReady && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> WA_CLOUD_APP_SECRET e WA_CLOUD_VERIFY_TOKEN não estão no .env: mensagens recebidas serão recusadas.
                        </div>
                    )}
                </div>

                <Button onClick={save} disabled={saving || !phoneNumberId}>
                    {saving ? "Validando com a Meta..." : "Salvar e conectar"}
                </Button>
            </CardContent>
        </Card>
    );
}
