# award-bot

Agente de monitoramento de passagens em milhas Brasil → Europa (GRU/GIG → FCO/MAD/CDG).

Roda a cada 30 minutos via GitHub Actions, cruza promoções LATAM com inventário Seats.aero e notifica via Telegram com alertas RED/YELLOW/GREEN.

## Setup local

```bash
git clone https://github.com/Noletu/Bot-Milhas
cd Bot-Milhas
npm install
cp .env.example .env
# Preencher .env com os secrets (ver seção abaixo)
npm run search
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SEATS_AERO_API_KEY` | Sim | API key do Seats.aero Pro |
| `TELEGRAM_BOT_TOKEN` | Sim | Token do bot (@BotFather) |
| `TELEGRAM_CHAT_ID` | Sim | Chat ID pessoal (@userinfobot) |
| `LOG_LEVEL` | Não | `info` (default) |
| `DB_PATH` | Não | `./data/state.sqlite` (default) |

## Scripts

| Script | Descrição |
|---|---|
| `npm run search` | Executa um ciclo completo de busca |
| `npm test` | Roda testes unitários |
| `npm run test:coverage` | Testes com relatório de cobertura |
| `npm run typecheck` | Verifica tipos TypeScript |
| `npm run lint` | Lint com ESLint |
| `npm run format` | Formata código com Prettier |

## Configuração de busca

Editar `config/search.yaml` para ajustar:
- Origens/destinos, janela de datas, tetos de milhas por programa
- Regras de prioridade (RED/YELLOW/GREEN)
- Janela de dedupe e quiet hours

## GitHub Actions

1. Ir em Settings > Secrets and variables > Actions
2. Adicionar: `SEATS_AERO_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
3. O workflow `.github/workflows/monitor.yml` roda automaticamente

O estado do SQLite é persistido entre runs via `actions/cache`.

## Fases de implementação

- **Fase 1 (MVP)** ✅ — RSS + Seats.aero + Telegram + GitHub Actions
- **Fase 2** — Cruzamento completo promo × inventário, templates diferenciados
- **Fase 3** — IMAP newsletters, comandos Telegram `/status` `/recent` `/snooze`
