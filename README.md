# x402-gift-agent

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![x402](https://img.shields.io/badge/payments-x402-0052ff.svg)](https://x402.org)
[![USDC on Base + Solana](https://img.shields.io/badge/USDC-Base%20%2B%20Solana-0052ff.svg)](https://x402.org)

**fund someone else's agent task** — Pay once in USDC and get a signed gift voucher — claim code, task budget, expiry — back in the same response. The recipient's agent redeems it for free and receives a signed, spendable credit record.

## Why x402 for this

Gifting normally means a merchant holds your money until someone else shows up to spend it — a balance you have to trust. With x402 the value is settled at purchase time and the instrument comes back in the payment response: a signed voucher you can forward over any channel. The recipient never needs an account with the sponsor, only a wallet on either rail.

## Pay in USDC on Base **or** Solana — your client picks the rail

Every paid route answers an unpaid request with a 402 whose `accepts` array
carries both rails:

| Rail | Networks | Asset | payTo |
|---|---|---|---|
| EVM | `base-sepolia` (default) · `base` | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana-devnet` (default) · `solana` | USDC | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Each rail settles through **its own facilitator** — they are not interchangeable:

| Rail | Facilitator | Env |
|---|---|---|
| EVM | `https://x402.org/facilitator` | `FACILITATOR_URL` |
| Solana | `https://facilitator.payai.network` | `SOLANA_FACILITATOR_URL` |

The x402.org reference facilitator settles Base but not Solana, so the Solana
rail defaults to PayAI's. On Solana, `extra.feePayer` is that facilitator's
sponsor account — discovered from its `/supported` endpoint at boot — so a payer
needs only USDC, never SOL for gas.

## Quickstart

```bash
git clone https://github.com/nirholas/x402-gift-agent && cd x402-gift-agent
npm install
cp .env.example .env       # optional — every value has a working default
npm run dev

# in another terminal, the full paid flow on the EVM rail:
PRIVATE_KEY=0xYourFundedBaseSepoliaKey npm run client
```

Open <http://localhost:4022/> for the browser checkout demo (EVM wallet or Phantom).


## API

| Route | Price | What you get back |
|---|---|---|
| `POST /gifts` | $0.11 (gift amount + $0.01 fee — e.g. `?amount=0.10`) | Signed gift voucher (claim code, task budget, expiry) |
| `POST /claim/:code` | free | Voucher validation + signed spendable credit record |
| `GET /gifts/:id` | free | Voucher status snapshot (claim code redacted) |
| `GET /credits/:wallet` | free | Signed credit records owned by that wallet |
| `GET /stats` | free | Aggregate counters |
| `POST /verify` | free | `{ valid: true | false }` |
| `GET /health` | free | `{ ok: true }` |
| `GET /.well-known/x402` | free | Machine-readable discovery manifest |

The `$0.01` fee is added on top of the gift amount: `POST /gifts?amount=0.50` costs `$0.51` and mints a voucher with a `$0.50` task budget (max `GIFT_MAX`, default `$5.00`).

## How x402 works here

1. Call a paid route with no payment → **402** with `accepts[]` quoting the exact price on **both** rails.
2. Your client picks a rail and signs: EIP-3009 `transferWithAuthorization` (EVM) or a serialized SPL transfer (Solana).
3. Retry with the `X-PAYMENT` header. The facilitator **for that rail** verifies and settles.
4. The server returns **the artifact in the 200 body**, plus `X-PAYMENT-RESPONSE` carrying `{ rail, network, transaction, payer }`.

Mainnet: `NETWORK=base`, `SOLANA_NETWORK=mainnet-beta`, and mainnet-capable
`FACILITATOR_URL` / `SOLANA_FACILITATOR_URL`.

## Real backend / API keys

Fully self-contained — **no external APIs and no API keys**. State is file-based (`data/vouchers.json`, `data/credits.json`).
Artifacts are signed with HMAC-SHA256 using `SIGNING_SECRET`; the dev default
(`dev-secret-change-me`) is public, so set your own in production.

## Human checkout

`public/index.html` is a working browser demo built on the drop-in
[`@three-ws/x402-payment-modal`](https://www.npmjs.com/package/@three-ws/x402-payment-modal)
(loaded from the CDN — it is a proprietary package and is never vendored here).
Open `http://localhost:4022/` after `npm run dev`. Because the 402 already
carries both rails, the modal offers an EVM wallet **and** Phantom with no extra
wiring. It also brings **SIWX re-entry** (sign in once with your wallet, come
back without re-approving) and **spending caps** (a per-session ceiling the user
sets, so an agent or a page cannot drain a wallet a cent at a time).

## For AI agents

- **skill.md**: [skill.md](skill.md) — agent-facing endpoints, prices, schemas, error codes.
- **Discovery manifest**: [`/.well-known/x402`](public/.well-known/x402), served live by the app, listing **both networks per resource** — indexable by [x402scan.com](https://x402scan.com), the x402 Bazaar, and [agentic.market](https://agentic.market). List your deployment there so paying agents can find it.
- **MCP**: [examples/mcp-tool.md](examples/mcp-tool.md) — wrap these routes as MCP tools for Claude.
- **Raw flow**: [examples/curl.md](examples/curl.md) — the 402 → pay → 200 walkthrough by hand.

## Docs

Full docs on GitHub Pages: **https://nirholas.github.io/x402-gift-agent/** — [tutorial](docs/tutorial.md) · [API reference](docs/api.md) · [for agents](docs/agents.md)

Part of the [x402 Suite](https://github.com/nirholas/x402-suite).

## Support

nichxbt@gmail.com

## License

[Apache-2.0](LICENSE)
