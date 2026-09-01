/**
 * Cache TTL em memória. Suficiente para o caso: uma instância (ou poucas
 * lambdas quentes na Vercel), rate limit do Notion de ~3 req/s e uma TV
 * consultando a cada 60s.
 *
 * Quando o recarregamento falha e existe um valor antigo, o valor antigo é
 * devolvido marcado como obsoleto — a rota repassa isso ao cliente, que
 * avisa na tela em vez de congelar ou mentir.
 */

export type ResultadoCache<T> = {
  valor: T;
  /** Epoch ms de quando o valor foi realmente carregado da origem. */
  carregadoEm: number;
  /** true quando o TTL venceu e a origem falhou — o valor é o último válido. */
  obsoleto: boolean;
  /** Mensagem do erro de recarga, quando obsoleto. */
  erro?: string;
};

type Entrada = { valor: unknown; carregadoEm: number; expiraEm: number };

const entradas = new Map<string, Entrada>();

export async function comCache<T>(
  chave: string,
  ttlMs: number,
  carregar: () => Promise<T>,
): Promise<ResultadoCache<T>> {
  const agora = Date.now();
  const entrada = entradas.get(chave);

  if (entrada && agora < entrada.expiraEm) {
    return {
      valor: entrada.valor as T,
      carregadoEm: entrada.carregadoEm,
      obsoleto: false,
    };
  }

  try {
    const valor = await carregar();
    entradas.set(chave, { valor, carregadoEm: agora, expiraEm: agora + ttlMs });
    return { valor, carregadoEm: agora, obsoleto: false };
  } catch (erro) {
    if (entrada) {
      return {
        valor: entrada.valor as T,
        carregadoEm: entrada.carregadoEm,
        obsoleto: true,
        erro: erro instanceof Error ? erro.message : String(erro),
      };
    }
    throw erro;
  }
}

/** Só para testes. */
export const limparCache = (): void => {
  entradas.clear();
};
