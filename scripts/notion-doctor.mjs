// Diagnóstico da conexão com o Notion. Rode com: npm run notion:doctor
// Nunca imprime o token — só nomes, tipos e IDs.
import { Client, extractNotionId } from "@notionhq/client";

const linha = (rotulo, valor) => console.log(`  ${rotulo.padEnd(22)} ${valor}`);

async function principal() {
  const token = process.env.NOTION_TOKEN?.trim();

  console.log("\n── Configuração ──");
  linha("NOTION_TOKEN", token ? `carregado (${token.slice(0, 4)}…)` : "❌ vazio");
  linha("NOTION_DB_LEILOES", process.env.NOTION_DB_LEILOES ?? "❌ vazio");
  linha("NOTION_DB_ITENS", process.env.NOTION_DB_ITENS ?? "❌ vazio");

  if (!token) {
    console.log("\nPreencha .env.local e rode de novo.\n");
    process.exitCode = 1;
    return;
  }

  const notion = new Client({ auth: token, timeoutMs: 15_000 });

  console.log("\n── Integração ──");
  const eu = await notion.users.me();
  linha("nome", eu.name ?? eu.id);

  console.log("\n── Databases → data sources ──");
  for (const nomeEnv of ["NOTION_DB_LEILOES", "NOTION_DB_ITENS"]) {
    const id = extractNotionId(process.env[nomeEnv] ?? "");
    if (!id) {
      linha(nomeEnv, "❌ ID/URL inválido");
      continue;
    }
    try {
      const db = await notion.databases.retrieve({ database_id: id });
      const fonte = db.data_sources?.[0];
      linha(nomeEnv, `✅ ${fonte?.name ?? "?"} → data source ${fonte?.id ?? "nenhuma!"}`);
    } catch (erro) {
      linha(nomeEnv, `❌ ${erro.code ?? "erro"}: ${erro.message}`);
    }
  }

  console.log("\n── O que a integração enxerga (amostra) ──");
  const busca = await notion.search({ page_size: 10 });
  if (!busca.results.length) {
    console.log(
      "  ⚠️  Nada. No Notion: página/database → menu ··· → Conexões → adicione a integração.",
    );
  }
  for (const item of busca.results) {
    const titulo = lerTitulo(item);
    console.log(`  [${item.object.padEnd(11)}] ${titulo} — ${item.id}`);
  }
  console.log();
}

function lerTitulo(item) {
  const rico =
    item.title ?? item.properties?.title?.title ?? item.properties?.Name?.title;
  if (Array.isArray(rico) && rico.length) {
    return rico.map((t) => t.plain_text).join("");
  }
  return "(sem título)";
}

principal().catch((erro) => {
  console.error(`\n❌ ${erro.code ?? "erro"}: ${erro.message}\n`);
  process.exitCode = 1;
});
