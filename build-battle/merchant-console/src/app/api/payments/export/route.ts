import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  DEFAULT_EXPORT_COLUMNS,
  exportFilename,
  parseColumns,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * Ops picks the columns and the scope; both arrive from the browser and both
 * are checked against an allowlist here. The query builder behind
 * GET /api/payments does the filtering, and pagination is deliberately not
 * applied — an export covers every matching row, not the page on screen.
 */

const SCOPES = ["filtered", "all"] as const
type Scope = (typeof SCOPES)[number]

function parseScope(value: string | null): Scope {
  return SCOPES.includes(value as Scope) ? (value as Scope) : "filtered"
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const scope = parseScope(params.get("scope"))
  const filters = parseFilters(params)

  // Absent means "ops did not choose", which is the default set. Present but
  // empty after the allowlist means they deselected everything, and an empty
  // file is worse than an error.
  const requested = params.get("columns")
  const columns = requested === null ? DEFAULT_EXPORT_COLUMNS : parseColumns(requested)

  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const rows = sortPayments(
    filterPayments(scope === "all" ? {} : filters),
    filters.sort,
    filters.direction,
  )

  // Every segment below comes from an allowlist: "all" is a literal, and
  // filters.status was already narrowed by parseFilters.
  const segment =
    scope === "all"
      ? "all"
      : filters.status && filters.status !== "all"
        ? filters.status
        : "filtered"

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exportFilename(new Date(), segment)}"`,
    },
  })
}
