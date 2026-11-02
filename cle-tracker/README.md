# cle-tracker

A small dashboard that shows which New York CLE credits are still needed to
finish the two-year newly admitted cycle and reregister.

- `data/certificates.json` – credits by category, transcribed from the Desmarais LLP
  certificates of attendance (April 2024 – July 2025, all 43 certificates).
- `data/requirements.json` – per-year and cycle minimums from the NY newly admitted
  attorney CLE FAQ (3 Ethics, 6 Skills, 7 Practice/LPM/Cyber-General per year;
  at least 1 Cybersecurity credit in the cycle; up to 3 Cyber-Ethics count as Ethics).
- `index.html` – the page source. It runs inside a claude.ai Dashboard artifact
  (it uses the `dash` API and `d3` that the artifact provides), so it isn't a
  standalone page.

## Updating

Add each new certificate as a row in `data/certificates.json` and ask Claude to
re-upload it to the dashboard (or replace the file under Sources in the dashboard).
