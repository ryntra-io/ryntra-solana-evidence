import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const ignored = new Set([".git", "node_modules", "coverage", "dist"]);
const allowedTopLevel = new Set([
  ".github",
  ".gitignore",
  "AUTHORS.md",
  "BUILDLOG.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "NOTICE",
  "README.md",
  "SECURITY.md",
  "docs",
  "eslint.config.mjs",
  "examples",
  "lib",
  "package-lock.json",
  "package.json",
  "packages",
  "scripts",
  "tsconfig.json",
]);

/**
 * The repository's own scaffolding. Every file that is not one of these must be
 * named by the public file list — not only files under `lib/` and `docs/`, but
 * everything under `packages/`, `examples/`, `scripts/` and `.github/` too.
 */
const templateFiles = new Set([
  ".github/workflows/ci.yml",
  ".gitignore",
  "AUTHORS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "NOTICE",
  "README.md",
  "SECURITY.md",
  "eslint.config.mjs",
  "package.json",
  "package-lock.json",
  "scripts/verify-boundaries.mjs",
  "tsconfig.json",
]);

/**
 * Checked against every path segment, so a nested `packages/demo/.env` or
 * `examples/x/.env.local` is refused exactly like one at the root.
 */
const forbiddenSegments = [
  /^\.env(?:\.|$)/i,
  /\.(?:pem|key|p12|pfx|jks|keystore|p8)$/i,
  /^id_(?:rsa|dsa|ecdsa|ed25519)/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
];
const credentialPatterns = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    const stat = await lstat(absolute);
    assert.equal(stat.isSymbolicLink(), false, `Symlinks are not allowed: ${relative(root, absolute)}`);
    if (entry.isDirectory()) output.push(...await walk(absolute));
    else output.push(absolute);
  }
  return output;
}

const topLevel = await readdir(root);
for (const name of topLevel) {
  if (ignored.has(name)) continue;
  assert.ok(allowedTopLevel.has(name), `Unexpected top-level path: ${name}`);
}

const files = await walk(root);
const paths = files.map((file) => relative(root, file).replaceAll("\\", "/"));
assert.ok(paths.includes("package-lock.json"), "package-lock.json is required");

for (const [index, file] of files.entries()) {
  const path = paths[index];
  for (const segment of path.split("/")) {
    assert.ok(!forbiddenSegments.some((pattern) => pattern.test(segment)), `Forbidden sensitive filename: ${path}`);
  }
  const stat = await lstat(file);
  assert.ok(stat.size <= 3 * 1_024 * 1_024, `Unexpected large file: ${path}`);
  if (/\.(?:lock|json|md|mjs|ts|ya?ml)$/i.test(path) || path === "NOTICE" || path === "LICENSE") {
    const text = await readFile(file, "utf8");
    assert.ok(!credentialPatterns.some((pattern) => pattern.test(text)), `Credential-like value in ${path}`);
  }
}

/* Every dependency resolves from the public npm registry: no private registry,
   no git or tarball URL that would point at a machine or account of ours. */
const lock = JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8"));
for (const [name, entry] of Object.entries(lock.packages ?? {})) {
  if (!entry.resolved || entry.link) continue; // workspace links resolve to paths inside this repository
  assert.ok(entry.resolved.startsWith("https://registry.npmjs.org/"), `Dependency resolved outside the public registry: ${name}`);
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
assert.equal(packageJson.private, true, "Root package must block accidental npm publication");
assert.equal(packageJson.license, "Apache-2.0", "Root package must declare Apache-2.0");
assert.deepEqual(packageJson.workspaces, ["packages/*", "examples/*"]);

/**
 * The tree is exactly the listed files plus this template, and nothing else:
 * the extraction copies an explicit list, and an unexpected module in a public
 * repository is the failure this whole recipe exists to make impossible.
 *
 * The list carries paths and roles and nothing else. Its key set is asserted
 * exactly, so a field that should never ship cannot be re-added silently.
 */
const list = JSON.parse(await readFile(resolve(root, "packages/solana-evidence-sdk/public-files.json"), "utf8"));
assert.equal(list.kind, "RYNTRA_PUBLIC_FILE_LIST");
assert.deepEqual(
  Object.keys(list).sort(),
  ["files", "kind", "license", "note", "repository", "schemaVersion"],
  "The public file list carries a field it should not",
);
const shipped = new Set(list.files.map((entry) => entry.path));
for (const path of paths) {
  if (templateFiles.has(path)) continue;
  assert.ok(shipped.has(path), `A file the list does not name reached the repository: ${path}`);
}
for (const path of shipped) {
  assert.ok(paths.includes(path), `The list names a file that is not in the repository: ${path}`);
}

console.log(`Boundary verification passed for ${files.length} files.`);
