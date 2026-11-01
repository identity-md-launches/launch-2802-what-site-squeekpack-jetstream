import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { hexToString } from "viem";
import ts from "typescript";
import { preview } from "./preview.mjs";

const root = resolve(process.argv[2] || ".");
const output = resolve(root, "test/scratch/validation");
await mkdir(output, { recursive: true });
const checks = [],
  limitations = [],
  errors = [];
const pass = (name, detail = "") => {
  checks.push({ name, passed: true, detail });
  console.log(`PASS ${name}${detail ? ": " + detail : ""}`);
};
const failed = (name, e) => {
  checks.push({ name, passed: false, detail: String(e) });
  console.error(`FAIL ${name}: ${e}`);
};
const fixture = (rpm = 0, extra = {}) => ({
  schemaVersion: 1,
  measurement: {
    freshness: "online",
    observedAt: new Date().toISOString(),
    staleAfterSeconds: 120,
    rpmMilli: rpm * 1000,
    speedMmPerSecond: rpm * 11,
    cumulativeWorkUnits: "62576",
    coreStatus: rpm > 0 ? "ACTIVE" : "IDLE",
    ...extra,
  },
  builder: {
    anchor: { blockHeight: "5570", settledThroughRound: "775" },
    projected: { blockHeight: "5571" },
  },
  oracle: { latestClosure: { lastRound: "776" } },
});
const API = "https://api.squeekchain.com/v1/status";

// Personal best must never be replaced by a higher imported score from another pilot.
try {
  const code = ts.transpileModule(
    await readFile(resolve(root, "src/storage.ts"), "utf8"),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    },
  ).outputText;
  const { bestForPlayer } = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  );
  const own = privateKeyToAccount(generatePrivateKey()).address,
    peer = privateKeyToAccount(generatePrivateKey()).address;
  const scores = [
    { score: 50 },
    { score: 100, address: own },
    { score: 9999, address: peer },
  ];
  assert.equal(bestForPlayer(scores).score, 50);
  assert.equal(bestForPlayer(scores, own.toLowerCase()).score, 100);
  assert.equal(bestForPlayer(scores, peer).score, 9999);
  pass(
    "Personal best is scoped to the guest or connected wallet, excluding other pilots",
  );
} catch (e) {
  failed("Personal best ownership", e);
}

