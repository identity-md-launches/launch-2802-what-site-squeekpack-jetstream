export type Mode = "Zoomies" | "Night Shift" | "Practice";
export type GamePhase = "idle" | "running" | "paused" | "over";
export type Telemetry = {
  rpm: number;
  speed: number;
  work: string;
  core: string;
  block: string | null;
  projectedBlock: string | null;
  round: string | null;
  observedAt: string;
  staleAfter: number;
  freshness: string;
  raw: Record<string, unknown>;
};
export type TelemetryState = {
  data: Telemetry | null;
  status: "loading" | "live" | "stale" | "offline";
  error: string | null;
  history: number[];
  refresh: () => void;
};
export type Run = {
  id: string;
  score: number;
  distance: number;
  coins: number;
  mode: Mode;
  modes: Mode[];
  block: string | null;
  round: string | null;
  date: string;
  duration: number;
  address?: `0x${string}`;
  signature?: `0x${string}`;
  message?: string;
  chainId?: number;
};
