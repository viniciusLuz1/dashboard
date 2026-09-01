import { describe, expect, it } from "vitest";
import { verificarAlarmes } from "../alarmes";

const T0 = Date.parse("2026-09-01T14:00:00-03:00");
const min = (n: number) => n * 60_000;

const leilao = (id: string, epochMs: number | null, semHora = false) => ({
  id,
  epochMs,
  semHora,
});

const alvo = leilao("a", T0);

describe("verificarAlarmes", () => {
  it("T-10 dispara dentro da janela e uma única vez", () => {
    const disparados = new Set<string>();

    const antes = verificarAlarmes([alvo], T0 - min(11), disparados);
    expect(antes).toEqual([]);

    const dentro = verificarAlarmes([alvo], T0 - min(10), disparados);
    expect(dentro).toEqual([{ chave: "a:t10", tipo: "t10", leilaoId: "a" }]);

    // O chamador registra a chave; o tick seguinte não repete.
    for (const d of dentro) disparados.add(d.chave);
    expect(verificarAlarmes([alvo], T0 - min(10) + 1000, disparados)).toEqual([]);
  });

  it("T-0 dispara na hora e é independente do T-10", () => {
    const disparados = new Set<string>(["a:t10"]);
    const naHora = verificarAlarmes([alvo], T0, disparados);
    expect(naHora).toEqual([{ chave: "a:t0", tipo: "t0", leilaoId: "a" }]);
  });

  it("TV ligada faltando 7 min: recebe o T-10 atrasado (melhor que nada)", () => {
    const r = verificarAlarmes([alvo], T0 - min(7), new Set());
    expect(r.map((d) => d.tipo)).toEqual(["t10"]);
  });

  it("aba acordou 30s depois da hora: T-0 ainda vale; 2 min depois, não", () => {
    expect(verificarAlarmes([alvo], T0 + 30_000, new Set()).map((d) => d.tipo)).toEqual(["t0"]);
    expect(verificarAlarmes([alvo], T0 + min(2), new Set())).toEqual([]);
  });

  it("sem hora nunca alarma, mesmo com epoch presente (meia-noite SP)", () => {
    const semHora = leilao("b", T0, true);
    expect(verificarAlarmes([semHora], T0 - min(5), new Set())).toEqual([]);
    expect(verificarAlarmes([leilao("c", null)], T0, new Set())).toEqual([]);
  });

  it("dois leilões na janela ao mesmo tempo: dois disparos", () => {
    const outro = leilao("d", T0 + min(9));
    const r = verificarAlarmes([alvo, outro], T0 - min(1), new Set());
    expect(r.map((d) => d.chave).sort()).toEqual(["a:t10", "d:t10"]);
  });
});
