# x402-gift-agent — agent skill

Fund someone else's agent task. A sponsor pays (gift amount + a $0.01 service fee) over x402 and receives a **signed gift voucher** — claim code, task budget, expiry — in the same 200 response. The recipient's agent redeems the claim code for free and gets a **signed credit record** it can spend. Ownership is dual-rail: a sponsor, a recipient binding, and a claimed credit are each identified by an EVM address *or* a Solana pubkey, so a Base sponsor can gift a Solana-native agent and vice versa.

**Base URL**: `{BASE_URL}` (self-hosted; e.g. `http://localhost:4022`)

## Endpoints

### POST /gifts — $0.11 (gift amount + $0.01 fee — e.g. `?amount=0.10`)
Buy a gift voucher. Costs the gift amount plus a $0.01 fee; returns the signed voucher including its secret claim code.

Request body:
```json
{
  "sponsor": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
  "recipient": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
  "message": "Happy birthday — have your agent book us dinner!",
  "taskHint": "restaurant booking, 2 people, Friday"
}
```

`amount` goes in the **query string** (`?amount=0.50`) so the 402 can quote the true total before the body arrives. `sponsor` and `recipient` each accept an EVM address **or** a Solana pubkey; setting `recipient` binds the voucher to that wallet.

Response `201`:
```json
{
  "voucherId": "gift_1c9d7f22-0b3e-4c5a-9f11-77a2d0e4bb31",
  "document": "x402-gift-agent/voucher",
  "claimCode": "GIFT-4A7C-19F0-B3D2",
  "taskBudget": "$0.50",
  "feePaid": "$0.01",
  "totalPaid": "$0.51",
  "sponsor": {
    "rail": "evm",
    "address": "0x40252cfdf8b20ed757d61ff157719f33ec332402"
  },
  "boundTo": {
    "rail": "solana",
    "address": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW"
  },
  "message": "Happy birthday — have your agent book us dinner!",
  "taskHint": "restaurant booking, 2 people, Friday",
  "issuedAt": "2026-01-01T00:00:00.000Z",
  "expiresAt": "2026-01-31T00:00:00.000Z",
  "status": "unclaimed",
  "signature": "7b21…hex hmac…",
  "algorithm": "HMAC-SHA256",
  "payment": {
    "rail": "evm",
    "network": "base-sepolia",
    "transaction": "0xabc…",
    "payer": "0xPayer…",
    "amount": "510000"
  }
}
```

### POST /claim/:code — free
Redeem a claim code against a wallet. Free — the sponsor already paid. Returns voucher validation plus a signed spendable credit record.

Request body:
```json
{
  "wallet": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW"
}
```

`wallet` is required and accepts an EVM address or a Solana pubkey.

Response `200`:
```json
{
  "voucher": {
    "voucherId": "gift_1c9d7f22-0b3e-4c5a-9f11-77a2d0e4bb31",
    "document": "x402-gift-agent/voucher",
    "taskBudget": "$0.50",
    "feePaid": "$0.01",
    "totalPaid": "$0.51",
    "sponsor": {
      "rail": "evm",
      "address": "0x40252cfdf8b20ed757d61ff157719f33ec332402"
    },
    "boundTo": {
      "rail": "solana",
      "address": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW"
    },
    "message": "Happy birthday — have your agent book us dinner!",
    "taskHint": "restaurant booking, 2 people, Friday",
    "issuedAt": "2026-01-01T00:00:00.000Z",
    "expiresAt": "2026-01-31T00:00:00.000Z",
    "status": "claimed",
    "signature": "7b21…hex hmac…",
    "algorithm": "HMAC-SHA256"
  },
  "credit": {
    "creditId": "cred_ab77e310-4c21-4f0d-9a3b-2e5c6d7f8091",
    "document": "x402-gift-agent/credit",
    "voucherId": "gift_1c9d7f22-0b3e-4c5a-9f11-77a2d0e4bb31",
    "budget": "$0.50",
    "claimedBy": {
      "rail": "solana",
      "address": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW"
    },
    "claimedAt": "2026-01-02T00:00:00.000Z",
    "status": "active",
    "redemption": "Present this signed credit to the sponsor's chosen executor, or spend the budget via any x402 client funded for the task. The credit proves the gift was claimed by solana wallet WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW.",
    "signature": "e4f0…hex hmac…",
    "algorithm": "HMAC-SHA256"
  }
}
```

### GET /gifts/:id — free
Public voucher status. Never exposes the claim code.

Response `200`:
```json
{
  "voucherId": "gift_1c9d7f22-0b3e-4c5a-9f11-77a2d0e4bb31",
  "document": "x402-gift-agent/voucher",
  "taskBudget": "$0.50",
  "feePaid": "$0.01",
  "totalPaid": "$0.51",
  "sponsor": {
    "rail": "evm",
    "address": "0x40252cfdf8b20ed757d61ff157719f33ec332402"
  },
  "boundTo": {
    "rail": "solana",
    "address": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW"
  },
  "message": "Happy birthday — have your agent book us dinner!",
  "taskHint": "restaurant booking, 2 people, Friday",
  "issuedAt": "2026-01-01T00:00:00.000Z",
  "expiresAt": "2026-01-31T00:00:00.000Z",
  "status": "unclaimed",
  "signature": "7b21…hex hmac…",
  "algorithm": "HMAC-SHA256"
}
```

