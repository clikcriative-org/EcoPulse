#!/bin/bash
set -e

echo "══════════════════════════════════════════"
echo "   ECOPULSE — Setup Completo"
echo "══════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
echo -e "${YELLOW}1/5${NC} Verificando pré-requisitos..."

if ! command -v node &> /dev/null; then
  echo "❌ Node.js não encontrado. Instale Node.js 20+"
  exit 1
fi

if ! command -v pnpm &> /dev/null; then
  echo "❌ pnpm não encontrado. Instale com: npm i -g pnpm"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "❌ Docker não encontrado. Instale Docker Desktop"
  exit 1
fi

echo -e "   ${GREEN}✓${NC} Node $(node -v) | pnpm $(pnpm -v) | Docker $(docker --version | cut -d' ' -f3)"

# Install dependencies
echo ""
echo -e "${YELLOW}2/5${NC} Instalando dependências..."
pnpm install

# Start services
echo ""
echo -e "${YELLOW}3/5${NC} Subindo PostgreSQL + Redis + MailHog..."
docker compose up -d

# Wait for postgres
echo "   Aguardando PostgreSQL..."
sleep 3
until docker compose exec -T postgres pg_isready -U ecopulse > /dev/null 2>&1; do
  sleep 1
done
echo -e "   ${GREEN}✓${NC} PostgreSQL pronto"

# Apply schema
echo ""
echo -e "${YELLOW}4/5${NC} Aplicando schema no banco..."
pnpm db:push

# Seed
echo ""
echo -e "${YELLOW}5/5${NC} Populando dados iniciais..."
pnpm db:seed

echo ""
echo "══════════════════════════════════════════"
echo -e "   ${GREEN}✓ Setup completo!${NC}"
echo "══════════════════════════════════════════"
echo ""
echo "   Para iniciar o projeto:"
echo "   $ pnpm dev"
echo ""
echo "   Acessos:"
echo "   Dashboard:  http://localhost:3001"
echo "   API Docs:   http://localhost:3000/docs"
echo "   MailHog:    http://localhost:8025"
echo ""
echo "   Login:"
echo "   Email: admin@ecopulse.com.br"
echo "   Senha: admin123"
echo ""
