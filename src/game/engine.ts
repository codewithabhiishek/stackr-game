import { sfx } from "./audio";

export type Phase = "menu" | "playing" | "paused" | "over";

export interface Hud {
  phase: Phase;
  score: number;
  best: number;
  combo: number;
  maxCombo: number;
  perfects: number;
  blocks: number;
  newBest: boolean;
  clutch: boolean;
}

interface Block {
  x: number;
  z: number;
  w: number;
  d: number;
  hue: number;
}

interface Active {
  axis: "x" | "z";
  t: number;
  dir: 1 | -1;
  x: number;
  z: number;
  w: number;
  d: number;
  hue: number;
}

interface Debris {
  x: number;
  z: number;
  w: number;
  d: number;
  hue: number;
  y: number;
  vy: number;
  dx: number;
  dz: number;
  rot: number;
  vr: number;
}

interface Particle {
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
}

interface Popup {
  x: number;
  z: number;
  y: number;
  text: string;
  life: number;
  max: number;
  size: number;
  color: string;
  center: boolean;
  rot: number;
}

type Rgb = [number, number, number];

const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
const BLOCK_H = 46;
const BASE = 240;
const PERFECT_EPS = 11;
const BEST_KEY = "stackr.best.v1";

const COMBO_WORDS: Array<[number, string]> = [
  [3, "COOKING"],
  [5, "SHEESH"],
  [7, "ON ONE"],
  [9, "UNREAL"],
  [12, "GODLIKE"],
  [15, "ACTUAL W"],
];

const SKY: Array<{ top: Rgb; bot: Rgb }> = [
  { top: [7, 12, 28], bot: [22, 52, 80] },
  { top: [6, 20, 34], bot: [24, 88, 94] },
  { top: [10, 28, 26], bot: [52, 116, 78] },
  { top: [30, 16, 20], bot: [148, 66, 58] },
  { top: [26, 12, 10], bot: [158, 96, 40] },
];

