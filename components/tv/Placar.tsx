/**
 * Fase 2 — ligada na tela por rotação (aparece por alguns segundos entre
 * uma contagem e outra, nunca durante o alerta T-10; isso o TvClient
 * decide, aqui só desenha).
 *
 * HOJE vem do leilão (Notion) — itens ganhos é adjudicação, não pedido.
 * A coluna de faturamento vem de pedidos de compra chegados (Supabase, ver
 * lib/pedidos.ts): valor real autorizado pelo cliente, não o estimado no
 * leilão — os dois divergem (nem todo item ganho vira pedido, e o valor
 * autorizado pode ser menor que o disputado), por isso não se misturam.
 */

export type PlacarProps = {
  diaItensGanhos: number;
  diaFaturamento: number;
  diaItensDisputados: number;
  diaAproveitamento: number;
  semanaFaturamentoReal: number | null;
  mesFaturamentoReal: number | null;
  mesAnteriorFaturamentoReal: number | null;
  /** Nome do mês atual, já formatado pelo chamador (ex. "setembro"). */
  mesAtualLabel: string;
  /** Nome do mês anterior, já formatado pelo chamador. */
  mesAnteriorLabel: string;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const pct = (razao: number): string => `${Math.round(razao * 100)}%`;

/** null = origem indisponível — a tela mostra "—", nunca inventa um valor. */
const valorOuTraco = (valor: number | null): string =>
  valor === null ? "—" : brl.format(valor);

type Stat = { valor: string; rotulo: string };

function Coluna({ periodo, stats }: { periodo: string; stats: Stat[] }) {
  return (
    <div className="placar__coluna">
      <p className="placar__periodo">{periodo}</p>
      {stats.map((stat) => (
        <div className="placar__stat" key={stat.rotulo}>
          <p className="placar__valor">{stat.valor}</p>
          <p className="placar__rotulo">{stat.rotulo}</p>
        </div>
      ))}
    </div>
  );
}

export function Placar(props: PlacarProps) {
  return (
    <section className="placar">
      <p className="placar__titulo">PLACAR</p>
      <div className="placar__colunas">
        <Coluna
          periodo="HOJE"
          stats={[
            { valor: String(props.diaItensGanhos), rotulo: "itens ganhos" },
            { valor: brl.format(props.diaFaturamento), rotulo: "faturamento" },
            {
              valor: pct(props.diaAproveitamento),
              rotulo: `aproveitamento · ${props.diaItensDisputados} disputados`,
            },
          ]}
        />
        <Coluna
          periodo="FATURAMENTO"
          stats={[
            { valor: valorOuTraco(props.semanaFaturamentoReal), rotulo: "semana" },
            {
              valor: valorOuTraco(props.mesFaturamentoReal),
              rotulo: `mês (${props.mesAtualLabel})`,
            },
            {
              valor: valorOuTraco(props.mesAnteriorFaturamentoReal),
              rotulo: `mês anterior (${props.mesAnteriorLabel})`,
            },
          ]}
        />
      </div>
    </section>
  );
}
