# LearnMore — notes for Claude

Electron shell + Angular 19 (standalone, signals) + ASP.NET Core 8 minimal API + EF Core on SQL Server
LocalDB. One origin in production (the API serves the Angular build from `wwwroot`). See `README.md`
for the daily-lesson engine, seeding, packaging, and release flow.

- API: `api/LearnMore.Api` — endpoints in `Program.cs`, entities in `Models/Entities.cs`,
  one `AppDbContext`, migrations applied on startup, content seeded from `seed/*.json`.
- UI: `client/src/app/pages/*.component.ts` — one standalone component per screen, inline template
  and styles, `ChangeDetectionStrategy.OnPush`, HTTP through `core/api.service.ts`.

## Course Plan module

A fixed ladder of 7 Udemy courses, one active at a time, that answers "what do I open right now?".
Separate from the daily-lesson engine — it has its own tables, endpoints, and screens.

- Entities (`Models/Entities.cs`): `PlanCourse` (named that because `Services.Course` already exists),
  `StudySession`, `Artifact`. Migration `AddCoursePlan`.
- Domain logic: `Services/CoursePlanService.cs`. Endpoints: `/api/course-plan/*`.
- Screens: `🎯 Course` (`/course`, the active course only) and `🪜 Course Plan` (`/course/plan`,
  the read-only ladder). The app still lands on the Dashboard.
- The 7 courses are seeded from code in `SeedService.SeedCoursePlanAsync()` and are seeded once.

### Rules — do not weaken these

1. Exactly one course is `Active`. Enforced in `CoursePlanService` and by a filtered unique index
   (`IX_PlanCourses_Status`, `WHERE [Status] = 1`), not by the UI.
2. "Mark course complete" is blocked until `Artifacts.Count >= RequiredArtifacts` (default 2).
   The block lives in `CompleteActiveAsync`; the button only mirrors it. Tooltip when blocked:
   `Log {n} more artifact(s) first`. **No bypass, no override toggle — this rule is the feature.**
3. Completing a course sets `Status = Done` + `CompletedOn` and activates the next course by `Order`.
4. Course 4 has `IsCheckpoint = true`: completing it activates nothing. The Course screen shows a
   full-screen checkpoint prompt, and only `POST /api/course-plan/continue` unlocks course 5.
5. Streak = consecutive days with at least one session of **10 minutes or more**. Longer sessions
   count the same — the metric is consistency, not volume.
6. Sessions can only be logged against the active course (`LogSessionAsync` rejects otherwise).
7. Udemy is read-only for the ladder: it never unlocks a course and never completes one. It may
   **propose** a session for the active course, never write one — a `StudySession` exists only
   because you clicked. The artifact gate is unaffected by any percentage.

### Udemy sync (v1.7, session suggestions v1.8)

Optional. `⚙️ Settings → 🎓 Udemy account` connects the account; 🪜 Course Plan and 🎯 Course then show
real per-course completion beside the hours you logged by hand.

Udemy publishes no API for personal-account progress, so `electron/udemy.js` reads the internal
endpoint the Udemy web app itself calls (`api-2.0/users/me/subscribed-courses/`), authenticated by
the session you create in Udemy's own login page inside an Electron window. **The shell is the only
component that talks to Udemy** — it owns the `persist:udemy` cookie jar (never `defaultSession`,
which is cleared on version change), fetches through Chromium's stack, and POSTs the result to the
API. No token is ever stored in the DB; the cookie jar is the source of truth for "connected".

- Shell: `electron/udemy.js` + `electron/preload.js` (`window.learnmore`, the only renderer bridge).
  Auto-sync rides the existing minute tick, at most every 6h.
- API: `Services/UdemySyncService.cs`, `/api/udemy/{status,progress,disconnect}`, entity
  `UdemyProgress` (1:1 with `PlanCourse`), connection state on `AppSettings`. Migration `AddUdemyProgress`.
- Matching is by URL slug (`/course/<slug>/`) — plan courses with no enrollment simply report null.
- UI: `core/desktop.service.ts` wraps the bridge; components never touch `window`.

**Session suggestions (v1.8).** A sync also sends, per ladder course, the completed lecture ids and
their total minutes (`asset.length` from the curriculum, cached in `udemy-curriculum.json`).
`UdemySyncService.AccrueSuggestion` diffs that against `UdemyProgress.WatchedMinutesTotal` and parks
the difference in `PendingMinutes`; the ⏱ card offers it as `[Log it] [Dismiss]`. Rules that hold it
together:

- **First sight of a course seeds the baseline silently** — connecting must never propose the whole
  backlog as one session. Same for rows carried over from v1.7 (`WatchedMinutesTotal <= 0`).
- Deltas floor at 0 and the baseline never walks back, so un-completing a lecture can't create credit.
- Pending accrues for the **active** course only, and accepting goes through `LogSessionAsync`, so
  rule 6 and the 1..1440 clamp stay in one place. Totals are sent, not deltas — a re-sync is a no-op.
- When lecture durations aren't available the shell omits them and the API estimates from the
  completion-ratio delta; `IsEstimated` makes the UI say so and the note becomes `From Udemy (estimated)`.
- `StudySession.Source` (`Manual`/`Udemy`) is provenance for display. **No query filters on it** —
  the streak counts both alike (rule 5 unchanged).

### Deliberately out of scope

No editing/reordering/adding/deleting courses from the UI (the plan is fixed — change the seed in
code), no skipping or unlocking ahead, no charts/heatmaps/reports **beyond the read-only summary rows
on the shared 📊 Stats screen** (no time series, no heatmaps, no exports), no reminders or scheduling
for this module, no gamification beyond the single streak number, no GitHub/LinkedIn integration, and
no Udemy write-back (the sync only reads).

📊 Stats composes those rows client-side from the endpoints that already exist — `/api/course-plan`,
`/api/course-plan/now` and `/api/plans` — so `StatsDto` stays about the daily-lesson engine and there
is no second aggregation to keep in step. The screen issues GETs only.
