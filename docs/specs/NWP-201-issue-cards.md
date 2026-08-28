# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Mohan
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Marcus wants ops to issue a card themselves, see what they have issued, and open one to check it.

## Current state

Cards do not exist in this codebase. Nothing to extend, everything to add — but the patterns to follow all exist.

- `src/data/types.ts` — `Payment`, `Refund`, `Dispute`, `Payout`, `Merchant`. No card type. `Currency` is `"USD" | "EUR" | "GBP"`.
- `src/data/store.ts` — the in-memory store, held on `globalThis.__northwindStore` so dev-server reloads do not hand each request a fresh copy. Has `payments`, `refunds`, `disputes`, `payouts`; needs `cards`.
- `src/data/generate.ts` — deterministic seed data via `mulberry32(SEED)` with `SEED = 20260813`, and `GENERATED_AT = 2026-08-13T00:00:00Z`. Returns `{ payments, refunds, disputes, payouts }`.
- `src/data/queries.ts` — the one payment query builder (`parseFilters`, `filterPayments`, `sortPayments`, `queryPayments`). Cards must not route through it; it filters payments, not cards.
- `src/lib/money.ts` — `formatMoney`, `parseAmountToMinorUnits`, `sumMinorUnits`. `parseAmountToMinorUnits` already converts `"250.00"` to `25000` and returns `null` on junk, so the issue form does not need its own parser.
- `src/lib/dates.ts` — `formatDate`, `utcDayKey`, `formatInZone`.
- `src/app/payments/page.tsx` — the list pattern to copy: server component, `searchParams`, `TableRoot`/`Table`, an inline empty-state row, pagination via `Button asChild` + `Link`.
- `src/app/payments/[id]/page.tsx` — the detail pattern.
- `src/components/Drawer.tsx` — Tremor drawer over `@radix-ui/react-dialog`. **This is the modal primitive that already exists**; a second one would be a duplicate.
- `src/components/ui/payments/StatusBadge.tsx` — badge keyed by status with `LABELS`/`DOTS`/`VARIANTS` maps. Card statuses are a different union, so this needs a sibling rather than an edit.
- `src/app/siteConfig.ts` + `src/components/ui/navigation/AppSidebar.tsx` — nav is a hardcoded array; `/cards` has to be added to both.
- `vitest.config.ts` fails on Node 20 with `ERR_REQUIRE_ESM`. Renaming to `.mts` fixes it, and the suite cannot run until it is fixed.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` | Cents drift on every total |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | A fixture could resemble a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Number generation becomes client-trusted |
| "Reveal once. The full number appears in the creation response and nowhere else." | `.claude/rules/cards.md` | Full PAN leaks into list/detail payloads |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server." | `.claude/rules/cards.md` | A cancelled card comes back to life |
| "Validate everything from the client against an allowlist." | `.claude/rules/api-routes.md` | Bad currency or negative limit reaches the store |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | Callers cannot handle failures uniformly |
| "Do not add a database, an ORM, or migrations." | `merchant-console/CLAUDE.md` + ticket | Burns the clock, earns nothing |

## Approach

Add a card domain in the same three layers the console already uses: types and a store slice in `src/data/`, pure logic in `src/lib/cards.ts`, and route handlers in `src/app/api/cards/`. All number generation, validation and status guarding lives server-side; the client sends a nickname, merchant, limit and currency and gets back a record. The full PAN exists only in the POST response body and is never written to the store — the record carries `last4` plus a `reference`, so there is nothing to leak from a list or detail payload even by accident.

The UI is three surfaces: a `/cards` list (server component, mirroring `/payments`), a detail page at `/cards/[id]`, and a client drawer for issuing. Freeze/unfreeze calls `PATCH` and uses `router.refresh()` so the row updates without a full page reload.

**Considered and rejected:** storing the full number on the record and masking at render. It reads simpler and it is what the old manual process effectively did, but it puts a PAN in the store where any future list route, log line, or CSV export would pick it up — exactly the class of near-miss NWP-101 was filed about. Masking at the boundary means one forgotten `select` re-exposes it; not storing it means there is nothing to forget.

**Also rejected:** deriving spend by joining payments to cards. There is no card reference on `Payment` and inventing one is a bigger change than the ticket asks for, so `spent` is a field on the card, seeded for seed cards and `0` for newly issued ones.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `vitest.config.ts` → `.mts` | change | Suite cannot start on Node 20 otherwise |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `MerchantCategory`, `CARD_STATUSES` |
| `src/lib/cards.ts` | add | Luhn generation on the `4242` BIN, masking, transition guard, validation |
| `src/lib/cards.test.ts` | add | Luhn + state machine + validation cases, beside the code |
| `src/data/cards.ts` | add | The single card store accessor: list, byId, create, transition |
| `src/data/generate.ts` | change | Seed four cards so list and detail have content |
| `src/data/store.ts` | change | `cards` slice |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` issue — the one reveal |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail, `PATCH` status transition |
| `src/app/cards/page.tsx` | add | The list |
| `src/app/cards/[id]/page.tsx` | add | Detail with spend against limit |
| `src/app/cards/issue-drawer.tsx` | add | Client issue form + one-time reveal screen |
| `src/app/cards/card-row-actions.tsx` | add | Freeze/unfreeze without a full reload |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Card statuses are their own union |
| `src/app/siteConfig.ts`, `AppSidebar.tsx` | change | `/cards` in nav |

