"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { verificarAlarmes } from "@/lib/alarmes";
import { FUSO, inicioDoDia } from "@/lib/tempo";
import {
  derivarVisao,
  formatarContagem,
  type DadosTV,
  type LeilaoTV,
} from "@/lib/visao";
import { AudioGate } from "./AudioGate";
import { tocarAlarme, tocarAviso } from "./beeps";

/**
 * Roda o dia inteiro numa TV sem ninguém por perto:
 * - fetch de /api/leiloes a cada 60s;
 * - tick de 1s recalcula a visão (lib/visao) sem refetch;
 * - alarmes verificados no tick, com dedup que vive numa ref;
 * - reload às 4h da manhã (pega deploy novo e limpa memória acumulada);
 * - wakeLock se o Silk tiver; erro de fetch NUNCA congela a tela em silêncio.
 */

type RespostaAPI = DadosTV & {
  agoraEpochMs: number;
  erro: string | null;
};

const FETCH_MS = 60_000;
const DEZ_MIN_MS = 10 * 60_000;
/** Sem resposta há mais que isto, a tela avisa mesmo sem erro explícito. */
const LIMITE_SILENCIO_MS = 3 * 60_000;

const horaSP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  hour: "2-digit",
  minute: "2-digit",
});
const diaSP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

const formatarHora = (leilao: LeilaoTV): string =>
  leilao.semHora || leilao.epochMs === null
    ? "—:—"
    : horaSP.format(leilao.epochMs);

