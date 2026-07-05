import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Dashboard</h1>

    @if (today(); as t) {
      <div class="card today-card" [style.border-left]="'4px solid ' + t.item.topicColor">
        <div class="today-info">
          <div class="text-dim">
            Today's lesson · {{ t.date | date: 'EEEE, MMM d' }}
          </div>
          <h2>{{ t.item.topicIcon }} {{ t.item.title }}</h2>
          <div class="meta">
            <span class="badge" [style.background]="t.item.topicColor + '33'" [style.color]="t.item.topicColor">
              {{ t.item.topicName }}
            </span>
            <span class="text-dim">⏱ ~{{ t.item.estimatedMinutes }} min</span>
            <span class="text-dim">{{ '★'.repeat(t.item.difficulty) }}{{ '☆'.repeat(3 - t.item.difficulty) }}</span>
          </div>
        </div>
        <div class="today-action">
          @if (t.status === 'completed') {
            <div class="done-mark">✅ Done for today!</div>
          } @else {
            <a class="btn" routerLink="/today">Start learning →</a>
          }
        </div>
      </div>
    }

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
          <div class="stat-value">📖 {{ s.totalCompleted }}<span class="text-dim">/{{ s.totalItems }}</span></div>
          <div class="text-dim">Lessons completed</div>
        </div>
      </div>

      <div class="card">
        <h3>Last 30 days</h3>
        <div class="calendar">
          @for (day of s.calendar; track day.date) {
            <div class="day" [class]="day.status" [title]="(day.date | date: 'MMM d') + ' — ' + day.status"></div>
          }
        </div>
        <div class="legend text-dim">
          <span><i class="day completed"></i> completed</span>
          <span><i class="day missed"></i> missed</span>
          <span><i class="day pending"></i> pending</span>
        </div>
      </div>
    }
  `,
  styles: `
    .today-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .today-info h2 { margin: 6px 0 10px; }
    .meta { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    .done-mark { font-size: 17px; font-weight: 600; color: var(--success); }

    .stat-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-value { font-size: 26px; font-weight: 700; }

    .calendar {
      display: grid;
      grid-template-columns: repeat(15, 1fr);
      gap: 6px;
      margin: 12px 0;
    }
    .day {
      aspect-ratio: 1;
      border-radius: 4px;
      background: var(--surface-2);
      &.completed { background: var(--success); }
      &.missed { background: var(--danger); opacity: 0.65; }
      &.pending { background: var(--warning); }
    }
    .legend {
      display: flex;
      gap: 18px;
      font-size: 13px;
      i.day { display: inline-block; width: 10px; height: 10px; margin-right: 5px; }
    }
  `
})
export class DashboardComponent {
  private api = inject(ApiService);

  readonly today = toSignal(this.api.getToday());
  readonly stats = toSignal(this.api.getStats());
}
