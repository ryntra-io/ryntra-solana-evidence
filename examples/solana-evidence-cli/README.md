# ryntra-solana — the evidence kit from a terminal

A runnable example, and the fastest way to check a claim without reading any
code. It contains no evidence logic of its own: everything it prints comes from
`@ryntra/solana-evidence-sdk`, so what you see here is what an integrator gets.

## Read one mint

```bash
node examples/solana-evidence-cli/cli.ts inspect 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo
```

That is PayPal USD on Solana mainnet. It prints the identity block, then every
token extension with what it means for a holder, with `!` marking the ones that
can change the outcome of a transfer.

Note what it says about `TransferHook`: the extension is present, and the
program id is the all-zero key — so no hook program runs today, and the sentence
says so along with who can install one. A passport that announced a running
program there would be describing a slot instead of a setting.

## Preview a transfer and judge it

```bash
node examples/solana-evidence-cli/cli.ts preflight \
  --mint 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo \
  --from 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM \
  --to 5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1 \
  --amount 1000000
```

Amounts are raw base units, never a decimal — a 64-bit amount does not survive a
JavaScript number, and a lossy amount is a wrong amount.

Without `--policy` it uses the kit's cautious example policy and names it in the
output. Pass your own to judge against your own stance:

```bash
node examples/solana-evidence-cli/cli.ts preflight ... --policy ./my-policy.json
```

The exit is a preview and a verdict. Nothing is built, nothing is signed and
nothing is sent — there is no code path in this kit that could.

## Check a receipt

```bash
node examples/solana-evidence-cli/cli.ts verify ./receipt.json
node examples/solana-evidence-cli/cli.ts verify ./receipt.json --trusted-key <base64>
```

Offline. It recomputes both hashes, checks the Ed25519 signature against the key
the receipt carries, and reports whether the receipt's registry pin names the
Solana adapter. Four axes, never one word.

`--trusted-key` is what turns "this signature is sound" into "this signature is
one I trust". It can be repeated.

The process exits `2` when a receipt is unrecognised or its hashes do not
recompute, so this can sit inside somebody else's pipeline without a broken
receipt reading as success.

## Machine output

Add `--json` to any command. The payload carries the data and the kit's
limitations together, so the boundary travels with the answer.

## Try it on the shipped fixtures

The receipt fixtures are real artifacts minted by the Ryntra issuer path with a
throwaway key that was discarded; each carries its own public key, so checking
one here is the same computation you would run on a live receipt.

```bash
node examples/solana-evidence-cli/cli.ts verify lib/solana/fixtures/receipt-solana-matched-signed.json
node examples/solana-evidence-cli/cli.ts verify lib/solana/fixtures/receipt-solana-tampered.json
```

The second one is the first with a single edited character. Both hashes stop
recomputing and the command exits non-zero.
