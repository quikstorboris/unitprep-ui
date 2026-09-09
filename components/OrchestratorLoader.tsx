"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/** Self-storage roll-up-door interstitial with a Matrix-style data rain
 * revealed underneath, standing in for the plain `Spinner` wherever a
 * load has (or could eventually have) real progress to report --
 * currently the Process Street fetches on the Create Client search and
 * review pages. Ported from a standalone canvas prototype (see the
 * vault's Process Street Integration notes); ownership of the visual
 * design lives here now, not in that prototype file.
 *
 * Progress-driven: pass `progress` (0-1) and the door's height tracks
 * it, easing toward the target so a jump reads as the door being pulled
 * up rather than teleporting. Omit `progress` for the "no total yet"
 * state -- both PS fetches are a single network round trip with no
 * fraction to report, so there's no real progress to track. Rather than
 * turning the door into a fake progress meter, it opens fully once, then
 * holds: symbolically, the data is "unlocked" -- and the rain, which
 * keeps falling continuously behind it (see `rain()`) for however long
 * the real fetch takes, is what carries the "still working" signal from
 * there, not the door.
 */

const INK = "#0B1423"; // brand navy -- frame and surround
const BLUE = "#00A4EC"; // brand blue -- rain, handle detail
const DOOR_HI = "#2B3D57"; // top of each slat
const DOOR_LO = "#151E2C"; // bottom of each slat
const SEAM = "#0A111C";
const APRON = "#212B3B"; // concrete in front of the unit
const VOID = "#04080E"; // inside of the unit

// The scene is authored in these units, then scaled to the element's
// real pixel size every frame -- resolution independent at any host size.
const W = 320;
const H = 264;
const FRAME = 11; // steel frame thickness
const HOUSING = 15; // door drum housing along the top
const OPEN_X = 26;
const OPEN_W = W - 52; // doorway opening
const OPEN_Y = 22;
const OPEN_H = 196;
const FLOOR_Y = OPEN_Y + OPEN_H;
const SLAT = 11; // slat pitch
const CELL = 12; // rain cell size at 1x

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789";
// A few columns spell unit numbers instead of glyphs -- the thing that's
// actually loading, so it's a small in-joke rather than pure decoration.
const CODES = ["A-104", "B-212", "C-07", "D-330", "10x20", "5x10", "E-88"];

interface RainColumn {
  y: number;
  speed: number;
  code: string | null;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface OrchestratorLoaderProps {
  /** 0-1. Omit for the indeterminate "no total yet" breathing-door state. */
  progress?: number;
  label?: string;
  className?: string;
  /** Paints the area around the unit -- e.g. for a full-screen takeover. Default transparent. */
  background?: string;
  /** How large the unit may be drawn relative to its base 320x264 size. Default 3. */
  maxScale?: number;
  /** Fires once the door finishes lifting (progress reached 1 and eased fully open). */
  onOpen?: () => void;
}

export function OrchestratorLoader({
  progress,
  label = "Loading",
  className,
  background,
  maxScale = 3,
  onOpen,
}: OrchestratorLoaderProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  // Read inside the rAF loop via refs so the effect below doesn't need
  // to tear down and restart the loop (and its ResizeObserver) on every
  // progress tick -- it only depends on things that change the drawing
  // surface itself. Synced in a layout effect rather than during render,
  // since writing a ref's `current` while rendering isn't allowed.
  const progressRef = useRef(progress);
  const onOpenRef = useRef(onOpen);
  useLayoutEffect(() => {
    progressRef.current = progress;
    onOpenRef.current = onOpen;
  });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    // Freshly-typed non-null aliases: the nested function declarations
    // below are hoisted, so TS can't carry the narrowing from the guard
    // above into their closures over the original `host`/`canvas`.
    const hostEl = host;
    const canvasEl = canvas;

    // jsdom (unit tests) has no canvas backend and returns null here --
    // the loop below still runs so ARIA state stays correct, it just
    // skips every ctx.* call.
    const ctx = canvas.getContext("2d");
    const reduceMotion =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    let scale = 0;
    let cell = CELL;
    let glyphPx = 11;
    let trail = 13;
    let columns: RainColumn[] = [];
    let dpr = 1;
    let ox = 0;
    let oy = 0;
    let shown = 0;
    let opened = false;
    let last = performance.now();
    let raf = 0;

    function buildColumns() {
      const cols = Math.ceil(OPEN_W / cell);
      const prev = columns;
      const next: RainColumn[] = [];
      for (let i = 0; i < cols; i++) {
        next.push(
          prev[i] ?? {
            y: -Math.random() * OPEN_H,
            speed: 22 + Math.random() * 46,
            code: Math.random() < 0.18 ? CODES[(Math.random() * CODES.length) | 0] : null,
          }
        );
      }
      columns = next;
    }

    function resize() {
      const rect = canvasEl.getBoundingClientRect();
      const cw = Math.max(1, Math.round(rect.width));
      const ch = Math.max(1, Math.round(rect.height));
      dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
      if (canvasEl.width !== cw * dpr || canvasEl.height !== ch * dpr) {
        canvasEl.width = cw * dpr;
        canvasEl.height = ch * dpr;
      }

      const s = Math.min(cw / W, ch / H, maxScale);
      ox = (cw - W * s) / 2;
      oy = (ch - H * s) / 2;

      // Rain keeps a constant on-screen glyph size -- a bigger unit gets
      // more, finer columns instead of giant characters.
      if (Math.abs(s - scale) / (scale || 1) > 0.02) {
        scale = s;
        cell = CELL / s;
        glyphPx = 11 / s;
        trail = Math.min(40, Math.round(13 * Math.max(1, s)));
        buildColumns();
      }
    }

    resize();

    let ro: ResizeObserver | undefined;
    let onWinResize: (() => void) | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(resize);
      ro.observe(canvasEl);
    } else {
      onWinResize = resize;
      addEventListener("resize", onWinResize);
    }

    function rain(dt: number, open: number) {
      if (!ctx) return;
      ctx.font = `600 ${glyphPx.toFixed(2)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "top";

      columns.forEach((col, i) => {
        const x = OPEN_X + 3 + i * cell;
        // Slower under reduced motion, but never stopped outright -- same
        // "essential feedback, not decoration" reasoning as the door above.
        col.y += col.speed * dt * (0.55 + open * 0.9) * (reduceMotion ? 0.35 : 1);
        if (col.y > OPEN_H + 40) {
          col.y = -20 - Math.random() * 80;
          col.speed = 22 + Math.random() * 46;
          col.code = Math.random() < 0.18 ? CODES[(Math.random() * CODES.length) | 0] : null;
        }

        const head = OPEN_Y + col.y;
        for (let k = 0; k < trail; k++) {
          const y = head - k * cell;
          if (y < OPEN_Y - cell || y > FLOOR_Y) continue;
          const glyph = col.code
            ? col.code[(k + ((col.y / cell) | 0)) % col.code.length]
            : GLYPHS[(i * 7 + k * 13 + ((col.y / (cell * 2)) | 0)) % GLYPHS.length];
          if (k === 0) {
            ctx.fillStyle = "#DCF3FF";
            ctx.shadowColor = BLUE;
            ctx.shadowBlur = 8 / scale;
          } else {
            ctx.fillStyle = `rgba(0,164,236,${Math.max(0, 0.85 - (k / trail) * 0.92)})`;
            ctx.shadowBlur = 0;
          }
          ctx.fillText(glyph, x, y);
        }
        ctx.shadowBlur = 0;
      });
    }

    function draw(open: number, dt: number) {
      if (!ctx) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      }
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);

      // Roll-up door: the bottom rail lifts, so the reveal grows off the floor.
      const doorEdge = FLOOR_Y - OPEN_H * open;

      // ---- inside of the unit, revealed below the door
      ctx.save();
      ctx.beginPath();
      ctx.rect(OPEN_X, doorEdge, OPEN_W, Math.max(0, FLOOR_Y - doorEdge));
      ctx.clip();

      ctx.fillStyle = VOID;
      ctx.fillRect(OPEN_X, OPEN_Y, OPEN_W, OPEN_H);
      rain(dt, open);

      const vig = ctx.createLinearGradient(0, OPEN_Y, 0, OPEN_Y + 60);
      vig.addColorStop(0, "rgba(4,8,14,.95)");
      vig.addColorStop(1, "rgba(4,8,14,0)");
      ctx.fillStyle = vig;
      ctx.fillRect(OPEN_X, OPEN_Y, OPEN_W, 60);
      ctx.restore();

      // ---- the door itself
      if (open < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(OPEN_X, OPEN_Y, OPEN_W, Math.max(0, doorEdge - OPEN_Y));
        ctx.clip();

        // slats are pinned to the bottom rail so they travel up with it
        for (let y = doorEdge; y > OPEN_Y - SLAT; y -= SLAT) {
          const g = ctx.createLinearGradient(0, y - SLAT, 0, y);
          g.addColorStop(0, DOOR_HI);
          g.addColorStop(0.78, DOOR_LO);
          ctx.fillStyle = g;
          ctx.fillRect(OPEN_X, y - SLAT, OPEN_W, SLAT);
          ctx.fillStyle = SEAM;
          ctx.fillRect(OPEN_X, y - 1.2, OPEN_W, 1.2);
        }

        // pull handle on the bottom rail
        const hy = doorEdge - 26;
        if (hy > OPEN_Y + 6) {
          ctx.fillStyle = "#4C6584";
          roundRect(ctx, W / 2 - 26, hy, 52, 6, 3);
          ctx.fill();
          ctx.fillStyle = BLUE;
          ctx.fillRect(W / 2 - 26, hy + 4.6, 52, 1.4);
        }

        // bottom rail catches light spilling from inside the unit
        ctx.fillStyle = `rgba(0,164,236,${0.1 + 0.35 * open})`;
        ctx.fillRect(OPEN_X, doorEdge - 1.6, OPEN_W, 1.6);
        ctx.restore();
      }

      // ---- steel frame, drum housing, apron
      const steel = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
      steel.addColorStop(0, "#182334");
      steel.addColorStop(1, INK);
      ctx.fillStyle = steel;
      ctx.fillRect(0, 0, W, OPEN_Y); // header
      ctx.fillRect(0, 0, OPEN_X, FLOOR_Y + FRAME); // left jamb
      ctx.fillRect(OPEN_X + OPEN_W, 0, OPEN_X, FLOOR_Y + FRAME);
      ctx.fillStyle = APRON;
      ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y); // concrete apron

      // lip around the doorway, so the unit reads as built on light or dark pages
      ctx.strokeStyle = "#33445F";
      ctx.lineWidth = 2;
      ctx.strokeRect(OPEN_X - 1, OPEN_Y - 1, OPEN_W + 2, OPEN_H + 2);
      ctx.fillStyle = "#3E5170";
      ctx.fillRect(OPEN_X - 2, FLOOR_Y, OPEN_W + 4, 2.5); // threshold

      // drum housing: two rails hinting at the coiled door above the opening
      ctx.fillStyle = "#16202F";
      roundRect(ctx, OPEN_X - 3, OPEN_Y - HOUSING, OPEN_W + 6, HOUSING, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.07)";
      ctx.lineWidth = 1;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(OPEN_X, OPEN_Y - HOUSING + i * 5);
        ctx.lineTo(OPEN_X + OPEN_W, OPEN_Y - HOUSING + i * 5);
        ctx.stroke();
      }

      // light spilling out of the unit onto the concrete
      if (open > 0.01) {
        const spill = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
        spill.addColorStop(0, `rgba(0,164,236,${0.3 * open})`);
        spill.addColorStop(1, "rgba(0,164,236,0)");
        ctx.fillStyle = spill;
        ctx.beginPath();
        ctx.moveTo(OPEN_X, FLOOR_Y);
        ctx.lineTo(OPEN_X + OPEN_W, FLOOR_Y);
        ctx.lineTo(OPEN_X + OPEN_W + 14, H);
        ctx.lineTo(OPEN_X - 14, H);
        ctx.closePath();
        ctx.fill();
      }

      // painted stripe on the apron
      ctx.fillStyle = "rgba(0,164,236,.22)";
      ctx.fillRect(0, H - 5, W, 2);
    }

    function loop(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const current = progressRef.current;
      const indeterminate = current === undefined;

      // Indeterminate has no fraction to track, so the door isn't a
      // progress meter here -- it's a one-time "unlocked" reveal: open
      // fully, then hold. (An earlier version eased toward a small
      // oscillating target instead, so the door only ever cracked ~12-22%
      // open and then visibly sank back down mid-breathe -- both reading
      // as broken, and leaving too thin a sliver of the unit visible for
      // the rain inside it to ever be noticed.) The continuously-falling
      // rain -- see above, never fully stopped even under reduced motion
      // -- is what now carries the "still working" signal for however
      // long the real fetch takes; the door itself doesn't need to keep
      // moving once it's told this story.
      const goal = indeterminate ? 1 : clamp01(current);

      // The determinate case still eases toward real progress so a jump
      // from 10% to 80% reads as being pulled up rather than teleporting,
      // snapping instantly under reduced motion instead (a real value
      // change, not decorative motion). The indeterminate reveal keeps a
      // deliberate, visible speed regardless -- reduced motion shortens
      // it rather than making it instant, so the "unlocking" moment still
      // reads as an event instead of the loader just appearing open.
      const ease = indeterminate
        ? Math.min(dt * (reduceMotion ? 3.4 : 1.8), 1)
        : reduceMotion
          ? 1
          : Math.min(dt * 3.2, 1);
      shown += (goal - shown) * ease;

      const clamped = indeterminate ? 0 : clamp01(current);
      if (!opened && shown > 0.995 && !indeterminate && clamped >= 1) {
        opened = true;
        onOpenRef.current?.();
      }

      const pct = Math.round(clamped * 100);
      const pctText = indeterminate ? "" : `${pct}%`;
      if (pctRef.current && pctRef.current.textContent !== pctText) {
        pctRef.current.textContent = pctText;
      }
      hostEl.setAttribute("aria-valuenow", String(pct));

      draw(shown, dt);
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      if (onWinResize) removeEventListener("resize", onWinResize);
    };
  }, [background, maxScale]);

  return (
    <div
      ref={hostRef}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`flex w-full flex-col items-center gap-3 ${className ?? ""}`}
    >
      {/* Sized by width alone (aspect-ratio, not a fixed height) so the
          unit fills whatever width the caller gives it -- letting it
          match a full-width section like the search page's sync-note box
          instead of floating at a fixed size inside a wider container. */}
      <canvas ref={canvasRef} className="aspect-[320/264] w-full" />
      <p className="m-0 flex items-baseline gap-2 text-sm text-slate-400">
        <span>{label}</span>
        <span ref={pctRef} className="font-semibold tabular-nums text-slate-100" />
      </p>
    </div>
  );
}
