/**
 * Gift voucher logic for x402-gift-agent.
 *
 * A sponsor pays (gift amount + $0.01 service fee) via x402 — on the Base rail
 * or the Solana rail — and receives a signed gift voucher, including its secret
 * claim code, in the same 200 response. The recipient's agent later redeems the
 * claim code (free) and receives a signed spendable credit record. Everything is
 * delivered in-response; nothing is delivered later.
 *
 * Ownership is dual-rail: a sponsor or recipient is identified by an EVM
 * address *or* a Solana pubkey (see wallet.ts). A voucher may be bound to a
 * specific recipient wallet on either rail, and only that wallet can claim it.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { signArtifact, type Signed } from "./sign.js";
import { loadStore, saveStore } from "./store.js";
import { parseWallet, requireWallet, sameWallet, walletRef, type Rail } from "./wallet.js";

export const FEE = 0.01;
export const MIN_GIFT = 0.01;
export const MAX_GIFT = Number(process.env.GIFT_MAX || "5.00");
export const DEFAULT_GIFT = 0.1;

export interface WalletRef {
  rail: Rail;
  address: string;
}

export interface Voucher {
  voucherId: string;
  document: "x402-gift-agent/voucher";
  claimCode: string;
  taskBudget: string;
  feePaid: string;
  totalPaid: string;
  /** Who paid — EVM address or Solana pubkey, or null if unstated. */
  sponsor: WalletRef | null;
  /** If set, only this wallet may claim the voucher. Either rail. */
  boundTo: WalletRef | null;
  message: string;
  taskHint: string;
  issuedAt: string;
  expiresAt: string;
  status: "unclaimed" | "claimed" | "expired";
}

export interface CreditRecord {
  creditId: string;
  document: "x402-gift-agent/credit";
  voucherId: string;
  budget: string;
  /** The wallet that claimed it, on whichever rail it lives. */
  claimedBy: WalletRef;
  claimedAt: string;
  status: "active";
  redemption: string;
}

type VoucherStore = Record<string, Signed<Voucher>>;
type CreditStore = Record<string, Signed<CreditRecord>>;

let vouchers: VoucherStore = loadStore<VoucherStore>("vouchers", {});
let credits: CreditStore = loadStore<CreditStore>("credits", {});

function persist(): void {
  saveStore("vouchers", vouchers);
  saveStore("credits", credits);
}

export class GiftError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Amount requested by the sponsor, clamped to policy. */
export function resolveGiftAmount(raw: unknown): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw.replace(/^\$/, ""))
        : NaN;
  const amount = Number.isFinite(n) && n > 0 ? n : DEFAULT_GIFT;
  return Math.min(Math.max(amount, MIN_GIFT), MAX_GIFT);
}

export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function makeClaimCode(): string {
  const block = () => randomBytes(2).toString("hex").toUpperCase();
  return `GIFT-${block()}-${block()}-${block()}`;
}

export function createVoucher(amount: number, body: Record<string, unknown>): Signed<Voucher> {
  const sponsor = parseWallet(body.sponsor);
  const bound = parseWallet(body.recipient);
  const voucher: Voucher = {
    voucherId: `gift_${randomUUID()}`,
    document: "x402-gift-agent/voucher",
    claimCode: makeClaimCode(),
    taskBudget: money(amount),
    feePaid: money(FEE),
    totalPaid: money(amount + FEE),
    sponsor: sponsor ? walletRef(sponsor) : null,
    boundTo: bound ? walletRef(bound) : null,
    message: typeof body.message === "string" ? body.message.slice(0, 500) : "",
    taskHint: typeof body.taskHint === "string" ? body.taskHint.slice(0, 500) : "",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    status: "unclaimed",
  };
  const signed = signArtifact(voucher);
  vouchers[voucher.voucherId] = signed;
  persist();
  return signed;
}

function findByCode(code: string): Signed<Voucher> | undefined {
  return Object.values(vouchers).find((v) => v.claimCode === code.trim().toUpperCase());
}

/**
 * Redeem a claim code. Free — the value was already paid by the sponsor.
 * Returns voucher validation + a signed spendable credit record owned by the
 * claiming wallet (EVM address or Solana pubkey).
 */
export function claimVoucher(
  code: string,
  walletInput: unknown,
): { voucher: Omit<Signed<Voucher>, "claimCode">; credit: Signed<CreditRecord> } {
  const wallet = requireWallet(walletInput, "wallet");
  const voucher = findByCode(code);
  if (!voucher) throw new GiftError(404, "CODE_NOT_FOUND", "Unknown claim code");
  if (voucher.status === "claimed")
    throw new GiftError(409, "ALREADY_CLAIMED", `Voucher ${voucher.voucherId} was already claimed`);
  if (new Date(voucher.expiresAt).getTime() < Date.now()) {
    voucher.status = "expired";
    persist();
    throw new GiftError(410, "VOUCHER_EXPIRED", `Voucher expired at ${voucher.expiresAt}`);
  }
  if (voucher.boundTo && !sameWallet(voucher.boundTo.address, wallet.address)) {
    throw new GiftError(
      403,
      "WRONG_RECIPIENT",
      `Voucher ${voucher.voucherId} is bound to ${voucher.boundTo.rail} wallet ${voucher.boundTo.address}`,
    );
  }

  voucher.status = "claimed";
  const credit: CreditRecord = {
    creditId: `cred_${randomUUID()}`,
    document: "x402-gift-agent/credit",
    voucherId: voucher.voucherId,
    budget: voucher.taskBudget,
    claimedBy: walletRef(wallet),
    claimedAt: new Date().toISOString(),
    status: "active",
    redemption:
      "Present this signed credit to the sponsor's chosen executor, or spend the budget " +
      "via any x402 client funded for the task. The credit proves the gift was claimed " +
      `by ${wallet.rail} wallet ${wallet.address}.`,
  };
  const signedCredit = signArtifact(credit);
  credits[credit.creditId] = signedCredit;
  persist();

  const { claimCode: _hidden, ...publicVoucher } = voucher;
  return { voucher: publicVoucher as Omit<Signed<Voucher>, "claimCode">, credit: signedCredit };
}

/** Public status — never exposes the claim code. */
export function voucherStatus(id: string): Record<string, unknown> | undefined {
  const v = vouchers[id];
  if (!v) return undefined;
  if (v.status === "unclaimed" && new Date(v.expiresAt).getTime() < Date.now()) {
    v.status = "expired";
    persist();
  }
  const { claimCode: _hidden, ...publicVoucher } = v;
  return publicVoucher;
}

/** Credits held by one wallet, on whichever rail it lives. */
export function creditsFor(walletInput: unknown): Signed<CreditRecord>[] {
  const wallet = requireWallet(walletInput, "wallet");
  return Object.values(credits).filter((c) => sameWallet(c.claimedBy.address, wallet.address));
}

export function stats(): {
  issued: number;
  claimed: number;
  totalGifted: string;
  byRail: Record<Rail, number>;
} {
  const all = Object.values(vouchers);
  const gifted = all.reduce((sum, v) => sum + Number(v.taskBudget.replace("$", "")), 0);
  const byRail: Record<Rail, number> = { evm: 0, solana: 0 };
  for (const credit of Object.values(credits)) byRail[credit.claimedBy.rail]++;
  return {
    issued: all.length,
    claimed: all.filter((v) => v.status === "claimed").length,
    totalGifted: money(gifted),
    byRail,
  };
}
