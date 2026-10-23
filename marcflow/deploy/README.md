# Instalar na VPS (Hostinger ou qualquer Ubuntu/Debian)

Tempo estimado: 20 minutos, a maior parte esperando o build.

## Requisitos

- VPS com **2 GB de RAM ou mais** (o build do painel usa cerca de 1,5 GB). Na Hostinger, o plano KVM 1 serve para começar.
- Sistema **Ubuntu 22.04 ou 24.04**. Na Hostinger: hPanel > VPS > Sistema operacional.
- Um **domínio ou subdomínio** (ex.: `zap.suaempresa.com.br`) com um registro **A** apontando para o IP da VPS. A Meta exige HTTPS válido no webhook, e o certificado só sai com o domínio apontado.
- Portas 80 e 443 liberadas. Na Hostinger: hPanel > VPS > Firewall.

## Passo a passo

1. **DNS:** no painel do domínio, crie o registro `A` com nome `zap` (ou o que preferir) e valor igual ao IP da VPS. A propagação leva de alguns minutos a 1 hora.
2. **Entre na VPS** pelo terminal do hPanel (botão "Terminal do navegador") ou por SSH:
   ```bash
   ssh root@IP_DA_VPS
   ```
3. **Baixe o código.** O repositório é privado, então crie um token em GitHub > Settings > Developer settings > Fine-grained tokens, só com leitura (Contents: Read-only) do repositório EcoPulse:
   ```bash
   apt-get update && apt-get install -y git
   git clone -b claude/kind-galileo-lsm0q1 https://SEU_USUARIO:SEU_TOKEN@github.com/clikcriative-org/EcoPulse.git /opt/ecopulse
   cd /opt/ecopulse/marcflow
   ```
4. **Instale:**
   ```bash
   sudo bash deploy/install.sh
   ```
   O script instala o Docker, pergunta domínio, e-mail, senha do painel e a chave secreta do app da Meta, gera as outras senhas sozinho e sobe tudo com HTTPS.
5. No final, ele mostra a **URL do webhook** e o **token de verificação**. Cole os dois no painel da Meta (WhatsApp > Configuração > Webhook) e assine o campo `messages`.
6. Acesse `https://SEU-DOMINIO`, entre com o e-mail e a senha que você definiu e siga o passo 2 de [docs/CLOUD_API.md](../docs/CLOUD_API.md).

## Operação do dia a dia

| Tarefa | Comando (na pasta `/opt/ecopulse/marcflow`) |
|---|---|
| Ver logs | `docker compose -f deploy/docker-compose.prod.yml logs -f app` |
| Atualizar | `git pull && sudo bash deploy/install.sh` |
| Reiniciar | `docker compose -f deploy/docker-compose.prod.yml restart app` |
| Backup do banco | `docker compose -f deploy/docker-compose.prod.yml exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" marcflow' > backup-$(date +%F).sql` |

As senhas geradas ficam em `deploy/.env`, com permissão só para o root. Guarde uma cópia desse arquivo fora do servidor: sem ele, você perde o acesso ao banco.

## Segurança

- O MySQL e o app não ficam expostos à internet; só o Caddy (portas 80 e 443) fica.
- A documentação Swagger (`/docs`) vem desligada em produção.
- Ative a autenticação em dois fatores na conta da Hostinger e prefira entrar por chave SSH em vez de senha.
