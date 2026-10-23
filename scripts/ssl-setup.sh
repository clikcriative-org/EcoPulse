#!/bin/bash
set -e

# ============================================================
# ECOPULSE — SSL Setup (primeira vez)
# Gera certificado Let's Encrypt via Certbot
# ============================================================

DOMAIN=${1:-api.ecopulse.com.br}
EMAIL=${2:-admin@ecopulse.com.br}

echo "Gerando certificado SSL para: $DOMAIN"
echo ""

# Start nginx temporarily for ACME challenge
docker compose -f docker-compose.prod.yml up -d nginx

# Request certificate
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Restart nginx with SSL
docker compose -f docker-compose.prod.yml restart nginx

echo ""
echo "✓ SSL configurado para $DOMAIN"
echo "  Renovação automática via certbot container."
