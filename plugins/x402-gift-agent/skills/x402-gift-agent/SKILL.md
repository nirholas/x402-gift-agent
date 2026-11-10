---
name: x402-gift-agent
description: Call the x402-gift-agent HTTP service to buy a signed gift voucher for another wallet, redeem a claim code into a signed credit record, and look up vouchers and credits. Use when one agent or person funds another agent's task.
---

# x402-gift-agent

x402-gift-agent is an Express service. A sponsor pays the gift amount plus a $0.01 fee over x402 and receives a signed voucher with a secret claim code. The recipient's agent redeems the code for free and gets a signed credit record. Sponsors, recipients and credits are identified by an EVM address or a Solana pubkey.

## Run it

No package is published and there is no hosted instance, so run it from a clone: `git clone https://github.com/nirholas/x402-gift-agent && cd x402-gift-agent`, then `npm install`, `cp .env.example .env`, and `npm run dev` (tsx `src/server.ts`). It listens on `PORT`, default 4022. For production use `npm run build` then `npm start`.

Key env vars: `PORT`, `GIFT_MAX` (maximum gift in USD, default 5.00), `SIGNING_SECRET`, `DATA_DIR`, `PAY_TO_ADDRESS`, `SOLANA_PAY_TO_ADDRESS`, `NETWORK`, `SOLANA_NETWORK`, `SOLANA_RPC_URL`.

## Endpoints

- `POST /gifts?amount=0.50` (gift amount plus $0.01, so $0.51 here). The amount is in the query string so the 402 can quote the true total before the body is sent. Body: `sponsor` (EVM address or Solana pubkey), `recipient` (optional, binds the voucher to that wallet), `message`, `taskHint`. Returns 201 with `voucherId`, `claimCode` (secret), `taskBudget`, `feePaid`, `totalPaid`, `expiresAt`, `signature`.
- `POST /claim/:code` (free). Body `{"wallet": "<EVM address or Solana pubkey>"}`. Returns voucher validation plus a signed credit record.
- `GET /gifts/:id` (free): public voucher status (`unclaimed` and so on). Never shows the claim code.
- `GET /credits/:wallet` (free): every signed credit record held by a wallet.
- `GET /stats`, `POST /verify` (body `{payload, signature}`), `GET /health` (free).

Treat `claimCode` like a secret: give it only to the recipient. Do not log it. Confirm the amount with the user before `POST /gifts`, since the total is charged immediately.

## Paying

Every paid route answers an unpaid request with HTTP 402 and a body whose `accepts` array lists two rails: USDC on Base (`base-sepolia` by default, `base` via `NETWORK`) and USDC on Solana (`solana` by default, `solana-devnet` via `SOLANA_NETWORK`). Pick the entry your wallet can sign, sign the USDC payment (EIP-3009 on Base, SPL `transferChecked` on Solana), and retry with the base64 `X-PAYMENT` header. The artifact is in the 200 body and the settlement receipt is in the `X-PAYMENT-RESPONSE` header. On the EVM rail `x402-fetch` with `viem` does this for you; `npm run client` runs `examples/agent-client.ts`, which reads `BASE_URL` and `PRIVATE_KEY`.

Discovery: `GET /.well-known/x402` lists routes, prices and rails, and `GET /skill.md` serves the repo's own reference. Paying moves real USDC on the configured network, so show the user the route, amount and rail first and wait for a yes before any paid call. Use a throwaway wallet on `base-sepolia` or `solana-devnet` for testing.