// The engine's deterministic rules run without rendering. No production test hooks are added.
try {
  const source = await readFile(resolve(root, "src/game.ts"), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  const { ArcadeEngine } = await import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.devicePixelRatio = 1;
  const canvas = {
    getContext: () => ({}),
    getBoundingClientRect: () => ({ width: 960, height: 520 }),
  };
  const game = new ArcadeEngine(
    canvas,
    () => {},
    () => {},
  );
  game.start();
  assert.equal(game.phase, "running");
  game.boost();
  assert(game.velocity < 0);
  game.input.mode = "Night Shift";
  game.velocity = 0;
  game.update(0.1);
  const nightGravity = game.velocity;
  game.input.mode = "Zoomies";
  game.velocity = 0;
  game.update(0.1);
  assert(nightGravity > game.velocity);
  game.start();
  game.input.mode = "Night Shift";
  game.y = 260;
  game.obstacles = [
    { x: 239, center: 260, gap: 220, coin: true, nut: false, passed: false },
  ];
  game.update(0.001);
  assert.equal(game.stats.coins, 1);
  assert(game.scoreFloat >= 50);
  game.start();
  game.input.mode = "Zoomies";
  game.y = 260;
  game.obstacles = [
    { x: 239, center: 260, gap: 220, coin: true, nut: false, passed: false },
  ];
  game.update(0.001);
  assert(game.scoreFloat >= 100);
  game.start();
  game.y = 260;
  game.obstacles = [
    { x: 124, center: 295, gap: 220, coin: false, nut: true, passed: false },
  ];
  game.update(0.001);
  assert.equal(game.stats.shield, 3);
  game.obstacles = [
    { x: 239, center: 100, gap: 100, coin: false, nut: false, passed: false },
  ];
  game.update(0.01);
  assert.equal(game.phase, "running");
  game.stats.shield = 0;
  game.update(0.01);
  assert.equal(game.phase, "over");
  game.start();
  game.togglePause();
  const elapsed = game.elapsed;
  game.update(1);
  assert.equal(game.elapsed, elapsed);
  game.togglePause();
  assert.equal(game.phase, "running");
  game.start();
  assert.equal(game.stats.coins, 0);
  assert.equal(game.stats.score, 0);
  game.destroy();
  pass(
    "Engine physics, coins, 2x scoring, Golden Nut, collisions, pause and reset",
  );
} catch (e) {
  failed("Engine rules", e);
}

const server = await preview(resolve(root, "dist"));
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
let response = fixture();
await page.route(API, (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(response),
  }),
);
try {
  await page.goto(server.url);
  await page.getByText("Night Shift active", { exact: true }).waitFor();
  for (const width of [320, 390, 760, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}`,
    );
    if (width === 390) {
      const start = await page
        .getByRole("button", { name: "Start run", exact: true })
        .boundingBox();
      assert(start && start.y + start.height < 844);
      await page.screenshot({
        path: resolve(output, "mobile-390.png"),
        fullPage: true,
      });
    }
    if (width === 1440)
      await page.screenshot({
        path: resolve(output, "desktop-1440.png"),
        fullPage: true,
      });
  }
  pass(
    "Responsive export at 320, 390, 760, 1024 and 1440; first-screen action at 390",
  );
  const resources = await page.evaluate(async () => {
    const urls = [
      ...document.querySelectorAll(
        "script[src],link[rel=stylesheet],link[rel=icon]",
      ),
    ].map((e) => e.src || e.href);
    urls.push(
      new URL(
        document.querySelector('meta[property="og:image"]').content,
        location.href,
      ).href,
    );
    return Promise.all(urls.map(async (u) => [u, (await fetch(u)).status]));
  });
  assert(
    resources.every(([, status]) => status === 200),
    JSON.stringify(resources),
  );
  assert(
    await page.evaluate(() => document.fonts.check('600 16px "Space Grotesk"')),
  );
  pass(
    "Relative subpath scripts, styles, favicon, social image and local fonts load",
  );
  const audit = await new AxeBuilder({ page }).analyze();
  await writeFile(
    resolve(output, "axe-main.json"),
    JSON.stringify(audit.violations, null, 2),
  );
  assert.equal(
    audit.violations.length,
    0,
    JSON.stringify(
      audit.violations.map((x) => ({
        id: x.id,
        impact: x.impact,
        nodes: x.nodes.map((n) => n.target),
      })),
    ),
  );
  pass("Automated accessibility audit: main screen");
  await page.getByRole("button", { name: "Unmute game audio" }).click();
  assert(
    (await page
      .getByRole("button", { name: "Mute game audio" })
      .getAttribute("aria-pressed")) === "true",
  );
  await page.getByRole("button", { name: "Mute game audio" }).click();
  pass("Audio mute and unmute");
  await page
    .getByRole("button", { name: "How to play", exact: true })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  const helpAudit = await new AxeBuilder({ page }).analyze();
  assert.equal(
    helpAudit.violations.length,
    0,
    JSON.stringify(helpAudit.violations.map((x) => x.id)),
  );
  await page.keyboard.press("Tab");
  assert(
    await page.evaluate(
      () => document.activeElement.closest("dialog") !== null,
    ),
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.getAttribute("aria-label"),
    ),
    "How to play",
  );
  pass(
    "Controls modal, accessibility audit, focus containment, Escape and focus return",
  );
  await page.getByRole("button", { name: "Inspect telemetry" }).click();
  await page.getByRole("button", { name: "Show raw API response" }).click();
  assert((await page.locator("pre").innerText()).includes("rpmMilli"));
  await page.getByRole("button", { name: "Hide raw API response" }).click();
  await page.keyboard.press("Escape");
  pass("Telemetry inspector, actual fields and raw-response toggle");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  assert.equal(
    await page.getByRole("button", { name: /Browser wallet/ }).count(),
    1,
  );
  await page.getByRole("button", { name: /Browser wallet/ }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "No browser wallet found" })
    .waitFor();
  await page.keyboard.press("Escape");
  pass("No-extension wallet sheet and recoverable connection error");
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  await page.keyboard.press("p");
  await page.getByRole("heading", { name: "Taking a breather." }).waitFor();
  const before = await page.locator(".session-data .score").textContent();
  await page.waitForTimeout(250);
  assert.equal(
    await page.locator(".session-data .score").textContent(),
    before,
  );
  await page.getByRole("button", { name: "Resume run", exact: true }).click();
  await page.keyboard.press("Space");
  await page
    .getByRole("heading", { name: "End of shift. Nice flying." })
    .waitFor({ timeout: 15000 });
  assert(
    Number(
      (await page.locator(".result-score strong").textContent()).replace(
        /,/g,
        "",
      ),
    ) > 0,
  );
  await page.screenshot({ path: resolve(output, "game-over.png") });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Play again", exact: true })
    .click();
  await page.locator(".in-game-hud").waitFor();
  assert(
    Number(
      (await page.locator(".in-game-hud > span").first().innerText()).replace(
        /[^0-9]/g,
        "",
      ),
    ) < 5,
  );
  await page
    .getByRole("heading", { name: "End of shift. Nice flying." })
    .waitFor({ timeout: 15000 });
  pass("Instant restart clears the result and resets the visible score");
  await page.getByRole("button", { name: "View leaderboard" }).click();
  await page.getByRole("cell", { name: "You · guest" }).waitFor();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByRole("button", { name: "All-time legends" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "All-time legends" })
      .getAttribute("aria-pressed"),
    "true",
  );
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export scores as JSON" }).click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), "squeekpack-scores.json");
  await page.reload();
  await page
    .getByRole("button", { name: "Hall of Squeeks", exact: true })
    .first()
    .click();
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.keyboard.press("Escape");
  pass(
    "Start, Space boost, pause/resume, game over, persistence, leaderboard filters and JSON export",
  );
  response = fixture(46);
  await page.reload();
  await page.getByText("Zoomies active", { exact: true }).waitFor();
  assert((await page.locator(".mode-strip").innerText()).includes("2×"));
  pass("Live wheel input changes mode to Zoomies and 2x multiplier");
  response = fixture(46, {
    observedAt: new Date(Date.now() - 180000).toISOString(),
  });
  await page.reload();
  await page.getByText("Practice mode", { exact: true }).waitFor();
  pass(
    "Stale hardware readings select Practice instead of pretending to be live",
  );
  await page.unroute(API);
  await page.route(API, (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.reload();
  await page.getByText("Practice mode", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Inspect telemetry" }).click();
  await page.getByText(/Wheel API returned 503/).waitFor();
  await page.unroute(API);
  response = fixture(8);
  await page.route(API, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    }),
  );
  await page.getByRole("button", { name: "Refresh telemetry" }).click();
  await page
    .getByText("Fresh hardware measurement", { exact: false })
    .waitFor();
  await page.keyboard.press("Escape");
  pass("API 503, explicit offline state, manual retry and recovery");
  await page.unroute(API);
  await page.route(API, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 9000));
    try {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(fixture(0)),
      });
    } catch {
      /* The expected eight-second timeout already aborted this request. */
    }
  });
  await page.reload();
  await page
    .getByText("Practice mode", { exact: true })
    .waitFor({ timeout: 12000 });
  await page.getByRole("button", { name: "Inspect telemetry" }).click();
  await page.getByText(/The wheel API did not respond in time/).waitFor();
  await page.unroute(API);
  await page.route(API, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(fixture(15)),
    }),
  );
  await page.getByRole("button", { name: "Refresh telemetry" }).click();
  await page
    .getByText("Fresh hardware measurement", { exact: false })
    .waitFor();
  await page.keyboard.press("Escape");
  pass(
    "Slow request reaches its eight-second timeout and recovers, without five-second poll cancellation",
  );
  await page.unroute(API);
  await page.route(API, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"measurement":{}}',
    }),
  );
  await page.reload();
  await page.getByText("Practice mode", { exact: true }).waitFor();
  pass("Unsupported API payload degrades to Practice");
  await page.unroute(API);
  await page.route(API, async (route) => {
    await new Promise((r) => setTimeout(r, 500));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixture(22)),
    });
  });
  await page.reload();
  await page
    .locator(".connection-label")
    .filter({ hasText: "Connecting" })
    .waitFor();
  await page.getByText("Zoomies active", { exact: true }).waitFor();
  pass("Telemetry loading state and successful transition");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const c = page.locator("canvas");
  const shot1 = await c.screenshot();
  await page.waitForTimeout(120);
  const shot2 = await c.screenshot();
  assert(shot1.equals(shot2));
  assert.equal(
    await page
      .locator(".wheel-rotor")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  pass("Reduced motion freezes idle canvas, parallax and wheel rotation");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Start run", exact: true }).click();
  const backgroundPixels = () =>
    page
      .locator("canvas")
      .evaluate((canvas) =>
        Array.from(canvas.getContext("2d").getImageData(2, 70, 20, 40).data),
      );
  await page.waitForTimeout(60);
  const backgroundBefore = await backgroundPixels();
  await page.waitForTimeout(120);
  assert.deepEqual(await backgroundPixels(), backgroundBefore);
  pass("Reduced motion freezes decorative parallax during active flight");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  await page.screenshot({ path: resolve(output, "mobile-paused.png") });
  await page.getByRole("button", { name: "Resume run", exact: true }).click();
  await page.getByRole("button", { name: "Inspect telemetry" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("heading", { name: "Taking a breather." }).waitFor();
  pass("Opening menus pauses an active run");
} catch (e) {
  failed("Chromium interaction validation", e);
  await page.screenshot({
    path: resolve(output, "failure.png"),
    fullPage: true,
  });
}

// EIP-6963 test wallet: an ephemeral key exists only in memory and never ships in the application.
const account = privateKeyToAccount(generatePrivateKey());
const walletContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const walletPage = await walletContext.newPage();
const methods = [],
  signedMessages = [];
let rejectSign = false,
  walletConnected = false,
  walletChain = "0x2105";
await walletPage.exposeFunction(
  "testWalletRequest",
  async ({ method, params }) => {
    methods.push(method);
    if (method === "eth_requestAccounts") {
      walletConnected = true;
      return [account.address];
    }
    if (method === "eth_accounts")
      return walletConnected ? [account.address] : [];
    if (method === "eth_chainId") return walletChain;
    if (method === "wallet_switchEthereumChain") {
      walletChain = params[0].chainId;
      return null;
    }
    if (
      method === "wallet_requestPermissions" ||
      method === "wallet_getPermissions"
    )
      return [{ parentCapability: "eth_accounts" }];
    if (method === "personal_sign") {
      if (rejectSign) throw new Error("User rejected the request");
      const message = hexToString(params[0]);
      signedMessages.push(message);
      return account.signMessage({ message });
    }
    throw new Error(`Unexpected simulated RPC method: ${method}`);
  },
);
await walletPage.addInitScript(() => {
  const provider = {
    request: (args) => window.testWalletRequest(args),
    on: () => {},
    removeListener: () => {},
  };
  const detail = {
    info: {
      uuid: "7ed42c20-41c1-44c5-9e1d-f7b77a227f17",
      name: "Interaction test wallet",
      icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"%3E%3Ccircle cx="14" cy="14" r="12" fill="orange"/%3E%3C/svg%3E',
      rdns: "test.squeekpack.validation",
    },
    provider,
  };
  const announce = () =>
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", { detail }),
    );
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
});
await walletPage.route(API, (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(fixture(0)),
  }),
);
try {
  await walletPage.goto(server.url);
  await walletPage.getByText("Night Shift active", { exact: true }).waitFor();
  await walletPage
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await walletPage
    .getByRole("button", { name: "Interaction test wallet", exact: true })
    .click();
  await walletPage.getByRole("dialog").waitFor({ state: "hidden" });
  await walletPage
    .getByRole("banner")
    .getByRole("button", { name: "Switch to Ethereum", exact: true })
    .click();
  await walletPage
    .getByRole("button", { name: new RegExp(account.address.slice(0, 6)) })
    .waitFor();
  assert(methods.includes("wallet_switchEthereumChain"));
  assert(
    !(await walletPage
      .getByRole("button", { name: "Browser wallet", exact: true })
      .count()),
  );
  pass(
    "EIP-6963 discovery, named wallet connection and wrong-chain switch to Ethereum",
  );
  await walletPage
    .getByRole("button", { name: "Start run", exact: true })
    .click();
  await walletPage
    .getByRole("heading", { name: "End of shift. Nice flying." })
    .waitFor({ timeout: 15000 });
  rejectSign = true;
  await walletPage
    .getByRole("button", { name: "Sign & submit high score" })
    .click();
  await walletPage.getByText(/Signature declined/).waitFor();
  pass("Rejected personal_sign keeps the score unsigned and offers retry");
  rejectSign = false;
  await walletPage
    .getByRole("button", { name: "Sign & submit high score" })
    .click();
  await walletPage
    .getByText("Your score is signed.", { exact: true })
    .waitFor();
  assert(methods.includes("personal_sign"));
  assert(signedMessages[0].includes("Squeekchain settled block: 5570"));
  assert(signedMessages[0].includes("Score:"));
  assert(signedMessages[0].includes(account.address));
  assert(signedMessages[0].includes("does not authorize a transaction"));
  const savedRuns = await walletPage.evaluate(() =>
    JSON.parse(localStorage.getItem("squeekpack.runs.v1")),
  );
  assert(savedRuns[0].signature);
  assert.equal(savedRuns[0].address, account.address);
  pass(
    "personal_sign message, current block, EOA recovery verification and persisted attestation",
  );
  const downloadPromise = walletPage.waitForEvent("download");
  await walletPage.getByRole("button", { name: "Export signed score" }).click();
  const downloaded = await downloadPromise;
  await downloaded.saveAs(resolve(output, "signed-score-test.json"));
  await page
    .getByRole("button", { name: "Hall of Squeeks", exact: true })
    .first()
    .click();
  const ownBestBeforeImport = await page
    .locator(".best-score strong")
    .textContent();
  await page
    .locator("input[type=file]")
    .setInputFiles(resolve(output, "signed-score-test.json"));
  await page
    .getByText("1 signed score verified. Saved on this device.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator("tbody tr").count(), 2);
  assert.equal(
    await page.locator(".best-score strong").textContent(),
    ownBestBeforeImport,
  );
  await page.locator(".pilot-address summary").first().click();
  assert.equal(
    await page.locator(".pilot-address code").first().textContent(),
    account.address,
  );
  const filledBoardAudit = await new AxeBuilder({ page }).analyze();
  assert.equal(filledBoardAudit.violations.length, 0);
  const tampered = JSON.parse(
    await readFile(resolve(output, "signed-score-test.json"), "utf8"),
  );
  tampered.runs[0].score += 100;
  await writeFile(
    resolve(output, "tampered-score-test.json"),
    JSON.stringify(tampered),
  );
  await page
    .locator("input[type=file]")
    .setInputFiles(resolve(output, "tampered-score-test.json"));
  await page.getByText(/A score differs from its signed message/).waitFor();
  assert.equal(await page.locator("tbody tr").count(), 2);
  await page.keyboard.press("Escape");
  pass(
    "Signed-score import verifies authorship, ranks another pilot and rejects tampered scores",
  );
  await walletPage.keyboard.press("Escape");
  await walletPage
    .getByRole("button", { name: new RegExp(account.address.slice(0, 6)) })
    .click();
  await walletPage
    .getByRole("button", { name: "Disconnect wallet", exact: true })
    .click();
  await walletPage
    .getByRole("button", { name: "Connect wallet", exact: true })
    .waitFor();
  pass("Signed-score export and disconnect");
} catch (e) {
  failed("Simulated wallet flow", e);
  await walletPage.screenshot({
    path: resolve(output, "wallet-failure.png"),
    fullPage: true,
  });
}

const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
});
const phonePage = await phone.newPage();
await phonePage.route(API, (route) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(fixture()),
  }),
);
try {
  await phonePage.goto(server.url);
  await phonePage
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  for (const wallet of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"])
    assert.equal(
      await phonePage
        .getByRole("link", { name: `Open in ${wallet}`, exact: true })
        .count(),
      1,
    );
  await phonePage
    .getByRole("button", { name: /Coinbase Smart Wallet/ })
    .waitFor();
  const box = await phonePage.getByRole("dialog").boundingBox();
  assert(box && box.y + box.height >= 840);
  await phonePage.screenshot({
    path: resolve(output, "phone-wallet-sheet.png"),
  });
  await phonePage.keyboard.press("Escape");
  await phonePage.getByRole("button", { name: "Start run", exact: true }).tap();
  await phonePage.locator("canvas").tap();
  await phonePage
    .getByRole("button", { name: "Pause game", exact: true })
    .tap();
  await phonePage
    .getByRole("heading", { name: "Taking a breather." })
    .waitFor();
  pass(
    "Phone wallet deep links, Smart Wallet row, bottom sheet and touch boost/pause",
  );
} catch (e) {
  failed("Phone flow", e);
}

try {
  const webkitBrowser = await webkit.launch({ headless: true });
  const p = await webkitBrowser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await p.route(API, (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(fixture()),
    }),
  );
  await p.goto(server.url);
  await p.getByRole("button", { name: "Start run", exact: true }).click();
  await p.keyboard.press("p");
  await p.getByRole("heading", { name: "Taking a breather." }).waitFor();
  await p.getByRole("button", { name: "Resume run", exact: true }).click();
  await p
    .getByRole("heading", { name: "End of shift. Nice flying." })
    .waitFor({ timeout: 15000 });
  await p.screenshot({ path: resolve(output, "webkit-game-over.png") });
  await webkitBrowser.close();
  pass("WebKit mobile start, keyboard pause/resume and game over");
} catch (e) {
  limitations.push("WebKit could not run: " + String(e).slice(0, 2200));
  console.log("LIMITATION WebKit runtime unavailable; see report");
}

// One separate page uses the real, unmodified public service.
const livePage = await browser.newPage({
  viewport: { width: 390, height: 844 },
});
try {
  const received = livePage.waitForResponse(API, { timeout: 12000 });
  await livePage.goto(server.url);
  const liveResponse = await received;
  const liveData = await liveResponse.json();
  assert(liveResponse.ok());
  assert.equal(typeof liveData.measurement.rpmMilli, "number");
  pass(
    "Real browser request to public API",
    `HTTP ${liveResponse.status()}, core ${liveData.measurement.coreStatus}, RPM ${(liveData.measurement.rpmMilli / 1000).toFixed(1)}`,
  );
} catch (e) {
  limitations.push("Real API browser check: " + String(e));
  console.log("LIMITATION real API request failed");
}
assert.equal(errors.length, 0, errors.join("\n"));
pass("No Chromium page script errors across interaction states");
await context.close();
await walletContext.close();
await phone.close();
await livePage.close();
await browser.close();
await server.close();
await writeFile(
  resolve(output, "results.json"),
  JSON.stringify(
    { checkedAt: new Date().toISOString(), checks, limitations, errors },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      passed: checks.filter((c) => c.passed).length,
      failed: checks.filter((c) => !c.passed).length,
      limitations,
    },
    null,
    2,
  ),
);
if (checks.some((c) => !c.passed)) process.exitCode = 1;
