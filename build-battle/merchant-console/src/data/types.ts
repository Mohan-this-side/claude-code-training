export type Currency = "USD" | "EUR" | "GBP"

export type PaymentStatus =
  | "authorized"
  | "captured"
  | "refunded"
  | "failed"
  | "disputed"

export type DisputeStatus = "needs_response" | "under_review" | "won" | "lost"

export type PayoutStatus = "paid" | "in_transit" | "pending"

/** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. */
export type CardStatus = "active" | "frozen" | "cancelled"

/** Server-side allowlist. Anything from a client is checked against this. */
export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

export const MERCHANT_CATEGORIES = [
  "advertising",
  "software",
  "travel",
  "office_supplies",
  "contractors",
  "utilities",
] as const

export type MerchantCategory = (typeof MERCHANT_CATEGORIES)[number]

export interface Merchant {
  id: string
  name: string
  country: string
  /** IANA timezone. Display converts to this; storage never does. */
  timezone: string
  currency: Currency
  riskTier: "low" | "standard" | "elevated"
}

export interface Payment {
  id: string
  merchantId: string
  /** Integer minor units. Never a float. */
  amount: number
  currency: Currency
  status: PaymentStatus
  method: "card" | "wallet" | "bank_transfer"
  cardBrand: "visa" | "mastercard" | "amex" | null
  last4: string | null
  /** ISO 8601, always UTC. */
  createdAt: string
  description: string
}

export interface Refund {
  id: string
  paymentId: string
  amount: number
  currency: Currency
  reason: "requested_by_customer" | "duplicate" | "fraudulent"
  createdAt: string
}

export interface Dispute {
  id: string
  paymentId: string
  merchantId: string
  amount: number
  currency: Currency
  reasonCode: string
  status: DisputeStatus
  openedAt: string
  /** Evidence deadline, UTC. */
  evidenceDueAt: string
}

export interface Payout {
  id: string
  merchantId: string
  periodStart: string
  periodEnd: string
  gross: number
  fees: number
  net: number
  currency: Currency
  status: PayoutStatus
  paymentIds: string[]
}

/**
 * A virtual card.
 *
 * The generated number is never a field here. The record carries the last four
 * and an opaque `reference`; the full number exists in exactly one response,
 * the creation one, and is not persisted anywhere.
 */
export interface Card {
  id: string
  nickname: string
  merchantId: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units already spent against the limit. */
  spent: number
  currency: Currency
  status: CardStatus
  last4: string
  /** Opaque handle for the generated number. Not the number. */
  reference: string
  category: MerchantCategory | null
  /** ISO 8601, always UTC. */
  createdAt: string
}

export interface PaymentFilters {
  status?: PaymentStatus | "all"
  merchantId?: string
  search?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
  sort?: "createdAt" | "amount"
  direction?: "asc" | "desc"
}
