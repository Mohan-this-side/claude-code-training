import { lastUtcDays, utcDayKey } from "@/lib/dates"
import { GENERATED_AT } from "./generate"
import { filterPayments } from "./queries"
import { store } from "./store"

/**
 * Dashboard metrics. Everything here is reported in USD minor units for the
 * headline figures, because the overview is an internal ops screen rather
 * than a merchant statement.
 */

export interface DailyVolume {
  date: string
  captured: number
  refunded: number
}

export function dailyVolume(days = 30): DailyVolume[] {
  const keys = lastUtcDays(days, GENERATED_AT)
  const buckets = new Map<string, DailyVolume>(
    keys.map((date) => [date, { date, captured: 0, refunded: 0 }]),
  )

  for (const payment of store.payments) {
    // Bucket by UTC calendar day. The keys come from lastUtcDays, which is
    // UTC, so reading the day in server local time files a payment under the
    // wrong date whenever the two calendars disagree — and drops it entirely
    // when the local day falls outside the window.
    const key = utcDayKey(payment.createdAt)
    const bucket = buckets.get(key)
    if (!bucket) continue

    // Minor units stay integers the whole way through. Dividing by 100 here
    // and rounding at the end accumulates float error across a busy day.
    if (payment.status === "captured") {
      bucket.captured += payment.amount
    }
    if (payment.status === "refunded") {
      bucket.refunded += payment.amount
    }
  }

  return keys.map((date) => buckets.get(date)!)
}

export function headlineMetrics() {
  const captured = filterPayments({ status: "captured" })
  const refunded = filterPayments({ status: "refunded" })

  // Gross volume is everything that moved through the platform.
  const grossVolume =
    captured.reduce((sum, p) => sum + p.amount, 0) +
    refunded.reduce((sum, p) => sum + p.amount, 0)

  const all = filterPayments({})
  const authorized = all.filter((p) => p.status !== "failed").length
  const authRate = all.length ? authorized / all.length : 0

  const openDisputes = store.disputes.filter(
    (d) => d.status === "needs_response" || d.status === "under_review",
  )

  return {
    grossVolume,
    authRate,
    paymentCount: all.length,
    openDisputes: openDisputes.length,
    disputedAmount: openDisputes.reduce((sum, d) => sum + d.amount, 0),
  }
}
