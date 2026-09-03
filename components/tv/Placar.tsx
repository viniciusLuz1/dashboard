/**
 * Fase 2 (agregados de itens ganhos/faturamento) — ligada na tela por
 * rotação: aparece por alguns segundos entre uma contagem e outra, nunca
 * durante o alerta T-10 (isso o TvClient decide, aqui só desenha).
 */

export type PlacarProps = {
  diaItensGanhos: number;
  diaFaturamento: number;
  diaItensDisputados: number;
  diaAproveitamento: number;
  semanaItensGanhos: number;
  semanaItensDisputados: number;
  semanaAproveitamento: number;
  /** Pedidos de compra chegados na semana (Supabase) — não o valor GANHO no leilão. null = origem indisponível. */
  semanaFaturamentoReal: number | null;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const pct = (razao: number): string => `${Math.round(razao * 100)}%`;

type ColunaProps = {
  periodo: string;
  itensGanhos: number;
  faturamentoRotulo: string;
  faturamento: number | null;
  itensDisputados: number;
  aproveitamento: number;
};

function Coluna({
  periodo,
  itensGanhos,
  faturamentoRotulo,
  faturamento,
  itensDisputados,
  aproveitamento,
}: ColunaProps) {
  return (
    <div className="placar__coluna">
      <p className="placar__periodo">{periodo}</p>
      <div className="placar__stat">
        <p className="placar__valor">{itensGanhos}</p>
        <p className="placar__rotulo">itens ganhos</p>
      </div>
      <div className="placar__stat">
        <p className="placar__valor">{faturamento === null ? "—" : brl.format(faturamento)}</p>
        <p className="placar__rotulo">{faturamentoRotulo}</p>
      </div>
      <div className="placar__stat">
        <p className="placar__valor">{pct(aproveitamento)}</p>
        <p className="placar__rotulo">
          aproveitamento · {itensDisputados} disputados
        </p>
      </div>
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
          itensGanhos={props.diaItensGanhos}
          faturamentoRotulo="faturamento"
          faturamento={props.diaFaturamento}
          itensDisputados={props.diaItensDisputados}
          aproveitamento={props.diaAproveitamento}
        />
        <Coluna
          periodo="SEMANA"
          itensGanhos={props.semanaItensGanhos}
          faturamentoRotulo="faturamento (pedidos)"
          faturamento={props.semanaFaturamentoReal}
          itensDisputados={props.semanaItensDisputados}
          aproveitamento={props.semanaAproveitamento}
        />
      </div>
    </section>
  );
}
