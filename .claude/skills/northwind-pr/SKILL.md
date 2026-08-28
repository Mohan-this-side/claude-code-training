---
name: northwind-pr
description: Write a pull request description for the current branch in the Northwind team's required format — title, what changed, how it was verified, acceptance criteria, and deliberately-not-done. Use when the user asks to write or draft a PR description for Northwind work, or invokes /northwind-pr.
---

# /northwind-pr

Write the pull request description for the work on this branch, in the team's required format.

The reviewer reads this before it reads your diff. It is the difference between a reviewer who understands the change in thirty seconds and one who reverse-engineers it from a diff and guesses at your intent.

## What to do

### 1. Gather the facts before you write a word

Do not draft from memory of the session. Read the branch:

- `git diff main...HEAD --stat`, then the diff itself — what actually changed
- `git log main..HEAD --oneline` — how it was sequenced, and the ticket ID in the commit subjects
- The ticket in `docs/tickets/<TICKET-ID>.md` — the acceptance criteria, the out-of-scope list, and the definition of done, read verbatim

If you cannot tell which ticket this branch belongs to, ask. Do not infer it from the branch name alone when the commits disagree.

### 2. Check each acceptance criterion against the code

Go criterion by criterion. For each one, find the specific code that satisfies it, or find that nothing does. A criterion is met when you can point at the file that meets it — not when you remember intending to.

If it is half done, it is half done. Say which half.

### 3. Write the description

Five sections, in this order. Every one of them, every time.

**Title** — `<TICKET-ID>: <what it does>`

Present tense, plain verb, what the change does for a user of the console. `NWP-201: issue virtual cards from the console`, not `NWP-201: card work` and not `NWP-201: implement CardService and related components`.

**What changed** — one paragraph of plain language.

What can the app do now that it could not do before? Write it for a person, not a changelog. Not a file list — the diff already is one. If you find yourself naming more than two files, you are writing the wrong section.

> Ops can now issue a virtual card from the console, see it in a list, and open it to check its spend against the limit. Numbers are generated server-side and shown once.

Not: "Implemented card issuance functionality across the service and UI layers."

**How I verified it** — the commands you ran and what they printed.

Every line in this section is a command that was actually executed and its actual result. Paste the real summary line. If you clicked through the app, name the route, the input, and what appeared on screen.

> `npm test` — 47 passing, 0 failing, including the four new Luhn generator cases
>
> Issued a card at `/cards` with a 250000 limit in USD — full number shown once on the success screen, `•••• 4242` in the list after reload

Not: "Tests pass and the feature works."

**Acceptance criteria** — the ticket's checkboxes, copied and ticked honestly.

Copy them from the ticket verbatim, in the ticket's order, keeping its core/stretch split. Tick what is met. Leave unmet ones unticked. For anything partial, tick nothing and add one line saying what works and what does not.

> - [x] **Issue a card.** Form takes nickname, merchant, limit, currency.
> - [ ] **Freeze and unfreeze** — freeze works from the list; unfreeze is wired but reloads the page instead of updating in place.

**Deliberately not done** — what you left, and why.

Anything out of scope, cut for time, or handed to a follow-up. Name it and give the reason in the same breath. Include the ticket's own out-of-scope items only where a reviewer might otherwise think you missed them.

> Persistence — out of scope per the ticket, NWP-203 covers it.
>
> Merchant category lock — ran out of clock. Nothing depends on it.

An unmet criterion reported honestly scores better than an unmet criterion left unmentioned, because the reviewer will find it either way and one of those reads as a mistake while the other reads as a lie.

### 4. Offer to open it

Print the finished description. Then offer the command:

```bash
gh pr create --title "<TICKET-ID>: <what it does>" --body-file <file>
```

Ask before running it. Opening a pull request is the user's call, not yours.

## Rules

- **Never claim a verification step that was not run.** This is the one that matters most. If a command was not executed in this session, it does not go in "How I verified it" — no matter how sure you are of what it would print. If you want to claim it, run it now. If you cannot run it, write what you did instead and say plainly what is unverified.
- **No invented output.** Paste real numbers from real runs. A plausible-looking test summary that nobody produced is worse than no test summary, because it is the one thing a reviewer can check in five seconds.
- **Say what you did not do.** The "Deliberately not done" section is never empty. If it looks empty, you have not looked hard enough at the ticket's stretch goals and out-of-scope list.
- **Plain language over ceremony.** "Ops can now issue a card and see it in the list" beats "implemented card issuance functionality".
- **Keep it scannable.** Short paragraphs, real bullets. A reviewer skims first and reads second.
- **No emoji, no filler, no summary of the summary.**

## Why this exists

A description written from memory drifts toward what you meant to build. A description written from the diff, the log, and the ticket describes what you actually built — including the parts you would rather not mention, which are exactly the parts a reviewer needs.
