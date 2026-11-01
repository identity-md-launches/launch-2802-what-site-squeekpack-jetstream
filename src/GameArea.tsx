import { useEffect, useRef, useState } from "react";
import { ArcadeEngine, type GameStats } from "./game";
import type { GamePhase, Mode, Run, Telemetry } from "./types";
import { Icon } from "./Icons";
import { number } from "./config";

export type GameControl = { start: () => void; pause: () => void };
export function GameArea({
  mode,
  telemetry,
  muted,
  blocked,
  control,
  onResult,
  onHelp,
  onScore,
}: {
  mode: Mode;
  telemetry: Telemetry | null;
  muted: boolean;
  blocked: boolean;
  control: React.RefObject<GameControl | null>;
  onResult: (run: Run) => void;
  onHelp: () => void;
  onScore: (score: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<ArcadeEngine | null>(null);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    distance: 0,
    coins: 0,
    shield: 0,
  });
  const [failure, setFailure] = useState(false);
  const current = useRef({ mode, telemetry, onResult, onScore });
  current.current = { mode, telemetry, onResult, onScore };
  useEffect(() => {
    if (!canvas.current) return;
    let game: ArcadeEngine;
    try {
      game = new ArcadeEngine(
        canvas.current,
        (next) => {
          setStats(next);
          current.current.onScore(next.score);
        },
        (next) => {
          setPhase(next);
          if (next === "over") {
            const { telemetry: t, mode: m } = current.current;
            current.current.onResult({
              id: crypto.randomUUID(),
              score: game.stats.score,
              distance: game.stats.distance,
              coins: game.stats.coins,
              mode: m,
              modes: [...game.modes],
              block: m === "Practice" ? null : (t?.block ?? null),
              round: m === "Practice" ? null : (t?.round ?? null),
              date: new Date().toISOString(),
              duration: Math.round(game.elapsed * 1000),
            });
          }
        },
      );
    } catch {
      setFailure(true);
      return;
    }
    engine.current = game;
    control.current = {
      start: () => {
        game.start();
        canvas.current?.focus({ preventScroll: true });
      },
      pause: () => {
        if (game.phase === "running") game.togglePause();
      },
    };
    const observer = new ResizeObserver(game.resize);
    observer.observe(canvas.current);
    const visible = () => {
      if (document.hidden && game.phase === "running") game.togglePause();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      game.destroy();
      observer.disconnect();
      document.removeEventListener("visibilitychange", visible);
      control.current = null;
    };
  }, [control]);
  useEffect(() => {
    const game = engine.current;
    if (!game) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      game.input = {
        mode,
        rpm: telemetry?.rpm ?? 0,
        muted,
        reducedMotion: media.matches,
      };
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [mode, muted, telemetry]);
  useEffect(() => {
    if (blocked && engine.current?.phase === "running")
      engine.current.togglePause();
  }, [blocked]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        blocked ||
        event.repeat ||
        (event.target instanceof HTMLElement &&
          event.target.closest("button, a, input, select, textarea, dialog"))
      )
        return;
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        engine.current?.boost();
      }
      if (event.code === "KeyP" || event.code === "Escape") {
        event.preventDefault();
        engine.current?.togglePause();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [blocked]);
  const boost = () => {
    if (!blocked) {
      engine.current?.boost();
      canvas.current?.focus({ preventScroll: true });
    }
  };
  return (
    <section
      className={`arcade ${phase === "running" ? "is-running" : ""}`}
      aria-label="Jetstream Run arcade"
    >
      <div className="game-toolbar">
        <div className="game-live">
          <span className="tiny-cross">+</span> <span>Mine shaft 01</span>
        </div>
        <div className="game-toolbar-right">
          <span className="data">
            {mode === "Zoomies" ? "2×" : "1×"} points
          </span>
          <button
            className="icon-button"
            aria-label="How to play"
            onClick={onHelp}
          >
            <Icon name="controls" size={18} />
          </button>
          <button
            className="icon-button"
            aria-label={phase === "paused" ? "Resume game" : "Pause game"}
            disabled={phase !== "running" && phase !== "paused"}
            onClick={() => engine.current?.togglePause()}
          >
            <Icon name={phase === "paused" ? "play" : "pause"} size={18} />
          </button>
        </div>
      </div>
      <div className="game-stage">
        <canvas
          ref={canvas}
          tabIndex={0}
          role="img"
          aria-label="Jetstream Run. Press Space or tap to boost. Press P to pause."
          onPointerDown={(e) => {
            if (e.button === 0) {
              e.preventDefault();
              boost();
            }
          }}
        />
        {phase === "idle" && (
          <div className="idle-overlay">
            <div className="idle-copy">
              <h2>
                Clock in.
                <br />
                <span>Jet out.</span>
              </h2>
              <p>Guide a jetpack hamster through the mine.</p>
              <button className="primary start-button" onClick={boost}>
                <Icon name="play" size={18} /> Start run{" "}
                <Icon name="arrow" size={18} />
              </button>
              <span className="start-hint">
                Tap or press <kbd>Space</kbd> to boost
              </span>
            </div>
            <div className="pilot-label data">
              <span className="pilot-line" />
              Squeektoshi, pilot
            </div>
            <div className="scene-caption data">
              <span>One very small horsepower</span>
            </div>
          </div>
        )}
        {phase === "running" && (
          <div className="in-game-hud" aria-hidden="true">
            <span>
              {number(stats.score)} <small>pts</small>
            </span>
            <span>
              <Icon name="coin" size={17} /> {stats.coins}
            </span>
            {stats.shield > 0 && (
              <span className="shield">
                <Icon name="shield" size={17} /> {stats.shield.toFixed(1)}s
              </span>
            )}
          </div>
        )}
        {phase === "paused" && (
          <div className="pause-overlay">
            <Icon name="pause" size={32} />
            <h2>Taking a breather.</h2>
            <p>Your run is paused.</p>
            <button className="primary" onClick={boost}>
              <Icon name="play" /> Resume run
            </button>
          </div>
        )}
        {phase === "over" && (
          <div className="end-overlay">
            <span className="data">Run complete</span>
            <h2>{number(stats.score)} points</h2>
            <button className="primary" onClick={boost}>
              <Icon name="refresh" /> Play again
            </button>
          </div>
        )}
        {failure && (
          <div className="pause-overlay">
            <h2>Canvas unavailable</h2>
            <p>Open this page in a browser with Canvas 2D support.</p>
          </div>
        )}
      </div>
      <div
        className={`mode-strip mode-${mode.toLowerCase().replace(" ", "-")}`}
      >
        <div>
          <Icon
            name={
              mode === "Zoomies"
                ? "bolt"
                : mode === "Night Shift"
                  ? "moon"
                  : "controls"
            }
            size={18}
          />
          <strong>
            {mode === "Practice" ? "Practice mode" : `${mode} active`}
          </strong>
          <span className="mode-explanation">
            {mode === "Zoomies"
              ? "Catch a tailwind and double points."
              : mode === "Night Shift"
                ? "Heavier gravity while the hamster rests."
                : "Waiting for fresh wheel telemetry."}
          </span>
        </div>
        <span className="data">
          {mode === "Zoomies" ? "2×" : "1×"} multiplier
        </span>
      </div>
      <div className="controls-strip">
        <span>
          <kbd>Space</kbd>
          <span>or</span>
          <Icon name="controls" size={17} />
          <span>tap to boost</span>
        </span>
        <span>
          <kbd>P</kbd> pause{" "}
          <span className="extra-controls">
            · Dodge pipes and collect coins.
          </span>
        </span>
      </div>
    </section>
  );
}
