/**
 * The Ryntra Solana evidence kit, from a terminal.
 *
 * Three commands over the SDK and nothing else — this file contains no
 * evidence logic of its own, so what it prints is exactly what an integrator
 * would get from the library. It is also the fastest way for a reviewer to
 * check a claim: one command, real chain data, and a refusal that names its
 * own reason when the chain says no.
 */

import { readFileSync } from "node:fs";

import {
  EXAMPLE_CAUTIOUS_POLICY,
  SOLANA_EVIDENCE_KIT_LIMITATIONS,
  SPL_TRANSFER_ACTION_REF,
  inspectSolanaMint,
  preflightSolanaAction,
  verifySolanaReceipt,
  type SolanaAssetPassport,
  type SolanaNetwork,
  type SolanaOwnerPolicy,
  type SolanaPolicyVerdict,
  type SolanaReceiptVerification,
  type SplTransferPreflight,
} from "../../packages/solana-evidence-sdk/src/index.ts";

const USAGE = `ryntra-solana — read-only Solana evidence

  inspect <mint> [--network mainnet|devnet] [--json]
      Read one mint and print its Asset Passport.

  preflight --mint <mint> --from <sender> --to <recipient> --amount <raw>
            [--network mainnet|devnet] [--policy <file.json>] [--json]
      Preview the exact transfer and judge it against a policy.
      Without --policy the cautious example policy is used and said so.

  verify <receipt.json> [--trusted-key <base64>]... [--json]
      Recompute a receipt's hashes and check its signature. Offline.

This tool holds no key, builds no transaction and signs nothing.`;

type Flags = Readonly<Record<string, string[] | true>>;

function parseFlags(argv: readonly string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Record<string, string[] | true> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const name = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[name] = true;
      continue;
    }
    const existing = flags[name];
    flags[name] = Array.isArray(existing) ? [...existing, next] : [next];
    index += 1;
  }
  return { positional, flags };
}

function one(flags: Flags, name: string): string | null {
  const value = flags[name];
  return Array.isArray(value) ? value[0] : null;
}

