import { describe, expect, it } from "vitest";
import type { DadosTV, LeilaoTV } from "../visao";
import { CARENCIA_POS_T0_MS, derivarVisao, formatarContagem } from "../visao";

const T = Date.parse("2026-09-01T14:00:00-03:00");
const min = (n: number) => n * 60_000;

const leilao = (id: string, epochMs: number | null, semHora = false): LeilaoTV => ({
  id,
  nome: id,
  rc: null,
  cidade: null,
  horarioISO: null,
  epochMs,
  semHora,
});

const dados = (parcial: Partial<DadosTV>): DadosTV => ({
  proximo: null,
  proximoEhDeHoje: true,
  proximosHoje: [],
  proximos: [],
  realizadosHoje: 2,
  realizadosSemana: 5,
  ...parcial,
});

describe("derivarVisao", () => {
  const base = dados({
    proximosHoje: [
      leilao("a", T),
      leilao("b", T + min(30)),
      leilao("sh", T, true),
    ],
    proximo: leilao("a", T),
  });

  it("na foto do servidor: herói é o primeiro, lista tem o resto + sem-hora", () => {
    const visao = derivarVisao(base, T - min(20));
    expect(visao.hero?.id).toBe("a");
    expect(visao.lista.map((l) => l.id)).toEqual(["b", "sh"]);
    expect(visao.realizadosHoje).toBe(2);
  });

  it("no T-0 o herói permanece durante a carência (mostrando AGORA)", () => {
    const visao = derivarVisao(base, T + CARENCIA_POS_T0_MS - 1000);
    expect(visao.hero?.id).toBe("a");
  });

  it("passada a carência, sem refetch: herói avança e contadores sobem", () => {
    const visao = derivarVisao(base, T + CARENCIA_POS_T0_MS);
    expect(visao.hero?.id).toBe("b");
    expect(visao.lista.map((l) => l.id)).toEqual(["sh"]);
    expect(visao.realizadosHoje).toBe(3);
    expect(visao.realizadosSemana).toBe(6);
  });

  it("hoje acabou: usa o próximo futuro do servidor, que também é alarmável", () => {
    const amanha = leilao("z", T + min(60 * 20));
    const visao = derivarVisao(
      dados({ proximo: amanha, proximoEhDeHoje: false, proximosHoje: [leilao("sh", T, true)] }),
      T,
    );
    expect(visao.hero?.id).toBe("z");
    expect(visao.heroEhDeHoje).toBe(false);
    expect(visao.lista.map((l) => l.id)).toEqual(["sh"]);
    expect(visao.alarmaveis.map((l) => l.id)).toEqual(["z"]);
  });

  it("sem nada: hero null e lista vazia (a tela escreve o estado, não fica em branco)", () => {
    const visao = derivarVisao(dados({ proximo: null, proximoEhDeHoje: false }), T);
    expect(visao.hero).toBeNull();
    expect(visao.lista).toEqual([]);
  });

  it("empate no mesmo horário de amanhã: o que não virou hero aparece na lista", () => {
    const amanha1 = leilao("papelaria", T + min(60 * 20));
    const amanha2 = leilao("mesa-trabalho", T + min(60 * 20)); // mesmo horário
    const amanha3 = leilao("carimbo", T + min(60 * 21));
    const visao = derivarVisao(
      dados({
        proximo: amanha2,
        proximoEhDeHoje: false,
        proximosHoje: [],
        proximos: [amanha1, amanha2, amanha3],
      }),
      T,
    );
    expect(visao.hero?.id).toBe("mesa-trabalho");
    // O empate (papelaria) e o seguinte (carimbo) não somem da tela.
    expect(visao.lista.map((l) => l.id)).toEqual(["papelaria", "carimbo"]);
    // Só o hero é alarmável — os outros da lista não disparam T-10/T-0.
    expect(visao.alarmaveis.map((l) => l.id)).toEqual(["mesa-trabalho"]);
  });

  it("hoje ainda tem itens: lista completa com hoje primeiro, depois cruzando dias, sem duplicar", () => {
    const b = leilao("b", T + min(30));
    const amanha = leilao("amanha", T + min(60 * 20));
    const visao = derivarVisao(
      dados({
        proximo: leilao("a", T),
        proximoEhDeHoje: true,
        proximosHoje: [leilao("a", T), b],
        // "a" e "b" também vêm do cross-day (é o mesmo Notion, mesma janela) — não deve duplicar.
        proximos: [leilao("a", T), b, amanha],
      }),
      T - min(20),
    );
    expect(visao.hero?.id).toBe("a");
    expect(visao.lista.map((l) => l.id)).toEqual(["b", "amanha"]);
  });
});

describe("formatarContagem", () => {
  it("HH:MM:SS com zero à esquerda", () => {
    expect(formatarContagem(min(83) + 5000)).toBe("01:23:05");
    expect(formatarContagem(9000)).toBe("00:00:09");
  });

  it("clampa em zero (fase AGORA) e mostra dias acima de 24h", () => {
    expect(formatarContagem(-5000)).toBe("00:00:00");
    expect(formatarContagem(min(60 * 26) + 1000)).toBe("1d 02:00:01");
  });
});
