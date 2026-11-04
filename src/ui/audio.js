// Sounds are synthesised, so there is nothing to download and nothing to license.

export class Sound {
  constructor(enabled) {
    this.enabled = enabled;
    this.ctx = null;
  }

  /** Browsers only allow audio to start from within a user's gesture. */
  unlock() {
    if (!this.enabled) return;
    this.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** A short filtered burst of noise: every mechanical click is a variation on it. */
  #burst(freq, gain, seconds = 0.03) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const { ctx } = this;
    const length = Math.ceil(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 3;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    source.connect(filter).connect(amp).connect(ctx.destination);
    source.start();
  }

  place() { this.#burst(2600, 0.55, 0.05); }
  turn() { this.#burst(4200, 0.35, 0.025); }
  wrong() { this.#burst(500, 0.5, 0.09); }
  ratchet() { this.#burst(3400, 0.5, 0.02); }
  tick() { this.#burst(5200, 0.1, 0.012); }
}

export function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is a nicety. Some browsers refuse it outright.
  }
}
