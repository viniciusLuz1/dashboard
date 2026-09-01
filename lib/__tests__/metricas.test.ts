import { describe, expect, it } from "vitest";
import type { ItemLeilao, Leilao } from "../leiloes";
import { agregarItens, classificar } from "../metricas";

// Terça 01/09/2026, 14:00 em São Paulo (17:00Z).
const AGORA = Date.parse("2026-09-01T17:00:00Z");

const leilao = (id: string, iso: string | null, semHora = false): Leilao => ({
  id,
  nome: `LEILÃO ${id}`,
  rc: null,
  cidade: null,
  status: null,
  resultado: null,
  dataISO: iso,
  epochMs: iso === null ? null : Date.parse(iso),
  semHora,
});

// Para date-only, o epoch é meia-noite SP (comportamento de parseDataNotion).
const leilaoSemHora = (id: string, diaSP: string): Leilao => ({
  ...leilao(id, `${diaSP}T00:00:00-03:00`, true),
  dataISO: diaSP,
});

describe("classificar", () => {
  const cenario = [
    leilao("manha", "2026-09-01T09:00:00-03:00"), // hoje, já passou
    leilao("tarde2", "2026-09-01T16:30:00-03:00"), // hoje, futuro (fora de ordem)
    leilao("tarde1", "2026-09-01T15:00:00-03:00"), // hoje, futuro
    leilaoSemHora("sem-hora-hoje", "2026-09-01"),
    leilao("ontem", "2026-08-31T10:00:00-03:00"),
    leilao("amanha", "2026-09-02T10:00:00-03:00"),
    leilao("sem-data", null),
    // 23:30 BRT de hoje = 02:30Z de AMANHÃ: quem usar dia UTC joga este
    // leilão para quarta e ele some da lista de hoje.
    leilao("noite", "2026-09-01T23:30:00-03:00"),
  ];

  const resultado = classificar(cenario, AGORA);

  it("próximos de hoje ordenados por hora, sem-hora no fim", () => {
    expect(resultado.proximosHoje.map((l) => l.id)).toEqual([
      "tarde1",
      "tarde2",
      "noite",
      "sem-hora-hoje",
    ]);
  });

  it("próximo = primeiro com hora (nunca um sem-hora)", () => {
    expect(resultado.proximo?.id).toBe("tarde1");
  });

  it("realizados hoje: só o que já passou COM hora; date-only pendente não conta", () => {
    expect(resultado.realizadosHoje).toBe(1); // "manha"
  });

  it("realizados na semana: de segunda 00:00 SP até agora", () => {
    expect(resultado.realizadosSemana).toBe(2); // "ontem" (segunda) + "manha"
  });

  it("dia sem nada restante: lista vazia e proximo null", () => {
    const fimDoDia = classificar(cenario, Date.parse("2026-09-02T02:45:00Z")); // ter 23:45 SP
    expect(fimDoDia.proximosHoje.map((l) => l.id)).toEqual(["sem-hora-hoje"]);
    expect(fimDoDia.proximo).toBeNull();
    expect(fimDoDia.realizadosHoje).toBe(4); // manha, tarde1, tarde2, noite
  });
});

describe("agregarItens", () => {
  const hoje = leilao("hoje", "2026-09-01T09:00:00-03:00");
  const segunda = leilao("segunda", "2026-08-31T10:00:00-03:00");
  const porId = new Map([
    ["hoje", hoje],
    ["segunda", segunda],
  ]);

  const item = (
    id: string,
    leilaoId: string | null,
    resultadoItem: string | null,
    lanceUnitario: number | null = 100,
    quantidade: number | null = 2,
  ): ItemLeilao => ({ id, leilaoId, resultadoItem, lanceUnitario, quantidade });

  it("conta por item, faturamento = lance × quantidade dos GANHOs", () => {
    const { dia, semana } = agregarItens(
      [
        item("a", "hoje", "GANHO", 100, 2), // 200 hoje
        item("b", "hoje", "PERDIDO"),
        item("c", "segunda", "GANHO", 50, 4), // 200 segunda
        item("d", "segunda", "AGUARDANDO"),
        item("e", "segunda", "CANCELADO"),
      ],
      porId,
      AGORA,
    );

    expect(dia).toEqual({
      itensGanhos: 1,
      faturamento: 200,
      itensDisputados: 2,
      aproveitamento: 0.5,
    });
    expect(semana).toEqual({
      itensGanhos: 2,
      faturamento: 400,
      itensDisputados: 3,
      aproveitamento: 2 / 3,
    });
  });

  it("lance ou quantidade nulos valem 0 no faturamento, mas o ganho conta", () => {
    const { semana } = agregarItens([item("a", "segunda", "GANHO", null, null)], porId, AGORA);
    expect(semana.itensGanhos).toBe(1);
    expect(semana.faturamento).toBe(0);
  });

  it("nada disputado → aproveitamento 0, sem divisão por zero", () => {
    const { dia, semana } = agregarItens([item("a", "hoje", "AGUARDANDO")], porId, AGORA);
    expect(dia.aproveitamento).toBe(0);
    expect(semana.aproveitamento).toBe(0);
  });

  it("item órfão fica só na semana", () => {
    const { dia, semana } = agregarItens([item("a", null, "GANHO")], porId, AGORA);
    expect(dia.itensGanhos).toBe(0);
    expect(semana.itensGanhos).toBe(1);
  });
});
