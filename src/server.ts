import "dotenv/config";
import express from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { solanaCheckout } from "./checkout.js";
import { paymentOf, paywall, payToBanner } from "./payments.js";
import {
  claimVoucher,
  createVoucher,
  creditsFor,
  FEE,
  GiftError,
  MAX_GIFT,
  money,
  resolveGiftAmount,
  stats,
  voucherStatus,
} from "./service.js";
import { verify } from "./sign.js";
import { WalletError } from "./wallet.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 4022);

const app = express();
app.use(express.json({ limit: "64kb" }));

// ---- x402: POST /gifts costs (gift amount + $0.01 fee), on either rail -----
// The amount comes from ?amount= so the price is known before the retry that
// carries the body — the 402 always quotes the true total.
app.use(
  paywall({
    "POST /gifts": (req) => {
      const amount = resolveGiftAmount(
        req.query.amount ?? (req.body as { amount?: unknown } | undefined)?.amount,
      );
      return {
        price: money(amount + FEE),
        description: `Gift voucher: ${money(amount)} task budget + ${money(FEE)} fee`,
        outputSchema: { type: "object", description: "Signed gift voucher including its claim code" },
      };
    },
  }),
);

// ---- Solana checkout helper for the browser modal --------------------------
// Phantom signs serialized transactions, so the Solana rail needs a tiny
// prepare/encode endpoint. EVM wallets sign typed data client-side and never
// touch this. See @three-ws/x402-payment-modal/server.
app.use("/api/x402-checkout", solanaCheckout());

// ---- Free routes ------------------------------------------------------------
app.get("/health", (_req, res) => res.json({ ok: true, service: "x402-gift-agent" }));
app.get("/stats", (_req, res) => res.json(stats()));

app.post("/claim/:code", (req, res) => {
  try {
    res.json(claimVoucher(req.params.code, req.body?.wallet));
  } catch (err) {
    if (err instanceof WalletError) {
      return res.status(err.statusCode).json({ error: err.code, message: err.message });
    }
    if (err instanceof GiftError) {
      return res.status(err.statusCode).json({ error: err.code, message: err.message });
    }
    throw err;
  }
});

app.get("/gifts/:id", (req, res) => {
  const voucher = voucherStatus(req.params.id);
  if (!voucher) {
    return res.status(404).json({ error: "VOUCHER_NOT_FOUND", message: `No voucher ${req.params.id}` });
  }
  res.json(voucher);
});

app.get("/credits/:wallet", (req, res) => {
  try {
    res.json({ wallet: req.params.wallet, credits: creditsFor(req.params.wallet) });
  } catch (err) {
    if (err instanceof WalletError) {
      return res.status(err.statusCode).json({ error: err.code, message: err.message });
    }
    throw err;
  }
});

app.post("/verify", (req, res) => {
  const artifact = req.body;
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    return res.status(400).json({ error: "BAD_REQUEST", message: "POST a signed artifact as the JSON body" });
  }
  res.json({ valid: verify(artifact as Record<string, unknown>) });
});

// ---- Paid route -------------------------------------------------------------
app.post("/gifts", (req, res) => {
  const amount = resolveGiftAmount(req.query.amount ?? req.body?.amount);
  const voucher = createVoucher(amount, req.body ?? {});
  res.status(201).json({ ...voucher, payment: paymentOf(req) ?? null });
});

// ---- Static (demo page + /.well-known/x402) ---------------------------------
app.get("/.well-known/x402", (_req, res) => {
  res.type("application/json").send(readFileSync(path.join(ROOT, "public/.well-known/x402"), "utf8"));
});
app.get("/skill.md", (_req, res) => {
  res.type("text/markdown").send(readFileSync(path.join(ROOT, "skill.md"), "utf8"));
});
app.use(express.static(path.join(ROOT, "public")));

app.listen(PORT, () => {
  console.log(`x402-gift-agent listening on http://localhost:${PORT}`);
  console.log("  Pay in USDC on Base or Solana — your client picks the rail.");
  for (const line of payToBanner()) console.log(line);
  console.log("  Paid routes:");
  console.log(`    POST /gifts?amount=X       gift amount + ${money(FEE)} fee (max gift ${money(MAX_GIFT)})`);
  console.log("  Free routes:");
  console.log("    POST /claim/:code          redeem a voucher -> signed credit record");
  console.log("    GET  /gifts/:id            voucher status (no claim code)");
  console.log("    GET  /credits/:wallet      credits held by an EVM address or Solana pubkey");
  console.log("    POST /verify               verify any signed artifact");
  console.log("    GET  /                     human checkout demo (payment modal)");
  console.log("    GET  /.well-known/x402     discovery manifest");
});
