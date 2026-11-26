# Claude's Opinions

Measures how Claude models answer 21 divisive US public moments when forced
to answer yes or no, and charts the result as a diverging bar chart with US
public opinion marked on each row. Refusals are recorded and charted as a
finding. The full spec is in `PLAN.md` (read its Amendments section).

## Status

Phases 1–2 done (questions and baselines approved 2026-11-26). The whole
pipeline is built and tested offline on synthetic data. **Waiting on Phase 3,
the pilot**, which needs the API key to be visible to the session (see below).

## Run

```
pip install -r requirements.txt
python check_key.py                # one 1-token call to confirm the key works
python run.py --pilot              # 21 synchronous calls, prints results and cost, then stops
python run.py --submit             # budget check from the pilot's measured cost; sends nothing
python run.py --submit --confirm   # submit the batch, save its ID to data/batches.json
python fetch.py                    # check the batch; when finished, download and aggregate
```

Every step is safe to re-run. `--submit` will not resubmit a batch that is
already recorded in `data/batches.json`; `fetch.py` skips batches it has
already downloaded.

The API key comes from the `CLAUDE_OPINIONS_API_KEY` environment variable
(falling back to `ANTHROPIC_API_KEY`). In cloud sessions `ANTHROPIC_API_KEY`
set on the environment does not reach the shell, so use the project's own name
there; a new session picks it up. Network secrets cannot be used for
`api.anthropic.com`. Never commit the key or write it to a file.

## How it works

- Each request is one user message with the prompt from `config.yaml`: no
  system prompt, no tools, no history. Opus 5.5 cannot turn thinking off, so it
  runs at `effort: medium` with a summary of its reasoning logged.
- No refusal fallbacks: a fallback would let a different model answer. A
  safety-classifier stop (`stop_reason: refusal`) counts as `DECLINE`, and its
  category is kept in `refusal_category`.
- Labels: `YES`, `NO`, `DECLINE` (anything else), `TRUNCATED` (hit
  `max_tokens`), `ERROR` (request failed; not retried). Shares are over
  YES + NO + DECLINE.
- `polarity_consistency` is 1 minus the total variation distance between the
  canonical splits of the two wordings: 1.0 means the same answer whichever way
  the question is put; low means the answer follows the wording.

## Layout

- `PLAN.md`: the build plan
- `config.yaml`: models, prices, sample counts, budget
- `questions.csv`, `controls.csv`: the question set and the controls
- `common.py`: request building, parsing, record format
- `check_key.py`, `run.py`, `fetch.py`, `aggregate.py`: the pipeline
- `data/raw/`: pilot logs, the submitted requests and the batch results, as JSONL
  (each record holds the full request, full response, usage, cost and timestamp)
- `data/batches.json`: submitted batches and their status
- `data/summary.json`: aggregated results (copied to `chart/summary.json`)
- `chart/index.html`: the chart page (plain HTML + D3 from cdnjs); open it
  through a web server, not from disk, so it can load `summary.json`

## Open

- Hosting: GitHub Pages can only serve a repository's root or `/docs`, so it
  cannot serve `claude-opinions/chart/` from this repository directly. Options:
  publish the page as a claude.ai artifact, or copy `chart/` to a Pages repo.
