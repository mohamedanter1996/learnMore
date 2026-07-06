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

## Study planner, mind map, tech news (v1.2)

- **🧭 Study Plan** — create plans with a title + date range, add free-text goals (checklist), and mark each day you studied on a calendar. Tracks goal %, studied-day count, study-day streak, and days remaining. (`/plans`)
- **🗺️ Roadmap mind map** — toggle the roadmap between the list ladder and an SVG mind map per topic (center = topic, branches = tiers, leaf dots colored by status with 🎯 weak-spot rings). Preference remembered.
- **📰 What's New** — curated per-technology feed (.NET, C#, Angular, TypeScript, SQL Server, EF Core, Web/CSS) with latest highlights + "learn next" pointers. Content: `seed/whatsnew.json`, refreshed each release.
- **⚙️ Settings** — reminder time, frequency (every 1–4h), notifications on/off.
- **Richer notifications** — ~30 rotating bilingual (🇪🇬/EN) reminder lines + a morning kickoff and evening streak-saver toast.

## Assessments, roadmap & courses (v1.1)

- **🎓 Assessment** — per-track interview MCQs (~20 each, junior→senior tiers). Scoring: junior tier ≥70% = Junior; + mid ≥60% = Mid; + senior ≥60% = Senior. Wrong answers show explanations and link to the lessons that teach them. Retake any time.
- **🗺️ Roadmap** — each track as a Junior→Mid→Senior ladder with your assessment marker (📍 YOU ARE HERE), completed/today/upcoming lessons, and 🎯 weak-spot flags from your latest assessment misses.
- **📚 Courses** — curated recommendations per topic per level (free, paid 💰, and Arabic 🇪🇬), shown on assessment results. Catalog: `seed/courses.json`.
- **Motivational toasts** — streak milestones (3/7/14/30/60/100+), completion praise, near-track-finish nudges, rotating reminder messages.
- Interview questions live in `seed/interview/*.json` (same idempotent seeding as lessons).

## Auto-update

The installed app checks [GitHub Releases](https://github.com/mohamedanter1996/learnMore/releases) on start and every 4 hours, downloads updates in the background, and installs on quit (or via tray → "Restart to update").

Shipping a new version:

```bash
# 1. bump "version" in package.json    2. commit + push    3.
$env:GH_TOKEN = (gh auth token)
npm run release        # builds everything and publishes the release
```

DB migrations and new seed content apply automatically on the updated app's first launch — user progress is preserved.

> **If `npm run release` fails mid-upload** (electron-builder's GitHub upload occasionally throws `socket hang up` on the ~140MB installer), the exe is still built under `build/installer/`. Recover with:
> ```bash
> npm run publish:assets 1.2.0    # regenerates latest.yml, uploads assets, publishes the release
> ```

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
