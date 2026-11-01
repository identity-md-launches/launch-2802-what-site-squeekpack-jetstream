import type { GamePhase, Mode } from "./types";

export type GameStats = {
  score: number;
  distance: number;
  coins: number;
  shield: number;
};
export type GameInput = {
  mode: Mode;
  rpm: number;
  reducedMotion: boolean;
  muted: boolean;
};
type Obstacle = {
  x: number;
  center: number;
  gap: number;
  passed: boolean;
  coin: boolean;
  nut: boolean;
};
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
};
export const WORLD = { width: 960, height: 520 };
const { width: W, height: H } = WORLD;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export class ArcadeEngine {
  phase: GamePhase = "idle";
  stats: GameStats = { score: 0, distance: 0, coins: 0, shield: 0 };
  modes = new Set<Mode>();
  elapsed = 0;
  input: GameInput = {
    mode: "Practice",
    rpm: 0,
    reducedMotion: false,
    muted: true,
  };
  y = H * 0.5;
  velocity = 0;
  private obstacles: Obstacle[] = [];
  private particles: Particle[] = [];
  private travel = 0;
  private visualTime = 0;
  private nextObstacle = 2;
  private publishTime = 0;
  private exhaustTime = 0;
  private scoreFloat = 0;
  private audio: AudioContext | null = null;
  private raf = 0;
  private lastTime = 0;
  private disposed = false;
  private ctx: CanvasRenderingContext2D;
  constructor(
    private canvas: HTMLCanvasElement,
    private onStats: (stats: GameStats) => void,
    private onPhase: (phase: GamePhase) => void,
  ) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D is unavailable in this browser.");
    this.ctx = ctx;
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }
  resize = () => {
    const width = this.canvas.getBoundingClientRect().width || 960;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(
      (this.canvas.getBoundingClientRect().height || (width / W) * H) * ratio,
    );
    this.ctx.imageSmoothingEnabled = false;
  };
  private sound(
    frequency: number,
    duration = 0.08,
    type: OscillatorType = "square",
    volume = 0.025,
  ) {
    if (this.input.muted) return;
    try {
      this.audio ??= new AudioContext();
      void this.audio.resume();
      const osc = this.audio.createOscillator(),
        gain = this.audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        frequency * 0.5,
        this.audio.currentTime + duration,
      );
      gain.gain.setValueAtTime(volume, this.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.audio.currentTime + duration,
      );
      osc.connect(gain);
      gain.connect(this.audio.destination);
      osc.start();
      osc.stop(this.audio.currentTime + duration);
    } catch {
      /* Audio is optional; the game remains playable. */
    }
  }
  start() {
    this.elapsed = 0;
    this.travel = 0;
    this.y = H * 0.5;
    this.velocity = -110;
    this.obstacles = [];
    this.particles = [];
    this.nextObstacle = 1.8;
    this.stats = { score: 0, distance: 0, coins: 0, shield: 0 };
    this.scoreFloat = 0;
    this.modes = new Set([this.input.mode]);
    this.setPhase("running");
    this.onStats({ ...this.stats });
    this.sound(520);
  }
  boost() {
    if (this.phase === "idle" || this.phase === "over") {
      this.start();
      return;
    }
    if (this.phase === "paused") {
      this.setPhase("running");
      return;
    }
    this.velocity = -245;
    this.sound(220, 0.055, "triangle", 0.045);
    if (!this.input.reducedMotion) for (let n = 0; n < 8; n++) this.exhaust();
  }
  togglePause() {
    if (this.phase === "running") this.setPhase("paused");
    else if (this.phase === "paused") this.setPhase("running");
  }
  private setPhase(phase: GamePhase) {
    this.phase = phase;
    this.onPhase(phase);
  }
  private exhaust() {
    this.particles.push({
      x: 236,
      y: this.y + 16,
      vx: -130 - Math.random() * 120,
      vy: 20 + Math.random() * 65,
      life: 0.4,
      max: 0.4,
      color: Math.random() > 0.5 ? "#ff9c50" : "#f6dfab",
      size: 3 + Math.random() * 5,
    });
  }
  private end() {
    this.stats.score = Math.floor(this.scoreFloat);
    this.sound(95, 0.22, "sawtooth", 0.035);
    this.onStats({ ...this.stats });
    this.setPhase("over");
  }
  private update(dt: number) {
    this.visualTime += dt;
    if (this.phase !== "running") return;
    this.elapsed += dt;
    this.modes.add(this.input.mode);
    const zoom = this.input.mode === "Zoomies",
      night = this.input.mode === "Night Shift";
    const speed = zoom ? 175 + Math.min(this.input.rpm, 100) * 0.65 : 145;
    this.travel += speed * dt;
    this.velocity = Math.min(this.velocity + (night ? 510 : 435) * dt, 340);
    this.y += this.velocity * dt;
    this.stats.distance = Math.floor(this.travel / 12);
    this.scoreFloat += dt * (zoom ? 20 : 10);
    this.stats.score = Math.floor(this.scoreFloat);
    this.stats.shield = Math.max(0, this.stats.shield - dt);
    this.nextObstacle -= dt;
    if (this.nextObstacle <= 0) {
      const gap = Math.max(165, 220 - this.elapsed * 0.5);
      this.obstacles.push({
        x: W + 40,
        center: 175 + Math.random() * 170,
        gap,
        passed: false,
        coin: true,
        nut: Math.random() < 0.23,
      });
      this.nextObstacle = zoom ? 2.5 : 2.8;
    }
    for (const obstacle of this.obstacles) {
      obstacle.x -= speed * dt;
      const dx = obstacle.x + 36 - 275;
      if (!obstacle.passed && dx < -52) {
        obstacle.passed = true;
        this.scoreFloat += zoom ? 40 : 20;
      }
      if (
        obstacle.coin &&
        Math.abs(dx) < 40 &&
        Math.abs(this.y - obstacle.center) < 36
      ) {
        obstacle.coin = false;
        this.stats.coins++;
        this.scoreFloat += 50 * (zoom ? 2 : 1);
        this.sound(880, 0.12, "sine", 0.06);
      }
      if (
        obstacle.nut &&
        Math.abs(dx + 115) < 36 &&
        Math.abs(this.y - obstacle.center + 35) < 38
      ) {
        obstacle.nut = false;
        this.stats.shield = 3;
        this.sound(1320, 0.25, "sine", 0.05);
      }
      if (
        this.stats.shield <= 0 &&
        Math.abs(dx) < 50 &&
        (this.y - 17 < obstacle.center - obstacle.gap / 2 ||
          this.y + 17 > obstacle.center + obstacle.gap / 2)
      ) {
        this.end();
        return;
      }
    }
    this.obstacles = this.obstacles.filter((obstacle) => obstacle.x > -110);
    if (this.y < 48 || this.y > H - 48) {
      if (this.stats.shield > 0) {
        this.y = clamp(this.y, 49, H - 49);
        this.velocity = this.y < H / 2 ? 40 : -170;
      } else {
        this.end();
        return;
      }
    }
    if (!this.input.reducedMotion) {
      this.exhaustTime += dt;
      if (this.exhaustTime > 0.035) {
        this.exhaust();
        this.exhaustTime = 0;
      }
      for (const particle of this.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
      }
      this.particles = this.particles.filter((particle) => particle.life > 0);
    }
    this.publishTime += dt;
    if (this.publishTime > 0.08) {
      this.onStats({ ...this.stats });
      this.publishTime = 0;
    }
  }
  private frame = (time: number) => {
    if (this.disposed) return;
    const dt = this.lastTime
      ? Math.min((time - this.lastTime) / 1000, 0.035)
      : 0;
    this.lastTime = time;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };
  private rect(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(
      Math.round(x),
      Math.round(y),
      Math.round(w),
      Math.round(h),
    );
  }
  private wheel(
    x: number,
    y: number,
    radius: number,
    turn: number,
    color: string,
  ) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(turn);
    c.strokeStyle = color;
    c.lineWidth = 7;
    c.beginPath();
    c.arc(0, 0, radius, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, radius - 12, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 8; i++) {
      c.rotate(Math.PI / 4);
      c.beginPath();
      c.moveTo(13, 0);
      c.lineTo(radius - 5, 0);
      c.stroke();
    }
    c.fillStyle = color;
    c.fillRect(-9, -9, 18, 18);
    c.restore();
  }
  private pipe(x: number, end: number, top: boolean, night: boolean) {
    const from = top ? 24 : end,
      height = top ? end - 24 : H - 24 - end;
    this.rect(x, from, 72, height, "#503c29");
    this.rect(x + 5, from, 62, height, "#886043");
    this.rect(x + 8, from, 12, height, "#b48054");
    this.rect(x + 21, from, 8, height, "#c99c69");
    this.rect(x + 55, from, 9, height, "#63492f");
    for (let line = from + 28; line < from + height; line += 46) {
      this.rect(x + 4, line, 64, 5, "#59412d");
      this.rect(x + 4, line + 5, 64, 3, "#c39a68");
    }
    const rim = top ? end - 20 : end;
    this.rect(x - 9, rim, 90, 20, "#3c3027");
    this.rect(x - 6, rim + 3, 84, 12, "#c38a53");
    this.rect(x - 3, rim + 4, 75, 3, "#f1b97d");
    for (let bolt = 0; bolt < 4; bolt++) {
      this.rect(x + bolt * 21, rim + 7, 5, 5, "#6b4d34");
      this.rect(x + bolt * 21, rim + 7, 3, 2, "#f1c48a");
    }
    if (night) this.rect(x - 4, top ? end - 4 : end + 2, 80, 3, "#a6d3a8");
  }
  private coin(x: number, y: number, time: number) {
    const c = this.ctx,
      stretch = 0.65 + Math.abs(Math.cos(time * 2)) * 0.35;
    c.save();
    c.translate(x, y);
    c.scale(stretch, 1);
    this.rect(-11, -15, 22, 30, "#ffbb50");
    this.rect(-15, -10, 30, 20, "#ffbb50");
    this.rect(-9, -10, 18, 20, "#a96c28");
    this.rect(-6, -8, 12, 16, "#e8a43e");
    this.rect(-2, -7, 4, 14, "#ffe3a0");
    this.rect(-5, -3, 10, 4, "#ffe3a0");
    c.restore();
  }
  private nut(x: number, y: number) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.shadowColor = "#eebf56";
    c.shadowBlur = this.input.reducedMotion ? 0 : 18;
    this.rect(-9, -4, 18, 19, "#f4c85d");
    this.rect(-6, 15, 12, 5, "#d69b35");
    this.rect(-12, -8, 24, 7, "#aa7a2f");
    this.rect(-9, -12, 18, 7, "#e4ac43");
    this.rect(-2, -17, 4, 7, "#c69445");
    this.rect(-5, 0, 4, 12, "#ffe8a3");
    c.restore();
  }
  private hamster(x: number, y: number, scale: number, tilt: number) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(tilt);
    c.scale(scale, scale);
    // A hand-drawn pixel silhouette: two steam tanks, leather helmet, goggles and a very round pilot.
    const r = (a: number, b: number, w: number, h: number, color: string) =>
      this.rect(a, b, w, h, color);
    r(-29, -11, 11, 29, "#292f2c");
    r(-34, -6, 9, 22, "#9ca59a");
    r(-33, -3, 4, 15, "#d0d1b6");
    r(-29, 16, 7, 8, "#696f65");
    r(-21, 13, 8, 11, "#9b9d80");
    r(-26, -14, 7, 31, "#526356");
    r(-21, -8, 6, 28, "#bdad7f");
    r(-16, -19, 30, 41, "#30251c");
    r(-22, -11, 42, 26, "#30251c");
    r(-17, -16, 32, 36, "#c88c4e");
    r(-20, -8, 40, 24, "#d7a260");
    r(-12, 15, 25, 9, "#dbac72");
    r(-5, -17, 19, 38, "#eac38b");
    r(6, -7, 19, 22, "#f4d6a3");
    r(16, -3, 11, 11, "#f4d6a3");
    r(24, -1, 5, 4, "#644032");
    r(-14, 18, 10, 8, "#d39b60");
    r(9, 18, 10, 7, "#edc18b");
    r(-5, 7, 10, 7, "#f5d2a0");
    r(-20, -24, 34, 10, "#362a21");
    r(-24, -18, 43, 13, "#362a21");
    r(-16, -29, 25, 8, "#362a21");
    r(-18, -23, 30, 10, "#b56136");
    r(-21, -17, 36, 9, "#bc7444");
    r(-13, -27, 21, 7, "#df9257");
    r(-13, -23, 5, 12, "#efb46d");
    r(-18, -11, 8, 10, "#7a482e");
    r(-17, -9, 5, 6, "#efc085");
    r(-19, -2, 5, 14, "#8e5334");
    r(1, -14, 21, 11, "#443b2a");
    r(2, -13, 19, 9, "#bdac79");
    r(5, -11, 12, 6, "#4e7d72");
    r(6, -11, 7, 2, "#b1d3b0");
    r(15, -12, 3, 6, "#243e39");
    r(11, 1, 3, 3, "#543c2b");
    r(15, 8, 9, 2, "#bd8352");
    r(-15, 25, 10, 3, "#4a3427");
    r(9, 24, 12, 3, "#4a3427");
    c.restore();
  }
  private draw() {
    const c = this.ctx,
      night = this.input.mode === "Night Shift";
    const scale = this.canvas.height / H,
      visibleWidth = this.canvas.width / scale;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    const idle = this.phase === "idle",
      still =
        this.input.reducedMotion ||
        this.phase === "paused" ||
        this.phase === "over";
    const t = still ? 0 : this.visualTime,
      move = this.input.reducedMotion
        ? 0
        : idle
          ? still
            ? 0
            : t * 12
          : this.travel;
    this.rect(0, 0, W, H, night ? "#172322" : "#252c27");
    // Layer 1: masonry and distant warm shaft lights.
    for (let row = 0; row < 9; row++) {
      const offset = ((move * 0.07) % 128) + (row % 2 ? 64 : 0);
      for (let col = -1; col < 10; col++) {
        this.rect(
          col * 128 - offset,
          row * 65 + 24,
          124,
          61,
          night ? "#1b2926" : "#2b322b",
        );
        this.rect(
          col * 128 - offset + 2,
          row * 65 + 26,
          120,
          3,
          night ? "#22302b" : "#30382e",
        );
      }
    }
    for (let i = -1; i < 5; i++) {
      const x = i * 290 - ((move * 0.16) % 290);
      this.rect(x, 14, 13, H - 25, "#303b30");
      this.rect(x + 13, 14, 4, H - 25, "#394333");
      this.rect(x - 5, 64, 28, 8, "#46503a");
      this.rect(x - 5, 442, 28, 8, "#46503a");
      this.wheel(x + 140, 280, 88, t * 0.08 + i, night ? "#304137" : "#3b4635");
      this.rect(x + 134, 369, 12, 95, "#344130");
      this.rect(x + 100, 460, 80, 9, "#344130");
      this.rect(x + 75, 24, 3, 58, "#4d4c32");
      this.rect(x + 62, 80, 28, 7, "#77754b");
      this.rect(x + 66, 87, 20, 6, "#c9aa62");
      const light = c.createRadialGradient(x + 76, 93, 0, x + 76, 93, 95);
      light.addColorStop(0, "#caa55518");
      light.addColorStop(1, "#caa55500");
      c.fillStyle = light;
      c.fillRect(x - 20, 85, 190, 110);
    }
    // Layer 2: service pipes, cable and floor.
    this.rect(0, 41, W, 8, "#4f4c35");
    this.rect(0, 42, W, 3, "#77704b");
    this.rect(0, 53, W, 4, "#373d2d");
    this.rect(0, H - 47, W, 13, "#49503a");
    this.rect(0, H - 36, W, 36, "#252c25");
    this.rect(0, H - 35, W, 3, "#6c6f48");
    for (let n = -1; n < 28; n++) {
      const x = n * 42 - ((move * 0.7) % 42);
      this.rect(x, H - 28, 28, 10, "#3f4632");
      this.rect(x + 6, H - 14, 28, 8, "#343c2c");
    }
    if (idle) {
      this.pipe(72, 152, true, night);
      this.pipe(72, 390, false, night);
      this.pipe(visibleWidth - 164, 172, true, night);
      this.pipe(visibleWidth - 164, 395, false, night);
      this.coin(visibleWidth * 0.72, 264, t);
      this.coin(visibleWidth * 0.78, 264, t + 0.5);
      this.nut(visibleWidth - 65, 303 + Math.sin(t) * 4);
    }
    for (const obstacle of this.obstacles) {
      this.pipe(obstacle.x, obstacle.center - obstacle.gap / 2, true, night);
      this.pipe(obstacle.x, obstacle.center + obstacle.gap / 2, false, night);
      if (obstacle.coin) this.coin(obstacle.x + 36, obstacle.center, t);
      if (obstacle.nut) this.nut(obstacle.x + 151, obstacle.center - 35);
    }
    for (const particle of this.particles) {
      c.globalAlpha = particle.life / particle.max;
      this.rect(
        particle.x,
        particle.y,
        particle.size,
        particle.size,
        particle.color,
      );
    }
    c.globalAlpha = 1;
    const x = idle ? visibleWidth * (visibleWidth < 700 ? 0.86 : 0.61) : 275,
      y = idle ? 254 + Math.sin(t * 2) * 9 : this.y;
    if (idle) {
      for (let p = 0; p < 7; p++) {
        const d = (t * 40 + p * 13) % 92;
        this.rect(
          x - 46 - d,
          y + 28 + d * 0.18 + Math.sin(p + t) * 6,
          8 - d / 18,
          8 - d / 18,
          p % 2 ? "#c6b896" : "#d68c48",
        );
      }
    }
    if (this.stats.shield > 0) {
      c.strokeStyle = "#ffdb75";
      c.lineWidth = 3;
      c.setLineDash([7, 5]);
      c.beginPath();
      c.arc(x, y, 49, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
    this.hamster(
      x,
      y,
      idle ? 2.05 : 1.03,
      idle ? -0.08 : clamp(this.velocity / 1700, -0.22, 0.18),
    );
    // Layer 3: foreground steel framing and dust.
    this.rect(0, 0, W, 18, "#151d19");
    this.rect(0, 18, W, 6, "#3d4733");
    this.rect(0, H - 7, W, 7, "#172019");
    for (let i = 0; i < 15; i++) {
      const x = (i * 79 + 33 - move * 0.23) % W,
        y = ((i * 67 + 114) % (H - 45)) + 25;
      this.rect(x, y, 2, 2, i % 2 ? "#7f886344" : "#d7bc7144");
    }
    const vignette = c.createRadialGradient(
      W / 2,
      H / 2,
      H * 0.2,
      W / 2,
      H / 2,
      W * 0.7,
    );
    vignette.addColorStop(0, "#10171100");
    vignette.addColorStop(1, "#1017119c");
    c.fillStyle = vignette;
    c.fillRect(0, 0, W, H);
  }
  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.audio) void this.audio.close();
  }
}
