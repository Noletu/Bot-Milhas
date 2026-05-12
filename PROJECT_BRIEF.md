# Award Flight Monitor Bot — Briefing para Claude Code

## 1. Contexto e objetivo

Construir um agente em Node.js + TypeScript que monitora oportunidades de emissão de passagens **em milhas** entre Brasil e Europa, focado em uma viagem específica de 2 passageiros. O agente roda agendado no GitHub Actions, consome múltiplas fontes de dados, e notifica via bot do Telegram quando encontra oportunidades que cruzam **promoção + disponibilidade real de assento**.

A viagem-alvo:
- **Origens**: GRU (São Paulo/Guarulhos) ou GIG (Rio/Galeão)
- **Destinos**: FCO (Roma), MAD (Madri), CDG (Paris) — qualquer um serve
- **Cabine ida**: **Business / Premium Business / Executiva**
- **Cabine volta**: **Econômica** (orçamento mais apertado, ida em J é a prioridade)
- **Pax**: 2 adultos
- **Janela de viagem**: 11 a 18 meses no futuro (planejamento longo, alta flexibilidade)
- **Foco principal**: LATAM Premium Business em voo direto GRU-FCO em promoção

## 2. Objetivos do agente

1. Detectar **promoções relâmpago** da LATAM em executiva para Europa em < 30 minutos da publicação
2. Detectar **disponibilidade de assento Award** (J class) em parceiras Star Alliance/Oneworld para o mesmo trecho via e-mails do Seats.aero
3. **Cruzar promoção + inventário** para gerar alertas de prioridade
4. Manter **log auditável** de oportunidades vistas (anti-duplicação por 7 dias)
5. Notificar via Telegram com link direto para a página de emissão

## 3. Configuração de busca (criar via YAML)

Arquivo `config/search.yaml`:

```yaml
search:
  origins: [GRU, GIG]
  destinations: [FCO, MAD, CDG]
  pax: 2
  require_direct: true                  # alertas com conexão são descartados na ida

  outbound:
    cabin: [BUSINESS, PREMIUM_BUSINESS]
    date_window:
      from: "2027-04-01"
      to: "2027-11-15"
    max_miles_per_pax:
      LATAM_PASS: 130000
      LATAM_PASS_PROMO: 110000
      IBERIA_PLUS: 65000
      BRITISH_AIRWAYS: 75000
      QATAR_PRIVILEGE: 90000
      AVIANCA_LIFEMILES: 80000
      TAP_MILES_GO: 160000
      AEROPLAN: 80000
      UNITED_MILEAGEPLUS: 90000
      SMILES: 280000

  inbound:
    cabin: [ECONOMY]
    date_window:
      from: "2027-04-15"
      to: "2027-11-30"
    max_miles_per_pax:
      LATAM_PASS: 60000
      IBERIA_PLUS: 25000
      BRITISH_AIRWAYS: 30000
      SMILES: 90000
      QATAR_PRIVILEGE: 40000

  trip_constraints:
    min_trip_days: 7
    max_trip_days: 21
    require_both_legs_in_alert: false

priority_rules:
  RED_alert:
    - "promo LATAM Business + inventário J confirmado mesma janela"
    - "2 J seats LATAM Pass tabela fixa em rota direta (FCO direto)"
  YELLOW_alert:
    - "promo LATAM Business sem confirmação inventário"
    - "1 J seat só (precisaria split de booking)"
  GREEN_alert:
    - "Iberia Plus 2 J GRU-MAD off-peak 11-13 meses out"
    - "Qatar Qsuite 2 J via DOH (apesar do tempo de conexão)"
    - "ITA Airways 2 J GRU-FCO via parceiro Star Alliance"

dedupe:
  reset_after_days: 7

quiet_hours:
  start: "23:00"
  end: "07:00"
```

## 4. Fontes de dados (3 pernas independentes)

### Perna 1 — Promoções LATAM próprio (caça primária)

Seats.aero NÃO cobre voos LATAM operados como inventário próprio (a LATAM usa preço dinâmico, não award fixo).

Fontes:
- **RSS Melhores Destinos**: `https://www.melhoresdestinos.com.br/feed`
- **RSS Passageiro de Primeira**: `https://passageirodeprimeira.com/feed`
- **Scraping leve** (Fase 2 opcional) da página de ofertas LATAM: `https://www.latamairlines.com/br/pt/ofertas`

