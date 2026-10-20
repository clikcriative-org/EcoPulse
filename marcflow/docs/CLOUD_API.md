# API oficial do WhatsApp (Cloud API da Meta)

Cada sessão pode usar um de dois tipos de conexão:

| | API oficial (`cloud`, padrão) | QR code (`baileys`) |
|---|---|---|
| Risco de banimento por automação | Baixo, quando você segue as regras da Meta | Alto: viola os termos do WhatsApp |
| Precisa de celular ligado | Não | Sim |
| Custo | A Meta cobra por conversa iniciada pela empresa (templates) | Zero |
| Grupos, status, histórico antigo | Não existem na API | Sim |
| Botões e listas | Sim, nativos | Não (só enquete) |

## 1. Configuração na Meta (uma vez por empresa)

1. Crie um app em https://developers.facebook.com, do tipo **Empresa**, e adicione o produto **WhatsApp**.
2. Em **WhatsApp > Configuração da API**, anote:
   - **Phone Number ID** (identificação do número de telefone)
   - **WhatsApp Business Account ID** (WABA ID)
3. Gere um **token permanente**: Business Manager > Usuários do sistema > crie um usuário admin > Gerar token, com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`. O token temporário do painel expira em 24h.
4. Em **Configurações do app > Básico**, copie a **Chave secreta do app** para `WA_CLOUD_APP_SECRET` no `.env`.
5. Invente um texto para `WA_CLOUD_VERIFY_TOKEN` no `.env` e reinicie o MarcFlow.
6. Em **WhatsApp > Configuração > Webhook**:
   - URL de callback: `https://SEU-DOMINIO/api/whatsapp/cloud/webhook` (precisa de HTTPS válido)
   - Token de verificação: o mesmo `WA_CLOUD_VERIFY_TOKEN`
   - Assine o campo **messages**

## 2. Configuração no MarcFlow (uma vez por número)

1. **Sessões > Criar nova sessão**, com Conexão = "API oficial da Meta".
2. Na tela da sessão, preencha Phone Number ID, WABA ID e token, e clique em **Salvar e conectar**. O sistema valida o token com a Meta antes de salvar.
3. O token fica numa tabela separada (`CloudCredential`) e nenhuma rota do painel ou da API o devolve.

## 3. Regras da Meta que mudam a operação

- **Janela de 24h.** Depois da última mensagem do cliente, você tem 24h para responder com qualquer conteúdo. Fora dela, só **templates aprovados** passam. Uma tentativa de texto livre falha com o erro `131047`, que aparece no painel como "Janela de 24h fechada".
- **Campanhas (Transmissões)** para quem não falou com você nas últimas 24h precisam de template. Por enquanto, o envio de template é feito pela API:
  ```bash
  curl -X POST https://SEU-DOMINIO/api/messages/SESSAO/template \
    -H "x-api-key: SUA_CHAVE" -H "Content-Type: application/json" \
    -d '{"to":"5511999998888","name":"boas_vindas","language":"pt_BR",
         "components":[{"type":"body","parameters":[{"type":"text","text":"Ana"}]}]}'
  ```
  Lista de templates aprovados: `GET /api/sessions/SESSAO/cloud/templates`.
- **Qualidade do número.** Bloqueios e denúncias derrubam a classificação de qualidade do número e reduzem o limite diário de envio. Mande campanha só para quem pediu (opt-in) e mantenha o descadastro ativo.

## 4. Como cada recurso se comporta

| Recurso | Na API oficial |
|---|---|
| Caixa de entrada, respostas rápidas, resposta automática | Funcionam |
| Fluxos | Funcionam. Menu no modo **enquete** vira botões (até 3 opções de até 20 caracteres) ou lista (até 10 opções). Com mais opções, vira texto numerado |
| "Digitando..." no bloco de atraso | Funciona quando há uma mensagem recente do contato |
| Texto, imagem, vídeo, áudio, documento, figurinha, localização, contato, reação, resposta citada | Funcionam |
| Grupos, status, canais | Não existem na API; o painel mostra o erro |
| Apagar, editar ou encaminhar mensagem enviada | Não existem na API |
| Exportar histórico antigo do celular | Não existe; só o que chegou pelo webhook |
| Foto, nome e recado do perfil | Altere no WhatsApp Manager da Meta |

## 5. Arquitetura (para desenvolvedores)

- `src/modules/whatsapp/cloud/api.ts`: cliente HTTP da Graph API (envio, upload e download de mídia, templates, assinatura).
- `src/modules/whatsapp/cloud/socket.ts`: `CloudSocket` imita a parte do `WASocket` do Baileys que o MarcFlow usa. Fluxos, campanhas e respostas rápidas chamam `sock.sendMessage(...)` sem saber qual provedor está por trás.
- `src/modules/whatsapp/cloud/inbound.ts`: converte o webhook da Meta em eventos `messages.upsert` e `messages.update` no formato do Baileys.
- `src/app/api/whatsapp/cloud/webhook/route.ts`: verificação (GET) e recebimento (POST) com checagem da assinatura `X-Hub-Signature-256`.
- `WA_CLOUD_GRAPH_URL` aponta para uma Graph API falsa nos testes locais.
