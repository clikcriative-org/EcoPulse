<div align="center">

# MarcFlow

**Automação de WhatsApp com fluxos visuais, campanhas, grupos e respostas rápidas.**

Criado por **Marcos Maia** · [@marcolamaia](https://instagram.com/marcolamaia)

</div>

---

## Conexão oficial

Esta versão conecta pela **API oficial do WhatsApp (Cloud API da Meta)**, sem QR code e sem o risco de banimento das conexões não oficiais. A conexão por QR code (Baileys) continua disponível como opção por sessão. Configuração passo a passo: [docs/CLOUD_API.md](docs/CLOUD_API.md).

## O que o MarcFlow faz

- **Fluxos de conversa:** construtor visual com mensagens, menus, condições, ações, atrasos e etiquetas. Inclui simulador para testar o rascunho sem enviar nada pelo WhatsApp.
- **Transmissões:** campanhas com variáveis, mídia, agendamento, intervalo entre envios, pausa e lista de quem pediu para sair.
- **Grupos:** categorias, ações em lote, sair e apagar de verdade, criar grupo e conversa do grupo no painel.
- **Respostas rápidas:** sequências de texto, mídia, voz, etiquetas e mais, disparadas da conversa aberta.
- **Conversas:** caixa de entrada em tempo real, notas de voz que tocam no iPhone e aviso de robô pausado durante o atendimento humano.
- **Exportar conversas:** selecione várias conversas (ou todas) e baixe um ZIP com uma pasta por conversa: histórico em TXT, áudios originais e, se quiser, fotos, vídeos e documentos. O sistema junta o que já tem salvo e pede ao celular o histórico antigo; o WhatsApp não garante entregar tudo, e o que faltar vai listado no relatório do ZIP.
- **API REST e webhooks:** documentação interativa em `/docs`.

## Instalação

### Requisitos
- Node.js 20+ (22 recomendado)
- MySQL
- ffmpeg (para notas de voz)
- PM2 para rodar em produção: `npm install -g pm2`

### Configuração
```bash
cd MarcFlow
npm install

cp .env.example .env
# edite o .env: DATABASE_URL, AUTH_SECRET, PORT...

npm run db:push
npm run make-admin seu@email.com sua-senha
```

### Desenvolvimento
```bash
npm run dev
```

### Produção com PM2
O script `start.sh` confere a configuração, instala dependências, sincroniza o banco, compila e inicia (ou recarrega) o PM2:
```bash
./start.sh
```

Ou manualmente:
```bash
npm run build
pm2 start ecosystem.config.js
pm2 startup && pm2 save   # iniciar junto com o servidor
```

Comandos úteis: `pm2 status`, `pm2 logs marcflow`, `pm2 restart marcflow`.

### Docker
```bash
cp .env.example .env
docker compose up -d
```

## Documentação

- API completa: [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- Referência rápida: [docs/API-QUICK-REFERENCE.md](docs/API-QUICK-REFERENCE.md)
- Variáveis de ambiente: [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)
- API oficial da Meta: [docs/CLOUD_API.md](docs/CLOUD_API.md)
- Swagger UI interativo: `/docs` com o app rodando

## Licença

MIT. Veja [LICENSE](LICENSE).

---

<div align="center">
  Feito por <a href="https://instagram.com/marcolamaia">Marcos Maia</a>
</div>
