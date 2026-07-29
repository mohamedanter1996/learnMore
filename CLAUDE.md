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

### Deliberately out of scope

No editing/reordering/adding/deleting courses from the UI (the plan is fixed — change the seed in
code), no skipping or unlocking ahead, no charts/heatmaps/reports, no reminders or scheduling for
this module, no gamification beyond the single streak number, no Udemy/GitHub/LinkedIn integration.
