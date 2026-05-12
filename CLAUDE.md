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
| `src/collectors/` | Side effects: busca RSS e Seats.aero via HTTP |
| `src/parsers/` | Pure functions: extrai dados estruturados de feeds |
| `src/engine/` | Pure functions: dedupe, prioridade, cross-reference |
| `src/storage/` | Side effects: SQLite (better-sqlite3, síncrono) |
| `src/notifier/` | Side effects: envio Telegram via grammy |
| `config/` | YAML de configuração + schema Zod |

## Fluxo de execução (`npm run search`)

1. Carregar env (Zod) + config (`config/search.yaml`)
2. Abrir SQLite + rodar migrations
3. Coletar RSS feeds → parsear promos LATAM
4. Consultar Seats.aero → award seats
5. `crossReference(promos, seats)` → lista de alerts
6. Filtrar por dedupe (SQLite) + quiet hours
7. Enviar via Telegram
8. Persistir eventos no DB

## Adicionando nova fonte de dados

1. Criar `src/collectors/nova-fonte.ts` retornando `Result<T[], AppError>`
2. Criar `src/parsers/nova-fonte-parser.ts` (funções puras)
3. Adicionar testes em `tests/parsers/nova-fonte-parser.test.ts`
4. Integrar em `src/index.ts`

## Fase 2 — Cross-reference avançado

- Implementar YELLOW com confirmação via Qantas FF e AAdvantage
- Templates Telegram diferenciados com botões inline (grammy keyboard)
- Filtro de quiet hours refinado (considerar timezone BRT)

## Fase 3 — IMAP e comandos Telegram

- `src/collectors/imap.ts` — imapflow + mailparser
- Variáveis: `IMAP_HOST`, `IMAP_USER`, `IMAP_PASS`
- Comandos: `/status`, `/recent`, `/snooze 24h`

## Out of scope

Nunca implementar: emissão automática de tickets, scraping pesado de LATAM/Smiles, UI web, login em programas de milhas, compra automática de milhas.
