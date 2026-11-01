import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { preview } from "./preview.mjs";
const root = resolve(process.argv[2] || "."),
  out = resolve(root, "test/scratch/review");
await mkdir(out, { recursive: true });
const server = await preview(resolve(root, "dist"));
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const report = { modals: [], contrast: [], canvas: [], errors: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
await page.goto(server.url);
await page
  .locator(".connection-label")
  .filter({ hasText: /Live|Offline|Stale/ })
  .waitFor();
await page.evaluate(() => document.fonts.ready);
const lum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) =>
  (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
for (const width of [320, 390, 760, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  report.canvas.push(
    await page.evaluate(
      ({ width }) => {
        const canvas = document.querySelector("canvas"),
          cr = canvas.getBoundingClientRect(),
          ctx = canvas.getContext("2d");
        const lum = (rgb) => {
          const f = (c) => {
            c /= 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
        };
        const rows = [];
        for (const selector of [
          ".idle-copy h2",
          ".idle-copy h2>span",
          ".idle-copy p",
          ".start-hint",
          ".pilot-label",
          ".scene-caption>span:first-child",
        ]) {
          const el = document.querySelector(selector),
            r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const rgb = getComputedStyle(el)
            .color.match(/[\d.]+/g)
            .map(Number);
          const pixels = ctx.getImageData(
            Math.max(
              0,
              Math.floor(((r.left - cr.left) * canvas.width) / cr.width),
            ),
            Math.max(
              0,
              Math.floor(((r.top - cr.top) * canvas.height) / cr.height),
            ),
            Math.min(
              canvas.width,
              Math.floor((r.width * canvas.width) / cr.width),
            ),
            Math.min(
              canvas.height,
              Math.floor((r.height * canvas.height) / cr.height),
            ),
          ).data;
          let worst = 100;
          const xStart = (r.left - cr.left) / cr.width,
            xEnd = (r.right - cr.left) / cr.width;
          // Sample the actual canvas and composite the computed scrim at each pixel.
          const gradient = getComputedStyle(
            document.querySelector(".idle-overlay"),
            "::before",
          ).backgroundImage;
          const stops = [
            ...gradient.matchAll(/rgba?\(([^)]+)\)\s+([\d.]+)%/g),
          ].map((match) => ({
            rgba: match[1].split(",").map(Number),
            position: Number(match[2]) / 100,
          }));
          if (stops.length < 2)
            throw new Error("Cannot measure the computed scrim: " + gradient);
          const pixelWidth = Math.min(
            canvas.width,
            Math.floor((r.width * canvas.width) / cr.width),
          );
          const firstX = Math.max(
            0,
            Math.floor(((r.left - cr.left) * canvas.width) / cr.width),
          );
          for (let p = 0; p < pixels.length; p += 4) {
            const x = (firstX + ((p / 4) % pixelWidth)) / canvas.width;
            const end = stops.findIndex((stop) => stop.position >= x);
            const left = stops[Math.max(0, end - 1)],
              right = stops[end < 0 ? stops.length - 1 : end];
            const progress =
              right.position === left.position
                ? 0
                : Math.max(
                    0,
                    Math.min(
                      1,
                      (x - left.position) / (right.position - left.position),
                    ),
                  );
            const color = [0, 1, 2, 3].map(
              (i) =>
                (left.rgba[i] ?? 1) +
                ((right.rgba[i] ?? 1) - (left.rgba[i] ?? 1)) * progress,
            );
            const a = color[3];
            const bg = [0, 1, 2].map(
              (i) => pixels[p + i] * (1 - a) + color[i] * a,
            );
            const l1 = lum(rgb),
              l2 = lum(bg);
            worst = Math.min(
              worst,
              (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
            );
          }
          rows.push({
            selector,
            minimumConservativeRectangleContrast: Number(worst.toFixed(2)),
            font: getComputedStyle(el).fontSize,
            xStart,
            xEnd,
          });
        }
        return { width, rows };
      },
      { width },
    ),
  );
  await page.screenshot({ path: resolve(out, `idle-${width}.png`) });
}
await page.setViewportSize({ width: 390, height: 844 });
for (const [name, selector] of [
  ["Controls", 'button[aria-label="How to play"]'],
  ["Telemetry", ".telemetry-panel>.text-action"],
  ["Wallet", ".wallet-button"],
  ["Leaderboard", ".quick-links>button:last-child"],
]) {
  await page.locator(selector).click();
  await page.getByRole("dialog").waitFor();
  const audit = await new AxeBuilder({ page }).analyze();
  report.modals.push({
    name,
    violations: audit.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      targets: v.nodes.map((n) => n.target),
    })),
  });
  await page.screenshot({ path: resolve(out, name.toLowerCase() + ".png") });
  await page.keyboard.press("Escape");
}
report.contrast = await page.evaluate(() => {
  const pairs = [
    ["Primary action", ".start-button", null],
    ["Body text", "h1", "body"],
    ["Muted text", ".page-heading p", "body"],
    ["Panel label", ".rpm-row>span", ".telemetry-panel"],
    ["Night Shift", ".mode-strip strong", ".mode-strip"],
  ];
  return pairs.map(([name, fg, bg]) => {
    const e = document.querySelector(fg),
      b = bg ? document.querySelector(bg) : e;
    return {
      name,
      foreground: getComputedStyle(e).color,
      background:
        getComputedStyle(b).backgroundColor === "rgba(0, 0, 0, 0)"
          ? getComputedStyle(document.documentElement).backgroundColor
          : getComputedStyle(b).backgroundColor,
    };
  });
});
for (const p of report.contrast) {
  p.ratio = Number(
    ratio(
      p.foreground.match(/[\d.]+/g).map(Number),
      p.background.match(/[\d.]+/g).map(Number),
    ).toFixed(2),
  );
}
await page.getByRole("button", { name: "Start run", exact: true }).click();
await page
  .getByRole("heading", { name: "End of shift. Nice flying." })
  .waitFor({ timeout: 15000 });
const a = await new AxeBuilder({ page }).analyze();
report.modals.push({
  name: "Game over",
  violations: a.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target),
  })),
});
await page.screenshot({ path: resolve(out, "game-over.png") });
await writeFile(resolve(out, "review.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
await server.close();
