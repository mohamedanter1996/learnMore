import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { CoursePlanRow, StudyPlanSummary } from '../core/models';

@Component({
  selector: 'app-stats',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Stats</h1>

    @if (stats(); as s) {
      <div class="stat-row">
        <div class="card stat">
          <div class="stat-value">🔥 {{ s.currentStreak }}</div>
          <div class="text-dim">Current streak</div>
        </div>
        <div class="card stat">
          <div class="stat-value">🏆 {{ s.longestStreak }}</div>
          <div class="text-dim">Longest streak</div>
        </div>
        <div class="card stat">
          <div class="stat-value">📖 {{ s.totalCompleted }}</div>
          <div class="text-dim">Total completed</div>
        </div>
        <div class="card stat">
          <div class="stat-value">
            {{ s.totalItems ? ((s.totalCompleted / s.totalItems) * 100).toFixed(0) : 0 }}%
          </div>
          <div class="text-dim">Of the whole bank</div>
        </div>
      </div>

      <div class="card">
        <h3>Progress per topic</h3>
        @for (t of s.perTopic; track t.id) {
          <div class="topic-row">
            <span class="name">{{ t.icon }} {{ t.name }}</span>
            <div class="progress">
              <div class="bar" [style.width.%]="t.total ? (t.completed / t.total) * 100 : 0"
                   [style.background]="t.color"></div>
            </div>
            <span class="count text-dim">{{ t.completed }}/{{ t.total }}</span>
          </div>
        }
      </div>
    }

    <!-- The course ladder and the study plans keep their own screens; this is a read-only
         summary of what they already report, never a second place to change them. -->
    @if (plan().length > 0) {
      <div class="card">
        <h3>🪜 Course plan</h3>
        <div class="strip text-dim">
          <span><b>{{ coursesDone() }} / {{ plan().length }}</b> done</span>
          <span><b>{{ totalCourseHours() }}h</b> logged</span>
          <span>🧱 <b>{{ totalArtifacts() }}</b> artifacts</span>
          @if (hasSessions()) {
            <span>🔥 <b>{{ courseStreak() }}</b> day session streak</span>
          } @else {
            <span>No sessions logged yet</span>
          }
        </div>

        @if (courseState() === 'checkpoint') {
          <p class="note">🛑 Checkpoint — waiting for you to continue.</p>
        } @else if (courseState() === 'finished') {
          <p class="note">🏁 All 7 courses done.</p>
        }

        @for (c of plan(); track c.id) {
          <div class="course-row" [class.locked]="c.status === 'locked'">
            <span class="name">{{ c.order }}. {{ c.title }}</span>
            <div class="progress" [title]="c.hoursLogged + ' of ' + c.estimatedHours + ' estimated hours'">
              <div class="bar" [style.width.%]="pct(c.hoursLogged, c.estimatedHours)"></div>
            </div>
            <span class="count text-dim">{{ c.hoursLogged }}/{{ c.estimatedHours }}h</span>
            <span class="count text-dim" title="Artifacts required to complete the course">
              🧱 {{ c.artifactCount }}/{{ c.requiredArtifacts }}
            </span>
            <span class="count text-dim" [title]="c.udemySyncedAt ? 'Synced ' + when(c.udemySyncedAt) : 'Not synced from Udemy'">
              🎓 {{ c.udemyPercent === null ? '—' : round(c.udemyPercent) + '%' }}
            </span>
            <span class="badge" [class]="'st-' + c.status">{{ label(c.status) }}</span>
          </div>
        }

        <a class="more text-dim" routerLink="/course/plan">Open the full ladder →</a>
      </div>
    }

    <div class="card">
      <h3>🧭 Study plans</h3>

      @if (plans().length === 0) {
        <p class="text-dim">
          No study plans yet — <a routerLink="/plans">create one on 🧭 Study Plan</a>.
        </p>
      } @else {
        <div class="strip text-dim">
          <span><b>{{ activePlans().length }}</b> active</span>
          <span>✅ <b>{{ goalsDone() }} / {{ goalsTotal() }}</b> goals</span>
          <span>📅 <b>{{ studiedDays() }}</b> days studied</span>
        </div>

        @for (p of orderedPlans(); track p.id) {
          <div class="plan-row" [class.locked]="p.daysRemaining <= 0">
            <span class="name">
              {{ p.title }}
              <span class="text-dim small">
                {{ p.startDate | date: 'MMM d' }} – {{ p.endDate | date: 'MMM d' }}
              </span>
            </span>
            <div class="progress" title="Goals done">
              <div class="bar goals" [style.width.%]="pct(p.goalsDone, p.goalsTotal)"></div>
            </div>
            <span class="count text-dim">✅ {{ p.goalsDone }}/{{ p.goalsTotal }}</span>
            <div class="progress" title="Days you marked as studied">
              <div class="bar days" [style.width.%]="pct(p.studiedDays, p.totalDays)"></div>
            </div>
            <span class="count text-dim">📅 {{ p.studiedDays }}/{{ p.totalDays }}</span>
            <span class="count text-dim">
              {{ p.daysRemaining > 0 ? p.daysRemaining + 'd left' : 'done' }}
            </span>
          </div>
        }

        <a class="more text-dim" routerLink="/plans">Open study plans →</a>
      }
    </div>
  `,
  styles: `
    .stat-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-value { font-size: 26px; font-weight: 700; }

    .card { margin-bottom: 20px; h3 { margin-top: 0; } }
    .small { font-size: 12px; }

    .topic-row {
      display: grid;
      grid-template-columns: 240px 1fr 60px;
      align-items: center;
      gap: 14px;
      margin-bottom: 14px;
    }
    .course-row {
      display: grid;
      grid-template-columns: minmax(200px, 1fr) 1fr 70px 60px 70px 90px;
      align-items: center;
      gap: 14px;
      margin-bottom: 12px;
    }
    .plan-row {
      display: grid;
      grid-template-columns: minmax(200px, 1fr) 1fr 70px 1fr 70px 70px;
      align-items: center;
      gap: 14px;
      margin-bottom: 12px;
    }
    .course-row.locked, .plan-row.locked { opacity: 0.45; }

    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .progress {
      height: 8px;
      border-radius: 4px;
      background: var(--surface-2);
      overflow: hidden;
    }
    .bar { height: 100%; border-radius: 4px; background: var(--primary); }
    .bar.goals { background: var(--success); }
    .bar.days { background: var(--primary); }
    .count { text-align: right; font-size: 13px; }

    .strip {
      display: flex; flex-wrap: wrap; gap: 20px;
      margin-bottom: 16px; font-size: 13px;
      b { color: var(--text); font-size: 15px; }
    }
    .note { margin: 0 0 14px; color: var(--warning); font-size: 13px; }
    .more { display: inline-block; margin-top: 4px; font-size: 13px; }

    .badge.st-active { background: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary); }
    .badge.st-done { background: color-mix(in srgb, var(--success) 20%, transparent); color: var(--success); }
    .badge.st-locked { background: var(--surface-2); color: var(--text-dim); }
  `
})
export class StatsComponent {
  private api = inject(ApiService);

  readonly stats = toSignal(this.api.getStats());
  readonly plan = toSignal(this.api.getCoursePlan(), { initialValue: [] as CoursePlanRow[] });
  readonly courseNow = toSignal(this.api.getCourseNow());
  readonly plans = toSignal(this.api.getPlans(), { initialValue: [] as StudyPlanSummary[] });

  readonly coursesDone = computed(() => this.plan().filter(c => c.status === 'done').length);
  readonly totalCourseHours = computed(() =>
    Math.round(this.plan().reduce((sum, c) => sum + c.hoursLogged, 0) * 10) / 10);
  readonly totalArtifacts = computed(() => this.plan().reduce((sum, c) => sum + c.artifactCount, 0));
  readonly hasSessions = computed(() => this.totalCourseHours() > 0);
  readonly courseState = computed(() => this.courseNow()?.state ?? null);
  readonly courseStreak = computed(() => this.courseNow()?.course?.streak ?? 0);

  readonly activePlans = computed(() => this.plans().filter(p => p.daysRemaining > 0));
  // Running plans first; finished ones stay visible but dimmed underneath.
  readonly orderedPlans = computed(() => [
    ...this.activePlans(),
    ...this.plans().filter(p => p.daysRemaining <= 0)
  ]);
  readonly goalsDone = computed(() => this.plans().reduce((sum, p) => sum + p.goalsDone, 0));
  readonly goalsTotal = computed(() => this.plans().reduce((sum, p) => sum + p.goalsTotal, 0));
  readonly studiedDays = computed(() => this.plans().reduce((sum, p) => sum + p.studiedDays, 0));

  pct(done: number, total: number) {
    return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  }

  round(percent: number) {
    return Math.round(percent);
  }

  when(iso: string) {
    return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  }

  label(status: CoursePlanRow['status']) {
    return status === 'active' ? '▶ Active' : status === 'done' ? '✅ Done' : '🔒 Locked';
  }
}
