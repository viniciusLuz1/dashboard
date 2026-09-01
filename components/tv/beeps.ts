/**
 * Sons gerados com OscillatorNode — sem arquivos, sem codec, sem asset que
 * o Silk possa falhar em carregar. Envelope de ganho curto em cada bipe
 * para não estalar o alto-falante da TV.
 */

type Bipe = {
  /** Segundos desde o início da sequência. */
  em: number;
  duracao: number;
  frequencia: number;
};

function agendar(ctx: AudioContext, bipes: Bipe[], volume: number): void {
  const inicio = ctx.currentTime + 0.02;

  for (const bipe of bipes) {
    const oscilador = ctx.createOscillator();
    const ganho = ctx.createGain();
    oscilador.type = "square";
    oscilador.frequency.value = bipe.frequencia;

    const t = inicio + bipe.em;
    ganho.gain.setValueAtTime(0, t);
    ganho.gain.linearRampToValueAtTime(volume, t + 0.01);
    ganho.gain.setValueAtTime(volume, t + bipe.duracao - 0.02);
    ganho.gain.linearRampToValueAtTime(0, t + bipe.duracao);

    oscilador.connect(ganho);
    ganho.connect(ctx.destination);
    oscilador.start(t);
    oscilador.stop(t + bipe.duracao + 0.05);
  }
}

/** T-10: dois bipes curtos, tom médio. Aviso, não emergência. */
export function tocarAviso(ctx: AudioContext): void {
  agendar(
    ctx,
    [
      { em: 0, duracao: 0.18, frequencia: 880 },
      { em: 0.3, duracao: 0.18, frequencia: 880 },
    ],
    0.3,
  );
}

/** T-0: sequência longa e insistente, alternando tons. Tem que atravessar a sala. */
export function tocarAlarme(ctx: AudioContext): void {
  const bipes: Bipe[] = [];
  for (let i = 0; i < 8; i += 1) {
    bipes.push({
      em: i * 0.38,
      duracao: 0.28,
      frequencia: i % 2 === 0 ? 1175 : 880,
    });
  }
  agendar(ctx, bipes, 0.4);
}

/**
 * O destrave de verdade: dentro do gesto do usuário, além do resume(),
 * toca-se um buffer de 1 frame — sem isso alguns Chromium "resumem" mas
 * seguem mudos até outro gesto.
 */
export function destravarAudio(ctx: AudioContext): void {
  const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  const fonte = ctx.createBufferSource();
  fonte.buffer = buffer;
  fonte.connect(ctx.destination);
  fonte.start(0);
}
