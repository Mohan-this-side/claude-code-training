import { cardById, transitionCard } from "@/data/cards"
import { isCardStatus } from "@/lib/cards"
import { NextRequest, NextResponse } from "next/server"

/**
 * A single card.
 *
 * GET returns the stored record — no number, ever. PATCH moves the status, and
 * the state machine is enforced here rather than in the button that was
 * clicked: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is
 * terminal.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "No such card." }, { status: 404 })
  }
  return NextResponse.json({ card })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: "Expected a JSON body." },
      { status: 400 },
    )
  }

  const requested = (body as { status?: unknown } | null)?.status
  if (!isCardStatus(requested)) {
    return NextResponse.json(
      { message: "Status must be active, frozen, or cancelled." },
      { status: 400 },
    )
  }

  const result = transitionCard(id, requested)
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ message: "No such card." }, { status: 404 })
    }
    return NextResponse.json(
      { message: "That status change is not allowed for this card." },
      { status: 409 },
    )
  }

  return NextResponse.json({ card: result.card })
}
