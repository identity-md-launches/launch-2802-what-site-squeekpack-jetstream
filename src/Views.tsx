import { useRef, useState } from "react";
import {
  useConnection,
  useSignMessage,
  useSwitchChain,
  usePublicClient,
} from "wagmi";
import { recoverMessageAddress, isAddressEqual } from "viem";
import { Modal } from "./Modal";
import { Icon } from "./Icons";
import { WheelGraphic } from "./TelemetryPanel";
import {
  API_URL,
  OFFICIAL_URL,
  WHITEPAPER_URL,
  number,
  shortAddress,
} from "./config";
import { downloadRuns, scoreMessage, rankRuns, bestForPlayer } from "./storage";
import type { Run, TelemetryState } from "./types";
import { parseSignedScores } from "./importScores";

export function HelpView({
  onClose,
  onPlay,
}: {
  onClose: () => void;
  onPlay: () => void;
}) {
  return (
    <Modal title="A little boost goes a long way." onClose={onClose}>
      <p className="modal-intro">
        Keep Squeektoshi in the air. Fly between the copper pipes and see how
        far your whiskers take you.
      </p>
      <div className="control-guide">
        <div>
          <Icon name="controls" size={28} />
          <strong>Tap or left-click</strong>
          <span>Mobile & desktop</span>
        </div>
        <span>or</span>
        <div>
          <kbd>Space</kbd>
          <strong>Press to boost</strong>
          <span>
            <kbd>P</kbd> or <kbd>Esc</kbd> to pause
          </span>
        </div>
      </div>
      <div className="legend-list">
        <div>
          <Icon name="coin" />
          <div>
            <strong>$SQK coin</strong>
            <p>
              +50 points. Worth +100 in Zoomies. Arcade collectibles have no
              token value.
            </p>
          </div>
        </div>
        <div>
          <Icon name="nut" />
          <div>
            <strong>The Golden Nut</strong>
            <p>
              Three seconds of invulnerability. Fly through pipes and bounce off
              the mine edges.
            </p>
          </div>
        </div>
        <div>
          <Icon name="bolt" />
          <div>
            <strong>Zoomies</strong>
            <p>
              When the real wheel spins, a faster tailwind and a 2× multiplier
              kick in.
            </p>
          </div>
        </div>
        <div>
          <Icon name="moon" />
          <div>
            <strong>Night Shift</strong>
            <p>
              When the wheel rests, neon pipe edges light up and gravity gets
              heavier.
            </p>
          </div>
        </div>
      </div>
      <p className="small muted">
        No fresh signal? Practice mode keeps you flying at 1× points. Your run
        pauses when you open a menu or leave the tab.
      </p>
      <button className="primary full" onClick={onPlay}>
        <Icon name="play" /> Start a run
      </button>
    </Modal>
  );
}

