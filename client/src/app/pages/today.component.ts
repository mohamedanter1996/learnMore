import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { ApiService } from '../core/api.service';
import { PrefsService } from '../core/prefs.service';
import { CompletionResult, Today } from '../core/models';

@Component({
  selector: 'app-today',
  imports: [MarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (today(); as t) {
      <div class="lesson-header">
        <span class="badge" [style.background]="t.item.topicColor + '33'" [style.color]="t.item.topicColor">
          {{ t.item.topicIcon }} {{ t.item.topicName }}
        </span>
        <span class="text-dim">⏱ ~{{ t.item.estimatedMinutes }} min · {{ '★'.repeat(t.item.difficulty) }}</span>
        @if (t.status === 'completed') {
          <span class="badge done-badge">✅ Completed</span>
        }
        @if (t.item.explanationArabic) {
          <button class="btn btn-ghost arabic-toggle" (click)="prefs.toggleArabic()">
            {{ prefs.showArabic() ? 'إخفاء الشرح' : '🇪🇬 اشرح بالمصري' }}
          </button>
        }
      </div>

      <div class="card lesson-body">
        <markdown [data]="t.item.bodyMarkdown" />
      </div>

      @if (t.item.explanationArabic && prefs.showArabic()) {
        <div class="card arabic-panel" dir="rtl" lang="ar">
          <h3>🇪🇬 الشرح بالمصري</h3>
          <markdown [data]="t.item.explanationArabic" />
        </div>
      }

      @if (t.item.practiceTask) {
        <div class="card practice">
          <h3>🛠️ Practice task</h3>
          <p>{{ t.item.practiceTask }}</p>
        </div>
      }

      @if (t.item.externalLinks.length > 0) {
        <div class="card links">
          <h3>🔗 Go deeper</h3>
          <ul>
            @for (link of t.item.externalLinks; track link) {
              <li><a [href]="link" target="_blank" rel="noopener">{{ link }}</a></li>
            }
          </ul>
        </div>
      }

      @if (t.item.quiz.length > 0) {
        <div class="card quiz">
          <h3>🧠 Quiz — answer to complete today's lesson</h3>

          @for (q of t.item.quiz; track q.id; let qi = $index) {
            <div class="question">
              <div class="q-text">{{ qi + 1 }}. {{ q.question }}</div>
              @for (opt of q.options; track $index; let oi = $index) {
                <label class="option"
                       [class.selected]="answers()[q.id] === oi"
                       [class.correct]="showCorrectness(q.id) && correctIndexFor(q.id) === oi"
                       [class.wrong]="showCorrectness(q.id) && answers()[q.id] === oi && correctIndexFor(q.id) !== oi">
                  <input type="radio"
                         [name]="'q' + q.id"
                         [checked]="answers()[q.id] === oi"
                         [disabled]="t.status === 'completed'"
                         (change)="select(q.id, oi)" />
                  {{ opt }}
                </label>
              }
              @if (explanationFor(q.id); as expl) {
                <div class="explanation">💡 {{ expl }}</div>
              }
            </div>
          }

          @if (t.status !== 'completed') {
            <button class="btn" [disabled]="!allAnswered() || submitting()" (click)="submit()">
              {{ submitting() ? 'Checking…' : 'Submit answers' }}
            </button>
            @if (result() && !result()!.allCorrect) {
              <div class="try-again">Not quite — check the highlighted answers and try again.</div>
            }
          } @else {
            <div class="completed-note">🎉 Lesson complete. Come back tomorrow for the next one!</div>
          }
        </div>
      }
    } @else {
      <p class="text-dim">Loading today's lesson…</p>
    }
  `,
  styles: `
    .lesson-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .done-badge { background: var(--success); color: #06281c; }
    .arabic-toggle { margin-left: auto; padding: 6px 14px; font-size: 14px; }

    .lesson-body, .practice, .links, .quiz { margin-bottom: 16px; }
    .practice h3, .links h3, .quiz h3 { margin-top: 0; }

    .question { margin-bottom: 20px; }
    .q-text { font-weight: 600; margin-bottom: 8px; }

    .option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      margin-bottom: 6px;
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;

      &:hover { background: var(--surface-2); }
      &.selected { border-color: var(--primary); }
      &.correct { border-color: var(--success); background: color-mix(in srgb, var(--success) 12%, transparent); }
      &.wrong { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
    }

    .explanation {
      margin-top: 8px;
      padding: 10px 14px;
      background: var(--surface-2);
      border-radius: 8px;
      font-size: 14px;
    }

    .try-again { margin-top: 12px; color: var(--warning); }
    .completed-note { font-size: 16px; font-weight: 600; color: var(--success); }
  `
})
export class TodayComponent {
  private api = inject(ApiService);
  readonly prefs = inject(PrefsService);

  readonly today = signal<Today | null>(null);
  readonly answers = signal<Record<number, number>>({});
  readonly result = signal<CompletionResult | null>(null);
  readonly submitting = signal(false);

  readonly allAnswered = computed(() => {
    const t = this.today();
    if (!t) return false;
    const a = this.answers();
    return t.item.quiz.every(q => a[q.id] !== undefined);
  });

  constructor() {
    this.load();
  }

  private load() {
    this.api.getToday().subscribe(t => this.today.set(t));
  }

  select(questionId: number, optionIndex: number) {
    this.answers.update(a => ({ ...a, [questionId]: optionIndex }));
  }

  submit() {
    const a = this.answers();
    const payload = Object.entries(a).map(([questionId, selectedIndex]) => ({
      questionId: +questionId,
      selectedIndex
    }));
    this.submitting.set(true);
    this.api.completeToday(payload).subscribe({
      next: r => {
        this.result.set(r);
        this.submitting.set(false);
        if (r.completed) this.load(); // refresh: server now reveals answers + completed state
      },
      error: () => this.submitting.set(false)
    });
  }

  /** Correct index: from submit results while pending, from the item itself once completed. */
  correctIndexFor(questionId: number): number | null {
    const fromItem = this.today()?.item.quiz.find(q => q.id === questionId)?.correctIndex;
    if (fromItem !== null && fromItem !== undefined) return fromItem;
    return this.result()?.results.find(r => r.questionId === questionId)?.correctIndex ?? null;
  }

  showCorrectness(questionId: number): boolean {
    return this.today()?.status === 'completed' || this.result() !== null;
  }

  explanationFor(questionId: number): string | null {
    const fromItem = this.today()?.item.quiz.find(q => q.id === questionId)?.explanation;
    if (fromItem) return fromItem;
    const r = this.result()?.results.find(r => r.questionId === questionId);
    return r && this.result() ? r.explanation : null;
  }
}