### GET /credits/:wallet — free
Every signed credit record held by one wallet, on whichever rail it lives.

Response `200`:
```json
{
  "wallet": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
  "credits": [
    {
      "creditId": "cred_ab77e310-4c21-4f0d-9a3b-2e5c6d7f8091",
      "document": "x402-gift-agent/credit",
      "voucherId": "gift_1c9d7f22-0b3e-4c5a-9f11-77a2d0e4bb31",
      "budget": "$0.50",
      "claimedBy": {
        "rail": "solana",
        "address": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW"
      },
      "claimedAt": "2026-01-02T00:00:00.000Z",
      "status": "active",
      "redemption": "Present this signed credit to the sponsor's chosen executor, or spend the budget via any x402 client funded for the task. The credit proves the gift was claimed by solana wallet WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW.",
      "signature": "e4f0…hex hmac…",
      "algorithm": "HMAC-SHA256"
    }
  ]
}
```

### GET /stats — free
Vouchers issued, vouchers claimed, total gifted, and claims split by rail.

Response `200`:
```json
{
  "issued": 12,
  "claimed": 7,
  "totalGifted": "$4.10",
  "byRail": {
    "evm": 5,
    "solana": 2
  }
}
```

### POST /verify — free
Verify the HMAC-SHA256 signature of any voucher or credit issued by this service.

Request body:
```json
{
  "creditId": "cred_ab77e310-4c21-4f0d-9a3b-2e5c6d7f8091",
  "document": "x402-gift-agent/credit",
  "voucherId": "gift_1c9d7f22-0b3e-4c5a-9f11-77a2d0e4bb31",
  "budget": "$0.50",
  "claimedBy": {
    "rail": "solana",
    "address": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW"
  },
  "claimedAt": "2026-01-02T00:00:00.000Z",
  "status": "active",
  "redemption": "Present this signed credit to the sponsor's chosen executor, or spend the budget via any x402 client funded for the task. The credit proves the gift was claimed by solana wallet WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW.",
  "signature": "e4f0…hex hmac…",
  "algorithm": "HMAC-SHA256"
}
```

Response `200`:
```json
{
  "valid": true
}
```

### GET /health — free
Liveness probe.

Response `200`:
```json
{
  "ok": true,
  "service": "x402-gift-agent"
}
```

## Payment — dual rail

**Pay in USDC on Base or Solana — your client picks the rail.**

Every paid route answers an unpaid request with `402` and an `accepts` array
holding both rails:

```json
{
  "x402Version": 1,
  "accepts": [
    { "scheme": "exact", "network": "base-sepolia", "asset": "USDC (0x036CbD53842c5426634e7929541eC2318f3dCF7e)",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402", "maxAmountRequired": "<base units, 6 decimals>" },
    { "scheme": "exact", "network": "solana-devnet", "asset": "USDC (4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU)",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW", "maxAmountRequired": "<base units, 6 decimals>",
      "extra": { "feePayer": "<facilitator sponsor>" } }
  ]
}
```

- Protocol: **x402** (HTTP 402). Asset **USDC** on both rails.
- EVM networks: `base-sepolia` (default) or `base` (`NETWORK=base`).
- Solana networks: `solana-devnet` (default) or `solana` (`SOLANA_NETWORK=mainnet-beta`).
- Facilitator: `https://x402.org/facilitator` — verifies and settles **both** rails (override with `FACILITATOR_URL`).
- Pay via `x402-fetch` (EVM), a Solana x402 client, or any x402-capable client: call the route, read `402`, pick an entry from `accepts`, sign, retry with the `X-PAYMENT` header. You get the artifact in the `200` body plus an `X-PAYMENT-RESPONSE` header carrying the settlement receipt (`{ rail, network, transaction, payer }`).

## Error codes

| Status | Code | Meaning |
|---|---|---|
| 402 | — | Payment required — dual-rail x402 challenge with `accepts[]` |
| 400 | `INVALID_WALLET` | `wallet` is neither an EVM address nor a Solana pubkey |
| 404 | `CODE_NOT_FOUND` | Unknown claim code |
| 404 | `VOUCHER_NOT_FOUND` | Unknown voucherId |
| 403 | `WRONG_RECIPIENT` | Voucher is bound to a different wallet |
| 409 | `ALREADY_CLAIMED` | Voucher was already redeemed |
| 410 | `VOUCHER_EXPIRED` | Voucher past `expiresAt` |
| 400 | `BAD_REQUEST` | Malformed body |

## Discovery

Machine-readable manifest: `{BASE_URL}/.well-known/x402` (lists both networks per resource).

## Contact

nichxbt@gmail.com
