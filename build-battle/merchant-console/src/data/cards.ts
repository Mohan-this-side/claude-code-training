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
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)
  return { card, number }
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
  return { ok: true, card }
}