function networkOf(flags: Flags): SolanaNetwork {
  const value = one(flags, "network");
  if (value === null) return "mainnet";
  if (value !== "mainnet" && value !== "devnet") {
    throw new Error(`Unknown network "${value}". Use mainnet or devnet.`);
  }
  return value;
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function emitJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const rule = "─".repeat(72);

function printPassport(passport: SolanaAssetPassport): void {
  const { identity } = passport;
  process.stdout.write(`\n${rule}\n`);
  process.stdout.write(`ASSET PASSPORT  ${identity.mint}\n`);
  process.stdout.write(`${rule}\n`);
  process.stdout.write(`  token program   ${identity.programKind} (${identity.programId})\n`);
  process.stdout.write(`  decimals        ${identity.decimals.value}\n`);
  process.stdout.write(`  supply          ${identity.supply.value} base units\n`);
  process.stdout.write(`  mint authority  ${identity.mintAuthority.value ?? "none"} — ${identity.mintAuthority.meaning}\n`);
  process.stdout.write(`  freeze auth.    ${identity.freezeAuthority.value ?? "none"} — ${identity.freezeAuthority.meaning}\n`);

  if (passport.extensions.length === 0) {
    process.stdout.write("\n  No token extensions. Transfers carry no issuer-programmed behaviour.\n");
  } else {
    process.stdout.write(`\n  ${passport.extensions.length} token extension(s):\n`);
    for (const extension of passport.extensions) {
      const marker = extension.affectsTransfers ? "!" : "·";
      process.stdout.write(`\n   ${marker} ${extension.kind}  [${extension.provenance}]\n`);
      process.stdout.write(`     ${extension.meaning}\n`);
      for (const [key, value] of Object.entries(extension.fields)) {
        process.stdout.write(`       ${key}: ${String(value)}\n`);
      }
    }
    process.stdout.write("\n   ! marks an extension that can change the outcome of a transfer.\n");
  }

  if (passport.unsupportedKinds.length > 0) {
    process.stdout.write(`\n  Not decodable by this version: ${passport.unsupportedKinds.join(", ")}\n`);
    process.stdout.write("  Their powers are unknown, not absent.\n");
  }
  process.stdout.write(`\n  read ${passport.observedAt} from ${passport.source.label}\n`);
}

function printPreflight(preflight: SplTransferPreflight): void {
  process.stdout.write(`\n${rule}\n`);
  process.stdout.write("TRANSFER PREVIEW\n");
  process.stdout.write(`${rule}\n`);
  process.stdout.write(`  requested       ${preflight.amountRequestedRaw} base units\n`);
  process.stdout.write(`  mint fee        ${preflight.transferFee.feeRaw} (${preflight.transferFee.basisPoints} bps`);
  process.stdout.write(preflight.transferFee.capApplied ? ", capped)\n" : ")\n");
  process.stdout.write(`  recipient gets  ${preflight.estimatedReceivedRaw} base units\n`);
  process.stdout.write(`  transfer hook   ${preflight.hookProgramId ?? "none runs on this transfer"}\n`);
  if (preflight.structuralBlockers.length > 0) {
    process.stdout.write(`  structural      ${preflight.structuralBlockers.join(", ")}\n`);
  }
  process.stdout.write(`  network fee     ${preflight.networkFeeLamports ?? "not computed here"}\n`);
  process.stdout.write(`                  ${preflight.unfilledReason}\n`);
}

function printVerdict(verdict: SolanaPolicyVerdict, policySource: string): void {
  process.stdout.write(`\n${rule}\n`);
  process.stdout.write(`POLICY VERDICT  ${verdict.verdict}\n`);
  process.stdout.write(`${rule}\n`);
  process.stdout.write(`  policy: ${policySource}\n\n`);
  /* Every marker is exactly six characters so the rule names form one column;
     an outcome nobody has a marker for still prints, padded, rather than
     silently shifting the whole table. */
  const marks: Record<string, string> = {
    ALLOWED: "  ok  ",
    BLOCKED: " STOP ",
    REVIEW_REQUIRED: " look ",
    INCOMPLETE: " gap  ",
  };
  for (const finding of verdict.findings) {
    const mark = (marks[finding.outcome] ?? finding.outcome).slice(0, 6).padEnd(6, " ");
    process.stdout.write(`${mark}${finding.rule}\n      ${finding.detail}\n`);
  }
  process.stdout.write("\n  NO_KNOWN_BLOCKER is the best verdict there is: it reports the absence of\n");
  process.stdout.write("  known blockers under your policy. It is not a safety judgement.\n");
}

function printVerification(result: SolanaReceiptVerification): void {
  process.stdout.write(`\n${rule}\n`);
  process.stdout.write("RECEIPT VERIFICATION\n");
  process.stdout.write(`${rule}\n`);
  if (!result.recognised) {
    process.stdout.write("  This is not an Outcome Receipt.\n");
    return;
  }
  process.stdout.write(`  schema      ${result.schema.valid ? "valid" : "INVALID"}\n`);
  for (const issue of result.schema.issues) process.stdout.write(`                ${issue}\n`);
  process.stdout.write(`  integrity   ${result.integrity.valid ? "both hashes recompute" : "MISMATCH"}\n`);
  for (const issue of result.integrity.issues) process.stdout.write(`                ${issue}\n`);
  process.stdout.write(`  issuer      ${result.issuer.verdict} — ${result.issuer.detail}\n`);
  process.stdout.write(`  binding     ${result.binding.verdict} — ${result.binding.detail}\n`);
  if (result.outcome) {
    process.stdout.write(`\n  observed    ${result.outcome.status} on ${result.outcome.network ?? result.outcome.chainRef}\n`);
    process.stdout.write(`              tx ${result.outcome.transactionHash}\n`);
    process.stdout.write(`              ${result.outcome.observedEffects} observed effect(s), reconciled ${result.outcome.reconciledAt}\n`);
  }
  if (result.issuer.verdict === "SIGNATURE_VALID") {
    process.stdout.write("\n  A sound signature says these bytes came from the holder of that key.\n");
    process.stdout.write("  Pass --trusted-key to check it is a key you actually trust.\n");
  }
}

function printLimitations(): void {
  process.stdout.write(`\n${rule}\n`);
  for (const line of SOLANA_EVIDENCE_KIT_LIMITATIONS) process.stdout.write(`  ${line}\n`);
  process.stdout.write(`${rule}\n`);
}

function loadPolicy(path: string | null): { policy: SolanaOwnerPolicy; source: string } {
  if (path === null) {
    return { policy: EXAMPLE_CAUTIOUS_POLICY, source: "the kit's cautious example (an example, not a recommendation)" };
  }
  return { policy: JSON.parse(readFileSync(path, "utf8")) as SolanaOwnerPolicy, source: path };
}

async function runInspect(positional: readonly string[], flags: Flags): Promise<void> {
  const mint = positional[0];
  if (!mint) fail("inspect needs a mint address.\n\n" + USAGE);

  const result = await inspectSolanaMint(mint, { network: networkOf(flags) });
  if (!result.ok) fail(`${result.code}: ${result.reason}`);
  if (flags.json) {
    emitJson({ passport: result.passport, limitations: SOLANA_EVIDENCE_KIT_LIMITATIONS });
    return;
  }
  printPassport(result.passport);
  printLimitations();
}

async function runPreflight(flags: Flags): Promise<void> {
  const mint = one(flags, "mint");
  const sender = one(flags, "from");
  const recipient = one(flags, "to");
  const amountRaw = one(flags, "amount");
  if (!mint || !sender || !recipient || !amountRaw) {
    fail("preflight needs --mint, --from, --to and --amount.\n\n" + USAGE);
  }

  const { policy, source } = loadPolicy(one(flags, "policy"));
  const result = await preflightSolanaAction({
    input: {
      schemaVersion: "1.0.0",
      actionRef: SPL_TRANSFER_ACTION_REF,
      network: networkOf(flags),
      mint,
      sender,
      recipient,
      amountRaw,
    },
    policy,
  });
  if (!result.ok) fail(`${result.code}: ${result.reason}`);
  if (flags.json) {
    emitJson({
      passport: result.passport,
      preflight: result.preflight,
      verdict: result.verdict,
      limitations: SOLANA_EVIDENCE_KIT_LIMITATIONS,
    });
    return;
  }
  printPassport(result.passport);
  printPreflight(result.preflight);
  printVerdict(result.verdict, source);
  printLimitations();
}

function runVerify(positional: readonly string[], flags: Flags): void {
  const path = positional[0];
  if (!path) fail("verify needs a path to a receipt JSON file.\n\n" + USAGE);

  let receipt: unknown;
  try {
    receipt = JSON.parse(readFileSync(path, "utf8"));
  } catch (failure) {
    fail(`Could not read ${path}: ${failure instanceof Error ? failure.message : String(failure)}`);
  }

  const trusted = flags["trusted-key"];
  const result = verifySolanaReceipt(receipt, {
    trustedPublicKeys: Array.isArray(trusted) ? trusted : undefined,
  });
  if (flags.json) {
    emitJson({ verification: result, limitations: SOLANA_EVIDENCE_KIT_LIMITATIONS });
    return;
  }
  printVerification(result);
  printLimitations();

  /* A non-zero exit lets this run inside somebody else's pipeline: a receipt
     whose hashes do not recompute must not read as success to a script. */
  if (!result.recognised || !result.integrity.valid) process.exitCode = 2;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseFlags(rest);

  try {
    switch (command) {
      case "inspect":
        await runInspect(positional, flags);
        return;
      case "preflight":
        await runPreflight(flags);
        return;
      case "verify":
        runVerify(positional, flags);
        return;
      case undefined:
      case "help":
      case "--help":
      case "-h":
        process.stdout.write(`${USAGE}\n`);
        return;
      default:
        fail(`Unknown command "${command}".\n\n${USAGE}`);
    }
  } catch (failure) {
    fail(failure instanceof Error ? failure.message : String(failure));
  }
}

await main();
