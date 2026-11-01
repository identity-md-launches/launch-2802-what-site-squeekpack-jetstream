import assert from "node:assert/strict";
import { readdir, readFile, lstat, writeFile, access } from "node:fs/promises";
import { resolve, join, relative, dirname } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(process.argv[2] || ".");
const excludedRoot = new Set([
  ".git",
  ".github",
  ".imd",
  ".agents",
  ".codex",
  ".aws",
  ".playwright-mcp",
]);
const excludedGenerated = new Set(["node_modules", ".npm", ".vite", ".cache"]);
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name),
      name = relative(root, path).replaceAll("\\", "/");
    if (directory === root && excludedRoot.has(entry.name)) continue;
    if (
      excludedGenerated.has(entry.name) ||
      name === "test/scratch" ||
      /^\.env(?:\.|$)/.test(entry.name)
    )
      continue;
    if (name === "artifacts/submission.json") continue;
    assert(
      entry.name !== ".git" && entry.name !== ".gitmodules",
      `Nested Git metadata/submodule: ${name}`,
    );
    assert(
      !entry.isSymbolicLink(),
      `Submission must be self-contained: ${name}`,
    );
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile()) {
      assert(
        !/\.(?:tgz|zip|tar|gz|map)$/.test(name),
        `Unnecessary packaging/source-map artifact: ${name}`,
      );
      const data = await readFile(path);
      files.push({
        path: name,
        bytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
      });
    }
  }
}
await walk(root);
for (const path of [
  "dist/index.html",
  "package.json",
  "package-lock.json",
  "README.md",
  "DESIGN.md",
  "artifacts/validation.md",
  "public/social-card.png",
])
  await access(resolve(root, path));
const manifest = JSON.parse(await readFile(resolve(root, "package.json")));
const lock = JSON.parse(await readFile(resolve(root, "package-lock.json")));
assert.deepEqual(
  manifest.dependencies,
  lock.packages[""].dependencies,
  "Production manifest/lock mismatch",
);
assert.deepEqual(
  manifest.devDependencies,
  lock.packages[""].devDependencies,
  "Development manifest/lock mismatch",
);
const html = await readFile(resolve(root, "dist/index.html"), "utf8");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const asset = match[1];
  assert(asset.startsWith("./"), `Non-relative production asset: ${asset}`);
  await access(resolve(root, "dist", asset));
}
for (const file of files.filter(
  (f) => f.path.startsWith("dist/") && f.path.endsWith(".css"),
)) {
  const css = await readFile(resolve(root, file.path), "utf8");
  for (const match of css.matchAll(/url\(([^)]+)\)/g)) {
    const asset = match[1].replaceAll(/["']/g, "");
    if (asset.startsWith("data:")) continue;
    assert(!/^(https?:|\/)/.test(asset), `Remote/absolute CSS asset: ${asset}`);
    await access(resolve(dirname(resolve(root, file.path)), asset));
  }
}
for (const file of files.filter((f) => f.path.startsWith("public/"))) {
  const exported = resolve(root, "dist", file.path.slice("public/".length));
  assert(
    (await readFile(exported)).equals(await readFile(resolve(root, file.path))),
    `Public asset missing or changed in export: ${file.path}`,
  );
}
files.sort((a, b) => a.path.localeCompare(b.path));
const withoutReport = files.reduce((total, file) => total + file.bytes, 0);
const report = {
  budgetBytes: 8388608,
  totalBytes: withoutReport,
  selfReportBytes: 0,
  exportBytes: files
    .filter((file) => file.path.startsWith("dist/"))
    .reduce((n, file) => n + file.bytes, 0),
  submittedFileCount: files.length + 1,
  generatedDependenciesIncluded: false,
  submodulesOrSymlinksIncluded: false,
  relativeAssetsVerified: true,
  publicAssetsMatchExport: true,
  manifestMatchesLock: true,
  note: "The inventory excludes this report hash; its own byte size is included in the total. Input/protected directories and explicitly budgeted scratch/cache paths are excluded.",
  files,
};
let body;
for (let i = 0; i < 8; i++) {
  body = JSON.stringify(report, null, 2) + "\n";
  const size = Buffer.byteLength(body);
  if (size === report.selfReportBytes) break;
  report.selfReportBytes = size;
  report.totalBytes = withoutReport + size;
}
assert(
  report.totalBytes <= report.budgetBytes,
  `Over submission budget: ${report.totalBytes}`,
);
await writeFile(resolve(root, "artifacts/submission.json"), body);
assert.equal(
  (await lstat(resolve(root, "artifacts/submission.json"))).size,
  report.selfReportBytes,
);
console.log(
  JSON.stringify(
    {
      passed: true,
      totalBytes: report.totalBytes,
      exportBytes: report.exportBytes,
      fileCount: report.submittedFileCount,
      budgetBytes: report.budgetBytes,
      remainingBytes: report.budgetBytes - report.totalBytes,
    },
    null,
    2,
  ),
);
