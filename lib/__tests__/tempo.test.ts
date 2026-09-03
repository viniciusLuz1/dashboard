import { describe, expect, it } from "vitest";
import {
  fimDaSemana,
  fimDoDia,
  fimDoMes,
  inicioDaSemana,
  inicioDoDia,
  inicioDoMes,
  mesAnterior,
  mesmoDia,
  paraDataSP,
  paraISOComOffset,
} from "../tempo";

/**
 * O caso que dá razão de existir a esta suíte: 22h em Brasília já é o DIA
 * SEGUINTE em UTC. Qualquer implementação que use o dia UTC quebra aqui.
 */
const TERCA_22H_BRT = Date.parse("2026-09-02T01:00:00Z"); // ter 01/09 22:00 em SP

// E o caso composto: domingo 22h BRT é segunda 01h UTC — uma implementação
// UTC pularia a semana inteira para a frente.
const DOMINGO_22H_BRT = Date.parse("2026-09-07T01:00:00Z"); // dom 06/09 22:00 em SP

describe("inicioDoDia / fimDoDia", () => {
  it("às 22h BRT, o dia ainda é o de Brasília, não o de UTC", () => {
    expect(inicioDoDia(TERCA_22H_BRT).toISOString()).toBe(
      "2026-09-01T00:00:00.000-03:00",
    );
    expect(fimDoDia(TERCA_22H_BRT).toISOString()).toBe(
      "2026-09-01T23:59:59.999-03:00",
    );
  });

  it("meia-noite SP corresponde a 03:00 UTC", () => {
    expect(inicioDoDia(TERCA_22H_BRT).getTime()).toBe(
      Date.parse("2026-09-01T03:00:00Z"),
    );
  });
});

describe("inicioDaSemana / fimDaSemana", () => {
  it("semana começa na segunda 00:00 SP, não no domingo", () => {
    expect(inicioDaSemana(TERCA_22H_BRT).toISOString()).toBe(
      "2026-08-31T00:00:00.000-03:00",
    );
  });

  it("domingo 22h BRT (segunda em UTC) ainda pertence à semana que termina", () => {
    expect(inicioDaSemana(DOMINGO_22H_BRT).toISOString()).toBe(
      "2026-08-31T00:00:00.000-03:00",
    );
    expect(fimDaSemana(DOMINGO_22H_BRT).toISOString()).toBe(
      "2026-09-06T23:59:59.999-03:00",
    );
  });
});

describe("mesmoDia", () => {
  it("dois instantes na mesma data SP, mesmo cruzando a meia-noite UTC", () => {
    const cedo = Date.parse("2026-09-01T10:00:00Z"); // ter 07:00 SP
    expect(mesmoDia(TERCA_22H_BRT, cedo)).toBe(true);
  });

  it("00:30 UTC e 04:00 UTC são dias SP diferentes (21:30 de ter × 01:00 de qua)", () => {
    const a = Date.parse("2026-09-02T00:30:00Z");
    const b = Date.parse("2026-09-02T04:00:00Z");
    expect(mesmoDia(a, b)).toBe(false);
  });
});

describe("paraISOComOffset", () => {
  it("emite offset -03:00, formato aceito pelo filtro do Notion", () => {
    expect(paraISOComOffset(TERCA_22H_BRT)).toBe(
      "2026-09-01T22:00:00.000-03:00",
    );
  });
});

describe("paraDataSP", () => {
  it("22h BRT ainda é o dia de SP, não o de UTC (já é dia seguinte lá)", () => {
    expect(paraDataSP(TERCA_22H_BRT)).toBe("2026-09-01");
  });
});

describe("inicioDoMes / fimDoMes / mesAnterior", () => {
  it("dia 1 00:00 até o último dia 23:59:59.999, horário de SP", () => {
    expect(inicioDoMes(TERCA_22H_BRT).toISOString()).toBe(
      "2026-09-01T00:00:00.000-03:00",
    );
    expect(fimDoMes(TERCA_22H_BRT).toISOString()).toBe(
      "2026-09-30T23:59:59.999-03:00",
    );
  });

  it("mês anterior de janeiro é dezembro do ano anterior (virada de ano)", () => {
    const JAN_15_SP = Date.parse("2026-01-15T12:00:00-03:00");
    expect(paraDataSP(mesAnterior(JAN_15_SP))).toBe("2025-12-15");
    expect(inicioDoMes(mesAnterior(JAN_15_SP)).toISOString()).toBe(
      "2025-12-01T00:00:00.000-03:00",
    );
    expect(fimDoMes(mesAnterior(JAN_15_SP)).toISOString()).toBe(
      "2025-12-31T23:59:59.999-03:00",
    );
  });
});
