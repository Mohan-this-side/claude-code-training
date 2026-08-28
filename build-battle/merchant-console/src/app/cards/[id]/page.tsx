import { ProgressBar } from "@/components/ProgressBar"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskNumber, spendPercent } from "@/lib/cards"
import { formatDate, formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../card-status-actions"

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  office_supplies: "Office supplies",
  contractors: "Contractors",
  utilities: "Utilities",
}

/**
 * One card's full record and its spend against the limit.
 *
 * Both figures are the card's own currency, so the bar compares like with
 * like — no cross-currency arithmetic happens on this page.
 */
export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const percent = spendPercent(card)
  const remaining = Math.max(0, card.spendLimit - card.spent)
  const nearLimit = percent >= 80

  return (
    <section aria-label={`Card ${card.nickname}`} className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-blue-600 hover:underline dark:text-blue-500"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              {card.nickname}
            </h1>
            <CardStatusBadge status={card.status} />
          </div>
          <p className="mt-1 font-mono tabular-nums text-gray-500">
            {maskNumber(card.last4)}
          </p>
        </div>
        <CardStatusActions cardId={card.id} status={card.status} withCancel />
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Spend against limit
          </p>
          <p className="text-sm tabular-nums text-gray-500">
            {formatMoney(card.spent, card.currency)} of{" "}
            {formatMoney(card.spendLimit, card.currency)}
          </p>
        </div>
        <ProgressBar
          className="mt-3"
          value={percent}
          variant={nearLimit ? "warning" : "default"}
          label={`Spend against limit for ${card.nickname}`}
        />
        <p className="mt-2 text-sm text-gray-500">
          {percent}% used · {formatMoney(remaining, card.currency)} remaining
          {nearLimit && " · close to the limit"}
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <Field label="Card ID" value={card.id} mono />
        <Field label="Reference" value={card.reference} mono />
        <Field label="Merchant" value={merchant?.name ?? card.merchantId} />
        <Field label="Currency" value={card.currency} />
        <Field
          label="Spend limit"
          value={formatMoney(card.spendLimit, card.currency)}
        />
        <Field label="Spent" value={formatMoney(card.spent, card.currency)} />
        <Field
          label="Category lock"
          value={
            card.category ? (CATEGORY_LABELS[card.category] ?? card.category) : "None"
          }
        />
        <Field label="Created (UTC)" value={formatDate(card.createdAt)} />
        {merchant && (
          <Field
            label={`Created (${merchant.timezone})`}
            value={formatInZone(card.createdAt, merchant.timezone)}
          />
        )}
      </dl>

      <p className="mt-8 text-sm text-gray-500">
        The full number was shown once, when this card was issued. Northwind
        does not store it, so it cannot be shown again.
      </p>
    </section>
  )
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd
        className={cx(
          "mt-0.5 text-sm text-gray-900 dark:text-gray-50",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  )
}
