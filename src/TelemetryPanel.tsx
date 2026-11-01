import type { TelemetryState } from "./types";
import { Icon } from "./Icons";
import { number } from "./config";

export function WheelGraphic({ running }: { running: boolean }) {
  return (
    <svg
      className={`wheel-graphic ${running ? "wheel-spinning" : ""}`}
      viewBox="0 0 220 188"
      fill="none"
      aria-hidden="true"
    >
      <path d="m70 172 25-42m55 42-25-42" stroke="#615e45" strokeWidth="8" />
      <path d="M58 177h104" stroke="#8b8660" strokeWidth="6" />
      <g className="wheel-rotor">
        <circle cx="110" cy="85" r="68" stroke="#4a5140" strokeWidth="12" />
        <circle cx="110" cy="85" r="65" stroke="#aaa778" strokeWidth="2" />
        <circle
          cx="110"
          cy="85"
          r="53"
          stroke="#656e4d"
          strokeWidth="2"
          strokeDasharray="3 5"
        />
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d="M110 31v47"
            stroke="#555e43"
            strokeWidth="3"
            transform={`rotate(${i * 30} 110 85)`}
          />
        ))}
        <circle cx="110" cy="85" r="12" fill="#8a885f" />
        <circle cx="110" cy="85" r="5" fill="#282f25" />
      </g>
      <path
        d="M73 143c6-13 20-19 35-15l14 7 10-2 4 8-9 5-41 1z"
        fill="#b69b69"
      />
      <path d="m103 128 3-7 7-1 5 10" fill="#c8b081" />
      <circle cx="122" cy="136" r="2" fill="#262b20" />
      <path
        d="M184 42h10m-5-5v10M26 118h6m-3-3v6"
        stroke="#8b7b51"
        strokeWidth="1.5"
      />
    </svg>
  );
}
export function TelemetryPanel({
  telemetry,
  onInspect,
}: {
  telemetry: TelemetryState;
  onInspect: () => void;
}) {
  const { data, status, history } = telemetry;
  const live = status === "live",
    spinning = live && !!data && data.rpm > 0;
  const maximum = Math.max(20, ...history);
  const points =
    history.length > 1
      ? history
          .map(
            (rpm, i) =>
              `${(i / (history.length - 1)) * 250},${48 - (rpm / maximum) * 39}`,
          )
          .join(" ")
      : "";
  return (
    <aside className="telemetry-panel" aria-label="Live wheel telemetry">
      <div className="panel-heading">
        <h2>The engine room</h2>
        <span className={`connection-label ${live ? "is-live" : ""}`}>
          <span className="status-dot" />
          {live
            ? "Live"
            : status === "loading"
              ? "Connecting"
              : status === "stale"
                ? "Stale"
                : "Offline"}
        </span>
      </div>
      <div className="wheel-display">
        <WheelGraphic running={spinning} />
        <span className="data wheel-model">WHEELY9000</span>
      </div>
      <div className="hamster-status">
        <span className={`status-dot ${spinning ? "orange-dot" : ""}`} />
        <strong>
          {status === "loading"
            ? "Checking on Squeektoshi"
            : !live
              ? "Signal unavailable"
              : spinning
                ? "Squeektoshi is spinning"
                : "Squeektoshi is resting"}
        </strong>
      </div>
      <p className="engine-caption">
        Real wheel telemetry drives your tailwind.
      </p>
      <div className="rpm-row">
        <span>Wheel speed</span>
        <div className="data">
          <strong>{data ? data.rpm.toFixed(1) : "N/A"}</strong>
          <span>RPM</span>
        </div>
      </div>
      <svg
        className="rpm-chart"
        viewBox="0 0 250 58"
        role="img"
        aria-label={`Recent wheel speed: ${history.length} actual readings. ${data ? `${data.rpm.toFixed(1)} RPM last observed.` : "Waiting for data."}`}
      >
        <path
          d="M0 12h250M0 30h250M0 48h250"
          stroke="#353c30"
          strokeDasharray="2 4"
        />
        {points && (
          <polyline
            fill="none"
            stroke="#b7c28a"
            strokeWidth="2"
            points={points}
          />
        )}
        {history.length > 0 && (
          <circle
            cx={history.length === 1 ? 0 : 250}
            cy={48 - (history[history.length - 1] / maximum) * 39}
            r="3"
            fill="#b7c28a"
          />
        )}
      </svg>
      <div className="chart-caption small">
        <span>Recent readings</span>
        <span>5s refresh</span>
      </div>
      <dl className="telemetry-meta">
        <div>
          <dt>Settled block</dt>
          <dd className="data">
            {data?.block ? `#${number(data.block)}` : "N/A"}
          </dd>
        </div>
        <div>
          <dt>Work units</dt>
          <dd className="data">{number(data?.work)}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            <a
              href="https://api.squeekchain.com/v1/status"
              target="_blank"
              rel="noreferrer"
            >
              Squeekchain API <Icon name="external" size={12} />
            </a>
          </dd>
        </div>
      </dl>
      <button className="text-action" onClick={onInspect}>
        Inspect telemetry <Icon name="arrow" size={17} />
      </button>
    </aside>
  );
}
