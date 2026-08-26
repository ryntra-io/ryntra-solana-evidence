/**
 * The one place Solana RPC is reached from.
 *
 * Public endpoints are the default so the evidence core works from a clean
 * clone with no account anywhere; a provider URL (Helius, Triton, QuickNode)
 * enters only through the environment, never through code. Every read that
 * leaves this module carries a timeout and a bounded retry, because a public
 * RPC that hangs is a normal Tuesday and an unbounded read would make the
 * caller's freshness stamp a lie.
 */

import { createSolanaRpc } from "@solana/kit";
import type { EvidenceSource } from "./evidence.ts";

export const SOLANA_NETWORKS = ["mainnet", "devnet"] as const;
export type SolanaNetwork = (typeof SOLANA_NETWORKS)[number];

const PUBLIC_ENDPOINTS: Record<SolanaNetwork, string> = {
  /* Not the Labs endpoint: `api.mainnet-beta.solana.com` is aggressively
     rate-limited for anything beyond experiments, and on the machine this
     module was first proven on it sat behind TLS interception while other
     hosts did not. The default must work from a clean clone with no account
     anywhere; a provider URL still wins through the env override. */
  mainnet: "https://solana-rpc.publicnode.com",
  devnet: "https://api.devnet.solana.com",
};

/* Exported so the workspace's Developers and Settings surfaces render these
   names from the module that honors them, instead of keeping a second list
   that drifts. */
export const ENV_OVERRIDES: Record<SolanaNetwork, string> = {
  mainnet: "RYNTRA_SOLANA_RPC_MAINNET",
  devnet: "RYNTRA_SOLANA_RPC_DEVNET",
};

export type SolanaRpcConfig = Readonly<{
  network: SolanaNetwork;
  /** Explicit endpoint wins over env; env wins over the public default. */
  endpoint?: string;
  timeoutMs?: number;
  /** Additional attempts after the first failure. */
  retries?: number;
}>;

export type SolanaRpcHandle = Readonly<{
  network: SolanaNetwork;
  endpoint: string;
  rpc: ReturnType<typeof createSolanaRpc>;
  timeoutMs: number;
  retries: number;
  source: (path: string) => EvidenceSource;
}>;

export function resolveEndpoint(network: SolanaNetwork, explicit?: string): string {
  if (explicit) return explicit;
  const fromEnv = process.env[ENV_OVERRIDES[network]];
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  return PUBLIC_ENDPOINTS[network];
}

export function createSolanaRpcHandle(config: SolanaRpcConfig): SolanaRpcHandle {
  const endpoint = resolveEndpoint(config.network, config.endpoint);
  const rpc = createSolanaRpc(endpoint);
  /* The label names the host, never the full URL: a provider URL can carry an
     API key in its path, and a source label is exactly the string that ends up
     on receipts and in fixtures. */
  const host = new URL(endpoint).host;
  return {
    network: config.network,
    endpoint,
    rpc,
    timeoutMs: config.timeoutMs ?? 10_000,
    retries: config.retries ?? 1,
    source: (path: string) => ({
      ref: `solana:${config.network}:rpc:${path}`,
      label: `Solana ${config.network} JSON-RPC (${host})`,
    }),
  };
}

/**
 * Run one RPC send with the handle's timeout, retrying transient failures.
 *
 * Retries are for the transport, never for the answer: a response that parses
 * is returned as-is even when it is "account not found", because "not found"
 * is a fact and re-asking does not change facts.
 */
export async function withRpcDiscipline<T>(
  handle: SolanaRpcHandle,
  run: (abortSignal: AbortSignal) => Promise<T>,
): Promise<T> {
  let lastFailure: unknown;
  for (let attempt = 0; attempt <= handle.retries; attempt += 1) {
    const signal = AbortSignal.timeout(handle.timeoutMs);
    try {
      return await run(signal);
    } catch (failure) {
      lastFailure = failure;
    }
  }
  throw lastFailure instanceof Error
    ? lastFailure
    : new Error(`Solana RPC failed after ${handle.retries + 1} attempts: ${String(lastFailure)}`);
}
