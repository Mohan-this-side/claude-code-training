import { describe, expect, it } from "vitest"
import { lastUtcDays, utcDayKey } from "@/lib/dates"
import { GENERATED_AT } from "./generate"
import { dailyVolume } from "./metrics"
import { store } from "./store"

/**
 * Seed data is deterministic, so these assert real numbers rather than shapes.
 *
 * Both cases here are regressions from NWP-102: the daily buckets were keyed
 * by the server's local calendar while the bucket list was built in UTC, and
 * the amounts were accumulated as floats in major units.
 */

const DAYS = 30

describe("dailyVolume", () => {
  it("buckets by the UTC day, not the server's local day", () => {
    const keys = new Set(lastUtcDays(DAYS, GENERATED_AT))
    const expected = new Map<string, { captured: number; refunded: number }>()

    for (const payment of store.payments) {
      const key = utcDayKey(payment.createdAt)
      if (!keys.has(key)) continue
      const bucket = expected.get(key) ?? { captured: 0, refunded: 0 }
      if (payment.status === "captured") bucket.captured += payment.amount
      if (payment.status === "refunded") bucket.refunded += payment.amount
      expected.set(key, bucket)
    }

    for (const day of dailyVolume(DAYS)) {
      const want = expected.get(day.date) ?? { captured: 0, refunded: 0 }
      expect({ date: day.date, captured: day.captured }).toEqual({
        date: day.date,
        captured: want.captured,
      })
      expect(day.refunded).toBe(want.refunded)
    }
  })

  it("accounts for every payment in the window, dropping none", () => {
    // Conservation only. It does not catch the local-calendar bug on its own,
    // because a shift between two in-window days leaves the total intact —
    // the per-day assertion above is what pins that. This one catches a
    // payment whose key falls outside the window and misses its bucket.
    const keys = new Set(lastUtcDays(DAYS, GENERATED_AT))
    const inWindow = store.payments.filter((p) =>
      keys.has(utcDayKey(p.createdAt)),
    )

    const captured = inWindow
      .filter((p) => p.status === "captured")
      .reduce((total, p) => total + p.amount, 0)

    const rows = dailyVolume(DAYS)
    expect(rows.reduce((total, row) => total + row.captured, 0)).toBe(captured)
    expect(captured).toBeGreaterThan(0)
  })

  it("reports integer minor units, never a float", () => {
    for (const day of dailyVolume(DAYS)) {
      expect(Number.isInteger(day.captured)).toBe(true)
      expect(Number.isInteger(day.refunded)).toBe(true)
    }
  })

  it("returns one row per requested day, oldest first", () => {
    const rows = dailyVolume(DAYS)
    expect(rows).toHaveLength(DAYS)
    expect(rows.map((r) => r.date)).toEqual(lastUtcDays(DAYS, GENERATED_AT))
  })
})
