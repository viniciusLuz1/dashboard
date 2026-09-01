# Dashboard de Leilões — Tottal Supply

Painel de TV (Fire TV Stick, navegador Silk, 1080p) mostrando os pregões
eletrônicos do dia com contagem regressiva e alarme sonoro. Fica ligado o
dia inteiro numa parede; ninguém interage depois do boot.

## O negócio em três linhas

A Tottal Supply revende materiais navais/industriais e disputa pregões
reversos (Transpetro etc.) com hora marcada — perder a hora é perder a
disputa. Adjudicação é **por item**: uma RC com 8 itens pode render 3 ganhos.

## Stack

Next.js (App Router) + TypeScript, deploy Vercel. Sem banco (lê o Notion
com cache de 60s no servidor), sem auth (URL obscura). Datas com
`date-fns` v4 + `@date-fns/tz` (`TZDate`). Testes com vitest (`npm test`).

## Dados no Notion

| Database | ID (env) | Data source (resolvida em runtime) |
|---|---|---|
| LEILÕES CAPTURAME | `NOTION_DB_LEILOES` = `86974c7b-5253-41c6-a2a5-2dc20a49fc51` | `feafd585-d300-434c-9f32-e05bf6f18930` |
| ITENS DE LEILÃO | `NOTION_DB_ITENS` = `514771c5-372d-4edf-ab44-396ecd118298` | `2e400bb6-c3ed-42d2-8cbe-ffdcff30b6e8` |

A API 2025-09-03 do Notion consulta **data sources**, não databases.
`lib/notion.ts` resolve `database → primeira data source` e cacheia em memória.
Os IDs de data source acima são os observados em produção — não os hardcode;
sempre resolva a partir do database.

## Pegadinhas aprendidas com dados reais (não rediscutir, foi observado)

- **Fórmulas e rollups não vêm na API de query.** `Faturamento`, `Custo
  Total`, `Margem RC` etc. são calculados em `lib/metricas.ts` a partir dos
  campos crus. Não tente ler os campos calculados.
- **~1500 leilões na base.** Nunca puxar tudo; a query filtra `Data` pela
  semana corrente.
- **Rate limit ~3 req/s** (já tomamos 429). Cache de 60s em `lib/cache.ts`.
- **A RC está no título** (`"CAFÉ RC(10911572) - TOTTAL"`). Extração com
  `/\d{8}/`; sem match, mostra o título inteiro.
- **`Data` sem hora** (~5% dos registros) vem como date-only (`2026-09-04`,
  sem `T`). Esses aparecem como "horário não informado", fora da contagem
  regressiva, dos alarmes e **também fora de `realizadosHoje`/`realizadosSemana`
  para sempre** — não só no dia em que aparecem. Passar a meia-noite não é
  informação nova sobre se o pregão ocorreu; a exclusão em `lib/metricas.ts`
  não pode depender de `deHoje`.
- **`CIDADE` é suja** (60 variações de grafia). Fase 1: primeiro valor, cru.
- **Fuso:** Vercel roda em UTC, Brasil é UTC-3. TODA lógica de
  hoje/semana/agora usa `America/Sao_Paulo` via `lib/tempo.ts`. Os testes de
  fuso (22h BRT = dia seguinte em UTC) existem para impedir regressão.

## Fases

- **Fase 1 (feita aqui):** lista do dia, contagem regressiva, alarmes
  T-10/T-0, contadores de hoje/semana.
- **Fase 2 (só camada de dados):** agregações de itens ganhos/faturamento já
  calculadas e expostas em `/api/leiloes` (chaves `dia*`/`semana*`). A tela
  ignora de propósito — 22 itens ainda não sustentam um placar. Ligar a
  Fase 2 = mudança de tela, não refatoração.
- **Fase 3 (não implementada):** um ESP32 (M5StickC) vai consumir
  `/api/leiloes`. Por isso o JSON é plano — mudanças no contrato quebram o
  microcontrolador; adicione chaves, não reestruture.

## Áudio (o ponto mais frágil)

Silk bloqueia áudio até gesto do usuário. Tela de boot com botão único
"ATIVAR SOM" → no handler: `AudioContext` + `resume()` + buffer silencioso.
Bipes via `OscillatorNode` (sem arquivos). Dedup obrigatória: `Set` com
`${leilaoId}:t10` / `${leilaoId}:t0`. A cada tick, se `ctx.state ===
'suspended'`, tenta `resume()`; falhou → indicador visual de mudo.

## Operação contínua

Fetch a cada 60s; tick de 1s recalcula contagens sem refetch; reload
automático às 4h (hora SP); `wakeLock` em try/catch (Silk pode não ter);
margem de 5% nas bordas (overscan); erro de fetch mostra banner com o
horário do último dado válido — a tela nunca mente.

## Git para iniciantes (o dono do repo pediu)

- Ver histórico: `git log --oneline`
- Desfazer o último commit mantendo os arquivos: `git reset --soft HEAD~1`
- Voltar um arquivo ao último commit: `git checkout -- caminho/do/arquivo`
- Voltar o projeto inteiro a um commit antigo (destrutivo!):
  `git reset --hard <hash>` — na dúvida, pergunte antes.

## Diagnóstico

`npm run notion:doctor` — verifica token, resolve data sources e lista o
que a integração enxerga. Nunca imprime o token.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
