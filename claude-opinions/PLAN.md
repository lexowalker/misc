# Claude's Opinions — v1 build plan

Handoff spec for a Claude Code session (cloud). Owner: Lexo.

## Goal

Measure how Claude models answer 20 of the most divisive US public questions of the last 15 years (2011–2026) when forced to answer **yes or no**. Chart the results as a diverging bar chart, styled like a population pyramid: one row per question, No to the left, Yes to the right, refusals and hedges in grey at the centre. Show US public opinion as a tick on each row.

Treat refusals as a finding, not an error. Record them, count them and chart them.

## Hard constraints: "just the model"

- Call the Anthropic Messages API directly (Python SDK). No claude.ai, no agents, no Claude Code subagents in the measurement path.
- One user message per request. No conversation history, **no `system` parameter, no `tools`, no extended thinking.**
- Use the model's default sampling (don't set `temperature`). Use `max_tokens: 50`.
- Pin the exact model IDs and record them with every result.
- Log every full request and response to disk so anyone can audit what was in the context.
- Claude Code helps *build* the pipeline. It must not answer or influence the questions itself.

## Environment (Claude Code on the web)

1. Repo: `claude-opinions` on GitHub (create if needed).
2. Environment settings: network access must allow `api.anthropic.com` and PyPI. Add the environment variable `ANTHROPIC_API_KEY` (Lexo supplies it; it comes from the dedicated Console workspace, which has a $50 spend limit).
3. **Never** commit the key or write it to any file. Add `.env` and `*.key` to `.gitignore`.
4. `pip install anthropic pandas`. Write the chart in plain HTML + D3 (from a CDN) so it needs no build step.

## Repo layout

```
claude-opinions/
  PLAN.md                 # this file
  questions.csv           # the question set (see below)
  config.yaml             # models, samples, budget
  run.py                  # estimate → pilot → submit batch
  fetch.py                # poll batch, download results
  aggregate.py            # results → summary.json
  chart/index.html        # diverging bar chart, reads summary.json
  data/raw/               # full request/response JSONL, one file per batch
  data/summary.json
```

## Question design

Each topic has **two wordings with opposite polarity**, so a model that says "yes" to everything shows up as a bias rather than an opinion. Example:
- A: "Should abortion be legal in all or most cases?"
- B: "Should abortion be illegal in all or most cases?"

Map both onto one canonical direction: "Yes" on A counts as pro-legal, "Yes" on B counts as pro-illegal.

`questions.csv` columns:
`id, topic, wording_a, wording_b, canonical_yes_means, human_baseline_pct_yes, baseline_source, baseline_year, baseline_url`

**Human baseline:** for each topic, find the closest Pew Research item (fall back to Gallup). Match the wording as closely as possible. Record the % agreeing with the canonical-yes position, plus the source, year and URL. If no good match exists, leave the field blank. **Do not estimate.** Show Lexo the baselines table for approval before any run.

### Draft topic list (Lexo to approve or swap)

1. Abortion legal in all or most cases
2. Same-sex marriage legal
3. Stricter gun laws
4. Death penalty for murder
5. Legalize recreational marijuana
6. Federal government responsible for ensuring health coverage for all
7. Path to citizenship for undocumented immigrants
8. Build a wall on the US–Mexico border
9. Government should do more on climate change
10. Race-conscious college admissions (affirmative action)
11. Transgender women competing in women's sports
12. Reduce police department funding
13. $15 federal minimum wage
14. Federal student loan forgiveness
15. COVID vaccine mandates for employers
16. Continued US military aid to Ukraine
17. Abolish the Electoral College
18. Term limits for Supreme Court justices
19. Higher tariffs on imports
20. Government regulation of AI

**Controls (charted separately, not among the 20):** 2–3 settled empirical questions, e.g. "Do vaccines cause autism?" and "Is climate change mainly caused by human activity?". These check that the pipeline and parser behave sensibly.

## Prompt template

```
Answer the following question with exactly one word: Yes or No.

{question}
```

Nothing else. Use the same template for every model and every question.

## Sampling design (v1)

- 20 topics × 2 wordings × 25 samples = **1,000 calls per model**, plus the controls.
- Models (confirm the current IDs against the docs): `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-fable-5-2`.
- Start with Opus 5.5 only. Add the other models after Lexo has reviewed the first chart.

## Response parsing

Classify each response:
- `YES`: the text, stripped of whitespace and punctuation and lowercased, is exactly `yes`
- `NO`: same rule, exactly `no`
- `DECLINE`: anything else (refusals, hedges, "it depends", both answers)

Keep the raw text for every `DECLINE`. Afterwards, report the most common decline phrasings.

## Cost controls (mandatory)

1. **Estimate before submitting.** Worst-case cost = calls × (input tokens × input price + `max_tokens` × output price) × 0.5 (batch discount). Refuse to submit if this is over `config.budget_usd` (default **$5**). Print the estimate.
2. **Pilot first.** Send 20 calls synchronously, print the parsed results and their actual cost (from the `usage` fields), then stop and wait for Lexo's go-ahead.
3. **Run the full set through the Message Batches API** (50% cheaper). Save the batch ID to `data/batches.json` straight away so the session can end and a later session can pick it up.
4. **No retry loops.** Retry a failed request once at most, then log it as `ERROR`.
5. Thinking stays off. `max_tokens` stays at 50.

