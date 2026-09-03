/**
 * O que a TV mostra entre um fetch e outro. O servidor manda a foto de 60s
 * atrás; o tick de 1s NÃO refaz o fetch — recalcula a visão daqui: o herói
 * avança quando um pregão passa, os contadores sobem, a lista encolhe.
 * Função pura, mesma razão de lib/metricas.ts.
 */

export type LeilaoTV = {
  id: string;
  nome: string;
  rc: string | null;
  cidade: string | null;
  horarioISO: string | null;
  epochMs: number | null;
  semHora: boolean;
};

export type DadosTV = {
  proximo: LeilaoTV | null;
  proximoEhDeHoje: boolean;
  proximosHoje: LeilaoTV[];
  /** Próximos com hora cruzando dias — pega empates no mesmo horário que "proximo" sozinho esconde. */
  proximos: LeilaoTV[];
  realizadosHoje: number;
  realizadosSemana: number;
};

export type Visao = {
  /** Alvo da contagem regressiva (ou o próximo futuro, quando hoje acabou). */
  hero: LeilaoTV | null;
  heroEhDeHoje: boolean;
  /** Demais de hoje: com hora primeiro, "horário não informado" no fim. */
  lista: LeilaoTV[];
  realizadosHoje: number;
  realizadosSemana: number;
  /** O que o verificador de alarmes deve observar neste tick. */
  alarmaveis: LeilaoTV[];
};

/**
 * Depois do T-0 o pregão segue como herói por este período, com "AGORA" na
 * tela — mesmo valor da tolerância do alarme, para som e visual concordarem.
 */
export const CARENCIA_POS_T0_MS = 60_000;

export function derivarVisao(dados: DadosTV, agoraMs: number): Visao {
  // Contadores e alarme só olham para "hoje" — isso não muda com a lista
  // cruzando dias, por isso continua vindo só de proximosHoje.
  const comHora = dados.proximosHoje.filter(
    (leilao): leilao is LeilaoTV & { epochMs: number } =>
      !leilao.semHora && leilao.epochMs !== null,
  );
  const semHora = dados.proximosHoje.filter((leilao) => leilao.semHora);

  const pendentes = comHora
    .filter((leilao) => leilao.epochMs + CARENCIA_POS_T0_MS > agoraMs)
    .sort((a, b) => a.epochMs - b.epochMs); // não confiar na ordem do payload
  const passadosDesdeFetch = comHora.length - pendentes.length;

  const heroDeHoje = pendentes[0] ?? null;
  const hero =
    heroDeHoje ?? (!dados.proximoEhDeHoje ? dados.proximo : null);

  // Lista: o resto de hoje primeiro (fonte sem limite, nunca perde nada do
  // dia), completado pelos próximos cruzando dias — cobre empates no mesmo
  // horário e dá visibilidade do que vem depois de hoje. Dedup por id.
  const restanteHoje = pendentes.slice(1);
  const idsNaLista = new Set([hero?.id, ...restanteHoje.map((l) => l.id)]);
  const restanteFuturo = dados.proximos
    .filter(
      (leilao): leilao is LeilaoTV & { epochMs: number } =>
        leilao.epochMs !== null &&
        leilao.epochMs + CARENCIA_POS_T0_MS > agoraMs &&
        !idsNaLista.has(leilao.id),
    )
    .sort((a, b) => a.epochMs - b.epochMs);

  return {
    hero,
    heroEhDeHoje: heroDeHoje !== null,
    lista: [...restanteHoje, ...restanteFuturo, ...semHora],
    realizadosHoje: dados.realizadosHoje + passadosDesdeFetch,
    realizadosSemana: dados.realizadosSemana + passadosDesdeFetch,
    alarmaveis:
      hero && !heroDeHoje ? [...pendentes, hero] : pendentes,
  };
}

/** "HH:MM:SS"; acima de 24h, "2d 03:24:00"; nunca negativo (clampa em zero). */
export function formatarContagem(faltamMs: number): string {
  const total = Math.max(0, Math.floor(faltamMs / 1000));
  const dias = Math.floor(total / 86_400);
  const horas = Math.floor((total % 86_400) / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;

  const relogio = [horas, minutos, segundos]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");

  return dias > 0 ? `${dias}d ${relogio}` : relogio;
}
