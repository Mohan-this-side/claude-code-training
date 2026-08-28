import {
  Card,
  CARD_STATUSES,
  CardStatus,
  Currency,
  MERCHANT_CATEGORIES,
  MerchantCategory,
} from "@/data/types"

/**
 * Card generation and rules for NWP-201.
 *
 * Everything here runs on the server. A number produced in the browser is a
 * bug, and the full number is never stored — `issueNumber` hands it back once
 * and the caller keeps only the last four and a reference.
 */

/** The test BIN. Every generated number starts here so nothing resembles a PAN. */
export const TEST_BIN = "4242"

/** Ops cannot issue above this, in minor units. 5,000,000 = $50,000.00. */
export const MAX_SPEND_LIMIT = 5_000_000

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/**
 * Luhn check digit for a partial number.
 *
 * Doubling runs from the right on the digit that will sit next to the check
 * digit, which is why the parity test is on `index % 2 === 0` over the
 * reversed body rather than on the digit's position in the final number.
 */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  const reversed = partial.split("").reverse()
  for (let index = 0; index < reversed.length; index++) {
    let digit = Number(reversed[index])
    if (index % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** True when a complete number's trailing digit is its correct Luhn digit. */
export function isValidLuhn(number: string): boolean {
  if (!/^\d{2,}$/.test(number)) return false
  const body = number.slice(0, -1)
  const check = Number(number.slice(-1))
  return luhnCheckDigit(body) === check
}

/**
 * Generate a 16-digit number on the test BIN with a valid check digit.
 *
 * `random` is injectable so tests are deterministic; production callers use
 * the default.
 */
export function issueNumber(random: () => number = Math.random): string {
  let body = TEST_BIN
  while (body.length < 15) {
    body += String(Math.floor(random() * 10))
  }
  return body + String(luhnCheckDigit(body))
}

/** `•••• 4242`. The only form a card number takes outside the creation response. */
export function maskNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * The status a card may move to, or `null` when the move is not allowed.
 *
 * `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal.
 * Guarded here so the server decides, not the button that was clicked.
 */
export function nextStatus(
  current: CardStatus,
  requested: CardStatus,
): CardStatus | null {
  if (current === "cancelled") return null
  if (current === requested) return null
  if (requested === "cancelled") return "cancelled"
  if (current === "active" && requested === "frozen") return "frozen"
  if (current === "frozen" && requested === "active") return "active"
  return null
}

export function isCardStatus(value: unknown): value is CardStatus {
  return typeof value === "string" && CARD_STATUSES.includes(value as CardStatus)
}

function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && CURRENCIES.includes(value as Currency)
}

function isCategory(value: unknown): value is MerchantCategory {
  return (
    typeof value === "string" &&
    (MERCHANT_CATEGORIES as readonly string[]).includes(value)
  )
}

export interface IssueInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: MerchantCategory | null
}

/**
 * Check an issue request from the browser.
 *
 * Returns either the narrowed input or a message safe to show a user. The
 * client has its own checks; those are convenience and this is enforcement,
 * so every field is re-tested here regardless of what the form allowed.
 */
export function validateIssueInput(
  body: unknown,
  merchantIds: readonly string[],
): { ok: true; value: IssueInput } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Expected a card to issue." }
  }
  const raw = body as Record<string, unknown>

  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : ""
  if (nickname.length === 0) {
    return { ok: false, message: "Give the card a nickname." }
  }
  if (nickname.length > 60) {
    return { ok: false, message: "Nickname is limited to 60 characters." }
  }

  if (typeof raw.merchantId !== "string" || !merchantIds.includes(raw.merchantId)) {
    return { ok: false, message: "Pick a merchant for this card." }
  }

  const spendLimit = raw.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return { ok: false, message: "Spend limit must be a whole number of minor units." }
  }
  if (spendLimit <= 0) {
    return { ok: false, message: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return { ok: false, message: "Spend limit cannot exceed 5,000,000 minor units." }
  }

  if (!isCurrency(raw.currency)) {
    return { ok: false, message: "Currency must be USD, EUR, or GBP." }
  }

  const category =
    raw.category === undefined || raw.category === null || raw.category === ""
      ? null
      : isCategory(raw.category)
        ? raw.category
        : undefined
  if (category === undefined) {
    return { ok: false, message: "That merchant category is not one we support." }
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId: raw.merchantId,
      spendLimit,
      currency: raw.currency,
      category,
    },
  }
}

/** Spend against the limit as a 0–100 integer, clamped. */
export function spendPercent(card: Pick<Card, "spent" | "spendLimit">): number {
  if (card.spendLimit <= 0) return 0
  const percent = Math.round((card.spent / card.spendLimit) * 100)
  return Math.min(100, Math.max(0, percent))
}