Heurística de filtro nos títulos/conteúdo:
- Contém: ("LATAM" OU "Latam") E ("Executiva" OU "Premium Business" OU "Business") E (destino na lista) E ("milhas" OU "promo" OU "R$")
- Excluir falsos positivos: "First Class", "Primeira Classe"

### Perna 2 — Validação de inventário via e-mails Seats.aero (fonte primária)

**A API REST do Seats.aero NÃO está disponível para uso pessoal** (confirmado com o suporte da plataforma). O agente lê e-mails do Seats.aero diretamente do Gmail via API oficial.

**Setup do usuário no Seats.aero**:
- Criar **continuous alerts** para todas as rotas-alvo no painel `seats.aero/alerts`
- 6 alertas mínimos (todos com `Only direct flights` marcado):
  1. `Qantas FF | GRU,GIG → FCO,MAD,CDG | Business | 2 pax`
  2. `AAdvantage | GRU,GIG → FCO,MAD,CDG | Business | 2 pax`
  3. `Iberia Club | GRU,GIG → MAD | Business | 2 pax`
  4. `British Airways | GRU,GIG → MAD,CDG,FCO | Business | 2 pax`
  5. `Qatar Privilege | GRU,GIG → MAD,CDG,FCO via DOH | Business | 2 pax`
  6. `TAP Miles&Go | GRU,GIG → MAD,CDG,FCO | Business | 2 pax`
- Para a volta em econômica, alertas espelhados com cabine `Economy` e ceilings reduzidos

**Setup do usuário no Gmail**:
- Criar label `seats-aero/real-alerts`
- Filtro automático: `from:alerts@seats.aero` → aplicar label `seats-aero/real-alerts` + nunca ir para spam
- Atenção: cada e-mail do Seats.aero contém **1 a N voos** para a mesma rota/data. O parser retorna um `AwardAlert` com array `flights[]`, não um objeto único

### Perna 3 — Plan B / oportunidades em parceiras Star Alliance/Oneworld

Coberta pelos mesmos alertas Seats.aero da Perna 2. O engine de priorização diferencia: alertas de Iberia/Qatar/ITA em parceira Star/Oneworld viram `GREEN_alert` (não-urgente), enquanto Qantas FF + AAdvantage (inventário LATAM compartilhado) viram parte do cruzamento RED com a Perna 1.

## 5. Engine de cruzamento (regras de priorização)

```typescript
// Pseudo-código da engine

interface PromoEvent {
  source: 'rss' | 'scraper'
  airline: 'LATAM' | 'IBERIA' | ...
  origin: string
  destination: string
  cabin: 'BUSINESS' | 'PREMIUM_ECONOMY' | 'ECONOMY'
  priceR$: number | null
  milesEstimate: number | null
  dateRange: { from: Date; to: Date }
  url: string
  detectedAt: Date
}

interface AwardSeat {
  source: 'gmail-seats-aero'
  program: string
  airline: string
  origin: string
  destination: string
  date: Date
  cabin: string
  seats: number
  miles: number
  taxes: number
  url: string
}

function crossReference(promos: PromoEvent[], seats: AwardSeat[]): Alert[] {
  // RED: promo LATAM + inventário J confirmado em janela compatível
  // YELLOW: promo LATAM sem confirmação inventário (validar via call center)
  // GREEN: inventário descoberto em parceira sem promo associada
}
```

Regras adicionais:
- Aplicar `quiet_hours` (não enviar entre 23h-07h BRT exceto para alertas RED)
- Aplicar `dedupe`: mesma combinação `(rota, data, programa, cabine)` não alerta 2x em 7 dias
- Aplicar `require_direct`: alertas com conexão em parceiras Oneworld/Star **na ida** são descartados
- Persistir em SQLite todas as detecções (mesmo as filtradas) para auditoria

## 6. Stack técnico

**Linguagem e runtime:**
- Node.js 20 LTS (mínimo)
- TypeScript 5.x **com strict mode** (`strict: true`, `noUncheckedIndexedAccess: true`)
- Module: ESM (`"type": "module"` no package.json)

