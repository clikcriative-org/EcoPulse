#!/usr/bin/env bash
# Cria uma voz clonada a partir de uma gravação de referência (10–20 s, limpa).
# Uso: ./clone-voice.sh "Nome da Voz" referencia.wav "transcrição exata do áudio"
# Use só vozes com autorização por escrito do dono.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env; set +a

NAME="${1:?nome da voz}"; FILE="${2:?arquivo de áudio}"; REF_TEXT="${3:-}"
URL="${VOICESTUDIO_URL:-http://127.0.0.1:3900}"

curl -fsS -H "Authorization: Bearer ${OMNIVOICE_API_KEY}" \
  -F "name=${NAME}" -F "kind=clone" -F "language=pt" \
  -F "ref_text=${REF_TEXT}" -F "ref_audio=@${FILE}" \
  "$URL/profiles"
echo
echo "Use o \"id\" (ou o nome) acima no campo \"voice\" de /v1/audio/speech."