export function AboutView({
  telemetry,
  onClose,
}: {
  telemetry: TelemetryState;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState(false);
  const { data, status } = telemetry;
  return (
    <Modal title="Meet your tiny power source." onClose={onClose} wide>
      <div className="about-layout">
        <div className="about-wheel">
          <WheelGraphic running={status === "live" && !!data && data.rpm > 0} />
          <span className="data">Squeektoshi × WHEELY9000</span>
        </div>
        <div>
          <h3>Proof of Hamster. Proof of fun.</h3>
          <p>
            Squeektoshi runs. A sensor counts the wheel’s magnet passages.
            Squeekchain records that physical work in rounds and settles it into
            Squeek blocks on Ethereum.
          </p>
          <p>
            This arcade reads that public telemetry every five seconds. A
            spinning wheel adds a tailwind and double points. A resting hamster
            brings the Night Shift.
          </p>
        </div>
      </div>
      <div className="inspector-header">
        <h3>Live telemetry inspector</h3>
        <button
          className="icon-button"
          onClick={telemetry.refresh}
          aria-label="Refresh telemetry"
        >
          <Icon name="refresh" />
        </button>
      </div>
      <p className="small muted">
        {status === "live"
          ? "Fresh hardware measurement"
          : status === "loading"
            ? "Connecting to the wheel API…"
            : status === "stale"
              ? "This reading is stale. Gameplay is in Practice mode."
              : "Unable to reach the API. Gameplay is in Practice mode."}
        {data
          ? ` · Observed ${new Date(data.observedAt).toLocaleTimeString()}`
          : ""}
      </p>
      {telemetry.error && (
        <p role="status" className="inline-message">
          {telemetry.error} Select refresh to retry.
        </p>
      )}
      <dl className="inspector-grid">
        <div>
          <dt>Wheel speed</dt>
          <dd>
            {data ? data.rpm.toFixed(3) : "N/A"} <small>RPM</small>
          </dd>
        </div>
        <div>
          <dt>Linear speed</dt>
          <dd>
            {data ? number(data.speed) : "N/A"} <small>mm/s</small>
          </dd>
        </div>
        <div>
          <dt>Cumulative work</dt>
          <dd>
            {number(data?.work)} <small>units</small>
          </dd>
        </div>
        <div>
          <dt>Core status</dt>
          <dd>{data?.core ?? "N/A"}</dd>
        </div>
        <div>
          <dt>Settled block</dt>
          <dd>{data?.block ? `#${number(data.block)}` : "N/A"}</dd>
        </div>
        <div>
          <dt>Projected block</dt>
          <dd>
            {data?.projectedBlock ? `#${number(data.projectedBlock)}` : "N/A"}{" "}
            <small>optimistic</small>
          </dd>
        </div>
      </dl>
      <button
        className="text-action"
        onClick={() => setRaw(!raw)}
        aria-expanded={raw}
      >
        {raw ? "Hide raw API response" : "Show raw API response"}
        <Icon name="chevron" size={16} />
      </button>
      {raw && (
        <pre className="raw-data">
          {data
            ? JSON.stringify(data.raw, null, 2)
            : "No reading received yet."}
        </pre>
      )}
      <div className="external-links">
        <a href={OFFICIAL_URL} target="_blank" rel="noreferrer">
          Watch the official livestream <Icon name="external" size={16} />
        </a>
        <a href={WHITEPAPER_URL} target="_blank" rel="noreferrer">
          Read the whitepaper <Icon name="external" size={16} />
        </a>
        <a href={API_URL} target="_blank" rel="noreferrer">
          Open the status API <Icon name="external" size={16} />
        </a>
      </div>
    </Modal>
  );
}

export function LeaderboardView({
  runs,
  round,
  address,
  onClose,
  onPlay,
  onImport,
}: {
  runs: Run[];
  round: string | null;
  address?: string;
  onClose: () => void;
  onPlay: () => void;
  onImport: (runs: Run[]) => boolean;
}) {
  const [filter, setFilter] = useState<"round" | "all">("round");
  const rows = rankRuns(runs, filter === "all" ? undefined : round);
  const fileInput = useRef<HTMLInputElement>(null);
  const client = usePublicClient();
  const [importing, setImporting] = useState(false),
    [notice, setNotice] = useState("");
  const best = bestForPlayer(runs, address);
  return (
    <Modal title="Hall of Squeeks" onClose={onClose} wide>
      <p className="modal-intro">Big scores from very small pilots.</p>
      <p className="storage-notice">
        <Icon name="info" size={17} />
        <span>
          This device’s top 50 pilots. Import friends’ signed scores to compete.
          Scores are not synced to a global service.
        </span>
      </p>
      <div className="leaderboard-tools">
        <div className="segmented" aria-label="Leaderboard period">
          <button
            aria-pressed={filter === "round"}
            onClick={() => setFilter("round")}
          >
            Current round
          </button>
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All-time legends
          </button>
        </div>
        <button
          className="icon-button"
          onClick={() => downloadRuns(runs)}
          disabled={runs.length === 0}
          aria-label="Export scores as JSON"
        >
          <Icon name="download" />
        </button>
      </div>
      <div className="import-tools">
        <button
          className="text-action"
          disabled={importing}
          onClick={() => fileInput.current?.click()}
        >
          <Icon name="download" size={16} />
          {importing ? "Verifying signatures…" : "Import signed scores"}
        </button>
        <span className="small muted">Best run per pilot</span>
      </div>
      <input
        ref={fileInput}
        className="file-input"
        type="file"
        accept=".json,application/json"
        aria-label="Import SqueekPack score file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setImporting(true);
          setNotice("");
          try {
            if (file.size > 1_000_000)
              throw new Error("Choose a score export smaller than 1 MB.");
            const imported = await parseSignedScores(
              await file.text(),
              client
                ? (address, message, signature) =>
                    client.verifyMessage({ address, message, signature })
                : undefined,
            );
            const saved = onImport(imported);
            setNotice(
              `${imported.length} signed ${imported.length === 1 ? "score verified" : "scores verified"}.${saved ? " Saved on this device." : " Browser storage is unavailable; export to keep a copy."}`,
            );
          } catch (e) {
            setNotice(
              e instanceof Error
                ? e.message
                : "Could not import scores. Choose a valid signed score export.",
            );
          } finally {
            setImporting(false);
          }
        }}
      />
      <p className="inline-message" role="status">
        {notice}
      </p>
      <p className="small muted">
        {filter === "round"
          ? round
            ? `Round ${number(round)} · since the last accepted wheel round`
            : "A current round is unavailable. View all-time legends or start a practice run."
          : "All saved runs, including practice."}
      </p>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Pilot</th>
                <th scope="col">Score</th>
                <th scope="col">Mode</th>
                <th scope="col">Block</th>
                <th scope="col">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((run, index) => (
                <tr key={run.id}>
                  <td className="rank">#{index + 1}</td>
                  <td>
                    {run.address ? (
                      <details className="pilot-address">
                        <summary>{shortAddress(run.address)}</summary>
                        <code>{run.address}</code>
                      </details>
                    ) : (
                      "You · guest"
                    )}
                    <small>
                      {run.signature ? "Signed attestation" : "Unsigned run"}
                    </small>
                  </td>
                  <td className="data score-cell">{number(run.score)}</td>
                  <td>{run.mode}</td>
                  <td className="data">
                    {run.block ? `#${number(run.block)}` : "Practice"}
                  </td>
                  <td>
                    {new Date(run.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="trophy" size={40} />
          <h3>
            {filter === "round"
              ? "This round is wide open."
              : "Your legend starts here."}
          </h3>
          <p>Finish a run to put your score on this device’s board.</p>
          <button className="primary" onClick={onPlay}>
            <Icon name="play" /> Start a run
          </button>
        </div>
      )}
      <div className="best-footer">
        <span>
          Your best score{address ? ` · ${shortAddress(address)}` : " · guest"}
        </span>
        <strong className="data">
          {best ? number(best.score) : "0"} <small>pts</small>
        </strong>
      </div>
    </Modal>
  );
}

export function ResultView({
  run,
  telemetry,
  onClose,
  onPlay,
  onLeaderboard,
  onWallet,
  onSave,
  saved,
}: {
  run: Run;
  telemetry: TelemetryState;
  onClose: () => void;
  onPlay: () => void;
  onLeaderboard: () => void;
  onWallet: () => void;
  onSave: (run: Run) => void;
  saved: boolean;
}) {
  const { address, chainId, isConnected } = useConnection();
  const { mutateAsync: sign, isPending } = useSignMessage();
  const { mutateAsync: switchChain, isPending: switching } = useSwitchChain();
  const client = usePublicClient();
  const [error, setError] = useState(""),
    [verifying, setVerifying] = useState(false);
  const pending = isPending || verifying;
  const signScore = async () => {
    if (!address || !chainId || pending || run.signature) return;
    setError("");
    if (telemetry.status !== "live" || !telemetry.data?.block) {
      setError(
        "A fresh settled block is needed to sign. Refresh telemetry and try again.",
      );
      return;
    }
    const attested = { ...run, block: telemetry.data.block, address, chainId };
    const message = scoreMessage(attested, address, chainId, location.origin);
    try {
      const signature = await sign({ message });
      setVerifying(true);
      let valid = false;
      try {
        valid = isAddressEqual(
          await recoverMessageAddress({ message, signature }),
          address,
        );
      } catch {
        /* Smart wallets use contract signatures. */
      }
      if (!valid && client)
        valid = await client.verifyMessage({ address, message, signature });
      if (!valid)
        throw new Error("The signature did not match the connected wallet.");
      onSave({ ...attested, message, signature });
    } catch (e) {
      setError(
        e instanceof Error && /reject|denied/i.test(e.message)
          ? "Signature declined. Your score is still saved unsigned. Try again when ready."
          : "The signature could not be verified. Reopen your wallet and try again.",
      );
    } finally {
      setVerifying(false);
    }
  };
  return (
    <Modal title="End of shift. Nice flying." onClose={onClose}>
      <div className="result-score">
        <Icon name="trophy" size={28} />
        <strong>{number(run.score)}</strong>
        <span>points earned</span>
      </div>
      <dl className="result-stats">
        <div>
          <dt>Distance</dt>
          <dd>
            {number(run.distance)} <small>m</small>
          </dd>
        </div>
        <div>
          <dt>$SQK coins</dt>
          <dd>{run.coins}</dd>
        </div>
        <div>
          <dt>Final mode</dt>
          <dd>{run.mode}</dd>
        </div>
      </dl>
      {run.modes.length > 1 && (
        <p className="small muted">
          Modes encountered: {run.modes.join(", ")}.
        </p>
      )}
      <div className="attestation">
        <div className="attestation-title">
          <Icon name={run.signature ? "check" : "wallet"} size={19} />
          <strong>
            {run.signature
              ? "Your score is signed."
              : "Make it your high score."}
          </strong>
        </div>
        <p>
          {run.signature
            ? `Attested by ${shortAddress(run.address!)}. Saved on this device; export it to keep a copy.`
            : isConnected && address
              ? `Sign as ${shortAddress(address)} with the current settled Squeek block. A message signature, with no gas fee.`
              : "Connect an EVM wallet to sign your score. Guest runs are saved on this device too."}
        </p>
        {run.signature ? (
          <button
            className="secondary full"
            onClick={() => downloadRuns([run])}
          >
            <Icon name="download" /> Export signed score
          </button>
        ) : !isConnected ? (
          <button className="secondary full" onClick={onWallet}>
            <Icon name="wallet" /> Connect to sign score
          </button>
        ) : chainId !== 1 ? (
          <button
            className="secondary full"
            disabled={switching}
            onClick={async () => {
              try {
                await switchChain({ chainId: 1 });
              } catch {
                setError("Switch to Ethereum in your wallet, then try again.");
              }
            }}
          >
            {switching ? "Switching…" : "Switch to Ethereum to sign"}
          </button>
        ) : (
          <button
            className="secondary full"
            disabled={
              pending || telemetry.status !== "live" || !telemetry.data?.block
            }
            onClick={signScore}
          >
            <Icon name="wallet" />
            {isPending
              ? "Confirm in your wallet…"
              : verifying
                ? "Verifying signature…"
                : "Sign & submit high score"}
          </button>
        )}
        {isConnected && !run.signature && telemetry.status !== "live" && (
          <button className="text-action" onClick={telemetry.refresh}>
            Refresh telemetry to enable signing{" "}
            <Icon name="refresh" size={15} />
          </button>
        )}
        <p className="inline-message" role="status">
          {error}
        </p>
      </div>
      <p className="small muted" role="status">
        {saved
          ? "Run saved on this device."
          : "Browser storage is unavailable. Export your score before leaving."}
      </p>
      {!saved && (
        <button className="secondary full" onClick={() => downloadRuns([run])}>
          <Icon name="download" /> Export score
        </button>
      )}
      <button className="primary full" onClick={onPlay}>
        <Icon name="refresh" /> Play again <Icon name="arrow" size={18} />
      </button>
      <button className="text-action centered" onClick={onLeaderboard}>
        View leaderboard <Icon name="trophy" size={17} />
      </button>
    </Modal>
  );
}
