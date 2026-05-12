# award-bot

Agente de monitoramento de passagens em milhas Brasil → Europa (GRU/GIG → FCO/MAD/CDG).

Roda a cada 30 minutos via GitHub Actions, cruza promoções LATAM com disponibilidade de assentos (lida de e-mails do Seats.aero via Gmail) e notifica via Telegram com alertas RED/YELLOW/GREEN.

## Fontes de dados

| Fonte | Método | O que extrai |
|---|---|---|
| Melhores Destinos + Passageiro de Primeira | RSS feed | Promoções LATAM Business |
| Seats.aero | E-mails de alerta → Gmail API | Disponibilidade de assentos award |

> **Por que Gmail em vez da API REST do Seats.aero?**  
> A API REST do Seats.aero (partnerapi) é restrita a parceiros comerciais; não está disponível para uso pessoal. A solução é configurar alertas na interface web do Seats.aero para uma conta Gmail dedicada e deixar o bot ler esses e-mails via OAuth2.

## Setup local

```bash
git clone https://github.com/Noletu/Bot-Milhas
cd Bot-Milhas
npm install
cp .env.example .env
# Preencher .env conforme instruções abaixo
npm run search
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `GMAIL_CLIENT_ID` | Sim | Client ID do projeto Google Cloud |
| `GMAIL_CLIENT_SECRET` | Sim | Client secret do projeto Google Cloud |
| `GMAIL_REFRESH_TOKEN` | Sim | Refresh token obtido via `npm run oauth:bootstrap` |
| `GMAIL_USER_EMAIL` | Sim | Endereço Gmail onde chegam os alertas do Seats.aero |
| `SEATS_AERO_LABEL` | Não | Label Gmail para filtrar e-mails (`seats-aero/real-alerts`) |
| `TELEGRAM_BOT_TOKEN` | Sim | Token do bot (@BotFather) |
| `TELEGRAM_CHAT_ID` | Sim | Chat ID pessoal (@userinfobot) |
| `LOG_LEVEL` | Não | `info` (default) |
| `DB_PATH` | Não | `./data/state.sqlite` (default) |

## Setup Gmail OAuth2

### 1. Criar projeto Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto (ex: `award-bot`)
3. No menu lateral: **APIs e serviços → Biblioteca**
4. Busque e ative: **Gmail API**

### 2. Criar credenciais OAuth2

1. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**
2. Tipo de aplicativo: **App para computador**
3. Baixe o JSON de credenciais
4. Copie `client_id` e `client_secret` para o `.env`

### 3. Gerar o refresh token

```bash
# Exportar vars primeiro
export GMAIL_CLIENT_ID=seu_client_id
export GMAIL_CLIENT_SECRET=seu_client_secret

npm run oauth:bootstrap
# Abrirá uma URL — autorize no navegador
# O refresh_token será impresso no terminal
```

Copie o `GMAIL_REFRESH_TOKEN` para o `.env`.

### 4. Configurar label no Gmail

1. No Gmail, crie a label `seats-aero/real-alerts`
2. Crie um filtro: `from:alerts@seats.aero` → aplicar label `seats-aero/real-alerts`

### 5. Configurar alertas no Seats.aero

1. Acesse [seats.aero](https://seats.aero) e faça login
2. Configure alertas para cada rota desejada (ex: GRU→FCO Business)
3. Os e-mails de alerta chegarão na conta Gmail configurada

## Scripts

| Script | Descrição |
|---|---|
| `npm run search` | Executa um ciclo completo de busca |
| `npm run oauth:bootstrap` | Gera o Gmail refresh token (executar uma vez localmente) |
| `npm test` | Roda testes unitários |
| `npm run test:coverage` | Testes com relatório de cobertura |
| `npm run typecheck` | Verifica tipos TypeScript |
| `npm run lint` | Lint com ESLint |
| `npm run format` | Formata código com Prettier |

## Configuração de busca

Editar `config/search.yaml` para ajustar:
- Origens/destinos, janela de datas, tetos de milhas por programa
- `search.require_direct: true` — filtrar apenas voos diretos
- Regras de prioridade (RED/YELLOW/GREEN)
- Janela de dedupe e quiet hours

## GitHub Actions

1. Ir em **Settings → Secrets and variables → Actions**
2. Adicionar: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
3. O workflow `.github/workflows/monitor.yml` roda automaticamente a cada 30 min (06h-19h BRT)

O estado do SQLite é persistido entre runs via `actions/cache`.

## Fases de implementação

- **Fase 1 (MVP)** ✅ — RSS + Gmail/Seats.aero + Telegram + GitHub Actions
- **Fase 2** — Cruzamento completo promo × inventário, templates diferenciados, engine usando `AwardAlert` rico
- **Fase 3** — Comandos Telegram `/status` `/recent` `/snooze`
