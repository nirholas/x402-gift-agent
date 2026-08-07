# Expose x402-gift-agent as an MCP tool

Give Claude (Desktop, Code, or any MCP client) direct access to this service.
The agent pays per call over x402 — on the Base rail with an EVM key, or on the
Solana rail with a Solana keypair.

## 1. A minimal MCP server

```ts
// mcp-x402-gift-agent.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "x402-fetch";

const BASE = process.env.GIFT_URL ?? "http://localhost:4022";
const payFetch = wrapFetchWithPayment(
  fetch,
  privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
);

const server = new McpServer({ name: "x402-gift-agent", version: "0.1.0" });

server.tool(
  "buy_gift_voucher",
  "Pay for a gift voucher (amount + $0.01 fee) in USDC. Returns the signed voucher including its claim code.",
  {
    amount: z.number().describe("Task budget in dollars, e.g. 0.5"),
    recipient: z.string().optional().describe("Bind the voucher to an EVM address or Solana pubkey"),
    message: z.string().optional(),
    taskHint: z.string().optional(),
  },
  async ({ amount, recipient, message, taskHint }) => {
    const res = await payFetch(`${BASE}/gifts?amount=${amount}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient, message, taskHint }),
    });
    return { content: [{ type: "text", text: JSON.stringify(await res.json(), null, 2) }] };
  },
);

server.tool(
  "claim_gift_voucher",
  "Redeem a gift claim code against a wallet (EVM address or Solana pubkey). Free. Returns a signed credit record.",
  { claimCode: z.string(), wallet: z.string() },
  async ({ claimCode, wallet }) => {
    const res = await fetch(`${BASE}/claim/${encodeURIComponent(claimCode)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet }),
    });
    return { content: [{ type: "text", text: JSON.stringify(await res.json(), null, 2) }] };
  },
);

await server.connect(new StdioServerTransport());
```

```bash
npm i @modelcontextprotocol/sdk zod viem x402-fetch
```

## 2. Register it with Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "x402-gift-agent": {
      "command": "npx",
      "args": ["-y", "tsx", "/absolute/path/to/mcp-x402-gift-agent.ts"],
      "env": {
        "PRIVATE_KEY": "0xYourFundedBaseSepoliaKey",
        "GIFT_URL": "http://localhost:4022"
      }
    }
  }
}
```

For Claude Code: `claude mcp add x402-gift-agent -- npx -y tsx /absolute/path/to/mcp-x402-gift-agent.ts`

## 3. Paying on Solana instead

`wrapFetchWithPayment` covers the EVM rail. For the Solana rail, swap it for an
x402 Solana client (or the browser modal's
[`/server` helpers](https://www.npmjs.com/package/@three-ws/x402-payment-modal))
and select the `solana-devnet` / `solana` entry from the 402 `accepts` array.
That entry's `extra.feePayer` comes from the Solana facilitator
(`SOLANA_FACILITATOR_URL`, PayAI by default), which is a different service from
the EVM one. The tool definitions above do not change — only the fetch wrapper does.

## 4. Spending guardrails

Give the MCP server its own funded key with a small balance. Every route here is
sub-cent to a few cents, and the price is quoted in the 402 before anything is
signed, so an agent can refuse a call whose price exceeds its budget.

Full endpoint reference: [skill.md](https://github.com/nirholas/x402-gift-agent/blob/main/skill.md).
