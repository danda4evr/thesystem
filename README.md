# Live Odds Feed — GitHub Actions setup

This runs `fetch_odds.py` on a schedule in GitHub's cloud, writing fresh odds
to `data/live_odds.csv` in your repo. Your computer doesn't need to be on.

## One-time setup

1. **Create a repo.** On GitHub, click New Repository. Public is simplest
   (private works too, see the note at the bottom).
2. **Add the files.** Upload `fetch_odds.py` to the repo root, and
   `refresh-odds.yml` into a folder called `.github/workflows/` (GitHub's UI
   lets you type that folder path when adding a file).
3. **Get a free odds API key** at https://the-odds-api.com/ (500
   requests/month free).
4. **Add it as a secret.** In your repo: Settings → Secrets and variables →
   Actions → New repository secret. Name it `ODDS_API_KEY`, paste your key
   as the value.
5. **Enable Actions.** Go to the Actions tab — GitHub may ask you to confirm
   you want workflows to run on this repo; click to enable.
6. **Test it.** Actions tab → "Refresh Live Odds" → "Run workflow" → Run.
   After ~30 seconds, check that `data/live_odds.csv` appeared with rows in
   it.

That's it — after this, it refreshes itself roughly every 30 minutes,
forever, with no further action from you.

## Getting the data into your Excel workbook

Your repo's raw CSV is reachable at a stable URL:

```
https://raw.githubusercontent.com/<your-username>/<your-repo>/main/data/live_odds.csv
```

In Excel: **Data → Get Data → From Web**, paste that URL, and Excel will
load it as a query you can refresh anytime (Data → Refresh All). To make
*that* refresh itself unattended too, you're back to needing something to
open Excel and hit refresh on a timer (Task Scheduler + a small macro, or
Power Automate Desktop) — happy to write that next if you want it.

## If you'd rather keep the repo private

Private repos can't be fetched anonymously via the raw URL above. Either
keep the repo public (the odds data itself isn't sensitive — it's not your
personal bets, just market prices), or let me know and I can adjust the
workflow to also push the CSV somewhere Excel can read without exposing the
whole repo.

## Adjusting what it pulls

Edit the top of `fetch_odds.py`:
- `SPORTS` — list of sport keys (full list:
  https://the-odds-api.com/sports-odds-data/sports-apis.html)
- `MARKETS` — add `"spreads"` and/or `"totals"` (comma-separated) alongside
  `"h2h"` if you want those markets too
