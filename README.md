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
- Miss a day and the ladder pauses instead of skipping: the oldest unfinished lesson is carried forward and becomes today's lesson (`CarriedFromDate` on the new row, old row flipped to `Missed`). One lesson per day, so a backlog drains oldest-first. A missed day still breaks the streak and still shows as `missed` on the calendar — the lesson is protected, the metric isn't.
- Completing = answering the lesson's quiz correctly (`POST /api/today/complete`). Wrong answers show the correct one + explanation — resubmit to complete.
- Streak: +1 if yesterday was completed, resets otherwise. Whole bank exhausted → oldest item recycles as review.
- Reminders: Electron polls the API every minute; from `reminderTime` (default 09:00), pending days get a toast every `reminderRepeatHours` (default 2h). Settings via `GET/PUT /api/settings`.

## Udemy sync (v1.7)

Optional, and off until you connect it: **⚙️ Settings → 🎓 Udemy account → Connect Udemy account**. Udemy's own login page opens in its own window — you sign in there, so the app never sees your password — and afterwards 🪜 Course Plan and 🎯 Course show how far you actually are in each course next to the hours you logged by hand.

Udemy publishes no API for personal-account progress (the Affiliate API is public catalog only; the analytics API is Udemy Business), so `electron/udemy.js` calls the same internal endpoint the Udemy web app uses, `api-2.0/users/me/subscribed-courses/`, using the session that login leaves behind. It's undocumented and can break if Udemy changes it — then the card just says "sign in again" and the last synced percentages stay on screen.

- **Only the Electron shell talks to Udemy.** It owns a `persist:udemy` cookie jar of its own, fetches through Chromium's network stack, and POSTs the result to `POST /api/udemy/progress`. No token is stored in the database.
- Courses are matched by URL slug (`/course/<slug>/`); plan courses you aren't enrolled in show `—`.
- It re-syncs on startup and at most every 6 hours, plus **Sync now** in Settings. **Disconnect** wipes the synced rows and the cookie jar.
- **Read-only:** the percentage never unlocks a course, never completes one, and never logs a study session by itself. A course at 100% on Udemy with fewer than its required artifacts still cannot be marked complete.

### ⏱ Log a session, from the sync (v1.8)

A sync also notices which lectures you finished since last time and adds up their durations, so ⏱ Log a session stops being a box you fill in from memory:

```
🎓 Udemy: 47 min of new lectures since 8/15 14:22   [Log it] [×]
```

**Log it** writes the session (note `From Udemy`, marked 🎓 in the list) and it counts toward the 🔥 streak exactly like a typed one — a session is a session. **×** throws the minutes away. Nothing is ever written without that click.

Two honest limits: the number is **content minutes, not wall-clock** (rewatching and pausing don't count; skipping to the end of a lecture counts in full), and if Udemy won't hand over lecture durations the app estimates from the completion percentage instead and labels the suggestion `estimated`. The first sync after connecting only records where you stand — it never proposes your whole backlog as one giant session.

## Rich Egyptian-Arabic explanations (v1.6)

The 🇪🇬 button shows one of two things per lesson:

- **A rich animated page** — a standalone HTML file under `seed/ar-html/`, listed in `seed/ar-html/index.json` by `topic` + `title`, served by `GET /api/items/{id}/ar-html` and rendered in a sandboxed `<iframe>` (`allow-scripts`). Angular's sanitizer would strip the page's `<style>`/`<script>`, hence the iframe. The page reports its own height over `postMessage({type:'lm-ar-height'})` so the frame never scrolls internally, and a "افتح في نافذة" button opens it as its own Electron window.
- **The markdown fallback** — `ExplanationArabic` from `seed/ar/*.json`, for every lesson that doesn't have a page yet.

`RichExplanationService` loads the index once at startup (no DB table, same pattern as `CourseCatalogService`) and `ItemDto.HasArabicHtml` tells the UI which of the two to render. Pages share `seed/ar-html/_shared/lesson.css`, served at `GET /api/ar-html/shared.css`; each page also links it by relative path so it renders when opened straight from disk. To add a lesson: drop an HTML file in the topic folder and add one entry to `index.json` — no code change, no migration.

## Live tech news (v1.3 / v1.3.1)

**v1.3.1:** the curated "Guides" section is now evergreen (topic labels, no version/date chips that go stale), and each technology has an always-current **"📖 Official What's New →"** link to the official docs hub (learn.microsoft.com/dotnet/core/whats-new, blog.angular.dev, etc.).


The **What's New** page now pulls **live posts** from official blog RSS feeds (.NET/C#/EF, Angular, TypeScript, Azure SQL, web.dev) alongside the curated "learn next" guides — so it stays current with the real tech world (e.g. Angular's actual latest release, not a hardcoded version). The API (`LiveFeedService` + `LiveFeedRefreshService`) fetches feeds on startup and every 12h, strips HTML server-side, and caches to `%LocalAppData%\LearnMore\feed-cache.json` so it still works offline (shows last-fetched). Endpoint `GET /api/whatsnew` returns curated `entries` + live `livePosts` per technology.

## Study planner, mind map, tech news (v1.2)

- **🧭 Study Plan** — create plans with a title + date range, add free-text goals (checklist), and mark each day you studied on a calendar. Tracks goal %, studied-day count, study-day streak, and days remaining. (`/plans`)
- **🗺️ Roadmap mind map** — toggle the roadmap between the list ladder and an SVG mind map per topic (center = topic, branches = tiers, leaf dots colored by status with 🎯 weak-spot rings). Preference remembered.
- **📰 What's New** — curated per-technology feed (.NET, C#, Angular, TypeScript, SQL Server, EF Core, Web/CSS) with latest highlights + "learn next" pointers. Content: `seed/whatsnew.json`, refreshed each release.
- **⚙️ Settings** — reminder time, frequency (every 1–4h), notifications on/off.
- **📊 Stats** — lesson streaks and per-topic progress, plus read-only summaries of the 🪜 course ladder (done count, hours logged, artifacts, session streak, Udemy %) and every 🧭 study plan (goals, days studied, days left). Composed from the existing endpoints, so it never becomes a second source of truth.
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