## Plan

1. **Fix the vitest config** — done when: `npm test` starts and the existing 28 tests pass.
2. **Types + `src/lib/cards.ts` + tests** — done when: `npm test` shows Luhn cases passing, including that every generated number starts `4242` and validates.
3. **Store slice + `src/data/cards.ts` + seed cards** — done when: `GET /api/cards` returns the seeded cards with no `number` field on any of them.
4. **`POST /api/cards`** — done when: a valid post returns `201` with `number` once; a missing merchant, a zero/negative limit, a limit over 5,000,000, and currency `JPY` each return `400` with a message.
5. **`PATCH /api/cards/[id]`** — done when: `active→frozen→active` succeeds, `→cancelled` succeeds, and any transition out of `cancelled` returns `409`.
6. **List + detail pages** — done when: `/cards` shows every seeded card masked as `•••• NNNN`, and `/cards/<id>` shows the record with spend against limit.
7. **Issue drawer** — done when: submitting shows the full number once on a success screen and the list shows only the mask after close.
8. **Freeze/unfreeze + spend bar + category + nav** — done when: the row status changes without a full page reload and the bar turns amber past 80%.
9. **Green checks** — done when: `npm test`, `npm run build`, `npm run lint` all pass.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | `POST /api/cards` returns `201`; drawer submits and the row appears in `/cards` |
| Card list | `/cards` renders nickname, merchant, masked number, limit, status, created date |
| Card detail | `/cards/<id>` renders the full record plus spend against limit |
| Generated card numbers | `cards.test.ts` asserts `4242` prefix and a valid Luhn digit over many generated numbers |
| Reveal once, mask forever | Test asserts `toCardRecord()` output has no `number` key; list/detail render `•••• NNNN` |
| Server-side validation | Tests over `validateIssueInput` for missing merchant, zero, negative, over-limit, bad currency |
| Freeze/unfreeze (stretch) | Test over `nextStatus`; UI patches and refreshes without reload |
| Spend progress (stretch) | Detail bar; amber past 80% |
| Tests (stretch) | `npm test` green, cases beside the code |

## Risks

- **Reveal-once is easy to undo later.** Mitigation: the full number is never stored, so re-exposing it would take a deliberate schema change rather than a forgotten mask.
- **Two currencies in one view.** A card's limit and its spend share the card's own currency, so no cross-currency sum happens; the list never totals limits.
- **`globalThis` store and route handlers.** Writes must go through `src/data/cards.ts` only, or two code paths will mutate the array differently.

## Out of scope

- **Persistence** — NWP-203. No database, ORM, or migration.
- **Auth, roles, permissions.**
- **Real card network calls** — there is no issuer.
- **Editing a limit after issue** — NWP-202.

## Open questions

- Should a cancelled card stay in the default list view or be filtered out? Assuming it stays, with its status shown, since ops asked to "check a card" after the fact.
