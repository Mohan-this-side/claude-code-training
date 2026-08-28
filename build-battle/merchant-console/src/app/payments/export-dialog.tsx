"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

/** Named so the reason it defaults off is on screen, not just in the ticket. */
const SENSITIVE: Partial<Record<ExportColumn, string>> = {
  last4: "Off by default — leave it off for files going to a merchant",
}

export function PaymentsExportDialog({
  query,
  filteredCount,
  allCount,
}: {
  query: string
  filteredCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<"filtered" | "all">("filtered")

  const toggle = (column: ExportColumn) => {
    setSelected((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : // Keep the canonical order rather than click order, so the file
          // reads the same way however ops got there.
          EXPORT_COLUMNS.filter(
            (name) => name === column || current.includes(name),
          ),
    )
  }

  const rowCount = scope === "all" ? allCount : filteredCount
  const disabled = selected.length === 0

  // The server builds the file. Handing this to the browser would export only
  // the rows on this page, which is the bug this feature exists to avoid.
  const href = () => {
    const params = new URLSearchParams(scope === "all" ? "" : query)
    params.set("scope", scope)
    params.set("columns", selected.join(","))
    return `/api/payments/export?${params.toString()}`
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>
            Choose what goes in the file before you download it.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filtered", "Current filter", filteredCount],
                  ["all", "All payments", allCount],
                ] as const
              ).map(([value, label, count]) => (
                <div key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`scope-${value}`}
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                  <label
                    htmlFor={`scope-${value}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {label}
                    <span className="ml-1 tabular-nums text-gray-500">
                      · {count.toLocaleString()} payments
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 space-y-2">
              {EXPORT_COLUMNS.map((column) => (
                <div key={column} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id={`column-${column}`}
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className="mt-0.5 size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                  <label
                    htmlFor={`column-${column}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {COLUMN_LABELS[column]}
                    {SENSITIVE[column] && (
                      <span className="block text-xs text-amber-600 dark:text-amber-500">
                        {SENSITIVE[column]}
                      </span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        </DialogBody>

        <DialogFooter>
          <p
            className="mr-auto self-center text-sm text-gray-500"
            aria-live="polite"
          >
            {disabled
              ? "Select at least one column to export."
              : `${rowCount.toLocaleString()} payments · ${selected.length} columns`}
          </p>
          <Button variant="secondary" asChild={!disabled} disabled={disabled}>
            {disabled ? (
              <span>Download CSV</span>
            ) : (
              <a href={href()} download>
                Download CSV
              </a>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
