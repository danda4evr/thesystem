"""
fetch_odds.py
-------------
Pulls current odds from The Odds API and writes them to data/live_odds.csv.
Designed to be run by the GitHub Actions workflow in
.github/workflows/refresh-odds.yml on a recurring schedule, so the CSV
in the repo is always close to current.

Game ID format matches the "Odds & Value Finder" tab in the betting
workbook: YYYYMMDD-AWY-HOM (date + 3-letter team abbreviations).

Requires the ODDS_API_KEY environment variable to be set (the GitHub
Actions workflow supplies this from a repo secret — see README.md).
"""

import os
import csv
import sys
import json
import urllib.request
from datetime import datetime, timezone

# ---------------- CONFIG — edit these ----------------
SPORTS = ["americanfootball_nfl", "basketball_nba"]   # sport keys to pull
REGIONS = "us"
MARKETS = "h2h"          # moneyline. Add "spreads" and/or "totals" comma-separated for more
ODDS_FORMAT = "american"
OUTPUT_PATH = "data/live_odds.csv"
# ------------------------------------------------------

API_KEY = os.environ.get("ODDS_API_KEY")


def abbreviate(team_name: str) -> str:
    """'Kansas City Chiefs' -> 'KCC'. Crude but consistent, used as a join key."""
    return "".join(word[0] for word in team_name.split()).upper()


def game_id(commence_time_iso: str, away_team: str, home_team: str) -> str:
    dt = datetime.fromisoformat(commence_time_iso.replace("Z", "+00:00"))
    return f"{dt.strftime('%Y%m%d')}-{abbreviate(away_team)}-{abbreviate(home_team)}"


def fetch_sport(sport_key: str):
    url = (
        f"https://api.the-odds-api.com/v4/sports/{sport_key}/odds/"
        f"?apiKey={API_KEY}&regions={REGIONS}&markets={MARKETS}&oddsFormat={ODDS_FORMAT}"
    )
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode())


def main():
    if not API_KEY:
        print("ERROR: ODDS_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    rows = []
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    for sport_key in SPORTS:
        try:
            games = fetch_sport(sport_key)
        except Exception as exc:  # network hiccup or bad response for one sport shouldn't kill the whole run
            print(f"WARNING: failed to fetch {sport_key}: {exc}", file=sys.stderr)
            continue

        for game in games:
            gid = game_id(game["commence_time"], game["away_team"], game["home_team"])
            for book in game.get("bookmakers", []):
                for market in book.get("markets", []):
                    for outcome in market.get("outcomes", []):
                        rows.append([
                            gid,
                            sport_key,
                            game["commence_time"],
                            game["away_team"],
                            game["home_team"],
                            market["key"],
                            book["title"],
                            outcome["name"],
                            outcome["price"],
                            now,
                        ])

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Game ID", "Sport", "Commence Time (UTC)", "Away Team", "Home Team",
            "Market", "Bookmaker", "Selection", "Odds (American)", "Last Refreshed (UTC)",
        ])
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
