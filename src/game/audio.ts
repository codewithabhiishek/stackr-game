/* Tiny WebAudio synth for game feedback — no assets, all oscillators. */

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Call from a user gesture so iOS/Chrome unlock audio. */
  unlock() {
    this.ensure();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    vol: number,
    delay = 0,
  ) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  ui() {
    this.tone("square", 640, 880, 0.07, 0.1);
  }

  place() {
    this.tone("triangle", 170, 55, 0.14, 0.5);
    this.tone("sine", 340, 120, 0.08, 0.14);
  }

  perfect(combo: number) {
    const f = 440 * Math.pow(1.059, Math.min(combo, 24) * 2);
    this.tone("sine", f, f, 0.09, 0.2);
    this.tone("sine", f * 1.5, f * 1.5, 0.12, 0.18, 0.055);
    this.tone("triangle", f * 2, f * 2.02, 0.1, 0.07, 0.11);
  }

  slice() {
    this.tone("sawtooth", 240, 48, 0.22, 0.24);
  }

  collapse() {
    this.tone("sawtooth", 320, 26, 0.7, 0.36);
    this.tone("square", 180, 22, 0.8, 0.16, 0.05);
  }

  over() {
    [392, 311, 233, 155].forEach((f, i) =>
      this.tone("triangle", f, f * 0.93, 0.17, 0.2, i * 0.13),
    );
  }

  milestone() {
    this.tone("sine", 660, 990, 0.16, 0.16);
    this.tone("sine", 990, 1320, 0.2, 0.12, 0.1);
  }
}

export const sfx = new Sfx();
