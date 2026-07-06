import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { StudyDay, StudyPlanDetail } from '../core/models';

@Component({
  selector: 'app-plan-detail',
  imports: [RouterLink, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/plans" class="back text-dim">← All plans</a>

    @if (plan(); as p) {
      <div class="head">
        <h1>{{ p.title }}</h1>
        <button class="btn btn-ghost del" (click)="remove()">🗑 Delete plan</button>
      </div>
      <p class="text-dim">
        {{ p.startDate | date: 'MMM d' }} – {{ p.endDate | date: 'MMM d, y' }}
      </p>

      <div class="stat-row">
        <div class="card stat">
          <div class="stat-value">{{ goalPct() }}%</div>
          <div class="text-dim">{{ p.goalsDone }}/{{ p.goalsTotal }} goals done</div>
        </div>
        <div class="card stat">
          <div class="stat-value">📆 {{ p.studiedDays }}</div>
          <div class="text-dim">of {{ p.totalDays }} days studied</div>
        </div>
        <div class="card stat">
          <div class="stat-value">🔥 {{ p.studyStreak }}</div>
          <div class="text-dim">study-day streak</div>
        </div>
        <div class="card stat">
          <div class="stat-value">{{ p.daysRemaining }}</div>
          <div class="text-dim">days remaining</div>
        </div>
      </div>

      <div class="cols">
        <div class="card goals">
          <h3>🎯 Goals</h3>
          @for (g of p.goals; track g.id) {
            <div class="goal" [class.done]="g.isDone">
              <label>
                <input type="checkbox" [checked]="g.isDone" (change)="toggleGoal(g.id)" />
                <span>{{ g.text }}</span>
              </label>
              <button class="x" (click)="deleteGoal(g.id)" title="Remove">×</button>
            </div>
          }
          @if (p.goals.length === 0) {
            <p class="text-dim small">No goals yet — add what you want to learn.</p>
          }
          <div class="add-goal">
            <input type="text" placeholder="Add a goal (e.g. Finish Angular signals course)"
                   [(ngModel)]="newGoal" (keyup.enter)="addGoal()" />
            <button class="btn" [disabled]="!newGoal" (click)="addGoal()">Add</button>
          </div>
        </div>

        <div class="card calendar-card">
          <h3>Calendar — click a day you studied</h3>
          <div class="cal">
            @for (d of plan()!.days; track d.date) {
              <button class="day" [class.studied]="d.studied" [class.today]="isToday(d.date)"
                      [title]="d.date" (click)="toggleDay(d.date)">
                {{ dayNum(d.date) }}
              </button>
            }
          </div>
          <div class="legend text-dim">
            <span><i class="day studied"></i> studied</span>
            <span><i class="day today"></i> today</span>
          </div>
        </div>
      </div>
    } @else {
      <p class="text-dim">Loading…</p>
    }
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 12px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      h1 { margin: 0; } }
    .del { padding: 6px 12px; font-size: 13px; }
    .small { font-size: 12px; }

    .stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin: 16px 0; }
    .stat-value { font-size: 24px; font-weight: 700; }

    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
    @media (max-width: 820px) { .cols { grid-template-columns: 1fr; } }

    .goals h3, .calendar-card h3 { margin-top: 0; }
    .goal { display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 6px 0; border-bottom: 1px solid var(--border);
      label { display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;
        input { width: 17px; height: 17px; accent-color: var(--success); } }
      &.done span { text-decoration: line-through; color: var(--text-dim); }
      .x { background: transparent; border: none; color: var(--text-dim); font-size: 20px;
        cursor: pointer; line-height: 1; &:hover { color: var(--danger); } }
    }
    .add-goal { display: flex; gap: 8px; margin-top: 12px;
      input { flex: 1; background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
        border-radius: 8px; padding: 8px 12px; font-size: 14px; } }

    .cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 10px 0; }
    .day {
      aspect-ratio: 1; border: 1px solid var(--border); border-radius: 6px;
      background: var(--surface-2); color: var(--text-dim); cursor: pointer;
      font-size: 12px; display: flex; align-items: center; justify-content: center;
      &:hover { border-color: var(--primary); }
      &.studied { background: var(--success); color: #06281c; font-weight: 700; border-color: var(--success); }
      &.today { outline: 2px solid var(--warning); }
    }
    .legend { display: flex; gap: 16px; font-size: 12px; margin-top: 4px;
      i.day { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 4px; vertical-align: middle;
        &.studied { background: var(--success); }
        &.today { background: var(--surface-2); outline: 2px solid var(--warning); } }
    }
  `
})
export class PlanDetailComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly plan = signal<StudyPlanDetail | null>(null);
  newGoal = '';
  private planId = 0;

  private readonly todayStr = new Date().toISOString().slice(0, 10);

  readonly goalPct = computed(() => {
    const p = this.plan();
    return p && p.goalsTotal ? Math.round((p.goalsDone / p.goalsTotal) * 100) : 0;
  });

  constructor() {
    this.route.paramMap.subscribe(pm => {
      this.planId = Number(pm.get('id'));
      this.load();
    });
  }

  private load() {
    this.api.getPlan(this.planId).subscribe(p => this.plan.set(p));
  }

  isToday(date: string) {
    return date === this.todayStr;
  }

  dayNum(date: string) {
    return Number(date.slice(8, 10));
  }

  addGoal() {
    if (!this.newGoal.trim()) return;
    this.api.addGoal(this.planId, this.newGoal.trim()).subscribe(() => { this.newGoal = ''; this.load(); });
  }

  toggleGoal(goalId: number) {
    this.api.toggleGoal(goalId).subscribe(() => this.load());
  }

  deleteGoal(goalId: number) {
    this.api.deleteGoal(goalId).subscribe(() => this.load());
  }

  toggleDay(date: string) {
    this.api.toggleDay(this.planId, date).subscribe(() => this.load());
  }

  remove() {
    this.api.deletePlan(this.planId).subscribe(() => this.router.navigate(['/plans']));
  }
}
