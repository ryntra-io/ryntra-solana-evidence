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
const forbiddenNames = [/^\.env(?:\.|$)/i, /\.pem$/i, /\.key$/i, /id_rsa/i];
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
assert.ok(files.some((file) => relative(root, file) === "package-lock.json"), "package-lock.json is required");
for (const file of files) {
  const path = relative(root, file).replaceAll("\\", "/");
  assert.ok(!forbiddenNames.some((pattern) => pattern.test(path)), `Forbidden sensitive filename: ${path}`);
  const stat = await lstat(file);
  assert.ok(stat.size <= 3 * 1_024 * 1_024, `Unexpected large file: ${path}`);
  if (/\.(?:lock|json|md|mjs|ts|ya?ml)$/i.test(path) || path === "NOTICE" || path === "LICENSE") {
    const text = await readFile(file, "utf8");
    assert.ok(!credentialPatterns.some((pattern) => pattern.test(text)), `Credential-like value in ${path}`);
  }
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
assert.equal(packageJson.private, true, "Root package must block accidental npm publication");
assert.equal(packageJson.license, "Apache-2.0", "Root package must declare Apache-2.0");
assert.deepEqual(packageJson.workspaces, ["packages/*", "examples/*"]);

/**
 * Every lib/ and docs/ file must appear in the public file list.
 * Reject unexpected source files and unrecognised manifest metadata.
 */
const list = JSON.parse(await readFile(resolve(root, "packages/solana-evidence-sdk/public-files.json"), "utf8"));
assert.equal(list.kind, "RYNTRA_PUBLIC_FILE_LIST");
/* An exact six-field schema rejects unrecognised metadata by default. */
assert.deepEqual(
  Object.keys(list).sort(),
  ["files", "kind", "license", "note", "repository", "schemaVersion"],
  "The public file list carries a field it should not",
);
const shipped = new Set(list.files.map((entry) => entry.path));
for (const file of files) {
  const path = relative(root, file).replaceAll("\\", "/");
  if (!path.startsWith("lib/") && !path.startsWith("docs/")) continue;
  assert.ok(shipped.has(path), `A file the list does not name reached the repository: ${path}`);
}

console.log(`Boundary verification passed for ${files.length} files.`);