**Libs principais:**
- `zod` — validação de payloads externos (Gmail, RSS, env vars)
- `rss-parser` — parsing dos feeds Melhores Destinos / Passageiro de Primeira
- `googleapis` — cliente oficial Google APIs Node.js (OAuth 2.0 + Gmail API)
- `mailparser` — decodifica MIME e quoted-printable do body retornado pelo Gmail
- `cheerio` — parsing do HTML dos e-mails do Seats.aero
- `better-sqlite3` — SQLite síncrono para estado
- `grammy` — Telegram bot framework
- `date-fns` + `date-fns-tz` — manipulação de datas com timezone
- `pino` + `pino-pretty` — logs estruturados
- `dotenv` — carregamento de .env (apenas dev)
- `axios` + `axios-retry` — HTTP client com retry exponencial
- `js-yaml` — leitura do `config/search.yaml`

**Dev e testes:**
- `vitest` — testes unitários e integração
- `@vitest/coverage-v8` — cobertura
- `eslint` + `@typescript-eslint/*` — lint
- `prettier` — formatação
- `husky` + `lint-staged` — pre-commit hooks
- `tsx` — execução TS direta para dev

**Mínimo de cobertura de testes**: 80% nos parsers, engine de cruzamento e dedupe. UI/notificação pode ficar em 50%.

## 7. Estrutura do projeto

```
award-bot/
├── .github/
│   └── workflows/
│       └── monitor.yml            # cron a cada 30min, 06h-23h BRT
├── config/
│   ├── search.yaml                # critérios de busca (versionado)
│   └── search.schema.ts           # Zod schema do YAML
├── src/
│   ├── index.ts                   # entry point (CLI + daemon)
│   ├── env.ts                     # validação Zod das env vars
│   ├── logger.ts                  # pino setup
│   ├── collectors/
│   │   ├── rss.ts                 # Melhores Destinos + PdP
│   │   └── gmail-seats-aero.ts    # leitor Gmail dos e-mails Seats.aero
│   ├── parsers/
│   │   ├── seats-aero-email.ts    # HTML → AwardAlert
│   │   ├── promo-detector.ts      # extrai PromoEvent de RSS
│   │   └── airline-codes.ts       # mapping IATA codes
│   ├── engine/
│   │   ├── cross-reference.ts     # core logic
│   │   ├── dedupe.ts              # checagem em SQLite
│   │   └── priority.ts            # RED/YELLOW/GREEN
│   ├── storage/
│   │   ├── db.ts                  # better-sqlite3 setup
│   │   ├── migrations/            # schema versions
│   │   └── repository.ts          # queries
│   ├── notifier/
│   │   ├── telegram.ts            # grammy bot
│   │   └── format.ts              # template de mensagens
│   └── types.ts                   # tipos compartilhados (AwardAlert, FlightOption, etc.)
├── tests/
│   ├── parsers/
│   ├── engine/
│   ├── fixtures/
│   │   └── seats-aero-emails/     # .eml reais e anonimizados
│   └── integration/
├── scripts/
│   └── gmail-oauth-bootstrap.ts   # one-shot para gerar refresh_token
├── data/
│   └── .gitkeep                   # sqlite db fica aqui (gitignored)
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── README.md
└── CLAUDE.md                      # instruções para futuras sessões Claude Code
```

## 8. Convenções de código

**Tipagem rigorosa:**
- Nada de `any`. Use `unknown` + Zod parse para entradas externas.
- Tipos de retorno explícitos em todas as funções públicas.
- `noUncheckedIndexedAccess: true` (acesso a arrays/objetos retorna `T | undefined`).

**Estilo de funções:**
- Funções puras sempre que possível.
- Side effects isolados em módulos `collectors/` e `notifier/`.
- Engine de cruzamento (`engine/`) deve ser 100% pura e testável sem mocks.

**Erros:**
- `Result<T, E>` ou `neverthrow`-style em vez de exceções (exceto erros realmente excepcionais).
- Toda chamada externa (API, RSS) deve ter retry exponencial com no máximo 3 tentativas.
- Falha de uma fonte não derruba o agente — registra erro estruturado e segue.

