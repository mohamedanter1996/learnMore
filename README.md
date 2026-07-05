# LearnMore — Daily Tech-Skill Trainer

Windows desktop app that assigns you **one new lesson every day** across five tracks and nags you until it's done:

- 🧮 Data Structures & Algorithms
- 🏗️ Design Patterns
- 🗄️ SQL Server Optimization
- 🌐 System Design
- 🎨 Frontend Engineering

~150 built-in lessons (markdown + quiz + practice task + links), seeded into SQL Server LocalDB. Complete the quiz to finish the day and keep your streak. The app starts with Windows, lives in the tray, and sends toast reminders until today's lesson is done.

## Stack

| Layer | Tech |
|---|---|
| Shell | Electron (tray, notifications, auto-start) |
| UI | Angular 19 (standalone, signals, ngx-markdown) |
| API | ASP.NET Core 8 minimal API + EF Core |
| DB | SQL Server LocalDB (`(localdb)\MSSQLLocalDB`, database `LearnMore`) |

Electron spawns the API as a child process (`http://localhost:5199`). In production the API also serves the Angular build from `wwwroot`, so everything is one origin.

## Development

Prereqs: .NET 8+ SDK, Node 20+, SQL Server LocalDB.

```bash
npm install                # root (electron toolchain)
npm install --prefix client
npm run dev                # starts API + ng serve + electron together
```

- API: http://localhost:5199 (creates + seeds the DB on first start)
- UI dev server: http://localhost:4200

## Packaging (installer)

```bash
npm run package
```

Builds Angular (prod), publishes the API self-contained (win-x64, single file), copies the UI into the API's `wwwroot`, and produces an NSIS installer under `build/installer/`.

## How the daily engine works

- `GET /api/today` creates today's assignment if missing: topics rotate round-robin (least recently assigned first), items unlock easiest-difficulty-first within the topic.
- Completing = answering the lesson's quiz correctly (`POST /api/today/complete`). Wrong answers show the correct one + explanation — resubmit to complete.
- Streak: +1 if yesterday was completed, resets otherwise. Whole bank exhausted → oldest item recycles as review.
- Reminders: Electron polls the API every minute; from `reminderTime` (default 09:00), pending days get a toast every `reminderRepeatHours` (default 2h). Settings via `GET/PUT /api/settings`.

## Arabic explanations (الشرح بالمصري)

Every lesson ships with a condensed Egyptian-Arabic explanation. On the lesson page, click **"🇪🇬 اشرح بالمصري"** to show it below the English lesson (RTL panel; code samples stay LTR). The preference is remembered locally.

Arabic content lives in `seed/ar/*.json` — one file per topic, items matched to English lessons by exact `title`:

```json
{
  "topic": "Data Structures & Algorithms",
  "items": [
    { "title": "<exact English title>", "explanationArabic": "markdown بالمصري..." }
  ]
}
```

The seeder applies them on API start and re-applies when the text changes — edit, restart, done.

## Adding content

Drop/extend JSON files in `seed/` (see existing files for the shape: topic → items → quiz). The seeder is idempotent — new titles are added on next API start, existing ones untouched. Locked lessons unlock only when the daily engine assigns them.

## Practicing SQL on the app itself

The app's own LocalDB database is your playground for the SQL Server Optimization track — many lessons include T-SQL you can run directly against it:

```
sqlcmd -S "(localdb)\MSSQLLocalDB" -d LearnMore
```
