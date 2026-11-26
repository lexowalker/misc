"""Phase 1 key check: one 1-token call. Prints the model, stop reason and usage.

The key is read from CLAUDE_OPINIONS_API_KEY (or ANTHROPIC_API_KEY). It is never
written to disk.
"""
import os

import anthropic
import yaml

from common import make_client

cfg = yaml.safe_load(open(os.path.join(os.path.dirname(__file__), "config.yaml")))
model = cfg["run_models"][0]

client = make_client(0)
try:
    r = client.messages.create(
        model=model,
        max_tokens=1,
        messages=[{"role": "user", "content": "Hi"}],
    )
except anthropic.AuthenticationError as e:
    raise SystemExit(f"KEY CHECK FAILED (authentication): {e.message}")
except anthropic.APIStatusError as e:
    raise SystemExit(f"KEY CHECK FAILED ({e.status_code}): {e.message}")
except anthropic.APIConnectionError as e:
    raise SystemExit(f"KEY CHECK FAILED (connection): {e}")

price = cfg["models"][model]
cost = (r.usage.input_tokens * price["input"] + r.usage.output_tokens * price["output"]) / 1e6
print(f"OK model={r.model} stop_reason={r.stop_reason} "
      f"in={r.usage.input_tokens} out={r.usage.output_tokens} cost=${cost:.6f}")
