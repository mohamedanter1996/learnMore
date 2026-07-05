import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AssessmentQuestion, AssessmentResult } from '../core/models';

@Component({
  selector: 'app-assessment-exam',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/assessment" class="back text-dim">← Assessments</a>

    @if (!result()) {
      <h1>Assessment</h1>
      @if (questions().length > 0) {
        <p class="text-dim">
          {{ questions().length }} questions · answer everything, then submit.
          Unanswered questions count as wrong.
        </p>
        <div class="progress-line">
          <div class="bar" [style.width.%]="(answeredCount() / questions().length) * 100"></div>
        </div>

        @for (q of questions(); track q.id; let qi = $index) {
          <div class="card question">
            <div class="q-head">
              <span class="q-num">{{ qi + 1 }}</span>
              <span class="tier-tag">{{ '★'.repeat(q.level) }}</span>
            </div>
            <div class="q-text">{{ q.question }}</div>
            @for (opt of q.options; track $index; let oi = $index) {
              <label class="option" [class.selected]="answers()[q.id] === oi">
                <input type="radio" [name]="'q' + q.id"
                       [checked]="answers()[q.id] === oi"
                       (change)="select(q.id, oi)" />
                {{ opt }}
              </label>
            }
          </div>
        }

        <div class="submit-row">
          <span class="text-dim">{{ answeredCount() }} / {{ questions().length }} answered</span>
          <button class="btn" [disabled]="submitting()" (click)="submit()">
            {{ submitting() ? 'Grading…' : 'Submit assessment' }}
          </button>
        </div>
      } @else {
        <p class="text-dim">Loading questions…</p>
      }
    } @else {
      @if (result(); as r) {
        <h1>{{ r.topicName }} — Result</h1>

        <div class="card result-card">
          <div class="level-line">
            Your level: <span class="level-badge" [class]="'lvl-' + r.resultLevel">{{ r.levelName }}</span>
            @if (r.resultLevel < 3) {
              <span class="text-dim">next stop: {{ r.nextLevelName }}</span>
            }
          </div>
          <div class="tiers">
            @for (tier of r.tiers; track tier.level) {
              <div class="tier-row">
                <span class="tier-name">{{ '★'.repeat(tier.level) }} {{ tierName(tier.level) }}</span>
                <div class="bar-track">
                  <div class="bar" [style.width.%]="tier.total ? (tier.correct / tier.total) * 100 : 0"></div>
                </div>
                <span class="text-dim">{{ tier.correct }}/{{ tier.total }}</span>
              </div>
            }
          </div>
        </div>

        @if (r.recommendedCourses.length > 0) {
          <div class="card">
            <h3>📚 To reach {{ r.resultLevel < 3 ? r.nextLevelName : 'mastery' }} — recommended courses</h3>
            <ul class="courses">
              @for (c of r.recommendedCourses; track c.url) {
                <li>
                  <a [href]="c.url" target="_blank" rel="noopener">{{ c.title }}</a>
                  <span class="text-dim"> — {{ c.provider }}</span>
                  @if (c.isPaid) { <span class="tag paid">💰 paid</span> }
                  @if (c.lang === 'ar') { <span class="tag">🇪🇬 عربي</span> }
                </li>
              }
            </ul>
          </div>
        }

        @if (r.wrongAnswers.length > 0) {
          <h3 class="review-h">Review your {{ r.wrongAnswers.length }} misses</h3>
          @for (w of r.wrongAnswers; track w.questionId) {
            <div class="card question">
              <div class="q-text">{{ w.question }}</div>
              @for (opt of w.options; track $index; let oi = $index) {
                <div class="option static"
                     [class.correct]="oi === w.correctIndex"
                     [class.wrong]="oi === w.selectedIndex && oi !== w.correctIndex">
                  {{ oi === w.correctIndex ? '✅' : (oi === w.selectedIndex ? '❌' : '▫️') }} {{ opt }}
                </div>
              }
              <div class="explanation">💡 {{ w.explanation }}</div>
              @if (w.relatedLesson; as lesson) {
                <div class="related">
                  🎯 Study:
                  @if (lesson.status === 'completed') {
                    <a [routerLink]="['/items', lesson.id]">{{ lesson.title }}</a>
                  } @else {
                    <span>{{ lesson.title }}</span>
                    <span class="text-dim">(will arrive as a daily lesson — flagged on your roadmap)</span>
                  }
                </div>
              }
            </div>
          }
        } @else {
          <div class="card"><p>🏆 Perfect score — nothing to review!</p></div>
        }

        <div class="submit-row">
          <a class="btn btn-ghost" routerLink="/roadmap">See your roadmap →</a>
          <a class="btn btn-ghost" routerLink="/assessment">All assessments</a>
        </div>
      }
    }
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 12px; }

    .progress-line {
      position: sticky; top: 0; z-index: 5;
      height: 5px; border-radius: 3px; background: var(--surface-2);
      overflow: hidden; margin-bottom: 16px;
      .bar { height: 100%; background: var(--primary); transition: width 150ms; }
    }

    .question { margin-bottom: 14px; }
    .q-head { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; }
    .q-num {
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--surface-2); display: inline-flex;
      align-items: center; justify-content: center; font-size: 13px; font-weight: 600;
    }
    .tier-tag { color: var(--warning); font-size: 13px; }
    .q-text { font-weight: 600; margin-bottom: 10px; }

    .option {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; margin-bottom: 6px;
      border: 1px solid var(--border); border-radius: 8px; cursor: pointer;
      &:hover:not(.static) { background: var(--surface-2); }
      &.selected { border-color: var(--primary); }
      &.static { cursor: default; }
      &.correct { border-color: var(--success); background: color-mix(in srgb, var(--success) 12%, transparent); }
      &.wrong { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
    }

    .submit-row {
      display: flex; align-items: center; gap: 16px;
      justify-content: flex-end; margin: 20px 0;
    }

    .result-card { margin-bottom: 16px; }
    .level-line { display: flex; align-items: center; gap: 12px; font-size: 17px; margin-bottom: 14px; }
    .level-badge {
      padding: 4px 16px; border-radius: 999px; font-weight: 700;
      &.lvl-0 { background: #47556933; color: var(--text-dim); }
      &.lvl-1 { background: #38bdf833; color: var(--primary); }
      &.lvl-2 { background: #fbbf2433; color: var(--warning); }
      &.lvl-3 { background: #34d39933; color: var(--success); }
    }
    .tiers { display: flex; flex-direction: column; gap: 8px; }
    .tier-row { display: grid; grid-template-columns: 120px 1fr 50px; align-items: center; gap: 10px; }
    .tier-name { font-size: 13px; }
    .bar-track { height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
    .bar { height: 100%; border-radius: 4px; background: var(--primary); }

    .courses { margin: 8px 0 0; padding-left: 18px; li { margin-bottom: 8px; } }
    .tag {
      font-size: 11px; padding: 1px 8px; border-radius: 999px;
      background: var(--surface-2); margin-left: 6px;
      &.paid { color: var(--warning); }
    }

    .review-h { margin: 24px 0 12px; }
    .explanation { margin-top: 8px; padding: 10px 14px; background: var(--surface-2); border-radius: 8px; font-size: 14px; }
    .related { margin-top: 8px; font-size: 14px; }
  `
})
export class AssessmentExamComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  readonly questions = signal<AssessmentQuestion[]>([]);
  readonly answers = signal<Record<number, number>>({});
  readonly result = signal<AssessmentResult | null>(null);
  readonly submitting = signal(false);

  readonly answeredCount = computed(() => Object.keys(this.answers()).length);

  private topicId = 0;

  constructor() {
    this.route.paramMap.subscribe(p => {
      this.topicId = Number(p.get('id'));
      this.result.set(null);
      this.answers.set({});
      this.api.getAssessmentQuestions(this.topicId).subscribe(q => this.questions.set(q));
    });
  }

  tierName(level: number) {
    return ['', 'Junior', 'Mid-Level', 'Senior'][level] ?? '';
  }

  select(questionId: number, optionIndex: number) {
    this.answers.update(a => ({ ...a, [questionId]: optionIndex }));
  }

  submit() {
    const payload = Object.entries(this.answers()).map(([questionId, selectedIndex]) => ({
      questionId: +questionId,
      selectedIndex
    }));
    this.submitting.set(true);
    this.api.submitAssessment(this.topicId, payload).subscribe({
      next: r => {
        this.result.set(r);
        this.submitting.set(false);
        window.scrollTo({ top: 0 });
      },
      error: () => this.submitting.set(false)
    });
  }
}
