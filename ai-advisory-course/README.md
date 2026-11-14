# AI Advisory Course

A self-paced, hands-on curriculum for becoming a premium AI-implementation
advisor ($5k–$15k/month retainers) to funds, firms, and high-net-worth
individuals. Built for someone with a technical (chemical engineering) and legal
background who isn't a software engineer, has plenty of evening and weekend
time, and wants deep understanding without researcher-level detail.

## The thesis behind this course

Clients don't pay you for knowing how attention heads work. They pay you to:

1. **See where AI fits in their business**, and where it doesn't
2. **Design systems that actually work** in their environment: harnesses,
   workflows, data access, permissions, evals
3. **De-risk adoption**: confidentiality, privilege, compliance, vendor lock-in,
   failure modes
4. **Get it running and adopted** with their IT team, their vendors, and their
   people

So the time split is deliberate:

| Track | Share of time | Why |
|---|---|---|
| A. How LLMs work (fundamentals) | ~15% | Enough to reason from first principles and explain it in plain language to a CIO, and enough to smell nonsense |
| B. The ecosystem (models, vendors, costs) | ~15% | Picking the right tool is half the advice you'll give |
| C. Harness engineering (hands-on) | ~45% | This is where your premium comes from, and where most "AI consultants" are thin |
| D. Advisory craft | ~25% | Turning knowledge into scoped, billable, measurable engagements |

## Files

- [`trail.html`](trail.html): **The Long Winter Trail**, the course as an interactive night-forest web page (published as a claude.ai artifact). Tracks progress through 12 camps, keeps a private journal, and has a fireside guide that quizzes you.
- [`CURRICULUM.md`](CURRICULUM.md): the 12-week plan, week by week, with resources and "done when" checks
- [`LABS.md`](LABS.md): hands-on builds, from your first API call to a client-grade demo harness
- [`ADVISORY-PLAYBOOK.md`](ADVISORY-PLAYBOOK.md): frameworks you'll actually use with clients (discovery, architecture patterns, risk checklist, engagement shapes)
- [`JOURNAL.md`](JOURNAL.md): a running log template. Writing up what you learn doubles as outreach content

## How to use it

- **Pace:** about 12–15 hours/week: 3 weeknight sessions (~1.5h) plus one long
  weekend block (~6–8h) for labs.
- **Rule of thumb:** for every hour of watching or reading, spend an hour
  *building or explaining*. You learn by teaching it back and getting your hands dirty.
- **Use Claude/ChatGPT as your tutor.** After each resource, ask a model to quiz
  you, to explain the part you didn't get with a chemical-engineering analogy,
  or to critique your one-paragraph summary.
- **Start outreach in parallel, in week 1.** Don't wait to "finish learning."
  You're already qualified for the first engagements, and real client problems
  will tell you what to learn next better than any syllabus. The journal entries
  become LinkedIn posts or short memos.

## Build / run

Nothing to build. These are Markdown files. The labs need Python 3.11+, an
Anthropic and/or OpenAI API key, and a code editor (VS Code) with an AI coding
agent (Claude Code, Cursor, or similar). Lab 0 walks through setup.