**Testes:**
- TDD obrigatório para a engine de cruzamento, dedupe e parser de e-mails Seats.aero.
- Fixtures com payloads reais (anonimizados) gravados em `tests/fixtures/`.
- Testes de integração rodam em CI usando SQLite em memória.
- Não fazer testes que dependam de rede externa em CI; mockar via `msw` ou nock.

**Git discipline:**
- Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`, `docs:`)
- Feature branches; PRs para `main`
- Pre-commit roda lint + format + testes afetados
- CI roda lint + typecheck + testes completos + cobertura

**Logging:**
- Pino estruturado, nada de `console.log` em produção.
- Níveis: `debug` (dev), `info` (eventos normais), `warn` (degradação), `error` (falhas).
- Cada execução do cron tem um `runId` que correlaciona logs.

## 9. Integrações externas

**Gmail API**
- Auth: OAuth 2.0 com refresh token de longa duração
- Setup manual (uma vez):
  1. Criar projeto no Google Cloud Console
  2. Ativar Gmail API
  3. Gerar OAuth client credentials (client_id + client_secret)
  4. Executar `scripts/gmail-oauth-bootstrap.ts` localmente uma vez para abrir browser, autorizar e obter refresh_token
  5. Guardar refresh_token nos secrets do GitHub Actions
- Scope mínimo: `https://www.googleapis.com/auth/gmail.readonly`
- Filtro de leitura: label `seats-aero/real-alerts` + `from:alerts@seats.aero`
- Polling: a cada 30 min via cron, busca e-mails da label desde `lastProcessedAt` armazenado em SQLite
- Variáveis de ambiente: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL`

**Seats.aero API**
- **NÃO DISPONÍVEL** para uso pessoal (confirmado com suporte da plataforma)
- Se essa política mudar no futuro, atualizar este briefing e adicionar coletor `collectors/seats-aero-api.ts` como camada de redundância ao parser de e-mail

**Telegram Bot:**
- Criar bot via @BotFather, obter token
- Variável: `TELEGRAM_BOT_TOKEN`
- Variável: `TELEGRAM_CHAT_ID` (chat ID pessoal — usar @userinfobot para obter)

**GitHub Actions:**
- Workflow agendado: `cron: '*/30 9-23 * * *'` (UTC; equivale a 06:00-20:00 BRT — ajustar)
- Persistir SQLite via commit automatizado em branch `state` ou usar GitHub Cache action
- Secrets: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

## 9.5 Schema de dados do AwardAlert

Cada e-mail do Seats.aero parseado vira um `AwardAlert` com array de `FlightOption`. Pontos críticos:

- **`flightNumbers`** é array (rotas com conexão têm múltiplos: `["AA4376", "AA108"]`)
- **`routing`** é string slash-separada (`"JFK/BOS/LHR"`); `segments` é o array decomposto
- **`isDirect`** = `segments.length === 2`
- **Invariante** validada por Zod refine: `flightNumbers.length === segments.length - 1`
- **`cheapestMiles`** e **`cheapestDirect`** são derivados; o engine usa essas chaves para comparar contra `max_miles_per_pax` no config

Schema Zod alvo em `src/types.ts`:

```typescript
import { z } from 'zod'

const IATACode = z.string().regex(/^[A-Z]{3}$/)
const FlightNumber = z.string().regex(/^[A-Z]{2,3}\d{1,4}[A-Z]?$/)
const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const Cabin = z.enum(['Economy', 'Premium Economy', 'Business', 'First'])

export const FlightOptionSchema = z.object({
  flightNumbers: z.array(FlightNumber).min(1),
  routing: z.string().regex(/^[A-Z]{3}(\/[A-Z]{3})+$/),
  segments: z.array(IATACode).min(2),
  isDirect: z.boolean(),
  numStops: z.number().int().nonnegative(),
  cabin: Cabin,
  miles: z.number().int().positive(),
  taxesUsd: z.number().nonnegative(),
}).refine(
  (data) => data.flightNumbers.length === data.segments.length - 1,
  { message: 'flight numbers count must equal segments - 1' }
)

