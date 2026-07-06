import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { StudyPlanSummary } from '../core/models';

@Component({
  selector: 'app-plans',
  imports: [RouterLink, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>🧭 Study Plans</h1>
    <p class="text-dim">
      Set your own goals over a time period and track each day you study.
      Great for prepping a course, a certification, or a new skill.
    </p>

    <div class="card new-plan">
      <h3>New plan</h3>
      <div class="fields">
        <input type="text" placeholder="Plan title (e.g. Master EF Core)" [(ngModel)]="title" />
        <label>From <input type="date" [(ngModel)]="start" /></label>
        <label>To <input type="date" [(ngModel)]="end" /></label>
        <button class="btn" [disabled]="!title || !start || !end || creating()" (click)="create()">
          {{ creating() ? 'Creating…' : 'Create plan' }}
        </button>
      </div>
    </div>

    @if (plans().length > 0) {
      <div class="grid">
        @for (p of plans(); track p.id) {
          <a class="card plan" [routerLink]="['/plans', p.id]">
            <div class="plan-head">
              <h3>{{ p.title }}</h3>
              <span class="ring" [style.--pct]="pct(p)">
                {{ p.goalsTotal ? pct(p) : 0 }}%
              </span>
            </div>
            <div class="text-dim small">
              {{ p.startDate | date: 'MMM d' }} – {{ p.endDate | date: 'MMM d, y' }}
            </div>
            <div class="stats">
              <span>✅ {{ p.goalsDone }}/{{ p.goalsTotal }} goals</span>
              <span>📆 {{ p.studiedDays }}/{{ p.totalDays }} days studied</span>
              @if (p.daysRemaining > 0) {
                <span class="text-dim">{{ p.daysRemaining }} days left</span>
              } @else {
                <span class="text-dim">ended</span>
              }
            </div>
          </a>
        }
      </div>
    } @else {
      <p class="text-dim empty">No plans yet — create your first one above.</p>
    }
  `,
  styles: `
    .small { font-size: 12px; }
    .new-plan { margin: 16px 0; }
    .new-plan h3 { margin: 0 0 12px; }
    .fields { display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
      input[type="text"] { flex: 1; min-width: 220px; }
      input { background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
        border-radius: 8px; padding: 8px 12px; font-size: 14px; }
      label { display: flex; gap: 6px; align-items: center; color: var(--text-dim); font-size: 13px; }
    }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .plan { color: var(--text); display: flex; flex-direction: column; gap: 8px;
      &:hover { transform: translateY(-2px); transition: transform 120ms; } }
    .plan-head { display: flex; justify-content: space-between; align-items: center; gap: 10px;
      h3 { margin: 0; } }
    .ring {
      width: 46px; height: 46px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: var(--text);
      background: conic-gradient(var(--primary) calc(var(--pct) * 1%), var(--surface-2) 0);
      position: relative;
      &::after { content: ''; position: absolute; inset: 5px; border-radius: 50%; background: var(--surface); }
      & { z-index: 0; }
      span, & > * { position: relative; z-index: 1; }
    }
    .stats { display: flex; flex-direction: column; gap: 3px; font-size: 13px; }
    .empty { margin-top: 20px; }
  `
})
export class PlansComponent {
  private api = inject(ApiService);

  readonly plans = signal<StudyPlanSummary[]>([]);
  readonly creating = signal(false);

  title = '';
  start = new Date().toISOString().slice(0, 10);
  end = new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10);

  constructor() {
    this.load();
  }

  private load() {
    this.api.getPlans().subscribe(p => this.plans.set(p));
  }

  pct(p: StudyPlanSummary) {
    return p.goalsTotal ? Math.round((p.goalsDone / p.goalsTotal) * 100) : 0;
  }

  create() {
    if (!this.title || !this.start || !this.end) return;
    this.creating.set(true);
    this.api.createPlan(this.title, this.start, this.end).subscribe({
      next: () => { this.creating.set(false); this.title = ''; this.load(); },
      error: () => this.creating.set(false)
    });
  }
}
