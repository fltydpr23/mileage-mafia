"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Runner { name: string; yearlyKm: number; completion: number; rank: number; annualTarget: number; }
interface NightRunGameProps { runners: Runner[]; onClose?: () => void; }

type GamePhase = "select" | "playing" | "dead";

// ─── Sprite sheet metadata ───────────────────────────────────────────────────
const SPRITE_META: Record<string, { cols: number; rows: number; frames: number; speed: number }> = {
  loaf: { cols: 4, rows: 3, frames: 11, speed: 6 },
  sd:   { cols: 3, rows: 2, frames: 6,  speed: 6 },
  bhat: { cols: 1, rows: 1, frames: 1,  speed: 1 },
  boba: { cols: 1, rows: 1, frames: 1,  speed: 1 },
};
const SPRITE_PATH: Record<string, string> = {
  loaf: "/images/runners/sprite-loaf.png",
  sd:   "/images/runners/sprite-sd.png",
  bhat: "/images/runners/sprite-bhat.png",
  boba: "/images/runners/sprite-boba.png",
};
const CHAR_COLOR: Record<string, string> = {
  loaf: "#4169E1", sd: "#9b59b6", bhat: "#3498db", boba: "#e67e22",
};
const CHAR_ABILITY: Record<string, { label: string; key: string }> = {
  loaf: { label: "SPEED BURST", key: "F" },
  sd:   { label: "DOUBLE JUMP", key: "↑↑" },
  bhat: { label: "SHIELD BASH", key: "F" },
  boba: { label: "COIN MAGNET", key: "passive" },
};

