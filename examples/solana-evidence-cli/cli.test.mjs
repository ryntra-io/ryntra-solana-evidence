/**
 * The CLI, run as a real process.
 *
 * Only the network-free commands are exercised here on purpose: a test suite
 * that needs a live RPC is a suite that goes red when somebody else's
 * endpoint has a bad afternoon. `inspect` and `preflight` are proven against
 * captured chain bytes in the SDK's own suite; what this file proves is that
 * the executable exists, parses its arguments, prints what it says it prints,
 * and exits non-zero on a receipt that does not check out.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));
const fixtures = fileURLToPath(new URL("../../lib/solana/fixtures/", import.meta.url));

function run(args) {
  try {
    return { status: 0, stdout: execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" }) };
  } catch (failure) {
    return { status: failure.status, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
  }
}

test("with no arguments it prints usage and states what it will not do", function () {
  const { status, stdout } = run([]);
  assert.equal(status, 0);
  assert.match(stdout, /inspect <mint>/);
  assert.match(stdout, /preflight --mint/);
  assert.match(stdout, /verify <receipt\.json>/);
  assert.match(stdout, /holds no key, builds no transaction and signs nothing/);
});

test("an unknown command fails rather than doing something adjacent", function () {
  const { status, stderr } = run(["sign"]);
  assert.equal(status, 1);
  assert.match(stderr, /Unknown command "sign"/);
});

test("verify reports all four axes on a signed Solana receipt", function () {
  const { status, stdout } = run(["verify", `${fixtures}receipt-solana-matched-signed.json`]);
  assert.equal(status, 0);
  assert.match(stdout, /schema\s+valid/);
  assert.match(stdout, /integrity\s+both hashes recompute/);
  assert.match(stdout, /issuer\s+SIGNATURE_VALID/);
  assert.match(stdout, /binding\s+SOLANA_PINNED/);
  assert.match(stdout, /observed\s+MATCHED on devnet/);
  /* A sound signature must not be allowed to read as a trusted one. */
  assert.match(stdout, /Pass --trusted-key to check it is a key you actually trust/);
});

test("a tampered receipt exits non-zero so a pipeline cannot mistake it for success", function () {
  const { status, stdout } = run(["verify", `${fixtures}receipt-solana-tampered.json`]);
  assert.equal(status, 2);
  assert.match(stdout, /CONTENT_HASH_MISMATCH/);
  assert.match(stdout, /INTEGRITY_HASH_MISMATCH/);
});

test("a receipt for another chain verifies its own bytes and is reported NOT_SOLANA", function () {
  const { status, stdout } = run(["verify", `${fixtures}receipt-other-chain-signed.json`]);
  assert.equal(status, 0);
  assert.match(stdout, /binding\s+NOT_SOLANA/);
});

test("--json emits machine-readable output with the limitations attached", function () {
  const { status, stdout } = run(["verify", `${fixtures}receipt-solana-deviation-unsigned.json`, "--json"]);
  assert.equal(status, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.verification.issuer.verdict, "UNSIGNED");
  assert.equal(parsed.verification.outcome.status, "DEVIATION_RECORDED");
  assert.equal(parsed.limitations.length, 3);
});

test("--trusted-key turns a sound signature into a trusted or untrusted one", function () {
  const path = `${fixtures}receipt-solana-matched-signed.json`;
  const stranger = run(["verify", path, "--trusted-key", "AAAA", "--json"]);
  assert.equal(JSON.parse(stranger.stdout).verification.issuer.verdict, "UNTRUSTED_KEY");

  const own = JSON.parse(run(["verify", path, "--json"]).stdout).verification;
  assert.equal(own.issuer.verdict, "SIGNATURE_VALID");
});

test("a missing file is refused with its reason rather than a stack trace", function () {
  const { status, stderr } = run(["verify", `${fixtures}does-not-exist.json`]);
  assert.equal(status, 1);
  assert.match(stderr, /Could not read/);
  assert.doesNotMatch(stderr, /at Object\./);
});

test("preflight without its required flags says which ones", function () {
  const { status, stderr } = run(["preflight", "--mint", "So11111111111111111111111111111111111111112"]);
  assert.equal(status, 1);
  assert.match(stderr, /--mint, --from, --to and --amount/);
});

test("an unknown network is refused before any read is attempted", function () {
  const { status, stderr } = run(["inspect", "So11111111111111111111111111111111111111112", "--network", "testnet"]);
  assert.equal(status, 1);
  assert.match(stderr, /Unknown network "testnet"/);
});
