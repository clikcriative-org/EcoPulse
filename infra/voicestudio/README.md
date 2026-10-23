# VoiceStudio — servidor de voz com GPU (sem tela)

API de texto-para-voz, clonagem de voz e transcrição rodando no seu servidor,
pronta para ser chamada pelo n8n, sites e automações. Compatível com a API de
áudio da OpenAI (`/v1/audio/speech`, `/v1/audio/transcriptions`).

## 1. Requisitos do servidor

| Item | Mínimo | Recomendado |
|---|---|---|
| Sistema | Ubuntu 22.04/24.04, **x86-64** | Ubuntu 24.04 |
| GPU | NVIDIA com 8 GB VRAM | 12–24 GB VRAM (RTX 3060 12GB, 4090, L4, A10) |
| RAM | 16 GB | 32 GB |
| Disco | 40 GB livres | 80 GB SSD |
| Driver | NVIDIA instalado (`nvidia-smi` funciona) | |

Opções de aluguel de GPU por hora: RunPod, Vast.ai, Lambda, Hetzner GPU.
Servidor ARM (Graviton, Apple) **não** serve: a imagem é só amd64.

## 2. Instalação (3 comandos)

```bash
git clone <este-repositório> && cd <repo>/infra/voicestudio
sudo ./setup.sh          # só VoiceStudio
# ou
sudo ./setup.sh --n8n    # VoiceStudio + n8n no mesmo servidor
```

O `setup.sh`:
1. confere a GPU;
2. instala Docker e NVIDIA Container Toolkit, se faltarem;
3. cria o `.env` com uma chave de API aleatória (`OMNIVOICE_API_KEY`);
4. sobe os containers e espera o `/health` responder.

## 3. Verificação

```bash
./test-api.sh "Olá, tudo bem?"
```

Confira na saída:
- `/health` com `"device": "cuda"` → está usando a GPU;
- `teste.mp3` gerado.

Se o modelo aparecer com `installed=false`, instale (≈2,4 GB, baixado do Hugging Face):

```bash
source .env
curl -H "Authorization: Bearer $OMNIVOICE_API_KEY" -H "Content-Type: application/json" \
  -d '{"repo_id":"<repo_id mostrado no teste>"}' http://127.0.0.1:3900/models/install
curl -H "Authorization: Bearer $OMNIVOICE_API_KEY" http://127.0.0.1:3900/models/install/status
```

## 4. Clonar uma voz

```bash
./clone-voice.sh "Locutor Loja" referencia.wav "Texto exato falado na gravação."
```

- Gravação de 10–20 s, sem música nem ruído.
- O retorno traz o `id`; use esse id (ou o nome) no campo `voice`.
- **Só clone vozes com autorização por escrito.**

## 5. Usar a API

```bash
curl -H "Authorization: Bearer $OMNIVOICE_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"omnivoice","input":"Promoção válida até sexta!","voice":"Locutor Loja","response_format":"mp3","language":"pt"}' \
  http://127.0.0.1:3900/v1/audio/speech -o anuncio.mp3
```

Campos úteis: `speed` (0.25–4), `response_format` (`mp3`, `wav`, `opus`…),
`instructions` (estilo, ex.: "tom animado"). Limite: 4096 caracteres por chamada.

Qualquer SDK da OpenAI funciona apontando `base_url` para
`http://<servidor>:3900/v1` e `api_key` para a sua `OMNIVOICE_API_KEY`.

Documentação interativa: `http://127.0.0.1:3900/docs`.

## 6. Integração com n8n

Com `--n8n`, o n8n já recebe as variáveis `VOICESTUDIO_URL` e `VOICESTUDIO_KEY`
e fala com o VoiceStudio pela rede interna do Docker.

1. Abra o n8n → **Workflows → Import from file** → `n8n-workflow-tts.json`.
2. Ative o workflow.
3. Chame:

```bash
curl -X POST http://localhost:5678/webhook/tts \
  -H "Content-Type: application/json" \
  -d '{"texto":"Seu pedido saiu para entrega.","voz":"Locutor Loja"}' -o aviso.mp3
```

Se o seu n8n roda em outro servidor, use no nó HTTP Request a URL do VoiceStudio
pela rede privada (Tailscale, ver item 7) e o header
`Authorization: Bearer <OMNIVOICE_API_KEY>`.

## 7. Acesso remoto com segurança

A porta 3900 fica presa a `127.0.0.1`: nada de fora alcança o servidor. Para
acessar do seu computador ou de outro servidor:

| Opção | Quando usar | Como |
|---|---|---|
| Túnel SSH | Teste pontual | `ssh -L 3900:127.0.0.1:3900 usuario@servidor` e abra `http://localhost:3900` |
| Tailscale | Uso diário, n8n em outro servidor | Instale Tailscale nos dois lados e troque a porta para `"<ip-tailscale>:3900:3900"` |
| Proxy HTTPS (Caddy/Nginx) | Só se precisar de URL pública | Mantenha a chave obrigatória; nunca exponha HTTP puro |

**Não** abra a porta 3900 direto na internet.

A interface web (mesma do app desktop) fica em `http://localhost:3900` via túnel;
ela pede a `OMNIVOICE_API_KEY` no primeiro acesso.

## 8. Operação

| Tarefa | Comando |
|---|---|
| Ver logs | `docker logs -f voicestudio` |
| Reiniciar | `docker compose restart voicestudio` |
| Atualizar versão | troque `VOICESTUDIO_TAG` no `.env`, depois `docker compose pull && docker compose up -d` |
| Backup (vozes, banco, modelos) | `docker run --rm -v voicestudio_voicestudio-data:/d -v $PWD:/b alpine tar czf /b/backup.tgz -C /d .` |
| Parar | `docker compose down` (os dados ficam no volume) |

## 9. Riscos e limites

- **Licença AGPL-3.0**: uso interno é livre. Oferecer como serviço a terceiros
  obriga a publicar o código de modificações feitas no VoiceStudio.
- **Custo de GPU**: servidor parado também cobra. Em GPU por hora, desligue
  fora do horário ou use fila de jobs.
- **Fila**: uma GPU gera um áudio por vez. Para volume alto, enfileire no n8n
  (Split in Batches) em vez de disparar tudo em paralelo.
- **Versão fixa (0.5.6)**: evita quebra por atualização automática. Teste uma
  versão nova antes de trocar a tag em produção.
- **Marca d'água**: o VoiceStudio insere uma marca invisível de procedência nos
  áudios gerados.
