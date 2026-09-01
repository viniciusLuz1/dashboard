import type { ItemLeilao, Leilao } from "./leiloes";
import { inicioDaSemana, mesmoDia } from "./tempo";

/**
 * Funções puras: recebem os dados crus e o instante `agoraMs` e devolvem os
 * números da tela. NUNCA chamadas com resultado cacheado — o cache guarda as
 * linhas do Notion; a classificação roda a cada request com o agora real
 * (senão o relógio congela por até 60s).
 */

export type Classificacao = {
  /**
   * Leilões de hoje ainda por acontecer, ordenados por hora. Os sem hora
   * ("horário não informado") entram no FIM da lista: aparecem na tela, mas
   * nunca são alvo de contagem regressiva nem de alarme.
   */
  proximosHoje: Leilao[];
  /** O primeiro de proximosHoje que tem hora — alvo da contagem regressiva. */
  proximo: Leilao | null;
  realizadosHoje: number;
  /** De segunda 00:00 (SP) até agora. */
  realizadosSemana: number;
};

export function classificar(leiloes: Leilao[], agoraMs: number): Classificacao {
  const comData = leiloes.filter(
    (leilao): leilao is Leilao & { epochMs: number } => leilao.epochMs !== null,
  );

  const deHoje = (leilao: { epochMs: number }) => mesmoDia(leilao.epochMs, agoraMs);

  // Sem hora, nunca se sabe se o pregão já ocorreu — não é só "hoje": um
  // AGENDADO sem hora de segunda continua sem essa informação na terça.
  // Mesma exclusão permanente que já vale para o alarme.
  const realizado = (leilao: Leilao & { epochMs: number }) =>
    leilao.epochMs < agoraMs && !leilao.semHora;

  const futurosComHora = comData
    .filter((leilao) => deHoje(leilao) && !leilao.semHora && leilao.epochMs >= agoraMs)
    .sort((a, b) => a.epochMs - b.epochMs);

  const semHoraHoje = comData.filter((leilao) => deHoje(leilao) && leilao.semHora);

  const inicioSemanaMs = inicioDaSemana(agoraMs).getTime();

  return {
    proximosHoje: [...futurosComHora, ...semHoraHoje],
    proximo: futurosComHora[0] ?? null,
    realizadosHoje: comData.filter((leilao) => deHoje(leilao) && realizado(leilao)).length,
    realizadosSemana: comData.filter(
      (leilao) => leilao.epochMs >= inicioSemanaMs && realizado(leilao),
    ).length,
  };
}

// ── Fase 2: camada de dados (a tela ignora por enquanto, o contrato existe) ──

export type AgregadoItens = {
  itensGanhos: number;
  /** Σ Lance Unitário × Quantidade dos itens GANHO. */
  faturamento: number;
  /** Itens com resultado GANHO ou PERDIDO. */
  itensDisputados: number;
  /** ganhos ÷ disputados; 0 quando nada foi disputado. */
  aproveitamento: number;
};

const agregadoVazio = (): AgregadoItens => ({
  itensGanhos: 0,
  faturamento: 0,
  itensDisputados: 0,
  aproveitamento: 0,
});

/**
 * O item não tem data própria: herda o `Data` do leilão pai. Adjudicação é
 * por item — uma RC com 8 itens pode render 3 ganhos, por isso tudo aqui
 * conta itens, nunca leilões.
 */
export function agregarItens(
  itens: ItemLeilao[],
  leiloesPorId: Map<string, Leilao>,
  agoraMs: number,
): { dia: AgregadoItens; semana: AgregadoItens } {
  const dia = agregadoVazio();
  const semana = agregadoVazio();

  for (const item of itens) {
    const ganho = item.resultadoItem === "GANHO";
    const disputado = ganho || item.resultadoItem === "PERDIDO";
    const valor = ganho ? (item.lanceUnitario ?? 0) * (item.quantidade ?? 0) : 0;

    const leilao = item.leilaoId ? leiloesPorId.get(item.leilaoId) : undefined;
    const ehDeHoje = leilao?.epochMs != null && mesmoDia(leilao.epochMs, agoraMs);

    // Os itens chegam via query pelos leilões da semana: todos pertencem a ela.
    for (const balde of ehDeHoje ? [dia, semana] : [semana]) {
      if (ganho) balde.itensGanhos += 1;
      if (disputado) balde.itensDisputados += 1;
      balde.faturamento += valor;
    }
  }

  for (const balde of [dia, semana]) {
    balde.aproveitamento = balde.itensDisputados
      ? balde.itensGanhos / balde.itensDisputados
      : 0;
  }

  return { dia, semana };
}
