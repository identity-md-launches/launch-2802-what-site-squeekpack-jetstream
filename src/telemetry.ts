import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "./config";
import type { Mode, Telemetry, TelemetryState } from "./types";

const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const integer = (v: unknown): string | null =>
  typeof v === "string" && /^\d+$/.test(v)
    ? v
    : typeof v === "number" && Number.isSafeInteger(v) && v >= 0
      ? String(v)
      : null;

export function parseTelemetry(input: unknown): Telemetry {
  const raw = object(input),
    measurement = object(raw.measurement),
    builder = object(raw.builder);
  const anchor = object(builder.anchor),
    projected = object(builder.projected);
  const rpmMilli = measurement.rpmMilli,
    speed = measurement.speedMmPerSecond;
  if (
    typeof rpmMilli !== "number" ||
    !Number.isFinite(rpmMilli) ||
    rpmMilli < 0 ||
    typeof speed !== "number" ||
    !Number.isFinite(speed) ||
    speed < 0 ||
    typeof measurement.observedAt !== "string" ||
    !Number.isFinite(Date.parse(measurement.observedAt)) ||
    integer(measurement.cumulativeWorkUnits) === null
  ) {
    throw new Error("The wheel returned an unsupported reading.");
  }
  const settledRound =
    integer(object(object(raw.oracle).latestClosure).lastRound) ??
    integer(anchor.settledThroughRound);
  return {
    rpm: rpmMilli / 1000,
    speed,
    work: integer(measurement.cumulativeWorkUnits)!,
    core:
      typeof measurement.coreStatus === "string"
        ? measurement.coreStatus
        : "Unknown",
    block: integer(anchor.blockHeight),
    projectedBlock: integer(projected.blockHeight),
    round: settledRound === null ? null : String(BigInt(settledRound) + 1n),
    observedAt: measurement.observedAt,
    staleAfter:
      typeof measurement.staleAfterSeconds === "number" &&
      measurement.staleAfterSeconds > 0
        ? measurement.staleAfterSeconds
        : 120,
    freshness:
      typeof measurement.freshness === "string"
        ? measurement.freshness
        : "unknown",
    raw,
  };
}

export function readingIsFresh(data: Telemetry, now = Date.now()) {
  const age = now - Date.parse(data.observedAt);
  return (
    data.freshness === "online" &&
    age >= -30000 &&
    age <= data.staleAfter * 1000
  );
}
export function modeFor(data: Telemetry | null, live: boolean): Mode {
  if (!data || !live) return "Practice";
  return data.rpm > 0 && data.core !== "SLEEPING" ? "Zoomies" : "Night Shift";
}

export function useTelemetry(): TelemetryState {
  const [data, setData] = useState<Telemetry | null>(null);
  const [status, setStatus] = useState<TelemetryState["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;
  const refresh = useCallback(async () => {
    if (controller.current && !controller.current.signal.aborted) return;
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 8000);
    try {
      const response = await fetch(API_URL, {
        signal: abort.signal,
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(`Wheel API returned ${response.status}.`);
      const next = parseTelemetry(await response.json());
      if (!mounted.current || abort !== controller.current) return;
      setData(next);
      setStatus(readingIsFresh(next) ? "live" : "stale");
      setError(null);
      setHistory((previous) => [...previous.slice(-35), next.rpm]);
    } catch (e) {
      if (!mounted.current || abort !== controller.current) return;
      setStatus("offline");
      setError(
        e instanceof Error && e.name !== "AbortError"
          ? e.message
          : "The wheel API did not respond in time.",
      );
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === abort) controller.current = null;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const poll = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    const clock = window.setInterval(
      () =>
        setStatus((current) => {
          if (
            current === "live" &&
            dataRef.current &&
            !readingIsFresh(dataRef.current)
          )
            return "stale";
          return current;
        }),
      1000,
    );
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted.current = false;
      controller.current?.abort();
      clearInterval(poll);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
  return { data, status, error, history, refresh };
}
