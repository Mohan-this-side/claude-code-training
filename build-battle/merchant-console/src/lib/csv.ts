import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMinorUnitsPlain } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns (NWP-101). EXPORT_COLUMNS is the allowlist and the
 * canonical order; DEFAULT_EXPORT_COLUMNS is what you get when nobody chooses,
 * and it leaves the card last four out, because most of these files go to a
 * merchant.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/** Every column except the card last four. Ops opts in to that one. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] =
  EXPORT_COLUMNS.filter((column) => column !== "last4")

function isExportColumn(value: string): value is ExportColumn {
  return (EXPORT_COLUMNS as readonly string[]).includes(value)
}

/**
 * Turn a client-supplied `columns` parameter into a column list.
 *
 * Column names arrive from the browser, so nothing here is trusted: anything
 * not in EXPORT_COLUMNS is dropped rather than passed along. Duplicates
 * collapse, and the caller's order is kept — ops asked for the file to come
 * out in the order they picked. An empty result means "nothing valid was
 * asked for", which the route turns into a 400 rather than an empty file.
 */
export function parseColumns(raw: string | null | undefined): ExportColumn[] {
  if (!raw) return []

  const seen = new Set<ExportColumn>()
  for (const part of raw.split(",")) {
    const name = part.trim()
    if (isExportColumn(name)) seen.add(name)
  }
  return [...seen]
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      // Minor units are formatted exactly once, here, on the way out. The
      // currency stays in its own column rather than riding along as a symbol.
      return formatMinorUnitsPlain(payment.amount)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * `payments-disputed-2026-08-13.csv`, or `payments-2026-08-13.csv` with no scope.
 *
 * The scope segment reaches a filename, so callers pass a value they took from
 * an allowlist — never a raw query parameter. The regex is a second line of
 * defence, not the first one.
 */
export function exportFilename(date = new Date(), scope?: string): string {
  const stamp = date.toISOString().slice(0, 10)
  const segment = scope && /^[a-z_]+$/.test(scope) ? `${scope}-` : ""
  return `payments-${segment}${stamp}.csv`
}
