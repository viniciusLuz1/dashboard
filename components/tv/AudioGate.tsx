"use client";

import { destravarAudio, tocarAviso } from "./beeps";

/**
 * O Silk (Chromium) bloqueia áudio até um gesto do usuário — e numa TV
 * ninguém clica em nada. Esta tela de boot pede UM clique no controle do
 * Fire Stick, uma vez por sessão, e destrava o AudioContext no handler.
 */

type Props = {
  onAtivado: (ctx: AudioContext) => void;
};

// Silk pode expor apenas o construtor prefixado.
type JanelaComAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export function AudioGate({ onAtivado }: Props) {
  function ativar() {
    const Construtor =
      window.AudioContext ?? (window as JanelaComAudio).webkitAudioContext;
    if (!Construtor) return; // sem Web Audio não há o que destravar

    const ctx = new Construtor();
    // Tudo dentro do gesto: resume + buffer silencioso + um bipe audível
    // de confirmação — quem clicou OUVE que o som funcionou.
    void ctx.resume().then(() => {
      destravarAudio(ctx);
      tocarAviso(ctx);
    });
    onAtivado(ctx);
  }

  return (
    <div className="audio-gate">
      <h1>Dashboard de Leilões</h1>
      <p>O navegador bloqueia som até um clique.</p>
      <button type="button" autoFocus onClick={ativar}>
        ATIVAR SOM
      </button>
      <p className="audio-gate__dica">
        Pressione o botão central do controle do Fire&nbsp;Stick
      </p>
    </div>
  );
}
