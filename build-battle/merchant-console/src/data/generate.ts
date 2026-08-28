import { issueNumber } from "@/lib/cards"
import { merchants } from "./merchants"
import {
  Card,
  CardStatus,
  Currency,
  Dispute,
  MerchantCategory,
  Payment,
  PaymentStatus,
  Payout,
  Refund,
} from "./types"

/**
 * Deterministic seed data. Everyone in the room gets identical records,
 * so a bug reproduces the same way on every machine.
 */

const SEED = 20260813
const DAYS = 120
const PAYMENTS_PER_DAY = 14

/** Small, fast, deterministic PRNG. Not for anything that matters. */
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(SEED)
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)]
const between = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min

const DESCRIPTIONS = [
  "Online order",
  "In-store purchase",
  "Subscription renewal",
  "Gift card",
  "Wholesale invoice",
  "Repeat order",
  "Marketplace order",
]

const REASON_CODES = [
  "10.4 Other Fraud",
  "12.6 Duplicate Processing",
  "13.1 Merchandise Not Received",
  "13.3 Not as Described",
  "13.7 Cancelled Merchandise",
]

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

/** The anchor date. Fixed, so "the last 30 days" is stable across runs. */
export const GENERATED_AT = new Date("2026-08-13T00:00:00.000Z")

function statusFor(): PaymentStatus {
  const roll = rand()
  if (roll < 0.78) return "captured"
  if (roll < 0.86) return "authorized"
  if (roll < 0.93) return "refunded"
  if (roll < 0.98) return "failed"
  return "disputed"
}

/**
 * A handful of cards ops has already issued, so the list and detail views have
 * something in them on a cold start.
 *
 * These go through `issueNumber` like a real issue does, which means the seed
 * respects the `4242` BIN rule and only the last four survives — the generated
 * number is discarded here exactly as it is in the route handler.
 */
const SEED_CARDS: {
  nickname: string
  merchantIndex: number
  spendLimit: number
  status: CardStatus
  category: MerchantCategory | null
  daysAgo: number
}[] = [
  {
    nickname: "Meta ad spend",
    merchantIndex: 0,
    spendLimit: 250_000,
    status: "active",
    category: "advertising",
    daysAgo: 34,
  },
  {
    nickname: "Figma + Linear seats",
    merchantIndex: 1,
    spendLimit: 80_000,
    status: "active",
    category: "software",
    daysAgo: 21,
  },
  {
    nickname: "Contractor — Q3 design",
    merchantIndex: 2,
    spendLimit: 500_000,
    status: "frozen",
    category: "contractors",
    daysAgo: 12,
  },
  {
    nickname: "Trade show travel",
    merchantIndex: 3,
    spendLimit: 150_000,
    status: "cancelled",
    category: "travel",
    daysAgo: 5,
  },
]

/**
 * Spend for a seed card, derived rather than invented.
 *
 * The store has no card reference on `Payment`, so attribution is by merchant
 * and window: the captured payments for this card's merchant, in the card's
 * own currency, dated after the card was issued, summed and capped at the
 * limit. That is a real derivation from real rows — not a number picked to
 * make a progress bar look interesting — and it is stated here because the
 * attribution is coarser than a true card-to-payment link would be.
 */
function derivedSpend(
  payments: Payment[],
  merchantId: string,
  currency: Currency,
  since: string,
  spendLimit: number,
): number {
  const attributed = payments.filter(
    (payment) =>
      payment.merchantId === merchantId &&
      payment.currency === currency &&
      payment.status === "captured" &&
      payment.createdAt >= since,
  )
  const total = attributed.reduce((sum, payment) => sum + payment.amount, 0)
  return Math.min(spendLimit, total)
}

function generateCards(payments: Payment[]): Card[] {
  return SEED_CARDS.map((seed, index) => {
    const merchant = merchants[seed.merchantIndex % merchants.length]
    const createdAt = new Date(
      GENERATED_AT.getTime() - seed.daysAgo * 86_400_000,
    ).toISOString()
    const currency = merchant.currency as Currency
    const number = issueNumber(rand)

    // Oldest first. A seeded card that is not active reached that status after
    // it was issued, so the trail has both entries rather than only the last.
    const history =
      seed.status === "active"
        ? [{ status: "active" as CardStatus, at: createdAt }]
        : [
            { status: "active" as CardStatus, at: createdAt },
            {
              status: seed.status,
              at: new Date(
                new Date(createdAt).getTime() + 86_400_000,
              ).toISOString(),
            },
          ]

    return {
      id: `crd_${pad(index + 1)}`,
      nickname: seed.nickname,
      merchantId: merchant.id,
      spendLimit: seed.spendLimit,
      spent: derivedSpend(
        payments,
        merchant.id,
        currency,
        createdAt,
        seed.spendLimit,
      ),
      currency,
      status: seed.status,
      last4: number.slice(-4),
      reference: `cref_${pad(index + 1)}`,
      category: seed.category,
      createdAt,
      history,
    }
  })
}

