# API reference — x402-gift-agent

Base URL: `http://localhost:4022` in development.

All paid routes speak **x402** and offer **two rails** — USDC on Base (EVM) and
USDC on Solana. The 402 challenge lists both; your client picks one. The
purchased artifact is always in the `200` body.

| Route | Price | Returns |
|---|---|---|
| `POST /gifts` | $0.11 (gift amount + $0.01 fee — e.g. `?amount=0.10`) | Signed gift voucher (claim code, task budget, expiry) |
| `POST /claim/:code` | free | Voucher validation + signed spendable credit record |
| `GET /gifts/:id` | free | Voucher status snapshot (claim code redacted) |
| `GET /credits/:wallet` | free | Signed credit records owned by that wallet |
| `GET /stats` | free | Aggregate counters |
| `POST /verify` | free | `{ valid: true | false }` |
| `GET /health` | free | `{ ok: true }` |

Every artifact is signed: `signature` is an HMAC-SHA256 (hex) over the
canonical JSON of the artifact minus `signature`/`algorithm`, keyed by
`SIGNING_SECRET`. `POST /verify` re-checks it for free.

---

## POST /gifts

**Price**: $0.11 (gift amount + $0.01 fee — e.g. `?amount=0.10`) — USDC on Base or Solana  
**Returns**: Signed gift voucher (claim code, task budget, expiry)

Buy a gift voucher. Costs the gift amount plus a $0.01 fee; returns the signed voucher including its secret claim code.

### Body parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `amount *(query)*` | number | 0.10 | Task budget in dollars, clamped to `[0.01, GIFT_MAX]` |
| `sponsor` | string | — | Who is gifting: EVM address or Solana pubkey |
| `recipient` | string | — | Bind the voucher to this wallet (either rail); omit for a bearer voucher |
| `message` | string | `""` | Gift message, ≤500 chars, recorded in the signed voucher |
| `taskHint` | string | `""` | What the budget is meant for, ≤500 chars |

### Example request

```bash
# unpaid → 402 with both rails
curl -s -i -X POST 'http://localhost:4022/gifts?amount=0.50' \
  -H 'content-type: application/json' -d '{"sponsor":"0xYourAddress"}'

# paid (EVM rail)
PRIVATE_KEY=0x... npm run client
```

### Example response (`201`)

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
  "settlement": {
    "rail": "evm",
    "network": "base-sepolia",
    "transaction": "0xabc…",
    "payer": "0xPayer…",
    "amount": "510000"
  }
}
```

### Unpaid (`402`)

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "110000",
      "resource": "http://localhost:4022/gifts",
      "description": "Buy a gift voucher. Costs the gift amount plus a $0.01 fee; returns the signed voucher including its secret claim code.",
      "mimeType": "application/json",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
      "maxTimeoutSeconds": 120,
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "extra": {
        "name": "USDC",
        "version": "2"
      }
    },
    {
      "scheme": "exact",
      "network": "solana-devnet",
      "maxAmountRequired": "110000",
      "resource": "http://localhost:4022/gifts",
      "description": "Buy a gift voucher. Costs the gift amount plus a $0.01 fee; returns the signed voucher including its secret claim code.",
      "mimeType": "application/json",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
      "maxTimeoutSeconds": 120,
      "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      "extra": {
        "feePayer": "CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"
      }
    }
  ]
}
```

---

## POST /claim/:code

**Price**: free  
**Returns**: Voucher validation + signed spendable credit record

Redeem a claim code against a wallet. Free — the sponsor already paid. Returns voucher validation plus a signed spendable credit record.

### Path parameters

| Name | Description |
|---|---|
| `code` | The `claimCode` from the voucher, e.g. `GIFT-4A7C-19F0-B3D2` |

### Body parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `wallet` | string | — | **Required.** The claiming wallet: EVM address or Solana pubkey |

### Example request

```bash
curl -s -X POST http://localhost:4022/claim/GIFT-4A7C-19F0-B3D2 \
  -H 'content-type: application/json' \
  -d '{"wallet":"WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW"}'
```

### Example response (`200`)

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

### Errors

| Status | Code | Meaning |
|---|---|---|
| 400 | `INVALID_WALLET` | Not an EVM address or Solana pubkey |
| 403 | `WRONG_RECIPIENT` | Voucher is bound to a different wallet |
| 404 | `CODE_NOT_FOUND` | Unknown claim code |
| 409 | `ALREADY_CLAIMED` | Voucher was already redeemed |
| 410 | `VOUCHER_EXPIRED` | Voucher past its expiry |

---

## GET /gifts/:id

**Price**: free  
**Returns**: Voucher status snapshot (claim code redacted)

Public voucher status. Never exposes the claim code.

### Path parameters

| Name | Description |
|---|---|
| `id` | The voucherId |

### Example request

```bash
curl -s http://localhost:4022/gifts/gift_YOUR_ID
```

### Example response (`200`)

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

### Errors

| Status | Code | Meaning |
|---|---|---|
| 404 | `VOUCHER_NOT_FOUND` | Unknown voucherId |

---

## GET /credits/:wallet

**Price**: free  
**Returns**: Signed credit records owned by that wallet

Every signed credit record held by one wallet, on whichever rail it lives.

### Path parameters

| Name | Description |
|---|---|
| `wallet` | EVM address or Solana pubkey |

### Example request

```bash
curl -s http://localhost:4022/credits/WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW
```

### Example response (`200`)

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

### Errors

| Status | Code | Meaning |
|---|---|---|
| 400 | `INVALID_WALLET` | Not an EVM address or Solana pubkey |

---

## GET /stats

**Price**: free  
**Returns**: Aggregate counters

Vouchers issued, vouchers claimed, total gifted, and claims split by rail.

### Example request

```bash
curl -s http://localhost:4022/stats
```

### Example response (`200`)

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

---

## POST /verify

**Price**: free  
**Returns**: `{ valid: true | false }`

Verify the HMAC-SHA256 signature of any voucher or credit issued by this service.

### Example request

```bash
curl -s -X POST http://localhost:4022/verify -H 'content-type: application/json' -d @credit.json
```

### Example response (`200`)

```json
{
  "valid": true
}
```

---

## GET /health

**Price**: free  
**Returns**: `{ ok: true }`

Liveness probe.

### Example request

```bash
curl -s http://localhost:4022/health
```

### Example response (`200`)

```json
{
  "ok": true,
  "service": "x402-gift-agent"
}
```


---

## Payment headers

| Header | Direction | Meaning |
|---|---|---|
| `X-PAYMENT` | request | Base64 x402 payload. EVM: signed EIP-3009 authorization. Solana: signed serialized transaction. |
| `X-PAYMENT-RESPONSE` | response | Base64 `{ success, rail, network, transaction, payer }` settlement receipt. |

Paid responses also echo that receipt in the body under `settlement`, purely for
convenience. It is attached **after** the artifact is signed and is excluded from
signature verification, so you can post a whole paid response body straight to
`POST /verify` and still get `{ "valid": true }`.

## Global error shape

```json
{ "error": "CODE", "message": "human readable explanation" }
```
