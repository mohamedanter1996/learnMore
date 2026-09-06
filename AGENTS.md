# LearnMore — notes for Codex

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

## Scenarios module (v1.9)

Business situations from a .NET / Angular / SQL Server shop, answered in **free text** and graded
against an authored rubric by Claude, using the user's own API key. Separate from both the
daily-lesson engine and the course ladder: its own tables, endpoints and screens. The daily-lesson
engine is not touched.

Everything else in the app grades a multiple-choice integer. This module grades *judgment* — did
you ask before building, measure before optimizing, name the trade-off, plan the rollback. The
payoff is not the per-run score, it is the skill-tag aggregation across runs.

- Entities (`Models/Entities.cs`): `Scenario`, `ScenarioStage`, `ScenarioRubricPoint`,
  `ScenarioRun`, `ScenarioAnswer`, `ScenarioCoverage`, `CoachSettings`.
  Migrations `AddScenarios` and `AddCoachSettings`.
- Domain logic: `Services/ScenarioService.cs`. Grading: `Services/ScenarioGradingService.cs`.
  Key handling: `Services/CoachService.cs` + `Services/ApiKeyProtector.cs`.
  Endpoints: `/api/scenarios/*` and `/api/coach/*`.
- Screens: `🧠 Scenarios` (`/scenarios`, the list plus the weakness card) and the run screen
  (`/scenarios/:slug`). A `🤖 AI coach` card in `⚙️ Settings` holds the key.
- Content is seeded from `seed/scenarios/*.json` and is never editable from the UI.

### Rules — do not weaken these

1. **The score is computed in C#, never by the model.** The coach reports rubric *coverage only*
   (`hit` / `partial` / `miss` plus a quote). `ScenarioService.Factor` and the sums around it are
   the only place a number is produced. The system prompt tells the model any number it emits is
   discarded, and it is.
2. **A hit must be quotable.** `evidence` has to be a verbatim quote; `ScenarioGradingService`
   normalizes whitespace and case and checks it is really a substring of the answer. A `hit` whose
   quote does not verify is **downgraded to `partial`** and flagged. This is the anti-pushover
   mechanism, and it is mechanical on purpose — prompt wording alone would not hold.
3. **The grader never sees `ModelAnswerMarkdown` or the rubric weights.** The model answer would
   make it match phrasing instead of judging substance; weights would invite it to reason about the
   score it is forbidden to produce.
4. **No API key ⇒ the module still works.** `GradeAsync` returning `null` means "no coach", not an
   error: the answer is stored ungraded and the self-scoring path takes over. Never a dead screen,
   never a nag wall. The app stays usable offline.
5. **The key is never returned, never logged.** DPAPI-encrypted at rest (`ApiKeyProtector`, current
   user, app entropy), stored on its own `CoachSettings` entity — deliberately **not** on
   `AppSettings`, which the settings screen round-trips whole. Endpoints expose only a masked hint.
   No Anthropic exception escapes `CoachService.Describe`: `Program.cs` has no `UseExceptionHandler`,
   so in a dev build anything that escapes is rendered on the developer error page.
6. **At most two coach calls per stage.** The follow-up probe comes back *with* the grade, so asking
   costs nothing; replying to it re-grades once and only once (`ProbeAnswerText` already set is the
   guard). Plus a hard daily cap, `CoachService.DailyLimit` — the API binds localhost with no
   authentication and now fronts a billable endpoint.
7. **No stored cursor and no stored total.** Position is the lowest-`Order` stage without a graded
   answer; the score is a pure function of the coverage rows. Both computed on read, so a flipped
   verdict can never leave a stale total behind.
8. **Your verdict wins.** `ScenarioCoverage` holds `LlmVerdict` and `UserVerdict`; effective is
   `UserVerdict ?? LlmVerdict ?? Miss`. Self-scoring and disagreeing with the coach are the same
   write, so disagreement becomes signal instead of eroding trust in the weakness view.
9. **The answer is yours.** The rubric, the model answer and the reveal are never shown before that
   stage is submitted. Revealing early makes the score a lie.
10. **Model output is data.** It grades the one answer it was asked about. It never unlocks a
    scenario, never edits scenario content, and never writes anywhere else.

### Seeding rule

Keyed by `Slug`, **insert-only for structure**. Display text (title, context, model answer, reveal,
rubric point text) is refreshed in place, matched by `Order` / `SortOrder`. Stages and rubric points
are never added, removed or reordered for a scenario that already exists — a past run has to stay
meaningful against the rubric it was actually graded on. To change a scenario materially, ship it
under a new slug (`invoice-report-timeout-v2`).

### Deliberately out of scope

No editing or authoring scenarios from the UI (change the seed in code), no scenario streak and no
tie into the daily-lesson streak (rule 5 of the course module stays about sessions; the daily streak
stays about lessons), no leaderboards, no sharing or export, no Udemy or GitHub tie-in, and no
second LLM call anywhere in the app — the coach exists to grade a scenario answer and nothing else.
📊 Stats shows read-only summary rows only (runs, average, top three weak tags), composed
client-side from `/api/scenarios` and `/api/scenarios/weaknesses`.
