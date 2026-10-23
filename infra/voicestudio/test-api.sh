#!/usr/bin/env bash
# Teste ponta a ponta: saúde, GPU, modelos, vozes e geração de um áudio.
# Uso: ./test-api.sh ["texto a falar"] [id-ou-nome-da-voz]
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a

URL="${VOICESTUDIO_URL:-http://127.0.0.1:3900}"
AUTH=(-H "Authorization: Bearer ${OMNIVOICE_API_KEY}")
TEXT="${1:-Olá! Este é um teste do servidor de voz.}"
VOICE="${2:-default}"

echo "== Saúde (device deve ser cuda)"
curl -fsS "${AUTH[@]}" "$URL/health"; echo

echo "== GPU vista pelo PyTorch"
docker exec voicestudio python3 -c \
  "import torch; ok=torch.cuda.is_available(); print(ok, torch.cuda.get_device_name(0) if ok else 'sem GPU')"

echo "== Modelos (installed: true/false)"
curl -fsS "${AUTH[@]}" "$URL/models" | python3 -c '
import json,sys
data=json.load(sys.stdin)
items=data.get("models", data) if isinstance(data, dict) else data
for m in items:
    print(f"- {m.get(\"repo_id\") or m.get(\"id\")}: installed={m.get(\"installed\")}")
' || true

echo "== Vozes disponíveis"
curl -fsS "${AUTH[@]}" "$URL/v1/audio/voices" | head -c 1500; echo

echo "== Gerando teste.mp3"
curl -fsS "${AUTH[@]}" -H "Content-Type: application/json" \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"model":"omnivoice","input":sys.argv[1],"voice":sys.argv[2],"response_format":"mp3","language":"pt"}))' "$TEXT" "$VOICE")" \
  "$URL/v1/audio/speech" -o teste.mp3
ls -lh teste.mp3
