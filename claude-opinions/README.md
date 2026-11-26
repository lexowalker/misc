# Claude's Opinions

Measures how Claude models answer 20 divisive US public questions when forced
to answer yes or no, and charts the result as a diverging bar chart with US
public opinion marked on each row. Refusals are recorded and charted as a
finding. The full spec is in `PLAN.md`.

## Status

Phase 1 (setup). The pipeline scripts (`run.py`, `fetch.py`, `aggregate.py`)
and the chart arrive in later phases.

## Run

```
pip install -r requirements.txt
python check_key.py        # one 1-token call to confirm the key works
```

The API key comes from the environment (`ANTHROPIC_API_KEY`) or the cloud
environment's network secret for `api.anthropic.com`. Never commit it or write
it to a file.

## Layout

- `PLAN.md`: the build plan
- `config.yaml`: models, prices, sample counts, budget
- `check_key.py`: key check
- `data/raw/`: full request and response logs, one JSONL file per batch
- `chart/`: the chart page
