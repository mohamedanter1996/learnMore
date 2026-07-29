import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { CoursePlanRow } from '../core/models';

@Component({
  selector: 'app-course-plan',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>🪜 Course plan</h1>
    <p class="text-dim">
      Fixed order, one course at a time. Read-only — finishing the active course unlocks the next.
      <a routerLink="/course">Back to the active course →</a>
    </p>

    <div class="rows">
      @for (c of rows(); track c.id) {
        <div class="card row" [class.locked]="c.status === 'locked'" [class.active]="c.status === 'active'">
          <div class="order">{{ c.order }}</div>
          <div class="main">
            <div class="row-head">
              <span class="row-title">{{ c.title }}</span>
              <span class="badge" [class]="'st-' + c.status">{{ label(c.status) }}</span>
              @if (c.isCheckpoint) {
                <span class="badge checkpoint" title="Pause gate after this course">🛑 Checkpoint</span>
              }
            </div>
            <div class="text-dim small">{{ c.instructor }}</div>
            <div class="meta text-dim small">
              <span>{{ c.hoursLogged }} / {{ c.estimatedHours }}h</span>
              <span>🧱 {{ c.artifactCount }} / {{ c.requiredArtifacts }} artifacts</span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .small { font-size: 12px; }
    .rows { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }

    .row { display: flex; gap: 14px; align-items: flex-start; padding: 14px 18px; }
    .row.locked { opacity: 0.45; }
    .row.active { border-color: var(--primary); }

    .order { width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%;
      background: var(--surface-2); color: var(--text-dim);
      display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
    .main { flex: 1; }
    .row-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .row-title { font-weight: 600; }
    .meta { display: flex; gap: 16px; margin-top: 4px; }

    .badge.st-active { background: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary); }
    .badge.st-done { background: color-mix(in srgb, var(--success) 20%, transparent); color: var(--success); }
    .badge.st-locked { background: var(--surface-2); color: var(--text-dim); }
    .badge.checkpoint { background: color-mix(in srgb, var(--warning) 20%, transparent); color: var(--warning); }
  `
})
export class CoursePlanComponent {
  private api = inject(ApiService);

  readonly rows = signal<CoursePlanRow[]>([]);

  constructor() {
    this.api.getCoursePlan().subscribe(r => this.rows.set(r));
  }

  label(status: CoursePlanRow['status']) {
    return status === 'active' ? '▶ Active' : status === 'done' ? '✅ Done' : '🔒 Locked';
  }
}
