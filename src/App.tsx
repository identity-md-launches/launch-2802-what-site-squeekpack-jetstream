import { useRef, useState } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { GameArea, type GameControl } from "./GameArea";
import { TelemetryPanel } from "./TelemetryPanel";
import { WalletSheet } from "./WalletSheet";
import { AboutView, HelpView, LeaderboardView, ResultView } from "./Views";
import { HamsterMark, Icon } from "./Icons";
import { useTelemetry, modeFor } from "./telemetry";
import { number, shortAddress, OFFICIAL_URL } from "./config";
import { readRuns, saveRun, mergeRuns, bestForPlayer } from "./storage";
import type { Run } from "./types";

type View = "none" | "help" | "about" | "leaderboard" | "result" | "wallet";
export default function App() {
  const telemetry = useTelemetry(),
    { address, isConnected, chainId } = useConnection();
  const { mutateAsync: switchChain, isPending: switchingChain } =
    useSwitchChain();
  const [view, setView] = useState<View>("none"),
    [returnView, setReturnView] = useState<View>("none");
  const [muted, setMuted] = useState(true),
    [score, setScore] = useState(0);
  const [runs, setRuns] = useState(readRuns),
    [result, setResult] = useState<Run | null>(null),
    [saved, setSaved] = useState(true);
  const game = useRef<GameControl | null>(null);
  const live = telemetry.status === "live",
    data = telemetry.data;
  const mode = modeFor(data, live),
    best = bestForPlayer(runs, address)?.score ?? 0;
  const play = () => {
    setView("none");
    window.setTimeout(() => game.current?.start(), 0);
  };
  const close = () => setView("none");
  const persist = (run: Run) => {
    const next = saveRun(run);
    setRuns(next.runs);
    setSaved(next.saved);
    setResult(run);
  };
  const walletAction = async () => {
    if (isConnected && chainId !== 1) {
      try {
        await switchChain({ chainId: 1 });
      } catch {
        openWallet();
      }
    } else openWallet();
  };
  const finish = (run: Run) => {
    persist(run);
    setView("result");
  };
  const openWallet = () => {
    setReturnView(view === "result" ? "result" : "none");
    setView("wallet");
  };
  return (
    <>
      <a className="skip-link" href="#arcade">
        Skip to the arcade
      </a>
      <div className="site-shell">
        <header className="site-header">
          <a className="brand" href="#arcade">
            <HamsterMark />
            <span>
              SqueekPack
              <span className="brand-byline">A Squeekchain arcade</span>
            </span>
          </a>
          <nav className="main-nav" aria-label="Main navigation">
            <a className="active" href="#arcade">
              The arcade
            </a>
            <button onClick={() => setView("leaderboard")}>
              Hall of Squeeks
            </button>
            <button onClick={() => setView("about")}>
              About the hamster <Icon name="info" size={13} />
            </button>
          </nav>
          <div className="header-actions">
            <button
              className="icon-button sound-button"
              onClick={() => setMuted(!muted)}
              aria-label={muted ? "Unmute game audio" : "Mute game audio"}
              aria-pressed={!muted}
            >
              <Icon name={muted ? "mute" : "sound"} />
            </button>
            <button
              className="wallet-button"
              disabled={switchingChain}
              onClick={walletAction}
            >
              <Icon name="wallet" size={17} />
              <span>
                {switchingChain
                  ? "Switching…"
                  : isConnected && chainId !== 1
                    ? "Switch to Ethereum"
                    : isConnected && address
                      ? shortAddress(address)
                      : "Connect wallet"}
              </span>
            </button>
          </div>
        </header>
        <main id="arcade">
          <div className="page-heading">
            <div>
              <div className="title-line">
                <h1>
                  Jetstream Run
                  <span className="title-spark" aria-hidden="true">
                    ✳
                  </span>
                </h1>
              </div>
              <p>A tiny jetpack powered by a real hamster.</p>
            </div>
            <div className="edition-stamp">
              <span className="data">Endless runner / Vol. 01</span>
              <span>Built for the Squeekchain ecosystem</span>
            </div>
          </div>
          <div className="telemetry-bar">
            <button className="live-pill" onClick={() => setView("about")}>
              <span className={`status-dot ${live ? "orange-dot" : ""}`} />
              <strong>Squeektoshi</strong>
              <span className="data">
                {data ? `${data.rpm.toFixed(1)} RPM` : "N/A RPM"}
              </span>
              <span className="hamster-pill-status">
                {live
                  ? data && data.rpm > 0
                    ? "SPINNING 🔥"
                    : "SLEEPING 💤"
                  : telemetry.status === "loading"
                    ? "Connecting"
                    : telemetry.status === "stale"
                      ? "Stale reading"
                      : "Signal offline"}
              </span>
              <Icon name="chevron" size={13} />
            </button>
            <div className="session-data">
              <span>
                Block{" "}
                <strong className="data">
                  {data?.block ? `#${number(data.block)}` : "N/A"}
                </strong>
              </span>
              <span className="score">
                Score{" "}
                <strong className="data">
                  {number(score).padStart(5, "0")}
                </strong>
              </span>
            </div>
          </div>
          <div className="play-layout">
            <GameArea
              mode={mode}
              telemetry={data}
              muted={muted}
              blocked={view !== "none"}
              control={game}
              onResult={finish}
              onHelp={() => setView("help")}
              onScore={setScore}
            />
            <TelemetryPanel
              telemetry={telemetry}
              onInspect={() => setView("about")}
            />
          </div>
          <div className="below-game">
            <div className="best-score">
              <Icon name="trophy" size={20} />
              <span>Personal best</span>
              <strong className="data">
                {number(best)} <small>pts</small>
              </strong>
              <span className="small muted device-note">on this device</span>
            </div>
            <div className="quick-links">
              <button onClick={() => setView("help")}>
                <Icon name="controls" size={18} /> How to play
              </button>
              <button onClick={() => setView("leaderboard")}>
                Hall of Squeeks <Icon name="arrow" size={17} />
              </button>
            </div>
          </div>
          <section className="field-notes" aria-label="Arcade field notes">
            <div className="note-intro">
              <span className="note-mark" aria-hidden="true">
                ✳
              </span>
              <h2>
                Small paws.
                <br />
                Serious horsepower.
              </h2>
            </div>
            <div className="field-note">
              <Icon name="wheel" size={24} />
              <div>
                <h3>A real hamster sets the pace.</h3>
                <p>
                  Wheel spinning? Catch a tailwind. Hamster napping? Welcome to
                  the Night Shift.
                </p>
                <button
                  className="text-action"
                  onClick={() => setView("about")}
                >
                  Meet Squeektoshi <Icon name="arrow" size={16} />
                </button>
              </div>
            </div>
            <div className="field-note">
              <Icon name="wallet" size={24} />
              <div>
                <h3>Sign your score when you’re ready.</h3>
                <p>
                  No wallet needed to play. Connect to sign a high score and
                  save your bragging rights.
                </p>
                <span className="small muted">
                  No gas fees for message signatures.
                </span>
              </div>
            </div>
          </section>
        </main>
        <footer className="site-footer">
          <span>
            <HamsterMark size={21} /> Powered by Proof of Hamster.
          </span>
          <span>Made for small pilots with big ambitions.</span>
          <a href={OFFICIAL_URL} target="_blank" rel="noreferrer">
            Squeekchain <Icon name="external" size={13} />
          </a>
        </footer>
      </div>
      {view === "help" && <HelpView onClose={close} onPlay={play} />}
      {view === "about" && <AboutView telemetry={telemetry} onClose={close} />}
      {view === "leaderboard" && (
        <LeaderboardView
          runs={runs}
          round={live ? (data?.round ?? null) : null}
          address={address}
          onClose={close}
          onPlay={play}
          onImport={(incoming) => {
            const next = mergeRuns(incoming);
            setRuns(next.runs);
            return next.saved;
          }}
        />
      )}
      {view === "result" && result && (
        <ResultView
          run={result}
          telemetry={telemetry}
          onClose={close}
          onPlay={play}
          onLeaderboard={() => setView("leaderboard")}
          onWallet={openWallet}
          onSave={persist}
          saved={saved}
        />
      )}
      {view === "wallet" && <WalletSheet onClose={() => setView(returnView)} />}
    </>
  );
}