const MOTE_COLORS = ["255,94,91", "255,200,87", "83,216,255", "168,255,62"];

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function rgbOf(c: Rgb, a = 1): string {
  return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

function lerp3(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export class StackEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHud: (h: Hud) => void;

  private W = 1;
  private H = 1;
  private dpr = 1;

  private phase: Phase = "menu";
  private blocks: Block[] = [];
  private active: Active | null = null;
  private debris: Debris[] = [];
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private motes: Array<{ x: number; y: number; r: number; v: number; c: string }> = [];
  private stars: Array<{ x: number; y: number; r: number; p: number }> = [];

  private score = 0;
  private best = 0;
  private combo = 0;
  private maxCombo = 0;
  private perfects = 0;
  private peakBlocks = 0;
  private newBest = false;
  private locked = false;

  private camY = 0;
  private zoom = 1;
  private time = 0;
  private shakeT = 0;
  private shakeMag = 0;
  private flashA = 0;
  private flashRgb = "255,255,255";
  private collapseTimer = -1;
  private autoTimer = 0.8;

  private raf = 0;
  private last = 0;
  private destroyed = false;
  private ro: ResizeObserver | null = null;

  private onKeyDown = (e: KeyboardEvent) => {
    const c = e.code;
    if (c === "Space" || c === "ArrowUp" || c === "Enter") {
      e.preventDefault();
      sfx.unlock();
      if (this.phase === "playing") this.drop();
      else if (this.phase === "menu" || this.phase === "over") this.startGame();
      else if (this.phase === "paused") this.togglePause();
    } else if (c === "KeyP" || c === "Escape") {
      if (this.phase === "playing" || this.phase === "paused") this.togglePause();
    } else if (c === "KeyR") {
      if (this.phase !== "menu") this.startGame();
    }
  };

  private onPointer = () => {
    sfx.unlock();
    if (this.phase === "playing") this.drop();
  };

  private onResize = () => this.resize();

  constructor(canvas: HTMLCanvasElement, onHud: (h: Hud) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.onHud = onHud;

    try {
      this.best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
    } catch {
      this.best = 0;
    }

    this.seedAmbient();
    this.buildDemoTower();
    this.resize();

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("pointerdown", this.onPointer);

    // Re-measure whenever the stage changes size (orientation, iframe, DPR).
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
      if (canvas.parentElement) this.ro.observe(canvas.parentElement);
    }

    try {
      void document.fonts.load('16px "Bungee"');
      void document.fonts.load('700 16px "Space Grotesk"');
    } catch {
      /* fonts fall back gracefully */
    }

    this.pushHud();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    if (this.ro) {
      this.ro.disconnect();
      this.ro = null;
    }
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("pointerdown", this.onPointer);
  }

  /* ------------------------------ public API ------------------------------ */

  startGame() {
    sfx.unlock();
    this.blocks = [{ x: 0, z: 0, w: BASE, d: BASE, hue: this.hueFor(0) }];
    this.debris = [];
    this.particles = [];
    this.popups = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfects = 0;
    this.peakBlocks = 1;
    this.newBest = false;
    this.locked = false;
    this.collapseTimer = -1;
    this.camY = 0;
    this.phase = "playing";
    this.spawnActive();
    this.pushHud();
  }

  togglePause() {
    if (this.phase === "playing") this.phase = "paused";
    else if (this.phase === "paused") this.phase = "playing";
    else return;
    this.pushHud();
  }

  toMenu() {
    this.buildDemoTower();
    this.phase = "menu";
    this.score = 0;
    this.combo = 0;
    this.newBest = false;
    this.pushHud();
  }

  /* ------------------------------- internals ------------------------------ */

  private seedAmbient() {
    for (let i = 0; i < 26; i++) {
      this.motes.push({
        x: Math.random(),
        y: Math.random(),
        r: 1.5 + Math.random() * 2.6,
        v: 10 + Math.random() * 24,
        c: MOTE_COLORS[i % MOTE_COLORS.length],
      });
    }
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.7 + Math.random() * 1.5,
        p: Math.random() * Math.PI * 2,
      });
    }
  }

  private buildDemoTower() {
    const n = 9;
    this.blocks = [];
    for (let i = 0; i < n; i++) {
      this.blocks.push({
        x: (Math.random() - 0.5) * 10,
        z: (Math.random() - 0.5) * 10,
        w: BASE - 6 * i,
        d: BASE - 6 * i,
        hue: this.hueFor(i),
      });
    }
    this.peakBlocks = n;
    this.debris = [];
    this.particles = [];
    this.popups = [];
    this.locked = false;
    this.collapseTimer = -1;
    this.camY = 0;
    this.autoTimer = 0.9;
    this.spawnActive();
  }

  private spawnActive() {
    const top = this.blocks[this.blocks.length - 1];
    if (!top) {
      this.active = null;
      return;
    }
    this.active = {
      axis: this.blocks.length % 2 === 1 ? "x" : "z",
      t: Math.random() * Math.PI * 2,
      dir: (Math.random() < 0.5 ? 1 : -1) as 1 | -1,
      x: top.x,
      z: top.z,
      w: top.w,
      d: top.d,
      hue: this.hueFor(this.blocks.length),
    };
    this.syncActive();
  }

  /**
   * Writes the current slide position into the active block. This is the
   * single source of truth used by BOTH the drop logic and the renderer,
   * so what you see is exactly what lands.
   */
  private syncActive() {
    const a = this.active;
    const top = this.blocks[this.blocks.length - 1];
    if (!a || !top) return;
    const amp = this.ampFor(a);
    const off = -Math.cos(a.t) * amp * a.dir;
    if (a.axis === "x") {
      a.x = top.x + off;
      a.z = top.z;
    } else {
      a.z = top.z + off;
      a.x = top.x;
    }
  }

  private hueFor(i: number) {
    return (14 + i * 18) % 360;
  }

  private speed() {
    return Math.min(7.0, 2.4 + this.peakBlocks * 0.12);
  }

  private ampFor(a: Active) {
    // Sweep a comfortable arc — close enough to the tower that drops land and
    // the stack visibly builds, but wide enough that a miss is still possible.
    return clamp((this.W / 2 / (COS * this.zoom)) * 0.62, 240, 430);
  }

  private pushHud() {
    const a = this.active;
    const clutch =
      this.phase === "playing" && !!a && Math.min(a.w, a.d) < BASE * 0.34;
    this.onHud({
      phase: this.phase,
      score: this.score,
      best: this.best,
      combo: this.combo,
      maxCombo: this.maxCombo,
      perfects: this.perfects,
      blocks: this.peakBlocks,
      newBest: this.newBest,
      clutch,
    });
  }

  private loop = (now: number) => {
    if (this.destroyed) return;
    // If the stage reported ~0 at boot (sandboxed iframe), re-measure once
    // layout exists so the canvas never stays a blank 1px buffer.
    if (this.W < 50 || this.H < 50 || this.needsResize()) this.resize();
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    this.time += dt;
    try {
      this.update(dt);
      this.render();
    } catch (err) {
      // A single bad frame must never freeze the game — keep animating.
      console.error("[STACKR] frame error:", err);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.phase !== "paused") {
      // ambient
      for (const m of this.motes) {
        m.y -= (m.v * dt) / Math.max(1, this.H);
        if (m.y < -0.02) {
          m.y = 1.02;
          m.x = Math.random();
        }
      }
      // debris
      for (const d of this.debris) {
        d.vy -= 900 * dt;
        d.y += d.vy * dt;
        d.x += d.dx * dt;
        d.z += d.dz * dt;
        d.rot += d.vr * dt;
      }
      const gone = (d: Debris) => {
        const sy =
          this.H * 0.62 +
          (d.x + d.z) * SIN * this.zoom -
          (d.y - this.camY) * this.zoom;
        return sy > this.H + 340;
      };
      if (this.debris.length) this.debris = this.debris.filter((d) => !gone(d));
      // particles
      for (const p of this.particles) {
        p.vy += p.grav * dt;
        p.sx += p.vx * dt;
        p.sy += p.vy * dt;
        p.life += dt;
      }
      this.particles = this.particles.filter((p) => p.life < p.max);
      // popups
      for (const p of this.popups) p.life += dt;
      this.popups = this.popups.filter((p) => p.life < p.max);

      this.shakeT = Math.max(0, this.shakeT - dt * 2.2);
      this.flashA = Math.max(0, this.flashA - dt * 1.6);

      // camera + zoom
      let targetCam: number;
      if (this.phase === "menu")
        targetCam =
          Math.max(0, this.blocks.length * BLOCK_H - 300) +
          Math.sin(this.time * 0.5) * 18;
      else if (this.phase === "playing")
        targetCam = Math.max(0, this.blocks.length * BLOCK_H - 190);
      else targetCam = this.camY;
      this.camY += (targetCam - this.camY) * Math.min(1, dt * 3.2);

      const tz = clamp(1.04 - Math.max(0, this.blocks.length - 8) * 0.007, 0.7, 1.04);
      this.zoom += (tz - this.zoom) * Math.min(1, dt * 2);

      // active block motion
      if (this.phase === "playing" && this.active && !this.locked) {
        this.active.t += dt * this.speed();
        this.syncActive();
      } else if (this.phase === "menu" && this.active) {
        this.active.t += dt * 1.7;
        this.syncActive();
        this.autoTimer -= dt;
        if (this.autoTimer <= 0) {
          this.autoTimer = 1.05;
          // Demo loop: build a clean stack, then start fresh so it never
          // grows without bound behind the menu.
          if (this.blocks.length >= 15) this.buildDemoTower();
          else this.drop(true);
        }
      }

      // collapse countdown → game over screen
      if (this.collapseTimer >= 0) {
        this.collapseTimer -= dt;
        if (this.collapseTimer <= 0) this.finalizeOver();
      }
    }
  }

  private drop(auto = false) {
    const a = this.active;
    const top = this.blocks[this.blocks.length - 1];
    if (!a || !top || this.locked) return;
    if (this.phase !== "playing" && !auto) return;

    const axis = a.axis;
    const size = axis === "x" ? a.w : a.d;
    const baseSize = axis === "x" ? top.w : top.d;
    const baseC = axis === "x" ? top.x : top.z;
    const movC = axis === "x" ? a.x : a.z;
    const delta = movC - baseC;
    const overlap =
      Math.min(baseC + baseSize / 2, movC + size / 2) -
      Math.max(baseC - baseSize / 2, movC - size / 2);

    if (overlap <= 0) {
      if (!auto) this.miss();
      else this.buildDemoTower(); // menu demo: quietly rebuild instead of dying
      return;
    }

    const y = this.blocks.length * BLOCK_H;
    const perfect = auto || Math.abs(delta) <= PERFECT_EPS;
    let nw = a.w;
    let nd = a.d;
    let nx = a.x;
    let nz = a.z;

    if (perfect) {
      if (axis === "x") nx = top.x;
      else nz = top.z;
      nw = Math.min(BASE, a.w + 10);
      nd = Math.min(BASE, a.d + 10);
      if (!auto) {
        this.combo += 1;
        this.perfects += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        // PERFECT = 20 base, +5 for every heat level in the streak
        const pts = 15 + 5 * this.combo;
        this.score += pts;
        this.burst(nx, nz, y + BLOCK_H, a.hue, 26, 260);
        this.flash("255,255,255", 0.2);
        this.addShake(4 + Math.min(this.combo, 8));
        this.popups.push({
          x: nx, z: nz, y: y + BLOCK_H + 10,
          text: `+${pts} PERFECT`, life: 0, max: 0.85,
          size: 19, color: "#a8ff3e", center: false, rot: 0,
        });
        const word = this.comboWord(this.combo);
        if (word) {
          this.popups.push({
            x: 0, z: 0, y: 0, text: word, life: 0, max: 1,
            size: clamp(40 + this.combo, 40, 64),
            color: "#a8ff3e", center: true,
            rot: (Math.random() - 0.5) * 0.12,
          });
        }
        sfx.perfect(this.combo);
      } else {
        this.burst(nx, nz, y + BLOCK_H, a.hue, 8, 150);
      }
    } else {
      // SLICE = flat +10, and a hot streak is lost
      if (!auto && this.combo >= 3) {
        this.popups.push({
          x: 0, z: 0, y: 0, text: "HEAT LOST", life: 0, max: 0.9,
          size: 26, color: "#ff5e5b", center: true, rot: 0.05,
        });
      }
      this.combo = 0;
      this.score += 10;
      const lo = Math.max(baseC - baseSize / 2, movC - size / 2);
      const hi = Math.min(baseC + baseSize / 2, movC + size / 2);
      const newC = (lo + hi) / 2;
      if (axis === "x") {
        nx = newC;
        nw = hi - lo;
      } else {
        nz = newC;
        nd = hi - lo;
      }
      const cw = size - (hi - lo);
      const side = movC > baseC ? 1 : -1;
      const cc = side > 0 ? hi + cw / 2 : lo - cw / 2;
      this.debris.push(
        axis === "x"
          ? { x: cc, z: a.z, w: cw, d: a.d, hue: a.hue, y, vy: 0, dx: side * 34, dz: 0, rot: 0, vr: side * 1.5 }
          : { x: a.x, z: cc, w: a.w, d: cw, hue: a.hue, y, vy: 0, dx: 0, dz: side * 34, rot: 0, vr: -side * 1.5 },
      );
      this.burst(nx, nz, y + BLOCK_H, a.hue, 10, 170);
      this.popups.push({
        x: nx, z: nz, y: y + BLOCK_H + 8,
        text: "+10", life: 0, max: 0.7,
        size: 16, color: "#ffc857", center: false, rot: 0,
      });
      this.flash("255,255,255", 0.06);
      this.addShake(3);
      sfx.place();
    }

    this.blocks.push({ x: nx, z: nz, w: nw, d: nd, hue: a.hue });
    this.peakBlocks = this.blocks.length;

    if (!auto && this.blocks.length % 10 === 0) {
      // ALTITUDE BONUS = +30 for every 10 blocks of height
      const bonus = 30;
      this.score += bonus;
      this.popups.push({
        x: 0, z: 0, y: 0, text: `ALT ${this.blocks.length}  +${bonus}`, life: 0, max: 1.1,
        size: 30, color: "#53d8ff", center: true, rot: -0.04,
      });
      sfx.milestone();
    }

    this.spawnActive();
    if (!auto) this.pushHud();
  }

  private miss() {
    const a = this.active;
    if (!a) return;
    const y = this.blocks.length * BLOCK_H;
    this.debris.push({
      x: a.x, z: a.z, w: a.w, d: a.d, hue: a.hue, y,
      vy: 80, dx: 0, dz: 0, rot: 0,
      vr: (Math.random() < 0.5 ? -1 : 1) * 1.8,
    });
    this.active = null;
    this.locked = true;
    this.collapseTimer = 1.05;
    this.flash("255,80,80", 0.32);
    this.addShake(16);
    sfx.slice();
    sfx.collapse();

    const arr = this.blocks;
    this.blocks = [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const b = arr[i];
      this.debris.push({
        x: b.x, z: b.z, w: b.w, d: b.d, hue: b.hue,
        y: i * BLOCK_H,
        vy: 60 + (arr.length - i) * 26 + Math.random() * 60,
        dx: (Math.random() - 0.5) * 180,
        dz: (Math.random() - 0.5) * 180,
        rot: 0,
        vr: (Math.random() - 0.5) * 3.4,
      });
    }
  }

  private finalizeOver() {
    this.collapseTimer = -1;
    this.phase = "over";
    this.locked = false;
    this.newBest = this.score > this.best;
    if (this.newBest) {
      this.best = this.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        /* private mode etc. */
      }
    }
    sfx.over();
    this.pushHud();
  }

  private comboWord(combo: number): string | null {
    let word: string | null = null;
    for (const [n, w] of COMBO_WORDS) if (combo === n) word = w;
    return combo > 15 && combo % 5 === 0 ? "ACTUAL W" : word;
  }

  private burst(wx: number, wz: number, wy: number, hue: number, n: number, power: number) {
    const [sx, sy] = this.proj(wx, wz, wy);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (0.3 + Math.random() * 0.7) * power;
      this.particles.push({
        sx, sy,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp * 0.6 - 70,
        life: 0,
        max: 0.45 + Math.random() * 0.45,
        size: 3 + Math.random() * 4.5,
        color: rgbOf(hslToRgb((hue + (Math.random() - 0.5) * 40 + 360) % 360, 92, 60 + Math.random() * 22)),
        grav: 460,
      });
    }
  }

  private addShake(m: number) {
    this.shakeMag = m;
    this.shakeT = 1;
  }

  private flash(rgb: string, a: number) {
    this.flashRgb = rgb;
    this.flashA = Math.max(this.flashA, a);
  }

  /* ------------------------------- rendering ------------------------------ */

  private proj(x: number, z: number, y: number): [number, number] {
    return [
      this.W / 2 + (x - z) * COS * this.zoom,
      this.H * 0.62 + (x + z) * SIN * this.zoom - (y - this.camY) * this.zoom,
    ];
  }

  private resize() {
    // Robust sizing: prefer the laid-out box, but never accept ~0 (some
    // sandboxed iframes report 0 before first layout → blank canvas).
    const rect = this.canvas.getBoundingClientRect();
    let w = rect.width;
    let h = rect.height;
    if (w < 2 || h < 2) {
      w = window.innerWidth || document.documentElement.clientWidth || 0;
      h = window.innerHeight || document.documentElement.clientHeight || 0;
    }
    if (w < 2 || h < 2) {
      w = 390;
      h = 700; // last-resort so the game always has a stage
    }
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    this.W = w;
    this.H = h;
    this.canvas.width = Math.max(1, Math.round(w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(h * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /** True when the backing store no longer matches the CSS size. */
  private needsResize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return this.W < 50 || this.H < 50;
    return (
      Math.abs(rect.width - this.W) > 1 || Math.abs(rect.height - this.H) > 1
    );
  }

  private skyColors(): { top: Rgb; bot: Rgb } {
    const seg = Math.max(0, this.camY / BLOCK_H / 20);
    const i = Math.floor(seg);
    const f = seg - i;
    const n = SKY.length - 1;
    const ping = (k: number) => {
      const m = k % (2 * n);
      return m < n ? m : 2 * n - m;
    };
    const A = SKY[ping(i)];
    const B = SKY[ping(i + 1)];
    return { top: lerp3(A.top, B.top, f), bot: lerp3(A.bot, B.bot, f) };
  }

  private shade(h: number, s: number, l: number): string {
    return rgbOf(hslToRgb(((h % 360) + 360) % 360, s, l));
  }

  private box(
    x: number, z: number, w: number, d: number,
    yBot: number, h: number, hue: number,
    sat = 82, alpha = 1, spin = 0, pivot: [number, number] | null = null,
  ) {
    const ctx = this.ctx;
    const t = yBot + h;
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const A = this.proj(x0, z0, t);
    const B = this.proj(x1, z0, t);
    const C = this.proj(x1, z1, t);
    const D = this.proj(x0, z1, t);
    const Bb = this.proj(x1, z0, yBot);
    const Cb = this.proj(x1, z1, yBot);
    const Db = this.proj(x0, z1, yBot);

    let ox = 0, oy = 0;
    ctx.save();
    if (spin && pivot) {
      ox = pivot[0];
      oy = pivot[1];
      ctx.translate(ox, oy);
      ctx.rotate(spin);
    }
    const face = (pts: Array<[number, number]>, color: string) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] - ox, pts[0][1] - oy);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] - ox, pts[i][1] - oy);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    };
    face([B, C, Cb, Bb], this.shade(hue, sat, 46));
    face([D, C, Cb, Db], this.shade(hue, sat, 33));
    face([A, B, C, D], this.shade(hue, sat, 63));
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawGrid() {
    const baseA = clamp(1 - this.camY / 900, 0, 1);
    if (baseA <= 0.02) return;
    const ctx = this.ctx;
    const E = 900;
    const step = 100;
    ctx.beginPath();
    for (let i = -E; i <= E; i += step) {
      let [ax, ay] = this.proj(-E, i, 0);
      let [bx, by] = this.proj(E, i, 0);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      [ax, ay] = this.proj(i, -E, 0);
      [bx, by] = this.proj(i, E, 0);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.strokeStyle = `rgba(120,180,220,${(0.11 * baseA).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private render() {
    const { ctx, W, H } = this;
    const sky = this.skyColors();

    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgbOf(sky.top));
    g.addColorStop(1, rgbOf(sky.bot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // stars (parallax)
    for (const s of this.stars) {
      const sy = (((s.y * H - this.camY * 0.12 * this.zoom) % H) + H) % H;
      const tw = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(this.time * 2 + s.p));
      ctx.fillStyle = `rgba(210,230,255,${tw.toFixed(3)})`;
      ctx.fillRect(s.x * W, sy, s.r, s.r);
    }

    // horizon glow behind the tower, tinted by current level hue
    const curHue = this.hueFor(Math.max(1, this.blocks.length));
    const gr = Math.min(W, H) * 0.55;
    const glow = ctx.createRadialGradient(W / 2, H * 0.56, 10, W / 2, H * 0.56, gr);
    glow.addColorStop(0, rgbOf(hslToRgb(curHue, 90, 60), 0.16));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    this.drawGrid();

    // motes
    for (const m of this.motes) {
      ctx.fillStyle = `rgba(${m.c},0.14)`;
      ctx.beginPath();
      ctx.arc(m.x * W, m.y * H, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // world (shaken)
    ctx.save();
    if (this.shakeT > 0) {
      const m = this.shakeMag * this.shakeT;
      ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
    }

    // pedestal
    this.box(0, 0, BASE + 150, BASE + 150, -84, 42, 218, 24, 1, 0, null);
    this.box(0, 0, BASE + 70, BASE + 70, -42, 42, 218, 30, 1, 0, null);

    // placed blocks (bottom → top)
    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      const yBot = i * BLOCK_H;
      const syTop = this.H * 0.62 - (yBot + BLOCK_H - this.camY) * this.zoom;
      const syBot = this.H * 0.62 - (yBot - this.camY) * this.zoom;
      if (syBot < -260 || syTop > this.H + 260) continue;
      this.box(b.x, b.z, b.w, b.d, yBot, BLOCK_H, b.hue);
    }

    // active block + guide
    const top = this.blocks[this.blocks.length - 1];
    if (top && this.active && this.phase !== "over") {
      const a = this.active;
      const y = this.blocks.length * BLOCK_H;
      // position comes from syncActive() — same values the drop logic uses
      const x = a.x;
      const z = a.z;

      // shadow + aim guide on the landing face
      const qA = this.proj(top.x - top.w / 2, top.z - top.d / 2, y);
      const qB = this.proj(top.x + top.w / 2, top.z - top.d / 2, y);
      const qC = this.proj(top.x + top.w / 2, top.z + top.d / 2, y);
      const qD = this.proj(top.x - top.w / 2, top.z + top.d / 2, y);
      ctx.beginPath();
      ctx.moveTo(qA[0], qA[1]);
      ctx.lineTo(qB[0], qB[1]);
      ctx.lineTo(qC[0], qC[1]);
      ctx.lineTo(qD[0], qD[1]);
      ctx.closePath();
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(qB[0], qB[1]);
      ctx.lineTo(qC[0], qC[1]);
      ctx.lineTo(qD[0], qD[1]);
      ctx.setLineDash([7, 7]);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);

      this.box(x, z, a.w, a.d, y, BLOCK_H, a.hue);
    }

    // debris
    for (const d of this.debris) {
      const pivot = this.proj(d.x, d.z, d.y + BLOCK_H / 2);
      this.box(d.x, d.z, d.w, d.d, d.y, BLOCK_H, d.hue, 82, 1, d.rot, pivot);
    }

    ctx.restore();

    // particles
    for (const p of this.particles) {
      const t = p.life / p.max;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.sx - p.size / 2, p.sy - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // popups
    for (const p of this.popups) {
      const t = p.life / p.max;
      const alpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.55) / 0.45);
      if (p.center) {
        const s = 1 + Math.max(0, 0.9 - t * 4.5);
        ctx.save();
        ctx.translate(W / 2, H * 0.32);
        ctx.rotate(p.rot * (1 - t));
        ctx.scale(s, s);
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.font = `${p.size}px "Bungee", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 8;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(5,8,15,0.85)";
        ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      } else {
        const [sx, sy] = this.proj(p.x, p.z, p.y + t * 70);
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.font = `700 ${p.size}px "Space Grotesk", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 5;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(5,8,15,0.8)";
        ctx.strokeText(p.text, sx, sy);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, sx, sy);
      }
    }
    ctx.globalAlpha = 1;

    // hit flash
    if (this.flashA > 0) {
      ctx.fillStyle = `rgba(${this.flashRgb},${this.flashA.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // vignette
    const vg = ctx.createRadialGradient(
      W / 2, H * 0.5, Math.min(W, H) * 0.35,
      W / 2, H * 0.5, Math.max(W, H) * 0.78,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(2,4,10,0.52)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
}
