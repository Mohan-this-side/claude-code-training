import { createCard, listCards } from "@/data/cards"
import { merchants } from "@/data/merchants"
import { validateIssueInput } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * Cards collection.
 *
 * GET returns the stored records, which never carry a number. POST issues a
 * card and is the single response in the whole app that contains a full one.
 * Every field on the way in is checked against an allowlist here; the form's
 * own checks are convenience, not enforcement.
 */

export function GET() {
  return NextResponse.json({ rows: listCards() })
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const checked = validateIssueInput(
    body,
    merchants.map((merchant) => ({
      id: merchant.id,
      currency: merchant.currency,
    })),
  )
  if (!checked.ok) {
    return NextResponse.json({ message: checked.message }, { status: 400 })
  }

  const { card, number } = createCard(checked.value)

  // The only response in this codebase that contains a full card number.
  // It is not stored, not logged, and not returned by any other route.
  return NextResponse.json({ card, number }, { status: 201 })
}
