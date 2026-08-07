# Raw 402 → pay → 200 walkthrough (curl)

Start the server:

```bash
npm run dev
```

## 1. Ask to buy a gift with no payment → dual-rail 402

The gift amount goes in the query string, so the 402 can quote the true total
(gift + $0.01 fee) before the body-carrying retry.

```bash
curl -s -i -X POST 'http://localhost:4022/gifts?amount=0.50' \
  -H 'content-type: application/json' \
  -d '{"sponsor":"0x40252CFDF8B20Ed757D61ff157719F33Ec332402","message":"enjoy"}'
```

`HTTP/1.1 402 Payment Required` with **two** entries in `accepts`:

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "510000",
      "resource": "http://localhost:4022/gifts",
      "description": "Gift voucher: $0.50 task budget + $0.01 fee",
      "mimeType": "application/json",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
      "maxTimeoutSeconds": 120,
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "extra": { "name": "USDC", "version": "2" }
    },
    {
      "scheme": "exact",
      "network": "solana-devnet",
      "maxAmountRequired": "510000",
      "resource": "http://localhost:4022/gifts",
      "description": "Gift voucher: $0.50 task budget + $0.01 fee",
      "mimeType": "application/json",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
      "maxTimeoutSeconds": 120,
      "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      "extra": { "feePayer": "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4" }
    }
  ]
}
```

`maxAmountRequired` is in USDC base units (6 decimals): `510000` = $0.51.

## 2. Pay and retry

```bash
PRIVATE_KEY=0x... npm run client   # EVM rail via x402-fetch
```

Or open `http://localhost:4022/` and pay in the browser — the modal reads the
same 402 and offers an EVM wallet **or** Phantom.

The `200` body is the signed voucher, **including its `claimCode`** — that is
the artifact you bought. `X-PAYMENT-RESPONSE` carries the settlement receipt.

## 3. Redeem the code (free)

Any wallet on either rail:

```bash
# Solana recipient
curl -s -X POST http://localhost:4022/claim/GIFT-4A7C-19F0-B3D2 \
  -H 'content-type: application/json' \
  -d '{"wallet":"WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW"}' | jq

# EVM recipient
curl -s -X POST http://localhost:4022/claim/GIFT-4A7C-19F0-B3D2 \
  -H 'content-type: application/json' \
  -d '{"wallet":"0x40252CFDF8B20Ed757D61ff157719F33Ec332402"}' | jq
```

You get the validated voucher plus a signed credit record owned by that wallet.

## 4. Look up and verify (free)

```bash
curl -s http://localhost:4022/gifts/gift_YOUR_ID | jq '.status'
curl -s http://localhost:4022/credits/WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW | jq
curl -s -X POST http://localhost:4022/verify \
  -H 'content-type: application/json' -d @credit.json | jq
```
