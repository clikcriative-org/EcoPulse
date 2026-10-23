#!/bin/bash
set -e

# ============================================================
# ECOPULSE — VPS Initial Setup
# Execute na VPS nova (Ubuntu 22.04+)
# ============================================================

echo "══════════════════════════════════════════"
echo "   ECOPULSE — VPS Setup"
echo "══════════════════════════════════════════"
echo ""

# Update system
echo "→ Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Install Docker
echo "→ Instalando Docker..."
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
echo "→ Instalando Docker Compose..."
sudo apt install -y docker-compose-plugin

# Install Git
echo "→ Instalando Git..."
sudo apt install -y git

# Firewall
echo "→ Configurando firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Create app directory
echo "→ Criando diretório do app..."
sudo mkdir -p /opt/ecopulse
sudo chown $USER:$USER /opt/ecopulse

echo ""
echo "══════════════════════════════════════════"
echo "   ✓ VPS pronta!"
echo "══════════════════════════════════════════"
echo ""
echo "   Próximos passos:"
echo ""
echo "   1. Clonar o repo:"
echo "      cd /opt/ecopulse"
echo "      git clone <SEU_REPO_URL> ."
echo ""
echo "   2. Configurar env:"
echo "      cp deploy/.env.prod.example deploy/.env.prod"
echo "      nano deploy/.env.prod"
echo ""
echo "   3. Gerar secrets:"
echo "      openssl rand -base64 64  # para JWT_SECRET"
echo "      openssl rand -base64 64  # para REFRESH_TOKEN_SECRET"
echo "      openssl rand -base64 32  # para DB_PASSWORD"
echo "      openssl rand -base64 32  # para REDIS_PASSWORD"
echo ""
echo "   4. Deploy:"
echo "      ./scripts/deploy.sh"
echo ""
echo "   5. SSL (após DNS apontar para este IP):"
echo "      ./scripts/ssl-setup.sh api.ecopulse.com.br admin@ecopulse.com.br"
echo ""
echo "   ⚠ Faça logout e login para o grupo docker funcionar"
echo ""
