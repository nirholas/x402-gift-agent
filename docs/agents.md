# For AI agents — x402-gift-agent

## What an agent gets

Fund someone else's agent task. A sponsor pays (gift amount + a $0.01 service fee) over x402 and receives a **signed gift voucher** — claim code, task budget, expiry — in the same 200 response. The recipient's agent redeems the claim code for free and gets a **signed credit record** it can spend. Ownership is dual-rail: a sponsor, a recipient binding, and a claimed credit are each identified by an EVM address *or* a Solana pubkey, so a Base sponsor can gift a Solana-native agent and vice versa.

Every paid route hands back the artifact **in the 200 body**. There is no
"payment accepted, check back later" path to babysit.

## 1. Discover

Two machine-readable entry points:

| Artifact | URL | Purpose |
|---|---|---|
| Skill file | [`skill.md`](https://github.com/nirholas/x402-gift-agent/blob/main/skill.md) | Endpoints, prices, request/response schemas, error codes — drop it into an agent's tool context |
| Manifest | `{BASE_URL}/.well-known/x402` | The x402 discovery format: resources, prices, accepted networks, output schemas |
| OpenAPI | [`openapi.json`](https://github.com/nirholas/x402-gift-agent/blob/main/openapi.json) | OpenAPI 3.1 including the dual-rail 402 response |

```bash
curl -s http://localhost:4022/.well-known/x402 | jq '.resources[] | {resource, price, accepts}'
```

## 2. Pay — pick a rail

An unpaid call to a paid route returns `402` with two `accepts` entries:

| Rail | Network | Asset | payTo |
|---|---|---|---|
| EVM | `base-sepolia` / `base` | USDC `0x036CbD…dCF7e` | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana-devnet` / `solana` | USDC `4zMMC9…ncDU` | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

An agent holding an EVM key uses the first entry; an agent holding a Solana
keypair uses the second. Each rail is verified and settled by **its own**
facilitator — `https://x402.org/facilitator` for Base,
`https://facilitator.payai.network` for Solana — because no single facilitator
here settles both. The server routes to the right one based on the rail the
payment arrived on; from the client's side nothing changes.

```ts
import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

const payFetch = wrapFetchWithPayment(fetch, privateKeyToAccount(process.env.PRIVATE_KEY));

// paid: buy the voucher — the claim code is in the response body
const voucher = await (await payFetch(`${BASE}/gifts?amount=0.50`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ sponsor: myWallet, recipient: theirWallet }),
})).json();

// free: the recipient's agent redeems it against its own wallet (either rail)
const claim = await (await fetch(`${BASE}/claim/${voucher.claimCode}`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ wallet: theirWallet }),
})).json();
claim.credit.budget;   // "$0.50" — signed, spendable
```

On the Solana side, the `accepts` entry carries `extra.feePayer` — the Solana
facilitator's sponsor account that pays the SOL network fee, so an agent needs
only USDC, never SOL for gas. That value is read from the Solana facilitator's
`/supported` endpoint at runtime, so pointing `SOLANA_FACILITATOR_URL`
elsewhere automatically advertises that facilitator's sponsor instead.

## 3. Verify what you bought

Artifacts are HMAC-SHA256 signed over canonical JSON. Re-check any of them for
free:

```bash
curl -s -X POST http://localhost:4022/verify -H 'content-type: application/json' -d @artifact.json
# {"valid": true}
```

The `X-PAYMENT-RESPONSE` header on every paid 200 carries the settlement
receipt, so an agent can log `{ rail, network, transaction, payer }` next to the
artifact it paid for.

## 4. MCP integration

[`examples/mcp-tool.md`](https://github.com/nirholas/x402-gift-agent/blob/main/examples/mcp-tool.md) wraps these
routes as MCP tools for Claude Desktop / Claude Code, including the
`claude_desktop_config.json` block.

## 5. Listing

Deploy it, then list the deployment so paying agents can find it:

- **[x402scan.com](https://x402scan.com)** — submit the base URL; it reads `/.well-known/x402`.
- **x402 Bazaar** — the facilitator-hosted resource directory; the manifest is already in the right shape.
- **[agentic.market](https://agentic.market)** — agent-facing marketplace listing; point it at `skill.md`.

Keep `/.well-known/x402` reachable without payment (it is, by design) and keep
`resource` URLs in the 402 matching your public hostname.

## Contact

nichxbt@gmail.com
