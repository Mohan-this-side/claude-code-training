import { store } from "@/data/store"
import { isValidLuhn, TEST_BIN } from "@/lib/cards"
import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it } from "vitest"
import { GET as getCard, PATCH } from "./[id]/route"
import { GET, POST } from "./route"

/**
 * Integration cover over the card routes.
 *
 * These call the handlers directly against the real in-memory store, so they
 * prove the things a unit test on `src/lib/cards.ts` cannot: that the creation
 * response is the only one carrying a number, that validation actually rejects
 * at the boundary, and that the state machine is enforced server-side.
 */

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

function patch(id: string, body: unknown) {
  return PATCH(
    new NextRequest(`http://localhost/api/cards/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  )
}

function validCard(overrides: Record<string, unknown> = {}) {
  return {
    nickname: "Integration card",
    merchantId: store.merchants[0].id,
    spendLimit: 25000,
    currency: store.merchants[0].currency,
    category: "software",
    ...overrides,
  }
}

/** The store is module state; keep each test from leaking into the next. */
let seeded: typeof store.cards
beforeEach(() => {
  seeded ??= [...store.cards]
  store.cards.length = 0
  store.cards.push(...seeded.map((card) => ({ ...card })))
})

describe("GET /api/cards", () => {
  it("returns the seeded cards", async () => {
    const body = await (await GET()).json()
    expect(body.rows.length).toBeGreaterThan(0)
  })

  it("never includes a card number on any row", async () => {
    const body = await (await GET()).json()
    for (const row of body.rows) {
      expect(row).not.toHaveProperty("number")
      expect(row.last4).toHaveLength(4)
    }
  })

  it("returns newest first", async () => {
    const body = await (await GET()).json()
    const dates = body.rows.map((row: { createdAt: string }) => row.createdAt)
    expect([...dates].sort().reverse()).toEqual(dates)
  })
})

describe("POST /api/cards", () => {
  it("issues a card and returns 201", async () => {
    const response = await post(validCard())
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.card.status).toBe("active")
    expect(body.card.spent).toBe(0)
  })

  it("returns the full number exactly once, on the creation response", async () => {
    const created = await (await post(validCard())).json()
    expect(created.number).toHaveLength(16)
    expect(created.number.startsWith(TEST_BIN)).toBe(true)
    expect(isValidLuhn(created.number)).toBe(true)

    // The stored record does not carry it...
    const stored = store.cards.find((card) => card.id === created.card.id)
    expect(stored).toBeDefined()
    expect(stored).not.toHaveProperty("number")

    // ...and no later read can produce it.
    const detail = await (
      await getCard(new NextRequest(`http://localhost/api/cards/${created.card.id}`), {
        params: Promise.resolve({ id: created.card.id }),
      })
    ).json()
    expect(detail.card).not.toHaveProperty("number")
    expect(JSON.stringify(detail)).not.toContain(created.number)

    const list = await (await GET()).json()
    expect(JSON.stringify(list)).not.toContain(created.number)
  })

  it("keeps only the last four of the generated number", async () => {
    const created = await (await post(validCard())).json()
    expect(created.card.last4).toBe(created.number.slice(-4))
  })

  it("rejects a missing merchant with 400", async () => {
    const response = await post(validCard({ merchantId: "" }))
    expect(response.status).toBe(400)
    expect((await response.json()).message).toBeTruthy()
  })

  it("rejects a merchant that does not exist", async () => {
    expect((await post(validCard({ merchantId: "mch_nope" }))).status).toBe(400)
  })

  it("rejects a zero or negative limit", async () => {
    expect((await post(validCard({ spendLimit: 0 }))).status).toBe(400)
    expect((await post(validCard({ spendLimit: -1 }))).status).toBe(400)
  })

  it("rejects a limit above 5,000,000 minor units", async () => {
    expect((await post(validCard({ spendLimit: 5_000_001 }))).status).toBe(400)
  })

  it("rejects a currency outside USD, EUR, GBP", async () => {
    expect((await post(validCard({ currency: "JPY" }))).status).toBe(400)
  })

  it("does not write a card when validation fails", async () => {
    const before = store.cards.length
    await post(validCard({ currency: "JPY" }))
    expect(store.cards).toHaveLength(before)
  })
})

describe("PATCH /api/cards/[id]", () => {
  async function issue() {
    return (await (await post(validCard())).json()).card as { id: string }
  }

  it("freezes an active card and unfreezes it again", async () => {
    const card = await issue()
    expect((await patch(card.id, { status: "frozen" })).status).toBe(200)
    expect((await patch(card.id, { status: "active" })).status).toBe(200)
  })

  it("cancels a card", async () => {
    const card = await issue()
    const response = await patch(card.id, { status: "cancelled" })
    expect(response.status).toBe(200)
    expect((await response.json()).card.status).toBe("cancelled")
  })

  it("refuses to bring a cancelled card back with 409", async () => {
    const card = await issue()
    await patch(card.id, { status: "cancelled" })
    expect((await patch(card.id, { status: "active" })).status).toBe(409)
    expect((await patch(card.id, { status: "frozen" })).status).toBe(409)
  })

  it("refuses a status that is not on the allowlist with 400", async () => {
    const card = await issue()
    expect((await patch(card.id, { status: "deleted" })).status).toBe(400)
    expect((await patch(card.id, { status: 3 })).status).toBe(400)
  })

  it("returns 404 for a card that does not exist", async () => {
    expect((await patch("crd_9999", { status: "frozen" })).status).toBe(404)
  })
})
