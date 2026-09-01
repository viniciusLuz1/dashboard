/**
 * Gatilhos de alarme como função pura: recebem o agora, os leilões e o que
 * já disparou; devolvem o que deve disparar NESTE tick. Quem toca o som é a
 * camada de áudio (components/tv/beeps.ts) — aqui não existe AudioContext,
 * por isso isto é testável.
 *
 * Dedup é obrigatória: sem o Set de chaves, o alarme repetiria a cada tick
 * de 1s e alguém desligaria a TV no primeiro dia.
 */

export type TipoAlarme = "t10" | "t0";

export type Disparo = {
  /** `${leilaoId}:${tipo}` — vai para o Set de já-disparados. */
  chave: string;
  tipo: TipoAlarme;
  leilaoId: string;
};

const DEZ_MINUTOS_MS = 10 * 60_000;

/**
 * Janela de disparo do T-0: se a aba esteve suspensa e acordou até 60s
 * depois da hora, o alarme ainda vale (o pregão acabou de abrir). Mais que
 * isso, tocar não ajuda ninguém.
 */
const TOLERANCIA_T0_MS = 60_000;

type LeilaoAlarmavel = {
  id: string;
  epochMs: number | null;
  semHora: boolean;
};

export function verificarAlarmes(
  leiloes: readonly LeilaoAlarmavel[],
  agoraMs: number,
  jaDisparados: ReadonlySet<string>,
): Disparo[] {
  const disparos: Disparo[] = [];

  for (const leilao of leiloes) {
    // Sem hora não há o que cronometrar — nunca alarma (regra do documento).
    if (leilao.semHora || leilao.epochMs === null) continue;

    const faltamMs = leilao.epochMs - agoraMs;

    // T-10: dentro de [T-10min, T-0). Quem liga a TV faltando 7 minutos
    // ainda recebe o aviso.
    if (faltamMs <= DEZ_MINUTOS_MS && faltamMs > 0) {
      const chave = `${leilao.id}:t10`;
      if (!jaDisparados.has(chave)) {
        disparos.push({ chave, tipo: "t10", leilaoId: leilao.id });
      }
    }

    // T-0: dentro de [T-0, T-0 + tolerância).
    if (faltamMs <= 0 && faltamMs > -TOLERANCIA_T0_MS) {
      const chave = `${leilao.id}:t0`;
      if (!jaDisparados.has(chave)) {
        disparos.push({ chave, tipo: "t0", leilaoId: leilao.id });
      }
    }
  }

  return disparos;
}
