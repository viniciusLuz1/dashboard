import { TZDate } from "@date-fns/tz";
import { collectPaginatedAPI } from "@notionhq/client";
import { dataSourceId, notion } from "./notion";
import { FUSO, paraISOComOffset } from "./tempo";

/**
 * Busca e normalização dos dados do Notion. Nada aqui lê fórmulas ou
 * rollups — a API de query não os retorna (observado em produção). Tudo que
 * é calculado vem dos campos crus, em lib/metricas.ts.
 */

export type Leilao = {
  id: string;
  /** Título completo do card. */
  nome: string;
  /** RC de 8 dígitos extraída do título, ou null (aí exibe-se o nome inteiro). */
  rc: string | null;
  /** Primeiro valor de CIDADE, cru — a propriedade tem ~60 grafias da mesma cidade. */
  cidade: string | null;
  status: string | null;
  resultado: string | null;
  /** Valor original de Data.start no Notion (com offset, ou date-only). */
  dataISO: string | null;
  /**
   * Epoch ms do pregão. Para registros sem hora, é a meia-noite do dia em
   * São Paulo — serve APENAS para classificar o dia; contagem regressiva e
   * alarme ignoram registros com semHora.
   */
  epochMs: number | null;
  /** true quando Data é date-only ("2026-09-04"): "horário não informado". */
  semHora: boolean;
};

export type ItemLeilao = {
  id: string;
  /** Primeiro leilão relacionado — a data do item vem dele. */
  leilaoId: string | null;
  quantidade: number | null;
  lanceUnitario: number | null;
  /** AGUARDANDO | GANHO | PERDIDO | CANCELADO */
  resultadoItem: string | null;
};

// ── Parse (funções puras, testadas em __tests__/leiloes.test.ts) ──

/** A RC vive embutida no título: "CAFÉ RC(10911572) - TOTTAL" → "10911572". */
export function extrairRC(titulo: string): string | null {
  return titulo.match(/\d{8}/)?.[0] ?? null;
}

/**
 * Data do Notion → epoch. Date-only é resolvido como meia-noite de São
 * Paulo: um Date.parse("2026-09-04") cru daria meia-noite UTC, que ainda é
 * 21h do dia ANTERIOR no Brasil — o leilão apareceria no dia errado.
 */
export function parseDataNotion(
  bruto: string | null | undefined,
): Pick<Leilao, "dataISO" | "epochMs" | "semHora"> {
  if (!bruto) return { dataISO: null, epochMs: null, semHora: false };

  if (bruto.includes("T")) {
    return { dataISO: bruto, epochMs: Date.parse(bruto), semHora: false };
  }

  const [ano, mes, dia] = bruto.split("-").map(Number);
  const meiaNoiteSP = new TZDate(ano, mes - 1, dia, FUSO);
  return { dataISO: bruto, epochMs: meiaNoiteSP.getTime(), semHora: true };
}

// Leitores defensivos: o union de tipos do SDK é impraticável aqui e o
// schema pode ganhar campos — ler pelo nome e tipo esperados basta.
type Propriedades = Record<string, { type?: string } & Record<string, unknown>>;
type PaginaNotion = { id: string; properties?: Propriedades };

const texto = (rico: unknown): string =>
  Array.isArray(rico)
    ? rico.map((parte) => (parte as { plain_text?: string }).plain_text ?? "").join("")
    : "";

const nomeDeSelect = (propriedade: unknown): string | null =>
  ((propriedade as { name?: string } | null)?.name ?? null);

export function parseLeilao(pagina: PaginaNotion): Leilao {
  const p = pagina.properties ?? {};
  const nome = texto(p["Name"]?.title) || "(sem título)";
  const dataBruta = (p["Data"]?.date as { start?: string } | null)?.start;
  const cidades = (p["CIDADE"]?.multi_select as { name?: string }[] | undefined) ?? [];

  return {
    id: pagina.id,
    nome,
    rc: extrairRC(nome),
    cidade: cidades[0]?.name ?? null,
    status: nomeDeSelect(p["Status"]?.status),
    resultado: nomeDeSelect(p["RESULTADO"]?.select),
    ...parseDataNotion(dataBruta),
  };
}

export function parseItem(pagina: PaginaNotion): ItemLeilao {
  const p = pagina.properties ?? {};
  const relacoes = (p["Leilão"]?.relation as { id?: string }[] | undefined) ?? [];

  return {
    id: pagina.id,
    leilaoId: relacoes[0]?.id ?? null,
    quantidade: (p["Quantidade"]?.number as number | null) ?? null,
    lanceUnitario: (p["Lance Unitário"]?.number as number | null) ?? null,
    resultadoItem: nomeDeSelect(p["Resultado do Item"]?.select),
  };
}

// ── Busca ──

const ehPaginaCompleta = (item: { object?: string }): boolean =>
  item.object === "page" && "properties" in item;

/** Leilões com Data dentro de [inicio, fim], ordenados por Data. Nunca a base inteira. */
export async function buscarLeiloesEntre(
  inicio: Date,
  fim: Date,
): Promise<Leilao[]> {
  const fonte = await dataSourceId("NOTION_DB_LEILOES");
  const paginas = await collectPaginatedAPI(notion().dataSources.query, {
    data_source_id: fonte,
    filter: {
      and: [
        { property: "Data", date: { on_or_after: paraISOComOffset(inicio) } },
        { property: "Data", date: { on_or_before: paraISOComOffset(fim) } },
      ],
    },
    sorts: [{ property: "Data", direction: "ascending" }],
    page_size: 100,
  });

  return paginas.filter(ehPaginaCompleta).map((pagina) => parseLeilao(pagina as PaginaNotion));
}

/** O primeiro leilão com Data >= aPartirDe — para quando hoje já acabou. */
export async function buscarProximoFuturo(aPartirDe: Date): Promise<Leilao | null> {
  const fonte = await dataSourceId("NOTION_DB_LEILOES");
  const resposta = await notion().dataSources.query({
    data_source_id: fonte,
    filter: { property: "Data", date: { on_or_after: paraISOComOffset(aPartirDe) } },
    sorts: [{ property: "Data", direction: "ascending" }],
    page_size: 1,
  });

  const pagina = resposta.results.find(ehPaginaCompleta);
  return pagina ? parseLeilao(pagina as PaginaNotion) : null;
}

/** Itens cujo Leilão está entre os IDs dados (Fase 2). Chunks de 100 — limite de condições do filtro composto. */
export async function buscarItensDosLeiloes(
  leilaoIds: string[],
): Promise<ItemLeilao[]> {
  if (leilaoIds.length === 0) return [];
  const fonte = await dataSourceId("NOTION_DB_ITENS");

  const itens: ItemLeilao[] = [];
  for (let i = 0; i < leilaoIds.length; i += 100) {
    const chunk = leilaoIds.slice(i, i + 100);
    const paginas = await collectPaginatedAPI(notion().dataSources.query, {
      data_source_id: fonte,
      filter: {
        or: chunk.map((id) => ({
          property: "Leilão",
          relation: { contains: id },
        })),
      },
      page_size: 100,
    });
    itens.push(
      ...paginas.filter(ehPaginaCompleta).map((pagina) => parseItem(pagina as PaginaNotion)),
    );
  }
  return itens;
}
