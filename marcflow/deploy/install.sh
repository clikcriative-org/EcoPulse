#!/usr/bin/env bash
# Instala o MarcFlow numa VPS Ubuntu/Debian (ex.: Hostinger KVM) com HTTPS automático.
# Rode como root, de dentro da pasta do projeto:  sudo bash deploy/install.sh
# Rodar de novo atualiza a aplicação e mantém banco, arquivos e senhas.
set -euo pipefail
cd "$(dirname "$0")"
ENV_FILE=.env

[ "$(id -u)" -eq 0 ] || { echo "Rode como root: sudo bash deploy/install.sh"; exit 1; }

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Instalando Docker"
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "==> Primeira instalação"
  read -rp "Domínio (ex.: zap.suaempresa.com.br): " DOMAIN
  read -rp "Seu e-mail (login do painel e aviso do certificado HTTPS): " ADMIN_EMAIL
  read -rsp "Senha do painel (mín. 8 caracteres): " ADMIN_PASSWORD; echo
  [ ${#ADMIN_PASSWORD} -ge 8 ] || { echo "Senha curta demais"; exit 1; }
  read -rp "Chave secreta do app da Meta (pode deixar vazio e preencher depois em deploy/.env): " WA_CLOUD_APP_SECRET
  umask 077
  cat > "$ENV_FILE" <<CONF
DOMAIN=$DOMAIN
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -base64 32)
WA_CLOUD_APP_SECRET=$WA_CLOUD_APP_SECRET
WA_CLOUD_VERIFY_TOKEN=$(openssl rand -hex 16)
CONF
fi
set -a; . "./$ENV_FILE"; set +a

SERVER_IP=$(curl -fsS -4 https://api.ipify.org || true)
DNS_IP=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)
if [ -n "$SERVER_IP" ] && [ "$DNS_IP" != "$SERVER_IP" ]; then
  echo "AVISO: $DOMAIN aponta para '${DNS_IP:-nada}', mas este servidor é $SERVER_IP."
  echo "Crie um registro A no DNS do domínio apontando para $SERVER_IP, senão o HTTPS não será emitido."
  read -rp "Continuar mesmo assim? [s/N] " ok; [ "$ok" = "s" ] || exit 1
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

echo "==> Construindo e iniciando (a primeira vez leva alguns minutos)"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" up -d --build

echo
echo "Pronto. Painel: https://$DOMAIN  (login: $ADMIN_EMAIL)"
echo
echo "Dados para o painel da Meta (WhatsApp > Configuração > Webhook):"
echo "  URL de callback:       https://$DOMAIN/api/whatsapp/cloud/webhook"
echo "  Token de verificação:  $WA_CLOUD_VERIFY_TOKEN"
echo "  Campo:                 messages"
[ -n "${WA_CLOUD_APP_SECRET:-}" ] || echo "  FALTA: WA_CLOUD_APP_SECRET em deploy/.env (depois rode este script de novo)"
echo
echo "Logs: docker compose -f deploy/docker-compose.prod.yml logs -f app"
