# award-bot — Instruções para Claude Code

## O que é este projeto

Agente Node.js/TypeScript que monitora passagens aéreas em milhas Brasil → Europa e envia alertas via Telegram. Detalhes completos no `PROJECT_BRIEF.md`.

## Stack

- **Runtime**: Node.js 20 LTS + TypeScript 5 strict ESM (`"type": "module"`)
- **Módulo**: `ESNext` + `moduleResolution: Bundler` (tsx-friendly, sem `.js` em imports)
- **Testes**: Vitest (cobertura ≥ 80% em `src/parsers/` e `src/engine/`)
- **Lint**: ESLint 9 flat config + `typescript-eslint` com type-checked rules
- **Formatter**: Prettier
- **Hooks**: Husky pre-commit (lint-staged + tsc --noEmit + vitest run)

## Convenções obrigatórias

- **Zero `any`** — use `unknown` + Zod para entradas externas
- **Retorno explícito** em todas as funções públicas
- **`neverthrow`** para erros previsíveis em vez de exceções (`Result<T, AppError>`)
- **`pino`** para todos os logs — NUNCA `console.log`
- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `test:`, `refactor:`, `docs:`
- **TDD obrigatório** para `engine/` e `parsers/`

## Estrutura de módulos

| Diretório | Responsabilidade |
|---|---|
| `src/collectors/` | Side effects: RSS, Gmail API (Seats.aero e-mails) |
| `src/collectors/award-alert-to-seats.ts` | Adapter puro: `AwardAlert[]` → `AwardSeat[]` (legado) |
| `src/parsers/` | Pure functions: extrai dados estruturados de feeds e e-mails |
| `src/engine/` | Pure functions: dedupe, prioridade, cross-reference |
| `src/storage/` | Side effects: SQLite (better-sqlite3, síncrono) |
| `src/notifier/` | Side effects: envio Telegram via grammy |
| `config/` | YAML de configuração + schema Zod |
| `scripts/` | Utilitários locais (não sobem para produção) |

## Fluxo de execução (`npm run search`)

1. Carregar env (Zod) + config (`config/search.yaml`)
2. Abrir SQLite + rodar migrations
3. Coletar RSS feeds → parsear promos LATAM
4. Coletar e-mails Gmail (Seats.aero alerts) → parsear → `AwardAlert[]`
5. Adapter: `AwardAlert[]` → `AwardSeat[]`
6. `crossReference(promos, seats)` → lista de alerts
7. Filtrar por dedupe (SQLite) + quiet hours
8. Enviar via Telegram
9. Persistir eventos no DB

## Fonte de inventário: Gmail (não API REST)

A API REST do Seats.aero (partnerapi) é restrita a parceiros comerciais. O bot lê e-mails de alerta do Seats.aero via Gmail API OAuth2.

- Collector: `src/collectors/gmail-seats-aero.ts`
- Parser: `src/parsers/seats-aero-email.ts` — usa `mailparser` + `cheerio`
- Schema rico: `AwardAlert` + `FlightOption` em `src/types.ts`
- Schema legado (engine): `AwardSeat` — preenchido pelo adapter

Para gerar o refresh token: `npm run oauth:bootstrap`

## Adicionando nova fonte de dados

1. Criar `src/collectors/nova-fonte.ts` retornando `Result<T[], AppError>`
2. Criar `src/parsers/nova-fonte-parser.ts` (funções puras)
3. Adicionar testes em `tests/parsers/nova-fonte-parser.test.ts`
4. Integrar em `src/index.ts`

## Fase 2 — Cross-reference avançado

- Engine consumindo `AwardAlert` rico diretamente (multi-flight comparison)
- Templates Telegram diferenciados com botões inline (grammy keyboard)
- Filtro `search.require_direct` aplicado na engine (atualmente apenas no YAML)
- Confirmação via Qantas FF e AAdvantage para nível YELLOW

## Fase 3 — Comandos Telegram

- Comandos: `/status`, `/recent`, `/snooze 24h`

## Out of scope

Nunca implementar: emissão automática de tickets, scraping pesado de LATAM/Smiles, UI web, login em programas de milhas, compra automática de milhas.
