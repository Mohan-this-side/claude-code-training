"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze, or cancel a card.
 *
 * Patches the route and calls `router.refresh()`, which re-renders the server
 * component in place — no full page reload. The server owns the state machine,
 * so a refused transition comes back as a 409 and is surfaced rather than
 * assumed impossible: these buttons are a convenience, not the guard.
 */
export function CardStatusActions({
  cardId,
  status,
  withCancel = false,
}: {
  cardId: string
  status: CardStatus
  withCancel?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  if (status === "cancelled") {
    return (
      <span className="text-sm text-gray-500">Cancelled — nothing to do</span>
    )
  }

  async function move(next: CardStatus) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.message ?? "That change was refused.")
        return
      }
      setConfirmingCancel(false)
      router.refresh()
    } catch {
      setError("Could not reach the server. Nothing changed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="py-1"
          disabled={busy}
          onClick={() => void move(status === "active" ? "frozen" : "active")}
        >
          {busy ? "…" : status === "active" ? "Freeze" : "Unfreeze"}
        </Button>

        {withCancel &&
          (confirmingCancel ? (
            <Button
              variant="destructive"
              className="py-1"
              disabled={busy}
              onClick={() => void move("cancelled")}
            >
              Confirm cancel
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="py-1"
              disabled={busy}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel card
            </Button>
          ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
