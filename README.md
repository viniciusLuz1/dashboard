# Dashboard de Leilões — Tottal Supply

Painel de parede (Fire TV Stick / Silk) com os pregões do dia, contagem
regressiva e alarme sonoro. Contexto completo do projeto em
[CLAUDE.md](CLAUDE.md).

## Rodar localmente

```bash
cp .env.example .env.local   # preencha NOTION_TOKEN
npm install
npm run dev                  # http://localhost:3000/tv
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm test` | suíte do vitest (fuso, métricas, alarmes, parse) |
| `npm run lint` | eslint |
| `npm run notion:doctor` | diagnóstico da conexão com o Notion |
| `node scripts/tv-screenshot.mjs` | screenshots 1920×1080 da tela (usa o Chrome instalado) |

## Testar o alarme sem esperar um pregão

Abra `/tv?demo=90`: injeta um pregão falso daqui a 90 segundos. Dá para
ver a contagem, o bloco ficar vermelho (T-10) e ouvir os dois alarmes
(aviso e o da hora). Funciona também na TV, para conferir o alto-falante.

## Deploy (Vercel)

1. Suba o repositório para o GitHub e importe na Vercel.
2. Em **Settings → Environment Variables**, cadastre as quatro variáveis
   de `.env.example` (o token NUNCA vai no git).
3. A URL de produção é sem autenticação — trate-a como não listada.

## Checklist na TV (primeira instalação)

- [ ] Abrir a URL no Silk e deixar em tela cheia.
- [ ] Clicar **ATIVAR SOM** com o controle — deve tocar um bipe de
      confirmação. Sem o clique, o painel não passa da tela de boot.
- [ ] Conferir com `/tv?demo=90` se o som sai na TV (volume!).
- [ ] Conferir se nenhuma borda está cortada (a margem de 5% deve sobrar
      inteira). Se cortar, ajustar o overscan na TV, não no código.
- [ ] Deixar a TV sem timer de desligamento automático.

A página se recarrega sozinha às 4h da manhã (pega deploys novos e limpa
memória). Se aparecer o banner âmbar **DADOS DESATUALIZADOS**, a tela está
avisando que o dado é velho — a hora do último dado válido fica no banner.

## API

`GET /api/leiloes` — JSON plano (contrato pensado para o ESP32 da Fase 3;
adicionar chaves é seguro, reestruturar quebra). Cache de 60s no servidor.
Campos `dia*` / `semana*` são a camada de dados da Fase 2 — calculados e
testados, ainda sem tela de propósito.