export function generate() {
  const payments: Payment[] = []
  const refunds: Refund[] = []
  const disputes: Dispute[] = []
  let paymentSeq = 0
  let refundSeq = 0
  let disputeSeq = 0

  for (let day = DAYS - 1; day >= 0; day--) {
    const dayStart = new Date(GENERATED_AT)
    dayStart.setUTCDate(dayStart.getUTCDate() - day)

    const count = between(PAYMENTS_PER_DAY - 5, PAYMENTS_PER_DAY + 5)

    for (let i = 0; i < count; i++) {
      const merchant = pick(merchants)
      const createdAt = new Date(dayStart)
      createdAt.setUTCHours(between(0, 23), between(0, 59), between(0, 59), 0)

      const status = statusFor()
      const method = rand() < 0.82 ? "card" : rand() < 0.6 ? "wallet" : "bank_transfer"
      const amount = between(450, 480_00)

      const payment: Payment = {
        id: `pay_${pad(++paymentSeq)}`,
        merchantId: merchant.id,
        amount,
        currency: merchant.currency as Currency,
        status,
        method,
        cardBrand:
          method === "card" ? pick(["visa", "mastercard", "amex"] as const) : null,
        last4: method === "card" ? String(between(1000, 9999)) : null,
        createdAt: createdAt.toISOString(),
        description: pick(DESCRIPTIONS),
      }
      payments.push(payment)

      if (status === "refunded") {
        const full = rand() < 0.7
        refunds.push({
          id: `re_${pad(++refundSeq)}`,
          paymentId: payment.id,
          amount: full ? amount : Math.floor(amount / 2),
          currency: payment.currency,
          reason: pick([
            "requested_by_customer",
            "duplicate",
            "fraudulent",
          ] as const),
          createdAt: new Date(
            createdAt.getTime() + between(1, 6) * 86_400_000,
          ).toISOString(),
        })
      }

      if (status === "disputed") {
        const openedAt = new Date(createdAt.getTime() + between(2, 10) * 86_400_000)
        disputes.push({
          id: `dp_${pad(++disputeSeq)}`,
          paymentId: payment.id,
          merchantId: merchant.id,
          amount,
          currency: payment.currency,
          reasonCode: pick(REASON_CODES),
          status: pick([
            "needs_response",
            "needs_response",
            "under_review",
            "won",
            "lost",
          ] as const),
          openedAt: openedAt.toISOString(),
          evidenceDueAt: new Date(
            openedAt.getTime() + 14 * 86_400_000,
          ).toISOString(),
        })
      }
    }
  }

  const payouts = generatePayouts(payments)
  const cards = generateCards(payments)
  return { payments, refunds, disputes, payouts, cards }
}

function generatePayouts(payments: Payment[]): Payout[] {
  const payouts: Payout[] = []
  let seq = 0

  for (const merchant of merchants) {
    for (let week = 0; week < 8; week++) {
      const periodEnd = new Date(GENERATED_AT)
      periodEnd.setUTCDate(periodEnd.getUTCDate() - week * 7)
      const periodStart = new Date(periodEnd)
      periodStart.setUTCDate(periodStart.getUTCDate() - 7)

      const inPeriod = payments.filter(
        (p) =>
          p.merchantId === merchant.id &&
          p.status === "captured" &&
          p.createdAt >= periodStart.toISOString() &&
          p.createdAt < periodEnd.toISOString(),
      )
      if (inPeriod.length === 0) continue

      const gross = inPeriod.reduce((sum, p) => sum + p.amount, 0)
      const fees = Math.round(gross * 0.029) + inPeriod.length * 30

      payouts.push({
        id: `po_${pad(++seq, 4)}`,
        merchantId: merchant.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        gross,
        fees,
        net: gross - fees,
        currency: merchant.currency,
        status: week === 0 ? "pending" : week === 1 ? "in_transit" : "paid",
        paymentIds: inPeriod.map((p) => p.id),
      })
    }
  }

  return payouts
}