// ─── Game constants ───────────────────────────────────────────────────────────
const GW = 900, GH = 400;
const GROUND = 305;           // pixel Y of top of ground (player stands here)
const GRAVITY = 0.60;
const JUMP_FORCE = -14.5;
const DJUMP_FORCE = -12;
const COYOTE_FRAMES = 6;      // grace frames after walking off edge
const JUMP_BUFFER = 8;        // frames to buffer a jump press before landing
const OBSTACLE_GAP_MIN = 380;
const OBSTACLE_GAP_MAX = 700;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; alpha: number; size: number; color: string; }
interface Coin     { x: number; y: number; collected: boolean; frame: number; }
interface Obstacle { x: number; y: number; w: number; h: number; kind: "low" | "high" | "beam"; speed: number; }
interface Building { x: number; y: number; w: number; h: number; layer: 0 | 1; winRows: number; winCols: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rng(a: number, b: number) { return a + Math.random() * (b - a); }
function mkBuildings(): Building[] {
  const list: Building[] = [];
  let x = 0;
  while (x < GW * 3) {
    const layer = Math.random() < 0.5 ? 0 : 1 as 0 | 1;
    const w = rng(50, 110); const h = rng(80, 210);
    list.push({ x, y: 0, w, h, layer, winRows: Math.floor(h / 30), winCols: Math.floor(w / 20) });
    x += w + rng(4, 20);
  }
  return list;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NightRunGame({ runners, onClose }: NightRunGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<GamePhase>("select");
  const [selectedRunner, setSelectedRunner] = useState<Runner | null>(null);
  const [finalScore, setFinalScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [newRecord, setNewRecord] = useState(false);
  const gameRef = useRef<any>(null); // holds all mutable game state

  // ─── Load sprites ───────────────────────────────────────────────────────────
  const spritesRef = useRef<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    Object.entries(SPRITE_PATH).forEach(([key, path]) => {
      const img = new window.Image();
      img.src = path;
      spritesRef.current[key] = img;
    });
    const hs = Number(localStorage.getItem("mm_nightrun_hs") || 0);
    setHighScore(hs);
  }, []);

  // ─── Start game ────────────────────────────────────────────────────────────
  const startGame = useCallback((runner: Runner) => {
    setSelectedRunner(runner);
    const spriteKey = SPRITE_PATH[runner.name.toLowerCase()] ? runner.name.toLowerCase() : "loaf";
    gameRef.current = {
      // player
      px: 100, py: GROUND, pvx: 0, pvy: 0,
      onGround: false, coyote: 0, jumpBuffer: 0,
      canDJump: runner.name.toLowerCase() === "sd",
      djumpUsed: false,
      hasShield: runner.name.toLowerCase() === "bhat",
      shieldActive: false, shieldCooldown: 0,
      speedMode: false, speedTimer: 0,
      magnetActive: runner.name.toLowerCase() === "boba",
      frameIdx: 0, frameTimer: 0,
      spriteKey,
      // world
      speed: 4.5, score: 0, dist: 0, coins: 0,
      tick: 0,
      flashFrames: 0,
      invincFrames: 0,
      dead: false,
      // scroll
      bg0x: 0, bg1x: 0, groundX: 0,
      // objects
      obstacles: [] as Obstacle[],
      coinList: [] as Coin[],
      particles: [] as Particle[],
      buildings: mkBuildings(),
      nextObstacleIn: 90,
      nextCoinIn: 60,
      // controls
      jumpPress: false,
      abilityPress: false,
      downPress: false,
      ducking: false,
    };
    setPhase("playing");
  }, []);

  // ─── Game loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || !selectedRunner) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    let raf: number;
    let alive = true;

    // input
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); g.jumpPress = true; }
      if (e.code === "ArrowDown" || e.code === "KeyS")  { e.preventDefault(); g.downPress = true; }
      if (e.code === "KeyF" || e.code === "ShiftLeft")   g.abilityPress = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (e.code === "Space" || e.code === "ArrowUp") g.jumpPress = false;
      if (e.code === "ArrowDown" || e.code === "KeyS") g.downPress = false;
      if (e.code === "KeyF" || e.code === "ShiftLeft") g.abilityPress = false;
    };
    const onTouch = (e: TouchEvent) => { e.preventDefault(); gameRef.current && (gameRef.current.jumpPress = true); };
    const onTouchEnd = () => { gameRef.current && (gameRef.current.jumpPress = false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("touchstart", onTouch, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    function killPlayer() {
      const g = gameRef.current;
      if (g.invincFrames > 0 || g.dead) return;
      if (g.hasShield && !g.shieldActive && g.shieldCooldown === 0) {
        g.shieldActive = true; g.shieldCooldown = 120; g.invincFrames = 60;
        spawnParticles(g, g.px + 20, g.py + 20, "#3498db", 12);
        return;
      }
      g.dead = true;
      spawnParticles(g, g.px + 20, g.py + 20, "#ff2d9b", 20);
    }

    function spawnParticles(g: any, x: number, y: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        g.particles.push({
          x, y,
          vx: rng(-4, 4), vy: rng(-8, -1),
          alpha: 1, size: rng(3, 8), color,
        });
      }
    }

    function update() {
      const g = gameRef.current;
      if (!g || !alive) return;
      g.tick++;

      // ── Speed ramp ──
      if (g.tick % 300 === 0 && g.speed < 13) g.speed += 0.3;
      const spd = g.speedMode ? g.speed * 1.6 : g.speed;

      // ── Scroll ──
      g.bg0x  -= spd * 0.2;
      g.bg1x  -= spd * 0.5;
      g.groundX -= spd;
      if (g.bg0x < -GW * 2) g.bg0x += GW * 2;
      if (g.bg1x < -GW * 2) g.bg1x += GW * 2;
      if (g.groundX < -40) g.groundX += 40;

      // ── Player physics ──
      // Duck
      g.ducking = g.downPress && g.onGround;

      // Coyote time
      if (g.onGround) { g.coyote = COYOTE_FRAMES; g.djumpUsed = false; }
      else if (g.coyote > 0) g.coyote--;

      // Jump buffer
      if (g.jumpPress) g.jumpBuffer = JUMP_BUFFER;
      else if (g.jumpBuffer > 0) g.jumpBuffer--;

      // Jump execution
      if (g.jumpBuffer > 0 && g.coyote > 0 && !g.ducking) {
        g.pvy = JUMP_FORCE; g.coyote = 0; g.jumpBuffer = 0;
        g.onGround = false;
        spawnParticles(g, g.px + 10, GROUND + 5, "#a855f7", 6);
        // variable jump height — if button released early, cut velocity
      }
      // Short-hop: cut velocity if jump key released early while still rising
      if (!g.jumpPress && g.pvy < -6) g.pvy = Math.max(g.pvy + 2.5, -6);

      // Double jump (SD)
      if (g.canDJump && g.jumpPress && !g.onGround && !g.djumpUsed && g.jumpBuffer === 0) {
        if (g.pvy > DJUMP_FORCE || g.pvy < -5) {
          // handled by buffer
        }
      }
      // Proper double-jump on fresh press detect
      // We track this by listening for keydown directly – see djumpRef
      
      // Gravity
      g.pvy += GRAVITY;
      // Terminal velocity
      if (g.pvy > 22) g.pvy = 22;
      g.py += g.pvy;

      // Landing
      const playerH = g.ducking ? 24 : 44;
      if (g.py >= GROUND) {
        g.py = GROUND; g.pvy = 0; g.onGround = true;
      } else {
        g.onGround = false;
      }

      // ── Obstacles ──
      g.nextObstacleIn--;
      if (g.nextObstacleIn <= 0) {
        const kind = Math.random() < 0.6 ? "low" : Math.random() < 0.5 ? "high" : "beam";
        const h = kind === "low" ? rng(36, 56) : rng(55, 80);
        const w = kind === "beam" ? rng(18, 26) : rng(28, 42);
        const y = kind === "low"  ? GROUND - h + 10
                : kind === "high" ? GROUND - h + 10
                : GROUND - 120; // beam hangs from above
        g.obstacles.push({ x: GW + 20, y, w, h, kind, speed: spd });
        g.nextObstacleIn = rng(OBSTACLE_GAP_MIN, OBSTACLE_GAP_MAX) / spd;
      }
      for (const o of g.obstacles) { o.x -= spd; o.speed = spd; }
      g.obstacles = g.obstacles.filter((o: Obstacle) => o.x > -80);

      // ── Coins ──
      g.nextCoinIn--;
      if (g.nextCoinIn <= 0) {
        const y = Math.random() < 0.4 ? GROUND - 80 : GROUND - 30;
        // spawn 3 in a row
        for (let i = 0; i < 3; i++) g.coinList.push({ x: GW + 20 + i * 36, y, collected: false, frame: 0 });
        g.nextCoinIn = rng(200, 350) / spd;
      }
      const magnetR = g.magnetActive ? 100 : 30;
      for (const c of g.coinList) {
        c.x -= spd;
        c.frame++;
        if (!c.collected) {
          const dx = (g.px + 20) - c.x, dy = (g.py - 22) - c.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (g.magnetActive && dist < magnetR) {
            c.x += dx * 0.12; c.y += dy * 0.12;
          }
          if (dist < 22) {
            c.collected = true; g.coins++;
            spawnParticles(g, c.x, c.y, "#FFD700", 5);
            g.score += 50;
          }
        }
      }
      g.coinList = g.coinList.filter((c: Coin) => c.x > -20);

      // ── Collision ──
      if (!g.dead && g.invincFrames === 0) {
        const px = g.px + 6, pw = 28;
        const py = g.ducking ? g.py - 24 : g.py - playerH + 4;
        const ph = g.ducking ? 24 : playerH - 8;
        for (const o of g.obstacles) {
          if (o.kind === "beam") {
            // beam: hit if player is high enough AND in x range
            if (px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y) {
              killPlayer();
            }
          } else {
            if (px < o.x + o.w - 2 && px + pw > o.x + 2 && py < o.y + o.h - 2 && py + ph > o.y + 2) {
              killPlayer();
            }
          }
        }
      }
      if (g.invincFrames > 0) g.invincFrames--;
      if (g.shieldCooldown > 0) g.shieldCooldown--;
      if (g.shieldCooldown === 0) g.shieldActive = false;

      // ── Ability ──
      if (g.abilityPress) {
        const sk = g.spriteKey;
        if (sk === "loaf" && !g.speedMode) { g.speedMode = true; g.speedTimer = 120; }
        if (sk === "bhat" && !g.shieldActive && g.shieldCooldown === 0) {
          g.shieldActive = true; g.shieldCooldown = 180; g.invincFrames = 80;
        }
      }
      if (g.speedMode) { g.speedTimer--; if (g.speedTimer <= 0) { g.speedMode = false; } }

      // ── Particles ──
      for (const p of g.particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.alpha -= 0.025;
      }
      g.particles = g.particles.filter((p: Particle) => p.alpha > 0);

      // ── Score / distance ──
      g.dist += spd;
      g.score = Math.floor(g.dist / 5) + g.coins * 50;

      // ── Sprite frame ──
      g.frameTimer++;
      const meta = SPRITE_META[g.spriteKey];
      if (g.frameTimer >= meta.speed) { g.frameTimer = 0; g.frameIdx = (g.frameIdx + 1) % meta.frames; }

      if (g.dead && g.particles.length === 0) endGame();
    }

    // ─── Draw ──────────────────────────────────────────────────────────────
    function draw() {
      const g = gameRef.current;
      if (!g) return;
      ctx.clearRect(0, 0, GW, GH);

      // Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND + 30);
      skyGrad.addColorStop(0, "#0a0118");
      skyGrad.addColorStop(0.5, "#1a0d3e");
      skyGrad.addColorStop(1, "#2d1060");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, GW, GH);

      // ── Buildings far layer ──
      drawBuildings(ctx, g.buildings, g.bg0x, 0, 0.35, "#0d0820");

      // ── Buildings near layer ──
      drawBuildings(ctx, g.buildings, g.bg1x, 1, 0.65, "#130c2e");

      // ── Neon window flickers ──
      drawWindowGlows(ctx, g.buildings, g.bg1x, g.tick);

      // ── Ground ──
      // Sidewalk
      ctx.fillStyle = "#1e1b35";
      ctx.fillRect(0, GROUND + 8, GW, GH - GROUND - 8);
      // Ground top line (neon pink)
      ctx.fillStyle = "#ff2d9b";
      ctx.fillRect(0, GROUND + 8, GW, 3);
      // Scrolling tile pattern
      ctx.fillStyle = "#252040";
      for (let tx = (g.groundX % 40); tx < GW; tx += 40) {
        ctx.fillRect(tx, GROUND + 11, 2, GH - GROUND - 11);
      }
      // Dashed centre line
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let tx = (g.groundX % 60); tx < GW; tx += 60) {
        ctx.fillRect(tx, GROUND + 25, 36, 3);
      }
      // Floor bottom gradient
      const gGrad = ctx.createLinearGradient(0, GROUND + 10, 0, GH);
      gGrad.addColorStop(0, "#1a1730");
      gGrad.addColorStop(1, "#0a0818");
      ctx.fillStyle = gGrad;
      ctx.fillRect(0, GROUND + 12, GW, GH - GROUND - 12);

      // ── Coins ──
      for (const c of g.coinList) {
        if (c.collected) continue;
        const bob = Math.sin(c.frame * 0.12) * 4;
        const r = 8;
        ctx.beginPath();
        ctx.arc(c.x, c.y + bob, r, 0, Math.PI * 2);
        ctx.fillStyle = "#FFD700";
        ctx.fill();
        ctx.strokeStyle = "#FFF";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Inner detail
        ctx.fillStyle = "#FFF8";
        ctx.fillRect(c.x - 2, c.y + bob - 5, 3, 3);
      }

      // ── Obstacles ──
      for (const o of g.obstacles) {
        if (o.kind === "beam") {
          // Hanging electric hazard
          ctx.fillStyle = "#ff2d9b";
          ctx.fillRect(o.x, 0, o.w, o.y + o.h);
          // Neon glow
          ctx.shadowBlur = 16; ctx.shadowColor = "#ff2d9b";
          ctx.fillStyle = "#ff5ec4";
          ctx.fillRect(o.x + 2, 0, o.w - 4, o.y + o.h - 4);
          ctx.shadowBlur = 0;
          // Hazard stripes
          for (let sy = 0; sy < o.y + o.h; sy += 16) {
            ctx.fillStyle = "rgba(0,0,0,0.3)";
            ctx.fillRect(o.x, sy, o.w, 8);
          }
          // Bottom spike
          ctx.fillStyle = "#ff2d9b";
          ctx.beginPath();
          ctx.moveTo(o.x, o.y + o.h);
          ctx.lineTo(o.x + o.w / 2, o.y + o.h + 14);
          ctx.lineTo(o.x + o.w, o.y + o.h);
          ctx.fill();
        } else if (o.kind === "low") {
          // Low barrier crate
          ctx.fillStyle = "#c0392b";
          ctx.fillRect(o.x, o.y, o.w, o.h);
          // Pixel detail
          ctx.fillStyle = "#e74c3c";
          ctx.fillRect(o.x + 3, o.y + 3, o.w - 6, 8);
          ctx.fillStyle = "#922b21";
          ctx.fillRect(o.x + 3, o.y + o.h - 11, o.w - 6, 8);
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 2;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
          // X mark
          ctx.strokeStyle = "#ff6b6b";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(o.x + 6, o.y + 6); ctx.lineTo(o.x + o.w - 6, o.y + o.h - 6);
          ctx.moveTo(o.x + o.w - 6, o.y + 6); ctx.lineTo(o.x + 6, o.y + o.h - 6);
          ctx.stroke();
        } else {
          // High barrier
          ctx.fillStyle = "#8e44ad";
          ctx.fillRect(o.x, o.y, o.w, o.h);
          ctx.fillStyle = "#a569bd";
          ctx.fillRect(o.x + 3, o.y + 4, o.w - 6, 8);
          ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
          // Neon top edge
          ctx.fillStyle = "#e056fd";
          ctx.fillRect(o.x, o.y, o.w, 4);
        }
      }

      // ── Player ──
      const img = spritesRef.current[g.spriteKey];
      const meta = SPRITE_META[g.spriteKey];
      const sprW = 40, sprH = g.ducking ? 24 : 48;
      const sprY = g.py - (g.ducking ? 24 : 48);
      const blinkHide = g.invincFrames > 0 && Math.floor(g.invincFrames / 4) % 2 === 0;

      if (!blinkHide) {
        if (img && img.complete && img.naturalWidth > 0) {
          // Clip one frame from sprite sheet
          const fW = img.naturalWidth / meta.cols;
          const fH = img.naturalHeight / meta.rows;
          const fi = g.frameIdx % meta.frames;
          const fcol = fi % meta.cols;
          const frow = Math.floor(fi / meta.cols);
          ctx.drawImage(img, fcol * fW, frow * fH, fW, fH, g.px, sprY, sprW + 4, sprH + 4);
        } else {
          // Fallback colored rectangle
          const color = CHAR_COLOR[g.spriteKey] ?? "#4169E1";
          ctx.fillStyle = color;
          ctx.fillRect(g.px + 4, sprY, sprW - 4, sprH);
          ctx.fillStyle = "#fff";
          ctx.fillRect(g.px + 10, sprY + 6, 8, 8);
        }
        // Shield visual
        if (g.shieldActive) {
          ctx.strokeStyle = "#00f5ff";
          ctx.lineWidth = 3;
          ctx.shadowBlur = 14; ctx.shadowColor = "#00f5ff";
          ctx.beginPath();
          ctx.arc(g.px + 22, sprY + sprH / 2, 28, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Speed trail
      if (g.speedMode) {
        for (let i = 1; i <= 4; i++) {
          ctx.save();
          ctx.globalAlpha = 0.15 * (5 - i);
          const img2 = spritesRef.current[g.spriteKey];
          if (img2 && img2.complete) {
            const meta2 = SPRITE_META[g.spriteKey];
            const fW = img2.naturalWidth / meta2.cols;
            const fH = img2.naturalHeight / meta2.rows;
            const fi = g.frameIdx % meta2.frames;
            ctx.drawImage(img2, (fi % meta2.cols) * fW, Math.floor(fi / meta2.cols) * fH, fW, fH,
              g.px - i * 14, sprY, sprW + 4, sprH + 4);
          }
          ctx.restore();
        }
      }

      // ── Particles ──
      for (const p of g.particles) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.restore();
      }

      // ── HUD ──
      // Top bar background
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, GW, 40);
      ctx.fillStyle = "#a855f7";
      ctx.fillRect(0, 39, GW, 2);

      // Score
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`SCORE  ${String(g.score).padStart(6,"0")}`, 16, 24);

      // Distance
      ctx.fillStyle = "#00f5ff";
      ctx.fillText(`DIST  ${(g.dist / 180).toFixed(2)} km`, GW / 2 - 60, 24);

      // Speed label
      const speedLabel = g.speed < 6 ? "JOG" : g.speed < 9 ? "RUN" : g.speed < 11 ? "SPRINT" : "BLITZ";
      ctx.fillStyle = g.speedMode ? "#FFD700" : "#a855f7";
      ctx.fillText(`PACE: ${speedLabel}${g.speedMode ? " ⚡" : ""}`, GW - 160, 24);

      // Ability cooldown
      if (g.spriteKey !== "boba") {
        const cdFrac = g.shieldCooldown > 0 ? g.shieldCooldown / 180 :
                       g.speedMode ? g.speedTimer / 120 : 0;
        const abilityLabel = CHAR_ABILITY[g.spriteKey]?.label ?? "ABILITY";
        ctx.fillStyle = cdFrac > 0 ? "#666" : "#fff";
        ctx.font = "10px monospace";
        ctx.fillText(`[F] ${abilityLabel}`, GW - 155, GH - 12);
        if (cdFrac > 0) {
          ctx.fillStyle = "#333"; ctx.fillRect(GW - 155, GH - 8, 100, 5);
          ctx.fillStyle = "#a855f7"; ctx.fillRect(GW - 155, GH - 8, 100 * (1 - cdFrac), 5);
        }
      }

      // Scanlines
      for (let y = 0; y < GH; y += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(0, y, GW, 1);
      }

      // Death flash
      if (g.flashFrames > 0) {
        ctx.fillStyle = `rgba(255,45,155,${g.flashFrames / 12})`;
        ctx.fillRect(0, 0, GW, GH);
        g.flashFrames--;
      }
    }

    function drawBuildings(
      ctx: CanvasRenderingContext2D,
      buildings: Building[], scrollX: number, layer: number,
      scale: number, fillColor: string
    ) {
      for (const b of buildings) {
        if (b.layer !== layer) continue;
        const bx = b.x + scrollX;
        if (bx + b.w < 0 || bx > GW) continue;
        const bh = b.h * scale, by = GROUND + 8 - bh;
        ctx.fillStyle = fillColor;
        ctx.fillRect(bx, by, b.w * scale, bh);
        // Rooftop neon strip
        ctx.fillStyle = layer === 1 ? "#ff2d9b33" : "#a855f722";
        ctx.fillRect(bx, by, b.w * scale, 3);
      }
    }

    function drawWindowGlows(
      ctx: CanvasRenderingContext2D, buildings: Building[], scrollX: number, tick: number
    ) {
      const colors = ["#ff2d9b", "#00f5ff", "#a855f7", "#FFD700"];
      for (const b of buildings) {
        if (b.layer !== 1) continue;
        const bx = b.x + scrollX;
        if (bx + b.w < 0 || bx > GW) continue;
        const bh = b.h * 0.65, by = GROUND + 8 - bh;
        for (let r = 0; r < b.winRows; r++) {
          for (let c = 0; c < b.winCols; c++) {
            const wx = bx + c * 18 + 5, wy = by + r * 26 + 10;
            const seed = (b.x + r * 7 + c * 13) % colors.length;
            const flicker = (tick + b.x + r + c) % 30 < 25;
            ctx.fillStyle = flicker ? colors[seed] + "99" : "#00000033";
            ctx.fillRect(wx, wy, 10, 14);
          }
        }
      }
    }

    function endGame() {
      if (!alive) return;
      const g = gameRef.current;
      const score = g?.score ?? 0;
      const hs = Number(localStorage.getItem("mm_nightrun_hs") || 0);
      const isNew = score > hs;
      if (isNew) localStorage.setItem("mm_nightrun_hs", String(score));
      setFinalScore(score);
      setHighScore(isNew ? score : hs);
      setNewRecord(isNew);
      setPhase("dead");
      alive = false;
    }

    function loop() {
      if (!alive) return;
      update();
      draw();
      if (!gameRef.current?.dead) raf = requestAnimationFrame(loop);
      else { draw(); setTimeout(endGame, 600); }
    }
    raf = requestAnimationFrame(loop);

    // Double-jump via direct keydown (not captured by the buffer logic)
    const onDJump = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g || !g.canDJump) return;
      if ((e.code === "Space" || e.code === "ArrowUp") && !g.onGround && !g.djumpUsed) {
        g.djumpUsed = true;
        g.pvy = DJUMP_FORCE;
        spawnParticles(g, g.px + 10, g.py - 20, "#9b59b6", 8);
      }
    };
    window.addEventListener("keydown", onDJump);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("keydown", onDJump);
      canvas.removeEventListener("touchstart", onTouch);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [phase, selectedRunner]);

  // ═══════════════════════ RENDER ═══════════════════════════
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      style={{ background: "#050210" }}>

      {/* ── Character Select ── */}
      <AnimatePresence>
        {phase === "select" && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center w-full max-w-2xl px-6"
          >
            {/* Title */}
            <div className="mb-2 text-center">
              <div className="text-[10px] font-mono text-purple-500 tracking-[0.5em] mb-1">
                MILEAGE MAFIA
              </div>
              <h1 className="text-4xl font-black text-white tracking-tighter italic font-mono mb-1"
                style={{ textShadow: "3px 3px 0 #9333ea, 6px 6px 0 #581c87" }}>
                NIGHT_RUN
              </h1>
              <p className="text-[10px] font-mono text-cyan-400 tracking-widest">
                CHOOSE YOUR OPERATIVE
              </p>
            </div>

            {/* Runner grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full mt-6">
              {runners.map((runner, i) => {
                const sk = runner.name.toLowerCase();
                const hasSprite = !!SPRITE_PATH[sk];
                const color = CHAR_COLOR[sk] ?? `hsl(${i * 47}, 70%, 55%)`;
                const ability = CHAR_ABILITY[sk];
                return (
                  <motion.button
                    key={runner.name}
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => startGame(runner)}
                    className="relative flex flex-col items-center p-4 text-left transition-all"
                    style={{
                      background: "#0d0820",
                      border: `2px solid ${color}50`,
                      boxShadow: `0 0 0 1px #000, 0 4px 20px ${color}20`,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 0 1px #000, 0 4px 24px ${color}50, inset 0 0 20px ${color}10`)}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 0 0 1px #000, 0 4px 20px ${color}20`)}
                  >
                    {/* Rank badge */}
                    <div className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-[9px] font-black font-mono"
                      style={{ background: color, color: "#000" }}>
                      {runner.rank}
                    </div>

                    {/* Sprite or color block */}
                    <div className="w-14 h-14 mb-3 relative border-2 flex items-center justify-center overflow-hidden"
                      style={{ borderColor: `${color}50`, background: "#08061a" }}>
                      {hasSprite ? (
                        <img src={SPRITE_PATH[sk]} alt={runner.name}
                          className="w-full h-full"
                          style={{ imageRendering: "pixelated", objectFit: "cover" }} />
                      ) : (
                        <div className="w-8 h-10 relative" style={{ imageRendering: "pixelated" }}>
                          {/* Pixel stick figure */}
                          <div className="w-3 h-3 rounded-full mx-auto mb-0.5" style={{ background: color }} />
                          <div className="w-4 h-5 mx-auto" style={{ background: color }} />
                          <div className="flex justify-center gap-0.5 mt-0.5">
                            <div className="w-1.5 h-3" style={{ background: color }} />
                            <div className="w-1.5 h-3" style={{ background: color }} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-full text-left">
                      <div className="font-black font-mono text-sm text-white mb-0.5"
                        style={{ textShadow: `1px 1px 0 ${color}` }}>
                        {runner.name.toUpperCase()}
                      </div>
                      {ability ? (
                        <div className="text-[8px] font-mono" style={{ color }}>⚡ {ability.label}</div>
                      ) : (
                        <div className="text-[8px] font-mono text-purple-400">BALANCED</div>
                      )}
                      <div className="mt-1.5 h-1 bg-purple-900/40">
                        <div className="h-full" style={{
                          width: `${Math.min(runner.completion, 100)}%`,
                          background: color,
                        }} />
                      </div>
                      <div className="text-[7px] font-mono text-neutral-500 mt-0.5">
                        {runner.yearlyKm.toFixed(0)} km logged
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Controls hint */}
            <div className="mt-6 flex gap-6 text-[9px] font-mono text-purple-400/60">
              <span>[ SPACE / ↑ ] JUMP</span>
              <span>[ ↓ ] DUCK</span>
              <span>[ F ] ABILITY</span>
              <span>[ TAP ] MOBILE</span>
            </div>

            {/* High score */}
            {highScore > 0 && (
              <div className="mt-3 text-[10px] font-mono text-yellow-400">
                ◈ RECORD  {highScore.toLocaleString()} pts
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Game Canvas ── */}
      <AnimatePresence>
        {phase === "playing" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
            style={{ imageRendering: "pixelated" }}
          >
            {/* Runner label */}
            <div className="absolute -top-7 left-0 flex items-center gap-2">
              <span className="text-[9px] font-mono text-purple-400">OPERATIVE:</span>
              <span className="text-[9px] font-mono font-black text-white">
                {selectedRunner?.name.toUpperCase()}
              </span>
            </div>
            <canvas
              ref={canvasRef}
              width={GW}
              height={GH}
              className="block"
              style={{
                maxWidth: "100%",
                imageRendering: "pixelated",
                border: "2px solid #a855f7",
                boxShadow: "0 0 40px rgba(168,85,247,0.3), 0 0 0 1px #000",
                cursor: "pointer",
              }}
            />
            {/* Mobile jump button */}
            <button
              className="absolute bottom-4 right-4 w-16 h-16 rounded-none sm:hidden flex items-center justify-center text-2xl font-black text-black"
              style={{ background: "#a855f7", border: "3px solid #000", boxShadow: "4px 4px 0 #000" }}
              onTouchStart={() => gameRef.current && (gameRef.current.jumpPress = true)}
              onTouchEnd={() => gameRef.current && (gameRef.current.jumpPress = false)}
            >
              ↑
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Game Over ── */}
      <AnimatePresence>
        {phase === "dead" && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="text-[10px] font-mono text-rose-400 tracking-[0.6em] mb-1">MISSION FAILED</div>
            <h2 className="text-6xl font-black font-mono italic text-white mb-3"
              style={{ textShadow: "4px 4px 0 #be123c" }}>
              GAME OVER
            </h2>
            <div className="text-center mb-6 space-y-1">
              <div className="text-2xl font-black font-mono" style={{ color: "#FFD700" }}>
                {finalScore.toLocaleString()} pts
              </div>
              {newRecord && (
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="text-[10px] font-mono text-yellow-400 tracking-widest"
                >
                  ★ NEW RECORD ★
                </motion.div>
              )}
              <div className="text-[10px] font-mono text-purple-400">
                BEST  {highScore.toLocaleString()}
              </div>
            </div>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => selectedRunner && startGame(selectedRunner)}
                className="px-8 py-3 font-black font-mono text-sm text-black"
                style={{ background: "#a855f7", border: "3px solid #000", boxShadow: "4px 4px 0 #000" }}
              >
                ▶ RETRY
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => setPhase("select")}
                className="px-8 py-3 font-black font-mono text-sm text-white border-2 border-purple-500"
                style={{ background: "#0d0820" }}
              >
                ← BACK
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
