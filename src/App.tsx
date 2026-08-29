import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { StackEngine } from "./game/engine";
import type { Hud } from "./game/engine";
import { sfx } from "./game/audio";

const INITIAL: Hud = {
  phase: "menu",
  score: 0,
  best: 0,
  combo: 0,
  maxCombo: 0,
  perfects: 0,
  blocks: 0,
  newBest: false,
  clutch: false,
};

const IS_TOUCH =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

/* ------------------------------- icons (SVG) ------------------------------ */

function Svg({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const PlayIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />
  </Svg>
);
const PauseIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M8 5v14M16 5v14" />
  </Svg>
);
const SoundOnIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
  </Svg>
);
const SoundOffIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
    <path d="M17 9.5l5 5M22 9.5l-5 5" />
  </Svg>
);
const RestartIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3" />
    <path d="M3.5 3.5v5h5" />
  </Svg>
);
const SkullIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M12 2a8 8 0 0 0-8 8c0 2.6 1.2 4.8 3 6.2V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3.8c1.8-1.4 3-3.6 3-6.2a8 8 0 0 0-8-8z" />
    <circle cx="9" cy="11" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="15" cy="11" r="1.7" fill="currentColor" stroke="none" />
    <path d="M10.5 21v-2.5M13.5 21v-2.5" />
  </Svg>
);
const TapIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="13" r="2.6" fill="currentColor" stroke="none" />
    <path d="M12 3.5a9.5 9.5 0 0 1 9.5 9.5" />
    <path d="M12 7a6 6 0 0 1 6 6" />
    <path d="M12 20.5A9.5 9.5 0 0 1 2.5 13" />
  </Svg>
);
const TargetIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.5" />
    <circle cx="12" cy="12" r="0.4" fill="currentColor" />
  </Svg>
);
const HomeIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6.5 9.5V20h11V9.5" />
  </Svg>
);
const BoltIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" stroke="none" />
  </Svg>
);
const FullscreenIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </Svg>
);
const FullscreenExitIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 14h6v6m10-10h-6V4m0 6 7-7M3 21l7-7" />
  </Svg>
);

/* ------------------------------ small pieces ------------------------------ */

