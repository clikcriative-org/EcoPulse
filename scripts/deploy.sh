#!/bin/bash
set -e

# ============================================================
# ECOPULSE — Deploy Script (VPS)
# Uso: ./scripts/deploy.sh
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "══════════════════════════════════════════"
echo "   ECOPULSE — Deploy Production (VPS)"
echo "══════════════════════════════════════════"
echo ""

# Check if running on server
if [ ! -f "deploy/.env.prod" ]; then
  echo -e "${RED}❌ Arquivo deploy/.env.prod não encontrado.${NC}"
  echo "   Copie deploy/.env.prod.example para deploy/.env.prod e preencha os valores."
  exit 1
fi

# Load env
export $(cat deploy/.env.prod | grep -v '^#' | xargs)

echo -e "${YELLOW}1/5${NC} Pulling latest code..."
git pull origin main

echo ""
echo -e "${YELLOW}2/5${NC} Building Docker images..."
docker compose -f docker-compose.prod.yml --env-file deploy/.env.prod build --no-cache api

echo ""
echo -e "${YELLOW}3/5${NC} Starting services..."
docker compose -f docker-compose.prod.yml --env-file deploy/.env.prod up -d

echo ""
echo -e "${YELLOW}4/5${NC} Running migrations..."
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy --schema=./prisma/schema.prisma

echo ""
echo -e "${YELLOW}5/5${NC} Health check..."
sleep 5
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "   ${GREEN}✓ API rodando (HTTP 200)${NC}"
else
  echo -e "   ${YELLOW}⚠ API retornou HTTP $HTTP_STATUS — verificar logs:${NC}"
  echo "   docker compose -f docker-compose.prod.yml logs api --tail 50"
fi

echo ""
echo "══════════════════════════════════════════"
echo -e "   ${GREEN}Deploy concluído!${NC}"
echo "══════════════════════════════════════════"
echo ""
echo "   API: https://${API_DOMAIN:-api.ecopulse.com.br}"
echo ""
echo "   Comandos úteis:"
echo "   - Logs:    docker compose -f docker-compose.prod.yml logs -f api"
echo "   - Restart: docker compose -f docker-compose.prod.yml restart api"
echo "   - Seed:    docker compose -f docker-compose.prod.yml exec api npx prisma db seed"
echo ""
