import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-stats',
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
  `,
  styles: `
    .stat-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-value { font-size: 26px; font-weight: 700; }

    .topic-row {
      display: grid;
      grid-template-columns: 240px 1fr 60px;
      align-items: center;
      gap: 14px;
      margin-bottom: 14px;
    }
    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .progress {
      height: 8px;
      border-radius: 4px;
      background: var(--surface-2);
      overflow: hidden;
    }
    .bar { height: 100%; border-radius: 4px; }
    .count { text-align: right; }
  `
})
export class StatsComponent {
  private api = inject(ApiService);
  readonly stats = toSignal(this.api.getStats());
}
