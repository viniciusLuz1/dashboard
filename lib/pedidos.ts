/**
 * Faturamento REAL da semana — não vem do que foi GANHO no leilão (Notion),
 * vem do que virou pedido de compra autorizado pelo cliente. Nem todo item
 * ganho gera pedido, e o valor autorizado pode ser menor que o disputado;
 * mostrar o valor do leilão como "faturamento" divergiria do que de fato
 * foi confirmado. Fonte: tabela `pedidos` do app pedidos-internos (Supabase,
 * outro sistema, lançado manualmente pela equipe) — chave `data_chegada` é
 * a data em que a autorização do cliente chegou.
 *
 * Não há join com RC/leilão: `numero_pedido` é o número do pedido de compra
 * do cliente (ex. "4501964374"), formato sem relação com a RC de 8 dígitos
 * usada no restante do painel. A soma é por período, não por leilão.
 */

type LinhaPedido = { valor_pedido: number | null };

/** Soma de valor_pedido para pedidos não deletados com data_chegada em [inicioISO, fimISO] (inclusive, "YYYY-MM-DD"). */
export async function buscarFaturamentoPedidosChegados(
  inicioISO: string,
  fimISO: string,
): Promise<number> {
  const url = process.env.PEDIDOS_SUPABASE_URL;
  const key = process.env.PEDIDOS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "PEDIDOS_SUPABASE_URL/PEDIDOS_SUPABASE_SERVICE_ROLE_KEY não configurados",
    );
  }

  const params = new URLSearchParams();
  params.set("select", "valor_pedido");
  params.set("deleted_at", "is.null");
  params.append("data_chegada", `gte.${inicioISO}`);
  params.append("data_chegada", `lte.${fimISO}`);

  const resposta = await fetch(`${url}/rest/v1/pedidos?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!resposta.ok) {
    throw new Error(`Supabase pedidos respondeu ${resposta.status}`);
  }

  const linhas = (await resposta.json()) as LinhaPedido[];
  return linhas.reduce((soma, linha) => soma + (linha.valor_pedido ?? 0), 0);
}