function GameButton({
  variant = "btn-amber",
  className = "",
  onClick,
  children,
  label,
}: {
  variant?: string;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.currentTarget.blur();
        onClick?.();
      }}
      className={`btn ${variant} ${className}`}
    >
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: ReactNode;
  color: string;
}) {
  return (
    <div className="border-2 border-ink bg-[#0a1320] px-3 py-2">
      <div className="text-[10px] font-bold tracking-[0.2em] text-white/45">
        {label}
      </div>
      <div className={`font-display text-2xl leading-tight tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}

function Key({ k }: { k: string }) {
  return <span className="keycap">{k}</span>;
}

/* -------------------------------- overlays -------------------------------- */

function MenuOverlay({ best, onStart }: { best: number; onStart: () => void }) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[rgba(4,8,16,0.52)] p-4"
      onPointerDown={onStart}
    >
      <div
        className="w-full max-w-lg animate-pop py-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="relative -rotate-1">
          {best > 0 && (
            <div className="absolute -top-4 right-1 z-10 rotate-3 border-[3px] border-ink bg-amber px-3 py-1 font-display text-sm text-[#231a02] shadow-[4px_4px_0_rgba(0,0,0,0.5)]">
              BEST {best}
            </div>
          )}
          <h1 className="title-shadow animate-float font-display text-[17vw] leading-[0.9] text-white sm:text-[96px] lg:text-[116px]">
            STACK<span className="text-coral">R</span>
          </h1>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-cyanx sm:mt-4 sm:text-[13px] sm:tracking-[0.22em]">
            one tap · infinite tower · zero excuses
          </p>
        </div>

        <div className="panel mt-6 rotate-[0.6deg] p-4 sm:p-5">
          <div className="text-[11px] font-bold tracking-[0.28em] text-white/45">
            HOW TO COOK
          </div>
          <ul className="mt-3 space-y-3 text-sm font-medium leading-snug text-white/85">
            <li className="flex items-start gap-3">
              <TapIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber" />
              <span>
                Tap, click or hit <Key k="SPACE" /> to drop the sliding block on
                the tower.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <TargetIcon className="mt-0.5 h-5 w-5 shrink-0 text-cyanx" />
              <span>
                Land it flush for a <b className="text-lime">PERFECT</b> — your
                heat rises and the block grows back.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <SkullIcon className="mt-0.5 h-5 w-5 shrink-0 text-coral" />
              <span>
                Hang off the edge and it gets sliced. Miss completely?{" "}
                <b className="text-coral">Tower&apos;s done.</b>
              </span>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">
            <span className="chip text-lime">PERFECT +20</span>
            <span className="chip text-lime">+5 / HEAT</span>
            <span className="chip text-amber">SLICE +10</span>
            <span className="chip text-cyanx">ALT 10 = +30</span>
            <span className="chip text-coral">MISS = L</span>
          </div>
        </div>

        <GameButton
          className="mt-6 w-full px-8 py-4 text-2xl"
          onClick={onStart}
          label="Start game"
        >
          <PlayIcon className="h-6 w-6" />
          LET&apos;S COOK
        </GameButton>
        <p className="mt-3 text-center text-[11px] font-bold tracking-[0.28em] text-white/40">
          {IS_TOUCH ? "OR TAP ANYWHERE" : "OR SMASH SPACE"}
        </p>

        <div className="mt-5 flex items-center justify-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-white/50">
          <span>BUILT BY</span>
          <a
            href="https://github.com/codewithabhiishek"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-amber underline decoration-amber/40 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
          >
            ABHISHEK ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function OverOverlay({
  hud,
  onRetry,
  onMenu,
}: {
  hud: Hud;
  onRetry: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[rgba(6,4,10,0.55)] p-4">
      <div className="w-full max-w-md animate-pop py-4">
        <div className="flex -rotate-1 items-center gap-2.5 sm:gap-3">
          <SkullIcon className="h-9 w-9 shrink-0 text-coral sm:h-12 sm:w-12" />
          <div>
            <h2 className="title-shadow-sm font-display text-4xl leading-none text-white sm:text-6xl">
              FUMBLED.
            </h2>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-white/55">
              the tower said L + ratio
            </p>
          </div>
        </div>

        <div className="panel mt-6 p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold tracking-[0.28em] text-white/45">
                SCORE
              </div>
              <div className="font-display text-5xl leading-none tabular-nums text-amber sm:text-6xl">
                {hud.score}
              </div>
            </div>
            {hud.newBest && (
              <div className="animate-blink-soft rotate-3 border-[3px] border-ink bg-lime px-2.5 py-1 font-display text-xs text-[#0f1a02] shadow-[3px_3px_0_rgba(0,0,0,0.5)]">
                NEW BEST
              </div>
            )}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <Stat label="BEST" value={hud.best} color="text-cyanx" />
            <Stat label="MAX HEAT" value={`×${hud.maxCombo}`} color="text-lime" />
            <Stat label="HEIGHT" value={hud.blocks} color="text-coral" />
          </div>
          <div className="mt-3 text-center text-[11px] font-bold tracking-[0.24em] text-white/40">
            {hud.perfects} PERFECT {hud.perfects === 1 ? "DROP" : "DROPS"}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <GameButton
            className="w-full px-6 py-3.5 text-xl"
            onClick={onRetry}
            label="Play again"
          >
            <RestartIcon className="h-5 w-5" />
            RUN IT BACK
          </GameButton>
          <GameButton
            variant="btn-ghost"
            className="w-full px-6 py-2.5 text-sm"
            onClick={onMenu}
            label="Back to menu"
          >
            <HomeIcon className="h-4 w-4" />
            MENU
          </GameButton>
        </div>

        <div className="mt-5 text-center font-mono text-[10.5px] tracking-[0.14em] text-white/40">
          BUILT BY{" "}
          <a
            href="https://github.com/codewithabhiishek"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-amber underline decoration-amber/30 underline-offset-2 transition-colors hover:text-white"
          >
            ABHISHEK ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function PauseOverlay({
  onResume,
  onRestart,
  onMenu,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(4,8,16,0.62)] p-4">
      <div className="w-full max-w-xs animate-pop text-center">
        <PauseIcon className="mx-auto h-10 w-10 text-cyanx" />
          <h2 className="title-shadow-sm mt-3 font-display text-4xl text-white sm:text-5xl">
            PAUSED
          </h2>        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.24em] text-white/50">
          the tower can wait. probably.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <GameButton
            className="w-full py-3.5 text-lg"
            onClick={onResume}
            label="Resume"
          >
            <PlayIcon className="h-5 w-5" />
            RESUME
          </GameButton>
          <GameButton
            variant="btn-cyan"
            className="w-full py-2.5 text-sm"
            onClick={onRestart}
            label="Restart"
          >
            <RestartIcon className="h-4 w-4" />
            RESTART
          </GameButton>
          <GameButton
            variant="btn-ghost"
            className="w-full py-2.5 text-sm"
            onClick={onMenu}
            label="Back to menu"
          >
            <HomeIcon className="h-4 w-4" />
            MENU
          </GameButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- app ----------------------------------- */

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<StackEngine | null>(null);
  const [hud, setHud] = useState<Hud>(INITIAL);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new StackEngine(canvas, setHud);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      sfx.setMuted(!m);
      return !m;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    sfx.ui();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyM") toggleMute();
      if (e.code === "KeyF") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleMute, toggleFullscreen]);

  const start = useCallback(() => {
    sfx.unlock();
    sfx.ui();
    engineRef.current?.startGame();
  }, []);
  const toMenu = useCallback(() => {
    sfx.ui();
    engineRef.current?.toMenu();
  }, []);
  const togglePause = useCallback(() => {
    sfx.ui();
    engineRef.current?.togglePause();
  }, []);

  const inGame = hud.phase !== "menu";

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-ink font-body text-white"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full cursor-pointer touch-none"
      />

      {/* ------------------------------- HUD ------------------------------- */}
      {inGame && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-2 pb-2 pt-[max(0.6rem,env(safe-area-inset-top))] sm:gap-3 sm:p-5 sm:pt-5">
            <div
              className={`panel relative px-3 py-2 sm:px-5 sm:py-3 ${
                hud.clutch ? "animate-clutch" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 sm:h-2.5 sm:w-2.5 ${
                    hud.clutch ? "bg-coral" : "bg-lime"
                  }`}
                />
                <span className="text-[10px] font-bold tracking-[0.24em] text-cyanx sm:text-[11px]">
                  SCORE
                </span>
              </div>
              <div className="font-display text-3xl leading-none tabular-nums sm:text-4xl lg:text-5xl">
                {hud.score}
              </div>
              {hud.clutch && (
                <div className="absolute -right-3 -top-3 rotate-6 border-2 border-ink bg-coral px-2 py-0.5 font-display text-[10px] text-[#1c0506]">
                  CLUTCH
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 sm:gap-2.5">
              <div className="panel px-3 py-1.5 text-right sm:px-4 sm:py-2">
                <div>
                  <span className="text-[10px] font-bold tracking-[0.24em] text-amber sm:text-[11px]">
                    BEST
                  </span>
                  <span className="ml-2 font-display text-lg tabular-nums sm:text-xl">
                    {hud.best}
                  </span>
                </div>
                <div className="mt-0.5">
                  <span className="text-[10px] font-bold tracking-[0.24em] text-cyanx/70">
                    HIGH
                  </span>
                  <span className="ml-2 font-display text-sm tabular-nums text-white/85">
                    {hud.blocks}
                  </span>
                </div>
              </div>
              <div className="pointer-events-auto flex gap-2">
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={hud.phase === "paused" ? "Resume" : "Pause"}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    togglePause();
                  }}
                >
                  {hud.phase === "paused" ? (
                    <PlayIcon className="h-5 w-5" />
                  ) : (
                    <PauseIcon className="h-5 w-5" />
                  )}
                </button>
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen (F)"}
                  title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    toggleFullscreen();
                  }}
                >
                  {isFullscreen ? (
                    <FullscreenExitIcon className="h-5 w-5" />
                  ) : (
                    <FullscreenIcon className="h-5 w-5" />
                  )}
                </button>
                <button
                  type="button"
                  className="iconbtn"
                  aria-label={muted ? "Unmute" : "Mute"}
                  title={muted ? "Unmute (M)" : "Mute (M)"}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    toggleMute();
                  }}
                >
                  {muted ? (
                    <SoundOffIcon className="h-5 w-5" />
                  ) : (
                    <SoundOnIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* heat combo meter */}
          {hud.combo >= 2 && hud.phase === "playing" && (
            <div className="pointer-events-none absolute bottom-[max(3.8rem,env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 sm:bottom-20">
              <div key={hud.combo} className="animate-combo-pop panel px-3 py-2 sm:px-4 sm:py-2.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.22em] text-lime">
                    <BoltIcon className="h-3.5 w-3.5" />
                    HEAT
                  </span>
                  <span className="font-display text-lg leading-none text-white">
                    ×{hud.combo}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-36 border-2 border-ink bg-[#0a1320] sm:w-48">
                  <div
                    className="heatbar h-full transition-[width] duration-200 ease-out"
                    style={{ width: `${Math.min(100, (hud.combo / 12) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* control hints (responsive for desktop & mobile) */}
          <div className="pointer-events-none absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2.5 sm:flex">
            <Key k="SPACE" />
            <span className="text-[11px] font-bold tracking-[0.18em] text-white/50">
              DROP
            </span>
            <Key k="P" />
            <span className="text-[11px] font-bold tracking-[0.18em] text-white/50">
              PAUSE
            </span>
            <Key k="F" />
            <span className="text-[11px] font-bold tracking-[0.18em] text-white/50">
              FULLSCREEN
            </span>
            <Key k="R" />
            <span className="text-[11px] font-bold tracking-[0.18em] text-white/50">
              RESTART
            </span>
            <Key k="M" />
            <span className="text-[11px] font-bold tracking-[0.18em] text-white/50">
              MUTE
            </span>
          </div>
          {hud.phase === "playing" && (
            <div className="animate-blink-soft pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 text-[11px] font-bold tracking-[0.34em] text-white/50 sm:hidden">
              TAP TO DROP
            </div>
          )}
        </>
      )}

      {/* ----------------------------- overlays ---------------------------- */}
      {hud.phase === "menu" && <MenuOverlay best={hud.best} onStart={start} />}
      {hud.phase === "over" && (
        <OverOverlay hud={hud} onRetry={start} onMenu={toMenu} />
      )}
      {hud.phase === "paused" && (
        <PauseOverlay
          onResume={togglePause}
          onRestart={start}
          onMenu={toMenu}
        />
      )}

      {/* persistent corner branding */}
      <div className="pointer-events-auto absolute bottom-2 right-3 z-10 hidden font-mono text-[10px] tracking-[0.14em] text-white/40 sm:block">
        BUILT BY{" "}
        <a
          href="https://github.com/codewithabhiishek"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-white/70 underline decoration-white/20 transition-colors hover:text-amber hover:decoration-amber"
        >
          ABHISHEK ↗
        </a>
      </div>
    </div>
  );
}
