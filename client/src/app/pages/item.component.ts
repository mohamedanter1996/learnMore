import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { MarkdownComponent } from 'ngx-markdown';
import { ApiService } from '../core/api.service';
import { PrefsService } from '../core/prefs.service';

/** Read-only view of a previously completed lesson (answers revealed). */
@Component({
  selector: 'app-item',
  imports: [RouterLink, MarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (item(); as it) {
      <a [routerLink]="['/topics', it.topicId]" class="back text-dim">← {{ it.topicName }}</a>

      <div class="lesson-header">
        <span class="badge" [style.background]="it.topicColor + '33'" [style.color]="it.topicColor">
          {{ it.topicIcon }} {{ it.topicName }}
        </span>
        <span class="text-dim">⏱ ~{{ it.estimatedMinutes }} min · {{ '★'.repeat(it.difficulty) }}</span>
        @if (it.explanationArabic) {
          <button class="btn btn-ghost arabic-toggle" (click)="prefs.toggleArabic()">
            {{ prefs.showArabic() ? 'إخفاء الشرح' : '🇪🇬 اشرح بالمصري' }}
          </button>
        }
      </div>

      <div class="card lesson-body">
        <markdown [data]="it.bodyMarkdown" />
      </div>

      @if (it.explanationArabic && prefs.showArabic()) {
        <div class="card arabic-panel" dir="rtl" lang="ar">
          <h3>🇪🇬 الشرح بالمصري</h3>
          <markdown [data]="it.explanationArabic" />
        </div>
      }

      @if (it.practiceTask) {
        <div class="card block">
          <h3>🛠️ Practice task</h3>
          <p>{{ it.practiceTask }}</p>
        </div>
      }

      @if (it.externalLinks.length > 0) {
        <div class="card block">
          <h3>🔗 Go deeper</h3>
          <ul>
            @for (link of it.externalLinks; track link) {
              <li><a [href]="link" target="_blank" rel="noopener">{{ link }}</a></li>
            }
          </ul>
        </div>
      }

      @if (it.quiz.length > 0) {
        <div class="card block">
          <h3>🧠 Quiz review</h3>
          @for (q of it.quiz; track q.id; let qi = $index) {
            <div class="question">
              <div class="q-text">{{ qi + 1 }}. {{ q.question }}</div>
              @for (opt of q.options; track $index; let oi = $index) {
                <div class="option" [class.correct]="q.correctIndex === oi">
                  {{ q.correctIndex === oi ? '✅' : '▫️' }} {{ opt }}
                </div>
              }
              @if (q.explanation) {
                <div class="explanation">💡 {{ q.explanation }}</div>
              }
            </div>
          }
        </div>
      }
    } @else {
      <p class="text-dim">Loading…</p>
    }
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 12px; }
    .lesson-header { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; flex-wrap: wrap; }
    .arabic-toggle { margin-left: auto; padding: 6px 14px; font-size: 14px; }
    .lesson-body, .block { margin-bottom: 16px; }
    .block h3 { margin-top: 0; }
    .question { margin-bottom: 18px; }
    .q-text { font-weight: 600; margin-bottom: 8px; }
    .option {
      padding: 6px 12px;
      margin-bottom: 4px;
      border: 1px solid var(--border);
      border-radius: 8px;
      &.correct { border-color: var(--success); background: color-mix(in srgb, var(--success) 12%, transparent); }
    }
    .explanation {
      margin-top: 8px;
      padding: 10px 14px;
      background: var(--surface-2);
      border-radius: 8px;
      font-size: 14px;
    }
  `
})
export class ItemComponent {
  private api = inject(ApiService);
  readonly prefs = inject(PrefsService);
  private route = inject(ActivatedRoute);

  readonly item = toSignal(
    this.route.paramMap.pipe(
      map(p => Number(p.get('id'))),
      switchMap(id => this.api.getItem(id))
    )
  );
}
