import { Client, extractNotionId } from "@notionhq/client";

/**
 * Único ponto de contato com o SDK do Notion. O token só existe no processo
 * do servidor (rota de API / scripts) — nunca chega ao client.
 *
 * A API 2025-09-03 consulta *data sources*, não databases: os IDs nas env
 * vars são de database (como aparecem na URL do Notion) e a primeira data
 * source de cada um é resolvida aqui uma única vez por processo.
 */

let cliente: Client | null = null;

export function notion(): Client {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "NOTION_TOKEN não está definido. Preencha .env.local (local) ou as variáveis de ambiente da Vercel.",
    );
  }
  cliente ??= new Client({ auth: token, timeoutMs: 15_000 });
  return cliente;
}

export type BaseConhecida = "NOTION_DB_LEILOES" | "NOTION_DB_ITENS";

const dataSourcesResolvidas = new Map<BaseConhecida, string>();

export async function dataSourceId(base: BaseConhecida): Promise<string> {
  const resolvida = dataSourcesResolvidas.get(base);
  if (resolvida) return resolvida;

  const bruto = process.env[base]?.trim();
  if (!bruto) {
    throw new Error(`${base} não está definido nas variáveis de ambiente.`);
  }
  const databaseId = extractNotionId(bruto);
  if (!databaseId) {
    throw new Error(`${base} não é um ID nem uma URL válida do Notion.`);
  }

  const database = await notion().databases.retrieve({
    database_id: databaseId,
  });
  const primeira = database.data_sources?.[0];
  if (!primeira?.id) {
    throw new Error(
      `A database de ${base} não expôs nenhuma data source — confira se a integração tem acesso a ela no Notion (menu ··· → Conexões).`,
    );
  }

  dataSourcesResolvidas.set(base, primeira.id);
  return primeira.id;
}
