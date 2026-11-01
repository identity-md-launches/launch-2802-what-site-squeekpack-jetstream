import { webkit } from "playwright";
import { resolve } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { preview } from "./preview.mjs";
const root = resolve(process.argv[2] || ".");
const server = await preview(resolve(root, "dist"));
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const checks = [];
const out = resolve(root, "test/scratch/validation");
await mkdir(out, { recursive: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.route("https://api.squeekchain.com/v1/status", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        measurement: {
          freshness: "online",
          observedAt: new Date().toISOString(),
          staleAfterSeconds: 120,
          rpmMilli: 0,
          speedMmPerSecond: 0,
          cumulativeWorkUnits: "62576",
          coreStatus: "IDLE",
        },
        builder: {
          anchor: { blockHeight: "5570", settledThroughRound: "775" },
        },
        oracle: { latestClosure: { lastRound: "776" } },
      }),
    }),
  );
  await page.goto(server.url);
  await page.getByText("Night Shift active", { exact: true }).waitFor();
  await page.screenshot({ path: resolve(out, "webkit-idle.png") });
  checks.push("390px export loads with correct telemetry mode");
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  await page.keyboard.press("p");
  await page.getByRole("heading", { name: "Taking a breather." }).waitFor();
  await page.getByRole("button", { name: "Resume run", exact: true }).click();
  await page.keyboard.press("Space");
  await page
    .getByRole("heading", { name: "End of shift. Nice flying." })
    .waitFor({ timeout: 15000 });
  await page.screenshot({ path: resolve(out, "webkit-game-over.png") });
  checks.push("Start, Space boost, P pause, resume and game over");
  await page.getByRole("button", { name: "View leaderboard" }).click();
  await page.getByRole("cell", { name: "You · guest" }).waitFor();
  await page.getByRole("button", { name: "All-time legends" }).click();
  await page.keyboard.press("Escape");
  checks.push("Round board, all-time filter, modal Escape");
  await page
    .getByRole("button", { name: "How to play", exact: true })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  checks.push("Controls modal");
  for (const width of [320, 390, 760, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (
      !(await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ))
    )
      throw new Error("Overflow at " + width);
  }
  checks.push("No horizontal page overflow at 320, 390, 760, 1440");
  if (errors.length) throw new Error(errors.join("; "));
  console.log("PASS WebKit", checks);
  await writeFile(
    resolve(out, "webkit-results.json"),
    JSON.stringify({ passed: true, checks, errors }, null, 2),
  );
} catch (e) {
  console.log("FAIL WebKit", String(e));
  await writeFile(
    resolve(out, "webkit-results.json"),
    JSON.stringify({ passed: false, checks, error: String(e) }, null, 2),
  );
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
