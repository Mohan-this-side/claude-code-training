"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { MERCHANT_CATEGORIES } from "@/data/types"
import { maskNumber } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  office_supplies: "Office supplies",
  contractors: "Contractors",
  utilities: "Utilities",
}

const CURRENCIES = ["USD", "EUR", "GBP"] as const

/**
 * Issue a card.
 *
 * The number is generated server-side and comes back in the POST response.
 * It lives in `revealed` only while the success screen is open and is dropped
 * on close, so nothing here can show it twice. The client's own checks below
 * exist to keep the button honest — the route re-validates every field.
 */
export function IssueCardDrawer({
  merchants,
}: {
  merchants: { id: string; name: string; currency: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<string>("USD")
  const [category, setCategory] = useState<string>("none")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<{
    number: string
    nickname: string
    last4: string
  } | null>(null)

  const minorUnits = parseAmountToMinorUnits(limit)
  const canSubmit =
    nickname.trim().length > 0 &&
    merchantId.length > 0 &&
    minorUnits !== null &&
    minorUnits > 0 &&
    !submitting

  function reset() {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("none")
    setError(null)
    setRevealed(null)
  }

  function close() {
    // Dropping `revealed` here is what makes the reveal one-time: once this
    // drawer closes the number is gone from the client entirely.
    setOpen(false)
    reset()
    router.refresh()
  }

  async function submit() {
    if (minorUnits === null) {
      setError("Enter a limit like 250 or 250.00.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          merchantId,
          spendLimit: minorUnits,
          currency,
          category: category === "none" ? null : category,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message ?? "Could not issue the card.")
        return
      }
      setRevealed({
        number: payload.number,
        nickname: payload.card.nickname,
        last4: payload.card.last4,
      })
    } catch {
      setError("Could not reach the server. Nothing was issued.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
        else setOpen(true)
      }}
    >
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-lg">
        {revealed ? (
          <>
            <DrawerHeader>
              <DrawerTitle>{revealed.nickname} is live</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now —
                after you close this it is {maskNumber(revealed.last4)}
                &nbsp;everywhere.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Card number
                </p>
                <p className="mt-1 font-mono text-lg tabular-nums text-gray-900 dark:text-gray-50">
                  {revealed.number.replace(/(.{4})/g, "$1 ").trim()}
                </p>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Northwind does not store this number. Nobody, including you, can
                retrieve it again from the console.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={close}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <>
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, always virtual, with a limit from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <form
                id="issue-card-form"
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void submit()
                }}
              >
                <div>
                  <label
                    htmlFor="card-nickname"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Nickname
                  </label>
                  <Input
                    id="card-nickname"
                    name="nickname"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="Meta ad spend"
                    className="mt-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="card-merchant"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Merchant
                  </label>
                  <Select
                    value={merchantId}
                    onValueChange={(next) => {
                      setMerchantId(next)
                      const merchant = merchants.find((m) => m.id === next)
                      if (merchant) setCurrency(merchant.currency)
                    }}
                  >
                    <SelectTrigger id="card-merchant" className="mt-2">
                      <SelectValue placeholder="Pick a merchant" />
                    </SelectTrigger>
                    <SelectContent>
                      {merchants.map((merchant) => (
                        <SelectItem key={merchant.id} value={merchant.id}>
                          {merchant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label
                      htmlFor="card-limit"
                      className="text-sm font-medium text-gray-900 dark:text-gray-50"
                    >
                      Spend limit
                    </label>
                    <Input
                      id="card-limit"
                      name="spendLimit"
                      inputMode="decimal"
                      value={limit}
                      onChange={(event) => setLimit(event.target.value)}
                      placeholder="2500.00"
                      className="mt-2"
                    />
                  </div>
                  <div className="w-32">
                    <label
                      htmlFor="card-currency"
                      className="text-sm font-medium text-gray-900 dark:text-gray-50"
                    >
                      Currency
                    </label>
                    {/*
                      A card settles against one merchant, so the currency is
                      the merchant's and is not ops' to change. Offering the
                      other two here would only produce a request the server
                      rejects. The server checks it regardless.
                    */}
                    <Select value={currency} disabled>
                      <SelectTrigger id="card-currency" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-gray-500">
                      {merchantId ? "Set by the merchant" : "Pick a merchant first"}
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="card-category"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Category lock{" "}
                    <span className="font-normal text-gray-500">(optional)</span>
                  </label>
                  <Select
                    value={category}
                    onValueChange={(next) => setCategory(next)}
                  >
                    <SelectTrigger id="card-category" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No lock</SelectItem>
                      {MERCHANT_CATEGORIES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {CATEGORY_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400"
                  >
                    {error}
                  </p>
                )}
              </form>
            </DrawerBody>
            <DrawerFooter>
              <Button
                variant="secondary"
                onClick={close}
                disabled={submitting}
                type="button"
              >
                Cancel
              </Button>
              <Button type="submit" form="issue-card-form" disabled={!canSubmit}>
                {submitting ? "Issuing…" : "Issue card"}
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
