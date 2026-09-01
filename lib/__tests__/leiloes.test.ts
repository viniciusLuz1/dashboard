import { describe, expect, it } from "vitest";
import { extrairRC, parseDataNotion, parseItem, parseLeilao } from "../leiloes";
import { mesmoDia } from "../tempo";

describe("extrairRC", () => {
  it("extrai a RC de 8 dígitos embutida no título", () => {
    expect(extrairRC("CAFÉ RC(10911572) - TOTTAL")).toBe("10911572");
    expect(extrairRC("EXTINTOR RC(10911392 - REPROCESSO) - TOTTAL")).toBe("10911392");
  });

  it("sem match retorna null (a tela mostra o título inteiro)", () => {
    expect(extrairRC("SECADORA DE ROUPA")).toBeNull();
    expect(extrairRC("PEDIDO 1234")).toBeNull(); // 4 dígitos não é RC
  });
});

describe("parseDataNotion", () => {
  it("data com hora preserva o offset vindo do Notion", () => {
    const r = parseDataNotion("2026-09-04T10:10:00.000-03:00");
    expect(r.semHora).toBe(false);
    expect(r.epochMs).toBe(Date.parse("2026-09-04T13:10:00Z"));
  });

  it("date-only vira meia-noite de SÃO PAULO, não meia-noite UTC", () => {
    const r = parseDataNotion("2026-09-04");
    expect(r.semHora).toBe(true);
    // Meia-noite UTC de 04/09 ainda é 21h de 03/09 no Brasil. Se alguém
    // trocar por Date.parse cru, o leilão cai no dia errado e este teste quebra.
    expect(r.epochMs).toBe(Date.parse("2026-09-04T03:00:00Z"));
    expect(mesmoDia(r.epochMs!, Date.parse("2026-09-04T12:00:00Z"))).toBe(true);
  });

  it("sem data", () => {
    expect(parseDataNotion(null)).toEqual({ dataISO: null, epochMs: null, semHora: false });
  });
});

const paginaLeilao = {
  id: "abc-123",
  properties: {
    Name: { type: "title", title: [{ plain_text: "CAFÉ RC(10911572) - TOTTAL" }] },
    Data: { type: "date", date: { start: "2026-09-04T10:10:00.000-03:00" } },
    Status: { type: "status", status: { name: "AGENDADO" } },
    CIDADE: { type: "multi_select", multi_select: [{ name: "SANTOS -SP" }, { name: "SANTOS" }] },
    RESULTADO: { type: "select", select: null },
  },
};

describe("parseLeilao", () => {
  it("normaliza a página do Notion", () => {
    const leilao = parseLeilao(paginaLeilao);
    expect(leilao).toMatchObject({
      id: "abc-123",
      nome: "CAFÉ RC(10911572) - TOTTAL",
      rc: "10911572",
      cidade: "SANTOS -SP", // primeiro valor, cru — sem normalizar (Fase 1)
      status: "AGENDADO",
      resultado: null,
      semHora: false,
    });
    expect(leilao.epochMs).toBe(Date.parse("2026-09-04T13:10:00Z"));
  });

  it("propriedades ausentes não explodem", () => {
    const leilao = parseLeilao({ id: "x", properties: {} });
    expect(leilao.nome).toBe("(sem título)");
    expect(leilao.rc).toBeNull();
    expect(leilao.epochMs).toBeNull();
  });
});

describe("parseItem", () => {
  it("lê relação, números e resultado", () => {
    const item = parseItem({
      id: "item-1",
      properties: {
        "Leilão": { type: "relation", relation: [{ id: "abc-123" }] },
        Quantidade: { type: "number", number: 4 },
        "Lance Unitário": { type: "number", number: 250.5 },
        "Resultado do Item": { type: "select", select: { name: "GANHO" } },
      },
    });
    expect(item).toEqual({
      id: "item-1",
      leilaoId: "abc-123",
      quantidade: 4,
      lanceUnitario: 250.5,
      resultadoItem: "GANHO",
    });
  });

  it("item órfão (sem leilão) e campos vazios", () => {
    const item = parseItem({ id: "item-2", properties: {} });
    expect(item.leilaoId).toBeNull();
    expect(item.quantidade).toBeNull();
    expect(item.resultadoItem).toBeNull();
  });
});
