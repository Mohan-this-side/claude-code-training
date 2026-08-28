import { issueNumber, IssueInput, nextStatus } from "@/lib/cards"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/**
 * The one way in and out of the card slice.
 *
 * Route handlers call these rather than touching `store.cards`, so there is a
 * single place where a card is created and a single place where its status
 * changes. The payment query builder is not reused here — it filters payments,
 * and a card is not a payment.
 */

/** Newest first, which is the order ops asked for. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | undefined {
  return store.cards.find((card) => card.id === id)
}

function nextId(): string {
  const highest = store.cards.reduce((max, card) => {
    const n = Number(card.id.replace(/^crd_/, ""))
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `crd_${String(highest + 1).padStart(4, "0")}`
}

/**
 * Create a card and hand back the generated number exactly once.
 *
 * The number is deliberately not part of the stored record and is not written
 * anywhere else — this return value is the only time it exists.
 */
export function createCard(input: IssueInput): { card: Card; number: string } {
  const number = issueNumber()
  const id = nextId()
  const createdAt = new Date().toISOString()
  const card: Card = {
    id,
    nickname: input.nickname,
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    last4: number.slice(-4),
    reference: `cref_${id.replace(/^crd_/, "")}`,
    category: input.category,
    createdAt,
    history: [{ status: "active", at: createdAt }],
  }
  store.cards.push(card)
  return { card, number }
}

/**
 * Issue a card at most once for a given idempotency key.
 *
 * A retried POST — a double-click, a proxy replay, a client that timed out and
 * tried again — must not leave ops with two cards and two limits. The key maps
 * to the card it created; a replay returns that card and `replayed: true`, and
 * deliberately no number: the reveal already happened and it is not stored, so
 * there is nothing honest to return a second time.
 */
export function createCardIdempotent(
  input: IssueInput,
  key: string | null,
): { card: Card; number: string | null; replayed: boolean } {
  if (!key) {
    const { card, number } = createCard(input)
    return { card, number, replayed: false }
  }

  const existingId = store.cardIdempotency.get(key)
  if (existingId) {
    const existing = cardById(existingId)
    if (existing) return { card: existing, number: null, replayed: true }
  }

  const { card, number } = createCard(input)
  store.cardIdempotency.set(key, card.id)
  return { card, number, replayed: false }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" | "forbidden" }

/**
 * Move a card's status, or refuse.
 *
 * The guard lives in `nextStatus`; this only applies the result. A refusal is
 * `forbidden` rather than a thrown error so the route can map it to a 409.
 */
export function transitionCard(
  id: string,
  requested: CardStatus,
): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, reason: "not_found" }

  const resolved = nextStatus(card.status, requested)
  if (!resolved) return { ok: false, reason: "forbidden" }

  card.status = resolved
  // Append-only: the trail records what happened, so a cancelled card still
  // shows the day it was frozen.
  card.history.push({ status: resolved, at: new Date().toISOString() })
  return { ok: true, card }
}
