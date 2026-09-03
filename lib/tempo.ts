import { TZDate } from "@date-fns/tz";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

/**
 * Todo cálculo de "hoje", "semana" e "agora" passa por aqui, resolvido em
 * America/Sao_Paulo. A Vercel roda em UTC: um `new Date()` cru faria "hoje"
 * começar às 21h do dia anterior no horário de Brasília. Os testes deste
 * módulo existem para impedir exatamente essa regressão.
 */
export const FUSO = "America/Sao_Paulo";

/** Instante em milissegundos ou Date — tudo é normalizado para TZDate em SP. */
export type Instante = number | Date;

const emSaoPaulo = (instante: Instante): TZDate =>
  new TZDate(
    typeof instante === "number" ? instante : instante.getTime(),
    FUSO,
  );

export const agora = (): TZDate => TZDate.tz(FUSO);

/** 00:00:00.000 do dia de `ref` no horário de São Paulo. */
export const inicioDoDia = (ref: Instante): TZDate =>
  startOfDay(emSaoPaulo(ref));

/** 23:59:59.999 do dia de `ref` no horário de São Paulo. */
export const fimDoDia = (ref: Instante): TZDate => endOfDay(emSaoPaulo(ref));

/** Segunda-feira 00:00:00.000 da semana de `ref`, horário de São Paulo. */
export const inicioDaSemana = (ref: Instante): TZDate =>
  startOfWeek(emSaoPaulo(ref), { weekStartsOn: 1 });

/** Domingo 23:59:59.999 da semana de `ref`, horário de São Paulo. */
export const fimDaSemana = (ref: Instante): TZDate =>
  endOfWeek(emSaoPaulo(ref), { weekStartsOn: 1 });

/** `a` e `b` caem no mesmo dia-calendário de São Paulo? */
export const mesmoDia = (a: Instante, b: Instante): boolean =>
  inicioDoDia(a).getTime() === inicioDoDia(b).getTime();

/** Dia 1, 00:00:00.000 do mês de `ref`, horário de São Paulo. */
export const inicioDoMes = (ref: Instante): TZDate => startOfMonth(emSaoPaulo(ref));

/** Último dia do mês de `ref`, 23:59:59.999, horário de São Paulo. */
export const fimDoMes = (ref: Instante): TZDate => endOfMonth(emSaoPaulo(ref));

/** Um instante dentro do mês anterior ao de `ref` — combine com inicioDoMes/fimDoMes. */
export const mesAnterior = (ref: Instante): TZDate => subMonths(emSaoPaulo(ref), 1);

/** ISO 8601 com offset (-03:00) — formato que o filtro de data do Notion aceita. */
export const paraISOComOffset = (instante: Instante): string =>
  emSaoPaulo(instante).toISOString();

/** "YYYY-MM-DD" do dia de `ref` em São Paulo — para comparar com colunas `date` (sem hora) de outros sistemas, ex. Supabase. */
export const paraDataSP = (ref: Instante): string =>
  format(emSaoPaulo(ref), "yyyy-MM-dd");
