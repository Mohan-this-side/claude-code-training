# Build Battle: Repo Rescue

**40 minutes. One ticket. Everyone competes.**

You are an engineer at **Northwind Payments**. Your team owns the merchant console: the internal tool support and ops staff use to look up a payment, refund it, work disputes, and issue virtual cards.

Ops is tired of asking the platform team to create cards by hand. That request is now a ticket, and it has your name on it.

---

## Your ticket

**[NWP-201 — Issue virtual cards from the console](../docs/tickets/NWP-201.md)**

Pull it into Claude Code rather than retyping it:

```
@docs/tickets/NWP-201.md
```

Read the whole thing before you start, including **Out of scope**. Two of the four items in that list are where people lose the most time.

## Setup

```bash
cd build-battle/merchant-console
npm install
npm run dev
```

No database. Data lives in memory, seeded from JSON, and resets when you restart the dev server. That is deliberate — it is in the ticket, and building persistence earns nothing.

## The flow

Do it in this order. The first two steps take five minutes and they are why the last one goes fast.

1. **Read the ticket.** `@docs/tickets/NWP-201.md`
2. **Write the spec.** `/spec docs/tickets/NWP-201.md` — Claude reads the actual codebase, asks you what is ambiguous, and writes a plan to `docs/specs/`. Review it and fix what is wrong.
3. **Build with it loaded.** `@docs/specs/NWP-201-issue-cards.md`, then plan mode, then go.
4. **Check yourself.** `/ship-ready`
5. **Write the PR.** `/pr`
6. **Ship it.** Commit, push, open the pull request.

Skipping step 2 is the most common way to lose this. It is also worth 10% of your score on its own.

## What you have to work with

| | What it does |
|---|---|
| `/spec` | Turns the ticket into a plan that cites real files |
| `/pr` | Writes the pull request description from your branch, the ticket, and the spec |
| `/ship-ready` | Pre-push check: money math, UTC handling, duplicate logic, unvalidated input |
| `bug-investigator` | A read-only subagent. Hand it a bug report and it returns a root-cause analysis with file paths. It cannot edit anything, which is exactly why you can trust the report |

Try the subagent on [NWP-102](../docs/tickets/NWP-102.md) if you finish early. Nothing in this repository stops you from adding your own skills, subagents, or hooks either — a hook that blocks a push when tests fail is a good ninety seconds of work.

## How you are scored

A Claude reviewer reads every pull request and scores it. Core criteria are most of the mark; context, correctness, and polish decide the leaderboard.

| Weight | Category | What it checks |
|--------|----------|---------------|
| 40% | **Core criteria** | The six things the ticket says must work |
| 20% | **Correctness rules** | Minor units, Luhn on the test BIN, reveal-once masking, the status state machine, server-side validation |
| 15% | **Code quality** | Conventions followed, no second implementations, no new bugs |
| 10% | **Context and planning** | Is there a spec, does it cite real files, does the code match it |
| 10% | **PR description** | What you built, what you met, how you verified it |
| 5% | **Stretch goals** | Freeze/unfreeze, spend progress, category lock, tests, real empty and error states |

Meeting every core criterion correctly and nothing else lands around 0.75. The rest is earned.

Ties break toward the submission with tests, then working keyboard and screen-reader behavior, then the smaller diff.

## How to submit

```bash
git checkout -b NWP-201-issue-cards
# ...build...
git add -A
git commit -m "NWP-201: issue virtual cards"
git push -u origin NWP-201-issue-cards
# Open a PR — the reviewer runs automatically
```

Push as many times as you like. Each push re-scores. Your best run counts.

## How to actually win this

- **Spend the first five minutes on context, not prompting.** Read `merchant-console/CLAUDE.md`, then run `/spec`. Four conventions live in that file and every one of them is worth points.
- **Correct the spec, not the diff.** Fixing a wrong plan takes a sentence. Fixing a wrong 400-line diff at minute 25 is what loses this.
- **Plan mode before you build.** Shift+Tab, let Claude propose the shape, and steer it there.
- **Get the six core criteria working before you touch a stretch goal.** A polished card list with an unvalidated API scores worse than a plain one that is correct.
- **Give Claude a way to check itself.** A test, a curl, a screenshot. It works better when it can see the result.
- **Run `/ship-ready` before you push.** It checks money math, UTC handling, duplicate query builders, and unvalidated input — the exact things the grader weighs.
- **Write the PR description.** It is worth more than any single stretch goal, and it takes ninety seconds.

Good luck. Have fun with it.
