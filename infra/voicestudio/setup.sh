#!/usr/bin/env bash
# Instala Docker + NVIDIA Container Toolkit (Ubuntu/Debian) e sobe o VoiceStudio.
# Uso: sudo ./setup.sh          (só VoiceStudio)
#      sudo ./setup.sh --n8n    (VoiceStudio + n8n)
set -euo pipefail
cd "$(dirname "$0")"

WITH_N8N=0
[[ "${1:-}" == "--n8n" ]] && WITH_N8N=1

log() { printf '\n==> %s\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "Rode com sudo."; exit 1; }
[[ "$(uname -m)" == "x86_64" ]] || { echo "A imagem oficial é só x86-64 (amd64)."; exit 1; }

log "Checando GPU NVIDIA"
if ! command -v nvidia-smi >/dev/null || ! nvidia-smi >/dev/null 2>&1; then
  echo "Driver NVIDIA não encontrado. Instale antes (ex.: sudo ubuntu-drivers install) e reinicie."
  exit 1
fi
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

if ! command -v docker >/dev/null; then
  log "Instalando Docker"
  curl -fsSL https://get.docker.com | sh
fi

if ! dpkg -s nvidia-container-toolkit >/dev/null 2>&1; then
  log "Instalando NVIDIA Container Toolkit"
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
    | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
    | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
    > /etc/apt/sources.list.d/nvidia-container-toolkit.list
  apt-get update -y
  apt-get install -y nvidia-container-toolkit
  nvidia-ctk runtime configure --runtime=docker
  systemctl restart docker
fi

log "Testando GPU dentro do Docker"
docker run --rm --gpus all nvidia/cuda:12.8.0-base-ubuntu22.04 nvidia-smi -L

if [[ ! -f .env ]]; then
  log "Criando .env com chave nova"
  cp .env.example .env
  KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
  sed -i "s|^OMNIVOICE_API_KEY=.*|OMNIVOICE_API_KEY=${KEY}|" .env
  chmod 600 .env
fi

log "Subindo containers"
if [[ $WITH_N8N -eq 1 ]]; then
  docker compose --profile n8n up -d
else
  docker compose up -d
fi

log "Aguardando /health (o primeiro start pode levar alguns minutos)"
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3900/health 2>/dev/null; then
    echo
    log "Pronto. Chave da API em .env (OMNIVOICE_API_KEY). Próximo passo: ./test-api.sh"
    exit 0
  fi
  sleep 10
done
echo "Não respondeu em 10 min. Veja: docker logs -f voicestudio"
exit 1
