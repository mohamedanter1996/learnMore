import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-assessment',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>🎓 Assessment</h1>
    <p class="text-dim">
      Measure your level per track with interview-style questions.
      Retake any time — your roadmap updates with the latest result.
    </p>

    <div class="grid">
      @for (t of topics(); track t.topicId) {
        <div class="card topic" [style.border-top]="'3px solid ' + t.color">
          <div class="icon">{{ t.icon }}</div>
          <h3>{{ t.name }}</h3>

          @if (t.lastAttempt; as a) {
            <div class="level-badge" [class]="'lvl-' + a.resultLevel">{{ a.levelName }}</div>
            <div class="text-dim small">Assessed {{ a.takenAt | date: 'MMM d, y' }}</div>
            <div class="tiers">
              @for (tier of a.tiers; track tier.level) {
                <div class="tier-row">
                  <span class="tier-name">{{ '★'.repeat(tier.level) }}</span>
                  <div class="bar-track">
                    <div class="bar" [style.width.%]="tier.total ? (tier.correct / tier.total) * 100 : 0"
                         [style.background]="t.color"></div>
                  </div>
                  <span class="text-dim small">{{ tier.correct }}/{{ tier.total }}</span>
                </div>
              }
            </div>
            <a class="btn btn-ghost" [routerLink]="['/assessment', t.topicId]">Retake →</a>
          } @else {
            <p class="text-dim">{{ t.questionCount }} questions · ~15 min</p>
            <a class="btn" [routerLink]="['/assessment', t.topicId]">Start assessment →</a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .topic { display: flex; flex-direction: column; gap: 8px; }
    .icon { font-size: 28px; }
    h3 { margin: 4px 0; }
    .small { font-size: 12px; }

    .level-badge {
      align-self: flex-start;
      padding: 3px 12px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 13px;
      &.lvl-0 { background: #47556933; color: var(--text-dim); }
      &.lvl-1 { background: #38bdf833; color: var(--primary); }
      &.lvl-2 { background: #fbbf2433; color: var(--warning); }
      &.lvl-3 { background: #34d39933; color: var(--success); }
    }

    .tiers { display: flex; flex-direction: column; gap: 6px; margin: 6px 0; }
    .tier-row { display: grid; grid-template-columns: 40px 1fr 44px; align-items: center; gap: 8px; }
    .tier-name { font-size: 12px; color: var(--warning); }
    .bar-track { height: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden; }
    .bar { height: 100%; border-radius: 3px; }
    .btn { margin-top: auto; align-self: flex-start; }
  `
})
export class AssessmentComponent {
  private api = inject(ApiService);
  readonly topics = toSignal(this.api.getAssessmentOverview(), { initialValue: [] });
}