export const AwardAlertSchema = z.object({
  alertName: z.string(),
  program: z.string(),
  origin: IATACode,
  destination: IATACode,
  travelDate: ISODate,
  cabin: Cabin,
  flights: z.array(FlightOptionSchema).min(1),
  cheapestMiles: z.number().int().positive(),
  cheapestDirect: z.number().int().positive().optional(),
  hasDirectOption: z.boolean(),
  lastSeenUtc: z.string().optional(),
  detailsUrl: z.string().url(),
  emailId: z.string(),                  // Gmail message ID — chave de dedupe
  emailReceivedAt: z.date(),
  detectedAt: z.date(),
})

export type AwardAlert = z.infer<typeof AwardAlertSchema>
export type FlightOption = z.infer<typeof FlightOptionSchema>
```

Filtro essencial: alertas onde `hasDirectOption === false` devem ser **descartados** se a config tiver `require_direct: true` (default para outbound Business no contexto BR-Europa).

## 10. Plano de implementação por fases

### Fase 1 — MVP (objetivo: primeiro alerta funcional em < 1 semana)

1. Bootstrap do projeto (package.json, tsconfig strict, vitest, ESLint, Prettier, Husky)
2. Schema Zod do `search.yaml` + carregamento + validação na inicialização
3. Schema Zod completo de `AwardAlert` e `FlightOption` em `src/types.ts`
4. Parser `seats-aero-email.ts` com TDD contra os 2 fixtures em `tests/fixtures/seats-aero-emails/`
5. Script `scripts/gmail-oauth-bootstrap.ts` para gerar refresh_token (rodar uma vez)
6. Cliente Gmail (`collectors/gmail-seats-aero.ts`) que lê e-mails da label e devolve `AwardAlert[]`
7. Storage SQLite com migrations + repositório de alertas vistos
8. Engine de dedupe e priorização básica (apenas RED/GREEN, sem YELLOW por enquanto)
9. Bot Telegram com mensagem mínima formatada
10. CLI: `npm run search` executa um ciclo completo
11. Workflow GitHub Actions com cron a cada 30 min
12. README.md com setup e CLAUDE.md com instruções para sessões futuras

**Critério de done da Fase 1**: rodar `npm run search` localmente, ver Telegram receber notificação para um alerta real do Seats.aero, e o cron rodar no GitHub Actions com sucesso.

### Fase 2 — Cruzamento promo + inventário

1. Coletor RSS (Melhores Destinos + Passageiro de Primeira) + parser de promos LATAM
2. Engine de cruzamento completa: detectar promo LATAM + confirmar inventário em janela compatível → gerar alerta RED
3. Templates Telegram diferenciados por prioridade (RED/YELLOW/GREEN), com formatação Markdown e links clicáveis
4. Filtro de quiet hours (23h-07h BRT)

**Critério de done da Fase 2**: testes mostram cruzamento correto com fixtures sintéticas; alertas chegam no Telegram com prioridade visualmente distinta.

### Fase 3 — Robustez e observabilidade

1. Métricas: alertas por dia, dedupe rate, source mix
2. Comando Telegram `/status` retornando saúde do agente
3. Comando Telegram `/recent` retornando últimos 5 alertas
4. Comando Telegram `/snooze 24h` para silenciar temporariamente
5. Backup automático do SQLite para outro repo privado
6. Healthcheck endpoint (caso queira mover para VPS no futuro)

**Critério de done da Fase 3**: agente roda 30+ dias sem intervenção, logs do GitHub Actions estão limpos, comandos Telegram funcionam.

## 11. Configuração inicial e secrets

Arquivo `.env.example`:
```env
# Required - Gmail
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_USER_EMAIL=