export function TvClient() {
  const [dados, setDados] = useState<RespostaAPI | null>(null);
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  const [falhaFetch, setFalhaFetch] = useState<string | null>(null);
  const [audioAtivo, setAudioAtivo] = useState(false);
  const [mudo, setMudo] = useState(false);

  /** Última resposta boa, no relógio do servidor — dispara o banner de silêncio. */
  const [ultimoOkMs, setUltimoOkMs] = useState<number | null>(null);

  const dadosRef = useRef<RespostaAPI | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const disparadosRef = useRef(new Set<string>());
  /** Diferença relógio servidor − relógio da TV, medida a cada fetch. */
  const desvioRef = useRef(0);
  const demoRef = useRef<LeilaoTV | null>(null);

  const agoraCorrigido = useCallback(
    () => Date.now() + desvioRef.current,
    [],
  );

  // ── Fetch a cada 60s ──
  useEffect(() => {
    let ativo = true;

    // Modo de teste na parede: /tv?demo=90 injeta um pregão falso daqui a
    // 90s para conferir contagem, mudança visual e os dois alarmes na TV real.
    const segundos = Number(
      new URLSearchParams(window.location.search).get("demo"),
    );
    if (Number.isFinite(segundos) && segundos > 0) {
      const epochMs = Date.now() + segundos * 1000;
      demoRef.current = {
        id: "demo-teste",
        nome: "TESTE DE ALARME (demo)",
        rc: null,
        cidade: null,
        horarioISO: new Date(epochMs).toISOString(),
        epochMs,
        semHora: false,
      };
    }

    async function buscar() {
      try {
        const resposta = await fetch("/api/leiloes", { cache: "no-store" });
        const corpo = (await resposta.json()) as RespostaAPI;
        if (!ativo) return;
        if (!resposta.ok) {
          throw new Error(corpo.erro ?? `HTTP ${resposta.status}`);
        }
        desvioRef.current = corpo.agoraEpochMs - Date.now();
        setUltimoOkMs(corpo.agoraEpochMs);
        if (demoRef.current) {
          corpo.proximosHoje = [...corpo.proximosHoje, demoRef.current];
        }
        dadosRef.current = corpo;
        setDados(corpo);
        setFalhaFetch(null);
      } catch (erro) {
        if (!ativo) return;
        setFalhaFetch(erro instanceof Error ? erro.message : String(erro));
      }
    }

    void buscar();
    const timer = setInterval(() => void buscar(), FETCH_MS);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, []);

  // ── Tick de 1s: relógio, alarmes, resume do áudio, reload das 4h ──
  useEffect(() => {
    const proxima4h = () => {
      const hoje4h = inicioDoDia(agoraCorrigido()).getTime() + 4 * 3_600_000;
      return hoje4h > agoraCorrigido() ? hoje4h : hoje4h + 24 * 3_600_000;
    };
    const alvoReload = proxima4h();

    const timer = setInterval(() => {
      const nowMs = agoraCorrigido();
      setAgoraMs(nowMs);

      if (nowMs >= alvoReload) {
        window.location.reload();
        return;
      }

      const atual = dadosRef.current;
      if (atual) {
        const { alarmaveis } = derivarVisao(atual, nowMs);
        const disparos = verificarAlarmes(alarmaveis, nowMs, disparadosRef.current);
        const ctx = audioRef.current;
        for (const disparo of disparos) {
          disparadosRef.current.add(disparo.chave);
          if (ctx && ctx.state === "running") {
            (disparo.tipo === "t0" ? tocarAlarme : tocarAviso)(ctx);
          }
        }
      }

      // AudioContext pode ser suspenso após horas ociosas. Tenta voltar; se
      // não der, a tela pelo menos avisa que está muda.
      const ctx = audioRef.current;
      if (ctx) {
        if (ctx.state === "suspended") {
          void ctx.resume().catch(() => undefined);
          setMudo(true);
        } else {
          setMudo(false);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [agoraCorrigido]);

  // ── wakeLock: melhor esforço, ausência não quebra nada (Silk pode não ter) ──
  useEffect(() => {
    let sentinela: { release?: () => Promise<void> } | null = null;

    async function requisitar() {
      try {
        sentinela = await navigator.wakeLock?.request("screen");
      } catch {
        // Sem suporte ou negado: a TV do Fire Stick já não dorme com vídeo ativo.
      }
    }

    void requisitar();
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void requisitar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      void sentinela?.release?.();
    };
  }, []);

  if (!audioAtivo) {
    return (
      <AudioGate
        onAtivado={(ctx) => {
          audioRef.current = ctx;
          setAudioAtivo(true);
        }}
      />
    );
  }

  if (!dados) {
    return (
      <main className="tv">
        <p className="tv__carregando">
          {falhaFetch
            ? `Sem conexão com a API — ${falhaFetch}`
            : "Carregando leilões…"}
        </p>
      </main>
    );
  }

  const visao = derivarVisao(dados, agoraMs);
  const { hero } = visao;

  const faltamMs = hero?.epochMs != null ? hero.epochMs - agoraMs : null;
  const emAlerta =
    faltamMs !== null && faltamMs <= DEZ_MIN_MS && visao.heroEhDeHoje;
  const agoraMesmo = faltamMs !== null && faltamMs <= 0;

  // agoraMs e ultimoOkMs estão ambos no relógio do servidor — comparáveis.
  const silencioMs = ultimoOkMs === null ? 0 : agoraMs - ultimoOkMs;
  const problema =
    falhaFetch ?? dados.erro ?? (silencioMs > LIMITE_SILENCIO_MS ? "sem resposta da API" : null);

  const MAX_LISTA = 4;
  const listaVisivel = visao.lista.slice(0, MAX_LISTA);
  const ocultos = visao.lista.length - listaVisivel.length;

  return (
    <main className={`tv${emAlerta ? " tv--alerta" : ""}`}>
      {problema && ultimoOkMs !== null && (
        <div className="banner-erro" role="alert">
          DADOS DESATUALIZADOS — última atualização às {horaSP.format(ultimoOkMs)}{" "}
          ({problema})
        </div>
      )}

      <section className="hero">
        {hero ? (
          <>
            <p className="hero__rotulo">
              {visao.heroEhDeHoje
                ? agoraMesmo
                  ? "PREGÃO ABRINDO"
                  : "PRÓXIMO PREGÃO"
                : `PRÓXIMO PREGÃO — ${hero.epochMs ? diaSP.format(hero.epochMs) : "data a confirmar"}`}
            </p>
            <p className="hero__contagem">
              {hero.semHora || faltamMs === null
                ? "—:—:—"
                : agoraMesmo
                  ? "AGORA"
                  : formatarContagem(faltamMs)}
            </p>
            <p className="hero__nome">{hero.rc ? `RC ${hero.rc}` : hero.nome}</p>
            <p className="hero__detalhe">
              {hero.rc ? `${hero.nome} · ` : ""}
              {hero.semHora ? "horário não informado" : horaSP.format(hero.epochMs!)}
              {hero.cidade ? ` · ${hero.cidade}` : ""}
            </p>
          </>
        ) : (
          <>
            <p className="hero__rotulo">HOJE</p>
            <p className="hero__vazio">NENHUM LEILÃO RESTANTE HOJE</p>
          </>
        )}
      </section>

      <section className="lista">
        {listaVisivel.length > 0 && (
          <ul>
            {listaVisivel.map((leilao) => (
              <li key={leilao.id}>
                <span className="lista__hora">{formatarHora(leilao)}</span>
                {/* O nome já carrega a RC embutida — prefixá-la duplicaria. */}
                <span className="lista__nome">{leilao.nome}</span>
                <span className="lista__cidade">
                  {leilao.semHora ? "horário não informado" : (leilao.cidade ?? "")}
                </span>
              </li>
            ))}
          </ul>
        )}
        {ocultos > 0 && <p className="lista__mais">+{ocultos} mais tarde</p>}
      </section>

      <footer className="rodape">
        <span>
          HOJE <strong>{visao.realizadosHoje}</strong> realizados
        </span>
        <span>
          SEMANA <strong>{visao.realizadosSemana}</strong> realizados
        </span>
        {mudo && <span className="rodape__mudo">🔇 SEM SOM</span>}
        <span className="rodape__hora">{horaSP.format(agoraMs)}</span>
      </footer>
    </main>
  );
}
