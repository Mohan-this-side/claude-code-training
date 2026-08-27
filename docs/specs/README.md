# Specs

An **spec** here is the short planning document you write *before* building, and then feed to Claude as context while you build.

A ticket is what someone wants. A spec is what is actually in the codebase, what you intend to do about it, and how you will know it worked.

## Why bother

The fastest way to lose a Build Battle is to paste a ticket into Claude Code and start accepting diffs. It looks quick for eight minutes, and then you are debugging a feature that reimplemented a helper that already existed, in dollars instead of cents, against a convention nobody read.

A spec is the fix, and it costs about five minutes:

- **Claude stops rediscovering the codebase.** The file paths are already in context, so it stops guessing.
- **The plan is reviewable while it is cheap.** Correcting a paragraph takes seconds. Correcting a 400-line diff does not.
- **The acceptance criteria stay in front of you.** Drift is the default without them.
- **You can hand it to someone else.** That is what makes it a work product rather than a chat log.

## How to write one

```
/spec docs/tickets/NWP-201.md
```

The skill reads the ticket, goes and reads the actual code, asks you about anything genuinely ambiguous, and writes the spec here. Review it. Fix what is wrong — it will get something wrong, and catching that now is the point.

Then build with it loaded:

```
@docs/specs/NWP-201-issue-cards.md
```

## Rules

- No code in a spec. File paths and function names, yes. Implementations, no.
- Every claim about the codebase carries a path.
- Under two pages. A long spec usually means the ticket needs splitting.
- Open questions are allowed and encouraged. A stated unknown beats a confident guess.

Start from [`TEMPLATE.md`](TEMPLATE.md).
