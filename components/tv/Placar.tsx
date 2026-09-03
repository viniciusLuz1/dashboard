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
  semanaFaturamento: number;
  semanaItensDisputados: number;
  semanaAproveitamento: number;
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
  faturamento: number;
  itensDisputados: number;
  aproveitamento: number;
};

function Coluna({
  periodo,
  itensGanhos,
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
        <p className="placar__valor">{brl.format(faturamento)}</p>
        <p className="placar__rotulo">faturamento</p>
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
          faturamento={props.diaFaturamento}
          itensDisputados={props.diaItensDisputados}
          aproveitamento={props.diaAproveitamento}
        />
        <Coluna
          periodo="SEMANA"
          itensGanhos={props.semanaItensGanhos}
          faturamento={props.semanaFaturamento}
          itensDisputados={props.semanaItensDisputados}
          aproveitamento={props.semanaAproveitamento}
        />
      </div>
    </section>
  );
}
