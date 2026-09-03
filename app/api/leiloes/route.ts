import { NextResponse } from "next/server";
import { comCache } from "@/lib/cache";
import {
  buscarItensDosLeiloes,
  buscarLeiloesEntre,
  buscarProximosFuturos,
  type Leilao,
} from "@/lib/leiloes";
import { agregarItens, classificar } from "@/lib/metricas";
import { buscarFaturamentoPedidosChegados } from "@/lib/pedidos";
import {
  FUSO,
  agora,
  fimDaSemana,
  inicioDaSemana,
  paraDataSP,
  paraISOComOffset,
} from "@/lib/tempo";

/**
 * O contrato desta rota é consumido pela TV e, na Fase 3, por um ESP32
 * (M5StickC) parseando JSON com pouca memória. Por isso é PLANO: adicione
 * chaves, não reestruture. As chaves "dia…" e "semana…" são a Fase 2 — a
 * tela ignora por enquanto, de propósito.
 */

export const dynamic = "force-dynamic"; // o cache é nosso (TTL 60s), não do Next

const TTL_MS = 60_000;
/** Quantos leilões futuros (com hora, cruzando dias) a lista "próximos" leva. */
const LIMITE_PROXIMOS = 6;

/** Forma pública de um leilão no contrato — não vaza o resto do Notion. */
type LeilaoAPI = {
  id: string;
  nome: string;
  rc: string | null;
  cidade: string | null;
  horarioISO: string | null;
  epochMs: number | null;
  semHora: boolean;
};

const paraAPI = (leilao: Leilao): LeilaoAPI => ({
  id: leilao.id,
  nome: leilao.nome,
  rc: leilao.rc,
  cidade: leilao.cidade,
  horarioISO: leilao.dataISO,
  epochMs: leilao.epochMs,
  semHora: leilao.semHora,
});

export async function GET() {
  const agoraSP = agora();
  const agoraMs = agoraSP.getTime();

  try {
    // A chave inclui a segunda-feira da semana: quando a semana vira, o
    // cache da anterior é naturalmente abandonado.
    const inicioSemana = inicioDaSemana(agoraMs);
    const semana = await comCache(
      `semana:${inicioSemana.toISOString()}`,
      TTL_MS,
      async () => {
        const leiloes = await buscarLeiloesEntre(inicioSemana, fimDaSemana(agoraMs));
        const itens = await buscarItensDosLeiloes(leiloes.map((leilao) => leilao.id));
        return { leiloes, itens };
      },
    );

    const { leiloes, itens } = semana.valor;
    const classificacao = classificar(leiloes, agoraMs);

    const proximo = classificacao.proximo;
    const proximoEhDeHoje = proximo !== null;

    // Próximos leilões cruzando dias — alimenta a lista da tela (pega
    // empates no mesmo horário que "proximo" sozinho esconderia) e também
    // serve de reserva de "proximo" quando hoje já acabou. Falha aqui não
    // derruba a resposta: o painel principal continua.
    let proximos: Leilao[] = [];
    try {
      const futuros = await comCache("proximos-futuros", TTL_MS, () =>
        buscarProximosFuturos(agoraSP, LIMITE_PROXIMOS),
      );
      proximos = futuros.valor;
    } catch {
      proximos = [];
    }
    const proximoResolvido = proximo ?? proximos[0] ?? null;

    const leiloesPorId = new Map(leiloes.map((leilao) => [leilao.id, leilao]));
    const { dia, semana: fase2Semana } = agregarItens(itens, leiloesPorId, agoraMs);

    // Faturamento real da semana: soma de pedidos de compra chegados (outro
    // sistema, Supabase) — não é o valor GANHO no leilão, é o que o cliente
    // de fato autorizou. null quando a origem falhou (a tela mostra "—", não
    // inventa zero). Cache próprio: falha aqui não derruba o painel principal.
    let semanaFaturamentoReal: number | null = null;
    try {
      const inicioSemanaData = paraDataSP(inicioSemana);
      const fimSemanaData = paraDataSP(fimDaSemana(agoraMs));
      const real = await comCache(
        `pedidos-semana:${inicioSemanaData}`,
        TTL_MS,
        () => buscarFaturamentoPedidosChegados(inicioSemanaData, fimSemanaData),
      );
      semanaFaturamentoReal = real.valor;
    } catch {
      semanaFaturamentoReal = null;
    }

    return NextResponse.json({
      geradoEm: paraISOComOffset(agoraMs),
      agoraEpochMs: agoraMs,
      fuso: FUSO,

      proximo: proximoResolvido ? paraAPI(proximoResolvido) : null,
      proximoEhDeHoje,
      proximosHoje: classificacao.proximosHoje.map(paraAPI),
      /** Próximos com hora cruzando dias (Fase 1.1) — alimenta a lista abaixo do contador. */
      proximos: proximos.map(paraAPI),
      realizadosHoje: classificacao.realizadosHoje,
      realizadosSemana: classificacao.realizadosSemana,

      // Fase 2 — camada de dados pronta, tela desligada de propósito.
      diaItensGanhos: dia.itensGanhos,
      diaFaturamento: dia.faturamento,
      diaItensDisputados: dia.itensDisputados,
      diaAproveitamento: dia.aproveitamento,
      semanaItensGanhos: fase2Semana.itensGanhos,
      semanaFaturamento: fase2Semana.faturamento,
      semanaItensDisputados: fase2Semana.itensDisputados,
      semanaAproveitamento: fase2Semana.aproveitamento,
      /** Faturamento real da semana (pedidos de compra chegados) — ver comentário acima. null = origem indisponível. */
      semanaFaturamentoReal,

      /** Quando o Notion falhou e estes dados são o último valor válido. */
      dadosDeEpochMs: semana.carregadoEm,
      erro: semana.obsoleto
        ? `Notion indisponível — exibindo dados de ${paraISOComOffset(semana.carregadoEm)}`
        : null,
    });
  } catch (erro) {
    // Nem cache antigo existe. A TV mostra o banner com o último dado que
    // ELA guardou; aqui só se reporta a falha honestamente.
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(`[api/leiloes] ${mensagem}`);
    return NextResponse.json(
      { geradoEm: paraISOComOffset(agoraMs), agoraEpochMs: agoraMs, erro: mensagem },
      { status: 502 },
    );
  }
}