# Required - Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Tuning
LOG_LEVEL=info
DB_PATH=./data/state.sqlite
SEATS_AERO_LABEL=seats-aero/real-alerts
```

Setup local:
```bash
git clone <repo>
cd award-bot
npm install
cp .env.example .env
# editar .env com client_id e client_secret do Google Cloud
npx tsx scripts/gmail-oauth-bootstrap.ts   # gera refresh_token, adicionar ao .env
npm run db:migrate
npm run search                              # primeira execução
npm test                                    # rodar testes
```

Setup GitHub Actions:
- Ir em Settings > Secrets and variables > Actions
- Adicionar todos os secrets do `.env.example` (exceto LOG_LEVEL e DB_PATH)
- O workflow `monitor.yml` consome esses secrets

## 12. Out of scope (NÃO fazer)

- ❌ **Não emitir tickets automaticamente.** O agente apenas alerta. A emissão é sempre manual via site da companhia ou call center LATAM.
- ❌ **Não usar a API do Seats.aero** (não disponibilizada para uso pessoal pelo suporte da plataforma — se mudar no futuro, atualizar este briefing)
- ❌ **Não implementar UI web.** Telegram é a única interface de saída.
- ❌ **Não monitorar destinos fora da lista** (só FCO, MAD, CDG).
- ❌ **Não tentar burlar ToS** de nenhuma plataforma.
- ❌ **Não armazenar credenciais de programas de milhas** (LATAM Pass, Smiles etc.). Não fazemos login automatizado nessas plataformas.
- ❌ **Não comprar milhas automaticamente.** Recomendações de compra são responsabilidade humana.

## 13. Critérios pessoais e contexto financeiro

Para que o Claude Code calibre os filtros corretamente:

- **Saldo atual aproximado**: 110.000 pontos somando Livelo + Esfera (varia)
- **Bônus realista de transferência LATAM Pass**: 30% (não 80-100% como aparece em alguns blogs antigos)
- **Meta de acúmulo**: ~250.000-300.000 milhas LATAM Pass para emitir 2 pax ida em J + 2 pax volta em Y
- **Estratégia preferida**: ida em executiva (priorizar promo LATAM 75-110k em J) + volta em econômica (50-80k em Y)
- **Programas-mãe disponíveis**: Esfera, Livelo
- **Programas aéreos com conta ativa**: LATAM Pass (família configurável)
- **Filtro "only direct flights"**: sempre marcado nos alertas do Seats.aero (rotas BR-Europa não compensam conexão random em US/Ásia)
- **E-mail Gmail dedicado**: ver `GMAIL_USER_EMAIL` no `.env`; label `seats-aero/real-alerts`
- **Tolerância a conexões**: prefere voo direto na ida (especialmente Roma direto). Aceita 1 conexão na volta.
- **Janela alvo**: ~maio 2027 a outubro 2027

## 14. Prompt de kickoff para Claude Code

Para iniciar o projeto numa nova sessão Claude Code, copiar exatamente:

---

> Vou construir o **award-bot**, agente de monitoramento de passagens em milhas. Leia atentamente `PROJECT_BRIEF.md` na raiz — contém toda a especificação funcional, stack técnico, convenções de código e plano de fases.
>
> Comece pela **Fase 1 (MVP)** descrita na seção 10. Objetivo desta sessão: deixar o projeto rodando localmente com `npm run search`, conectado ao Gmail via OAuth, parseando os e-mails do Seats.aero da label configurada, e enviando notificação no Telegram para os alertas que casarem com `config/search.yaml`.
>
> **Fixtures de teste reais** estão em `tests/fixtures/seats-aero-emails/`. O parser deve passar nos 2 fixtures antes de qualquer integração com Gmail.
>
> **Convenções obrigatórias** (ver brief seção 8): TS strict com `noUncheckedIndexedAccess`, ESM, Node 20+, Vitest com cobertura ≥80% nos parsers/engine, Zod para toda entrada externa, Result<T,E> para erros previsíveis, Conventional Commits, pino para logs.
>
> Antes de codar:
> 1. Resuma em 5-10 linhas o entendimento da Fase 1
> 2. Liste os arquivos que vai criar
> 3. Aponte ambiguidades ou decisões técnicas que precisem da minha confirmação (especialmente: estratégia de armazenamento do SQLite no GitHub Actions, e estratégia de obtenção do refresh token Gmail)
> 4. Só comece a codar depois do meu OK
>
> TDD obrigatório para `parsers/seats-aero-email.ts` e `engine/dedupe.ts`. Testes contra os 2 fixtures `.eml` antes de qualquer outra coisa.

---

## 15. Notas finais

Este briefing é vivo. Se ao construir surgirem decisões técnicas relevantes (ex: substituir SQLite por PostgreSQL, mover para Cloudflare Workers, adicionar fonte nova), atualize este documento na mesma PR.

O bot é uma ferramenta pessoal, não um produto. Otimize para **simplicidade, confiabilidade e baixo custo de manutenção**, mesmo que isso signifique cobertura menor que o teoricamente possível. Um alerta confiável vale mais que dez alertas com falsos positivos.