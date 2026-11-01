import {
  isAddress,
  isAddressEqual,
  recoverMessageAddress,
  type Address,
  type Hex,
} from "viem";
import { scoreMessage } from "./storage";
import type { Mode, Run } from "./types";

const modes: Mode[] = ["Zoomies", "Night Shift", "Practice"];
const count = (v: unknown, maximum: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= maximum;
const decimal = (v: unknown) =>
  v === null || (typeof v === "string" && /^\d{1,30}$/.test(v));
function validRun(
  input: unknown,
): input is Run & {
  address: Address;
  signature: Hex;
  message: string;
  chainId: number;
} {
  if (input === null || typeof input !== "object") return false;
  const r = input as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    /^[a-zA-Z0-9-]{1,80}$/.test(r.id) &&
    count(r.score, 1_000_000_000) &&
    count(r.distance, 10_000_000) &&
    count(r.coins, 1_000_000) &&
    count(r.duration, 86400000) &&
    modes.includes(r.mode as Mode) &&
    Array.isArray(r.modes) &&
    r.modes.length > 0 &&
    r.modes.length <= 3 &&
    r.modes.every((mode) => modes.includes(mode)) &&
    decimal(r.block) &&
    decimal(r.round) &&
    typeof r.date === "string" &&
    r.date.length <= 40 &&
    Number.isFinite(Date.parse(r.date)) &&
    typeof r.address === "string" &&
    isAddress(r.address) &&
    typeof r.signature === "string" &&
    /^0x[0-9a-fA-F]+$/.test(r.signature) &&
    r.signature.length <= 32770 &&
    typeof r.message === "string" &&
    r.message.length < 4096 &&
    r.chainId === 1
  );
}

/** Accept only canonical attestations whose score fields and wallet signature agree. */
export async function parseSignedScores(
  text: string,
  verifyContract?: (
    address: Address,
    message: string,
    signature: Hex,
  ) => Promise<boolean>,
): Promise<Run[]> {
  if (text.length > 1_000_000)
    throw new Error("Choose a score export smaller than 1 MB.");
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("Choose a SqueekPack JSON score export.");
  }
  const record = input as Record<string, unknown> | null;
  if (
    !record ||
    record.application !== "SqueekPack: Jetstream Run" ||
    record.version !== 1 ||
    !Array.isArray(record.runs) ||
    record.runs.length > 250
  )
    throw new Error(
      "Choose a SqueekPack JSON score export with at most 250 runs.",
    );
  const signed = record.runs.filter(
    (run) => run && typeof run === "object" && run.signature,
  );
  if (!signed.length)
    throw new Error(
      "This export has no signed scores. Sign a run before sharing it.",
    );
  const verified: Run[] = [];
  for (const run of signed) {
    if (!validRun(run))
      throw new Error(
        "A score has invalid fields. Ask the pilot for a new export.",
      );
    const origin = run.message
      .split("\n")
      .find((line) => line.startsWith("Origin: "))
      ?.slice(8);
    let validOrigin = false;
    try {
      if (origin)
        validOrigin =
          new URL(origin).origin === origin && /^https?:/.test(origin);
    } catch {
      /* Invalid origins are rejected below. */
    }
    if (
      !validOrigin ||
      !origin ||
      scoreMessage(run, run.address, run.chainId, origin) !== run.message
    )
      throw new Error(
        "A score differs from its signed message. Ask the pilot for a new export.",
      );
    let valid = false;
    try {
      valid = isAddressEqual(
        await recoverMessageAddress({
          message: run.message,
          signature: run.signature,
        }),
        run.address,
      );
    } catch {
      /* Contract signatures are checked below. */
    }
    if (!valid && verifyContract) {
      const verification = verifyContract(
        run.address,
        run.message,
        run.signature,
      ).catch(() => false);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        valid = await Promise.race([
          verification,
          new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(false), 8000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
    if (!valid)
      throw new Error(
        "A wallet signature could not be verified. Check your connection or ask for a new export.",
      );
    verified.push({
      id: run.id,
      score: run.score,
      distance: run.distance,
      coins: run.coins,
      mode: run.mode,
      modes: run.modes,
      block: run.block,
      round: run.round,
      date: run.date,
      duration: run.duration,
      address: run.address,
      chainId: run.chainId,
      signature: run.signature,
      message: run.message,
    });
  }
  return verified;
}
