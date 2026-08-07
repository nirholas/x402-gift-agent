/**
 * Full x402 flow: buy a $0.10 gift voucher (pays $0.11), print the signed
 * voucher + X-PAYMENT-RESPONSE, then redeem the claim code as the recipient.
 *
 * Usage:
 *   PRIVATE_KEY=0x... BASE_URL=http://localhost:4022 npx tsx examples/agent-client.ts
 */
import { privateKeyToAccount } from "viem/accounts";
import { decodeXPaymentResponse, wrapFetchWithPayment } from "x402-fetch";

const BASE_URL = process.env.BASE_URL || "http://localhost:4022";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const AMOUNT = process.env.AMOUNT || "0.10";
/** Recipient wallet — EVM address or Solana pubkey, both accepted. */
const RECIPIENT = process.env.RECIPIENT || "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW";

async function main() {
  if (!PRIVATE_KEY) {
    console.error("Set PRIVATE_KEY to a funded base-sepolia key (USDC + a little ETH).");
    process.exit(1);
  }
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const payFetch = wrapFetchWithPayment(fetch, account, 2_000_000n); // allow up to $2

  // 1. Sponsor buys the voucher — 402 → pay (amount + $0.01 fee) → 201.
  const giftRes = await payFetch(`${BASE_URL}/gifts?amount=${AMOUNT}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sponsor: account.address,
      // Bind the voucher to a Solana-native recipient. Either rail works here:
      // an EVM address or a base58 Solana pubkey.
      recipient: RECIPIENT,
      message: "Have your agent get us dinner reservations",
      taskHint: "restaurant booking, Fri 7pm, party of 2",
    }),
  });
  if (!giftRes.ok) {
    console.error("Gift purchase failed:", giftRes.status, await giftRes.text());
    process.exit(1);
  }
  const voucher = await giftRes.json();
  console.log("Signed gift voucher (the purchased artifact):\n", JSON.stringify(voucher, null, 2));

  const paymentHeader = giftRes.headers.get("x-payment-response");
  if (paymentHeader) {
    console.log("\nX-PAYMENT-RESPONSE (settlement):\n", decodeXPaymentResponse(paymentHeader));
  }

  // 2. Recipient's agent redeems the claim code — free.
  const claimRes = await fetch(`${BASE_URL}/claim/${voucher.claimCode}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: RECIPIENT }),
  });
  const claim = await claimRes.json();
  console.log("\nClaim result (voucher validation + signed credit record):\n", JSON.stringify(claim, null, 2));

  // 3. Verify the credit record signature (free).
  const verifyRes = await fetch(`${BASE_URL}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(claim.credit),
  });
  console.log("\nCredit signature valid:", (await verifyRes.json()).valid);

  // 4. Credits held by that wallet, looked up on whichever rail it lives on.
  const held = await (await fetch(`${BASE_URL}/credits/${RECIPIENT}`)).json();
  console.log(`\nCredits held by ${RECIPIENT}:`, held.credits.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/* ---------------------------------------------------------------------------
 * Paying on the Solana rail instead
 * ---------------------------------------------------------------------------
 * Every paid route here answers with a DUAL-RAIL 402: `accepts` holds one
 * base-sepolia entry and one solana-devnet entry. `wrapFetchWithPayment` above
 * picks the EVM one. To pay from a Solana wallet, pick the other entry and
 * build the `X-PAYMENT` envelope yourself:
 *
 *   import {
 *     prepareSolanaCheckout,
 *     encodeX402Payment,
 *   } from "@three-ws/x402-payment-modal/server";
 *
 *   const res = await fetch(url, { method: "POST" });          // 402
 *   const { accepts } = await res.json();
 *   const accept = accepts.find((a) => a.network.startsWith("solana"));
 *
 *   // 1. server-side helper builds the SPL transferChecked the buyer signs.
 *   //    accept.extra.feePayer sponsors the SOL fee, so you need only USDC.
 *   const { tx_base64 } = await prepareSolanaCheckout({
 *     accept, buyer: myPubkey, rpcUrl: process.env.SOLANA_RPC_URL,
 *   });
 *
 *   // 2. sign tx_base64 with your keypair / Phantom.
 *   const signedTxBase64 = await signWithWallet(tx_base64);
 *
 *   // 3. wrap it into the x402 envelope and retry.
 *   const { x_payment } = encodeX402Payment({
 *     accept, signedTxBase64, resourceUrl: url,
 *   });
 *   const paid = await fetch(url, { method: "POST", headers: { "X-PAYMENT": x_payment } });
 *
 * In a browser the drop-in modal does all three steps for you:
 *   <script type="module" src="https://unpkg.com/@three-ws/x402-payment-modal"></script>
 *
 * The raw dual-rail 402 body, for reference:
 *
 *   $ curl -s -i -X POST http://localhost:4022/gifts?amount=0.50
 *   HTTP/1.1 402 Payment Required
 *   {
 *     "x402Version": 1,
 *     "error": "X-PAYMENT header is required",
 *     "accepts": [
 *       { "scheme": "exact", "network": "base-sepolia",  "asset": "0x036CbD…dCF7e",
 *         "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402", "maxAmountRequired": "510000" },
 *       { "scheme": "exact", "network": "solana-devnet", "asset": "4zMMC9…ncDU",
 *         "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW", "maxAmountRequired": "510000",
 *         "extra": { "feePayer": "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4" } }
 *     ]
 *   }
 * ------------------------------------------------------------------------- */