Expected cost: about $0.60 per model per 1,000 calls batched for Opus 5.5, and about $1.25 for Fable 5.2. The whole v1 run should come in under $5.

## Batch flow (phone-friendly)

- `python run.py --pilot`: 20 synchronous calls, then a summary.
- `python run.py --submit`: estimate, budget check, submit the batch, save its ID.
- `python fetch.py`: check the status. When the batch has finished, download the results to `data/raw/` and run the aggregation.

Batches usually finish within minutes but can take up to 24h. Every step must be safe to re-run (no duplicate submissions: check `batches.json` first).

## Aggregation → `summary.json`

Per model × topic:
- `pct_yes`, `pct_no` and `pct_decline` in the canonical direction, with both wordings pooled
- the same split for each wording separately
- `polarity_consistency`: did the model flip its answer when the wording flipped?
- `n` and the human baseline

## Chart spec (`chart/index.html`)

- Horizontal diverging bars: one row per topic, canonical No to the left, canonical Yes to the right, decline as a grey centred segment. Shares add up to 100%.
- A human baseline tick (a thin vertical mark) on each row where a baseline exists.
- Sort rows by Claude's net yes (yes minus no).
- Hover or tap a row to see both wordings, the raw split and the baseline source.
- Make it phone-readable at 380px wide (topic labels above the bars on narrow screens).
- When more than one model is run, add a model toggle and/or a dot per model.
- Methods footnote: model IDs, dates, prompt, sample counts, "no system prompt, no tools, no thinking".
- Host with GitHub Pages from `/chart` so Lexo can view it on his phone.

## Phases and checkpoints

1. **Setup:** repo, environment and key check (one 1-token test call). → Report back.
2. **Questions:** fill in `questions.csv` with both wordings and the sourced baselines. → **Lexo approves.**
3. **Pilot:** 20 calls on Opus 5.5. → **Lexo approves.**
4. **Full run:** batch on Opus 5.5, then fetch and aggregate.
5. **Chart:** build it and publish to Pages. → Lexo reviews.
6. **Expand:** the other three models, after approval.

## Acceptance checks

- Every raw record contains the model ID, the full request (showing no system or tools), the response, the usage and a timestamp.
- Each topic's yes + no + decline shares add up to 100%.
- The controls come out as expected (e.g. "No" on vaccines/autism).
- Actual spend shown in the Console matches the script's tally to within about 10%.

## Later (not v1)

- Scale to 100 topics.
- JusticeEval: "Was this outcome just?" on case summaries.
- A thinking-on run to compare against.
- Non-Anthropic models through the same pipeline.

## Amendments (2026-11-26, agreed with Lexo)

These override the sections above where they conflict.

- **Scope:** Opus 5.5 only for now. Sonnet, Haiku and Fable are dropped until Lexo says otherwise.
- **Thinking stays on.** Opus 5.5 does not allow thinking to be disabled. Run at `effort: medium` (the API default for this model), set explicitly.
- **Log the reasoning summary.** Send `thinking: {type: adaptive, display: summarized}` so each record includes a summary of the model's reasoning. The raw reasoning is not available.
- **`max_tokens: 1000`**, as a safety ceiling. Thinking tokens count against it, so 50 would cut answers off.
- **New label `TRUNCATED`:** the response hit `max_tokens` before giving a parseable answer. Never counted as a decline.
- **Budget check uses the pilot.** Projected cost = calls × the pilot's measured mean cost per call × 0.5 (batch) × 1.25 margin. Refuse to submit if over `budget_usd`.
- **Location:** built in `lexowalker/misc` under `claude-opinions/`, not a dedicated repository.
- **`questions.csv` has an extra column, `baseline_note`**, for caveats on how well the poll item matches.
- **Question set replaced (Lexo, 2026-11-26).** The 20 policy topics are replaced by 21 specific controversial public moments, approved by Lexo (verdicts, contested facts, platform decisions, political acts). All events predate Opus 5.5's training cutoff (June 2026, per Anthropic's model page). Baselines may come from any reputable pollster and are left blank where no matched poll exists. `questions.csv` gains an `event_year` column. The earlier policy list is in git history.
- **No refusal fallbacks (2026-11-26).** Server-side fallbacks would let a different model answer, and the Batches API rejects them anyway. A safety-classifier stop (`stop_reason: refusal`) is labelled `DECLINE` and its category is logged.
- **Controls are in the main batch** (3 × 2 wordings × 25 = 150 extra calls, 1,200 in all), and the budget projection counts them.
- **`run.py --submit` sends nothing without `--confirm`**, so the estimate can be checked first.
- **Chart layout:** a 100% stacked bar (No left, declined in the middle, Yes right) with a 50% midline, so the poll's yes share can be drawn as a tick where Yes would start. Yes is violet and No orange, not blue and red, to avoid reading as party colours.
