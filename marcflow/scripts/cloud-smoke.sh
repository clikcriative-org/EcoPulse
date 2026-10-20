#!/usr/bin/env bash
# Teste rápido da Cloud API com credenciais reais, sem depender do MarcFlow.
# Uso: PHONE_ID=... TOKEN=... TO=5511999998888 ./scripts/cloud-smoke.sh
# TO precisa estar na lista de números de teste do app (WhatsApp > Configuração da API) enquanto o app estiver em modo de desenvolvimento.
set -euo pipefail
: "${PHONE_ID:?defina PHONE_ID}" "${TOKEN:?defina TOKEN}" "${TO:?defina TO}"
V="${WA_CLOUD_API_VERSION:-v23.0}"
API="https://graph.facebook.com/$V"

echo "1) Token e número"
curl -sS "$API/$PHONE_ID?fields=display_phone_number,verified_name,quality_rating" -H "Authorization: Bearer $TOKEN"; echo

echo "2) Template hello_world (funciona fora da janela de 24h)"
curl -sS "$API/$PHONE_ID/messages" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"messaging_product\":\"whatsapp\",\"to\":\"$TO\",\"type\":\"template\",\"template\":{\"name\":\"hello_world\",\"language\":{\"code\":\"en_US\"}}}"; echo

echo "3) Responda a mensagem no celular e rode de novo com TEXT=1 para testar texto livre (exige janela de 24h aberta)"
if [ "${TEXT:-0}" = "1" ]; then
  curl -sS "$API/$PHONE_ID/messages" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"messaging_product\":\"whatsapp\",\"to\":\"$TO\",\"type\":\"text\",\"text\":{\"body\":\"Teste MarcFlow: texto livre OK\"}}"; echo
fi
