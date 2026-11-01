import type { Run } from "./types";
const KEY = "squeekpack.runs.v1";
export function readRuns(): Run[] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(entries)) return [];
    return entries
      .filter(
        (r): r is Run =>
          typeof r === "object" &&
          r !== null &&
          typeof r.id === "string" &&
          Number.isFinite(r.score) &&
          r.score >= 0 &&
          Number.isFinite(r.distance) &&
          typeof r.date === "string" &&
          ["Zoomies", "Night Shift", "Practice"].includes(r.mode),
      )
      .slice(0, 250);
  } catch {
    return [];
  }
}
export function saveRun(run: Run): { runs: Run[]; saved: boolean } {
  const runs = [run, ...readRuns().filter((r) => r.id !== run.id)]
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
    .slice(0, 250);
  try {
    localStorage.setItem(KEY, JSON.stringify(runs));
    return { runs, saved: true };
  } catch {
    return { runs, saved: false };
  }
}
export function mergeRuns(incoming: Run[]): { runs: Run[]; saved: boolean } {
  const byId = new Map(readRuns().map((run) => [run.id, run]));
  for (const run of incoming) {
    const existing = byId.get(run.id);
    if (existing?.signature && existing.signature !== run.signature)
      throw new Error(
        "An existing run uses this ID with a different signature.",
      );
    byId.set(run.id, run);
  }
  const runs = [...byId.values()]
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
    .slice(0, 250);
  try {
    localStorage.setItem(KEY, JSON.stringify(runs));
    return { runs, saved: true };
  } catch {
    return { runs, saved: false };
  }
}
export function bestForPlayer(runs: Run[], address?: string): Run | undefined {
  return runs
    .filter((run) =>
      address
        ? run.address?.toLowerCase() === address.toLowerCase()
        : !run.address,
    )
    .sort((a, b) => b.score - a.score)[0];
}
export function rankRuns(runs: Run[], round: string | null | undefined) {
  const players = new Map<string, Run>();
  for (const run of runs
    .filter(
      (run) => round === undefined || (round !== null && run.round === round),
    )
    .sort((a, b) => b.score - a.score)) {
    const player = run.address?.toLowerCase() ?? "guest";
    if (!players.has(player)) players.set(player, run);
  }
  return [...players.values()].slice(0, 50);
}
export function downloadRuns(runs: Run[]) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          application: "SqueekPack: Jetstream Run",
          version: 1,
          scope: "this-device",
          runs,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "squeekpack-scores.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function scoreMessage(
  run: Run,
  address: string,
  chainId: number,
  origin: string,
) {
  return [
    "SqueekPack: Jetstream Run — Score Attestation v1",
    `Origin: ${origin}`,
    `Player: ${address}`,
    `Wallet chain: ${chainId}`,
    `Run: ${run.id}`,
    `Score: ${run.score}`,
    `Distance: ${run.distance} m`,
    `Coins: ${run.coins}`,
    `Mode: ${run.mode}`,
    `Modes encountered: ${run.modes.join(", ")}`,
    `Squeekchain settled block: ${run.block ?? "unavailable (practice)"}`,
    `Round: ${run.round ?? "practice"}`,
    `Completed: ${run.date}`,
    "This signature attests to a client-reported arcade score. It does not authorize a transaction or transfer.",
  ].join("\n");
}
