/**
 * LIVE ODDS FEED — auto-refreshing odds pulled from The Odds API
 * ------------------------------------------------------------------
 * This runs inside Google Sheets (Apps Script), NOT inside Excel.
 * Excel/xlsx files can't run background code — Google Sheets can,
 * via a time-based trigger that fires even when the sheet is closed.
 *
 * WHAT IT DOES
 * Writes one row per (game, bookmaker, selection) into a sheet called
 * "Live Odds Feed", including a Game ID formatted the same way as the
 * "Odds & Value Finder" tab in your workbook (YYYYMMDD-AWY-HOM), so
 * you can pull prices into that tab with a lookup formula.
 *
 * SETUP (one-time)
 * 1. Open your workbook in Google Sheets (File > Import, if it's
 *    still an .xlsx, or just open it if it's already a Google Sheet).
 * 2. Extensions > Apps Script. Delete the placeholder code and paste
 *    this whole file in.
 * 3. Sign up for a free key at https://the-odds-api.com/
 *    (free tier: 500 requests/month — plenty for a few refreshes/day).
 * 4. Paste your key into API_KEY below.
 * 5. Edit SPORTS to the sport keys you want (list of all keys:
 *    https://the-odds-api.com/sports-odds-data/sports-apis.html).
 * 6. Save (the disk icon), then Run > refreshOdds once. The first run
 *    will ask you to authorize the script — that's normal, it's your
 *    own script running in your own sheet.
 * 7. Run > installTrigger once. That schedules automatic refreshes —
 *    the sheet will now update itself throughout the day even if you
 *    never open it.
 * 8. Reload the spreadsheet — you'll see an "Odds Feed" menu for
 *    manual refreshes any time.
 *
 * COST NOTE: each refresh uses 1 API request per sport per market
 * group. On the free tier, refreshing 2 sports every 30 min uses
 * ~2 x 48 = 96 requests/day — that runs out of the monthly 500 quota
 * in about 5 days. Pick REFRESH_MINUTES and SPORTS with your quota in
 * mind, or upgrade the API plan if you want tighter refresh intervals.
 */

// ---------------- CONFIG — edit these ----------------
const API_KEY = 'YOUR_ODDS_API_KEY_HERE';
const SPORTS = ['americanfootball_nfl', 'basketball_nba']; // sport keys to pull
const REGIONS = 'us';
const MARKETS = 'h2h';        // moneyline. Add 'spreads' and/or 'totals' comma-separated if you want those too
const ODDS_FORMAT = 'american';
const REFRESH_MINUTES = 30;   // must be one of: 1, 5, 10, 15, 30
// ------------------------------------------------------

const SHEET_NAME = 'Live Odds Feed';

function refreshOdds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.clearContents();

  const headers = ['Game ID', 'Sport', 'Commence Time (UTC)', 'Away Team', 'Home Team',
                    'Market', 'Bookmaker', 'Selection', 'Odds (American)', 'Last Refreshed'];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length)
       .setFontWeight('bold').setBackground('#1F4E78').setFontColor('#FFFFFF');

  const rows = [];
  const now = new Date();
  let errors = [];

  SPORTS.forEach(function (sportKey) {
    const url = 'https://api.the-odds-api.com/v4/sports/' + sportKey + '/odds/' +
                '?apiKey=' + API_KEY + '&regions=' + REGIONS +
                '&markets=' + MARKETS + '&oddsFormat=' + ODDS_FORMAT;
    let response;
    try {
      response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    } catch (e) {
      errors.push(sportKey + ': ' + e);
      return;
    }
    if (response.getResponseCode() !== 200) {
      errors.push(sportKey + ' (HTTP ' + response.getResponseCode() + '): ' + response.getContentText());
      return;
    }

    const games = JSON.parse(response.getContentText());
    games.forEach(function (game) {
      const gameId = formatGameId(game.commence_time, game.away_team, game.home_team);
      game.bookmakers.forEach(function (book) {
        book.markets.forEach(function (market) {
          market.outcomes.forEach(function (outcome) {
            rows.push([
              gameId, sportKey, game.commence_time, game.away_team, game.home_team,
              market.key, book.title, outcome.name, outcome.price, now
            ]);
          });
        });
      });
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.autoResizeColumns(1, headers.length);

  if (errors.length > 0) {
    sheet.getRange(rows.length + 3, 1).setValue('Errors on last refresh:');
    errors.forEach(function (err, i) {
      sheet.getRange(rows.length + 4 + i, 1).setValue(err);
    });
  }
}

function formatGameId(commenceTimeIso, awayTeam, homeTeam) {
  const datePart = Utilities.formatDate(new Date(commenceTimeIso), 'UTC', 'yyyyMMdd');
  return datePart + '-' + abbreviate(awayTeam) + '-' + abbreviate(homeTeam);
}

function abbreviate(teamName) {
  // "Kansas City Chiefs" -> "KCC". Crude but consistent — matches fine as a join key.
  return teamName.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase();
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refreshOdds') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshOdds')
    .timeBased()
    .everyMinutes(REFRESH_MINUTES)
    .create();
  SpreadsheetApp.getUi().alert('Auto-refresh installed \u2014 odds will update every ' + REFRESH_MINUTES + ' minutes, even when the sheet is closed.');
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refreshOdds') ScriptApp.deleteTrigger(t);
  });
  SpreadsheetApp.getUi().alert('Auto-refresh removed.');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Odds Feed')
    .addItem('Refresh now', 'refreshOdds')
    .addItem('Install auto-refresh (' + REFRESH_MINUTES + ' min)', 'installTrigger')
    .addItem('Remove auto-refresh', 'removeTrigger')
    .addToUi();
}
