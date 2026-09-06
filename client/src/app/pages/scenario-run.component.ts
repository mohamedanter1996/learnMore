import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { ApiService } from '../core/api.service';
import { Coverage, ScenarioDetail, ScenarioRun, StageResult, Verdict } from '../core/models';

const VERDICTS: Exclude<Verdict, ''>[] = ['hit', 'partial', 'miss'];

@Component({
  selector: 'app-scenario-run',
  imports: [FormsModule, RouterLink, MarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (detail(); as d) {
      <div class="head">
        <div>
          <h1>{{ d.title }}</h1>
          <p class="text-dim small">
            {{ d.domain }} · {{ d.stageCount }} stages · ~{{ d.estimatedMinutes }} min ·
            <a routerLink="/scenarios">all scenarios</a>
          </p>
        </div>
        @if (run(); as r) {
          <div class="tally">
            <span class="pct">{{ r.percent }}%</span>
            <span class="text-dim small">{{ r.covered }} of {{ r.points }} points covered</span>
          </div>
        }
      </div>

      <!-- The brief. Collapsible, because you re-read it at stage 1 and skim it after. -->
      <div class="card brief" [class.folded]="folded()">
        <button class="fold btn-ghost" (click)="folded.set(!folded())">
          {{ folded() ? '▸ The situation' : '▾ The situation' }}
        </button>
        @if (!folded()) {
          <markdown [data]="d.contextMarkdown" />
          <div class="two-col">
            <div>
              <h4>Who is involved</h4>
              <markdown [data]="d.stakeholdersMarkdown" />
            </div>
            <div>
              <h4>What you are working with</h4>
              <markdown [data]="d.constraintsMarkdown" />
            </div>
          </div>
        }
      </div>

      @if (!run()) {
        <div class="card start">
          <p>You will be asked {{ d.stageCount }} questions, one at a time. Answer in your own words —
             what you would actually do, not what sounds good.</p>
          <p class="text-dim small">Nothing is revealed until you answer. That is the point.</p>
          <button class="btn" [disabled]="busy()" (click)="start()">
            {{ busy() ? 'Starting…' : 'Start' }}
          </button>
        </div>
      }

      @for (h of run()?.history ?? []; track h.stageId) {
        <div class="card stage done">
          <div class="stage-head">
            <span class="n">Stage {{ h.order }}</span>
            @if (h.label) { <span class="label">{{ h.label }}</span> }
            @if (h.graded) {
              <span class="badge" [class.good]="pct(h) >= 60" [class.bad]="pct(h) < 40">
                {{ h.covered }}/{{ h.points }} covered
              </span>
            }
          </div>

          <p class="prompt text-dim">{{ h.prompt }}</p>
          <div class="answer"><span class="who">Your answer</span>{{ h.answerText }}</div>

          @if (h.gradeError) {
            <p class="warn">⚠️ {{ h.gradeError }}</p>
            <div class="actions">
              <button class="btn" [disabled]="busy()" (click)="regrade(h.stageId)">Retry grading</button>
            </div>
          }

          @if (h.feedback; as f) {
            @if (f.strengths.length) {
              <ul class="fb good-list">
                @for (s of f.strengths; track s) { <li>{{ s }}</li> }
              </ul>
            }
            @if (f.gaps.length) {
              <ul class="fb gap-list">
                @for (g of f.gaps; track g) { <li>{{ g }}</li> }
              </ul>
            }
            @if (f.seniorMove) {
              <p class="senior"><b>What a senior would have added:</b> {{ f.seniorMove }}</p>
            }
            @if (f.arabicSummary) {
              <p class="arabic" dir="rtl" lang="ar">🇪🇬 {{ f.arabicSummary }}</p>
            }
          }

          <!-- Coverage. Clickable in both directions: this is the self-score UI when there is no
               coach, and the disagree-with-the-coach UI when there is one. -->
          <div class="coverage">
            <div class="cov-head text-dim small">
              {{ h.graded ? 'Click any verdict to overrule it — your call wins.'
                          : 'Score yourself honestly. Nobody sees this but you.' }}
            </div>
            @for (c of h.coverage; track c.rubricPointId) {
              <div class="cov" [class.hit]="verdictOf(h, c) === 'hit'"
                               [class.partial]="verdictOf(h, c) === 'partial'">
                <div class="picker">
                  @for (v of verdicts; track v) {
                    <button type="button" class="v" [class.on]="verdictOf(h, c) === v"
                            [attr.aria-label]="v" [disabled]="busy()"
                            (click)="setVerdict(h, c, v)">{{ mark(v) }}</button>
                  }
                </div>
                <div class="cov-text">
                  <span>{{ c.text }}</span>
                  @if (c.evidence) {
                    <span class="ev text-dim small">“{{ c.evidence }}”</span>
                  }
                  @if (c.quoteUnverified) {
                    <span class="ev warn small">The coach claimed this but could not quote you, so it was marked down.</span>
                  }
                </div>
                <span class="w text-dim small">×{{ c.weight }}</span>
              </div>
            }
            @if (!h.graded) {
              <div class="actions">
                <button class="btn" [disabled]="busy()" (click)="saveSelfScore(h)">
                  {{ busy() ? 'Saving…' : 'Save my score and continue' }}
                </button>
              </div>
            }
          </div>

          @if (h.probeQuestion) {
            <div class="probe">
              <p class="q">👤 {{ h.probeQuestion }}</p>
              @if (h.probeAnswerText) {
                <p class="a">{{ h.probeAnswerText }}</p>
              } @else {
                <textarea rows="3" placeholder="Answer them…" [(ngModel)]="probeDraft"></textarea>
                <button class="btn btn-ghost" [disabled]="busy() || !probeDraft.trim()"
                        (click)="sendProbe(h.stageId)">Reply</button>
              }
            </div>
          }

          @if (h.modelAnswerMarkdown) {
            <details class="model">
              <summary>What a senior would have written</summary>
              <markdown [data]="h.modelAnswerMarkdown" />
            </details>
          }

          @if (h.revealMarkdown) {
            <div class="reveal">
              <span class="reveal-tag">What happens next</span>
              <markdown [data]="h.revealMarkdown" />
            </div>
          }
        </div>
      }

      @if (run(); as r) {
        @if (r.currentStage; as stage) {
          <div class="card stage current">
            <div class="stage-head">
              <span class="n">Stage {{ stage.order }} of {{ r.stageCount }}</span>
              @if (stage.label) { <span class="label">{{ stage.label }}</span> }
            </div>
            <markdown class="prompt-md" [data]="stage.prompt" />
            @if (stage.inputHint) { <p class="hint text-dim small">{{ stage.inputHint }}</p> }

            <textarea rows="10" [readonly]="busy()" [(ngModel)]="draft"
                      (ngModelChange)="saveDraft(r.id, stage.id, $event)"
                      placeholder="What would you actually do?"></textarea>

            <div class="actions">
              <button class="btn" [disabled]="busy() || draft.trim().length < 10"
                      (click)="submit(r.id, stage.id)">
                {{ busy() ? 'Submitting…' : 'Submit answer' }}
              </button>
              @if (r.canFinishEarly) {
                <button class="btn btn-ghost" [disabled]="busy()" (click)="finish(r.id)">
                  Finish here
                </button>
              }
              <span class="text-dim small grow">Nothing is revealed until you answer.</span>
              <button class="btn btn-ghost danger" [disabled]="busy()" (click)="abandon(r.id)">
                Abandon
              </button>
            </div>
          </div>
        } @else if (r.status !== 'inprogress') {
          <div class="card outcome">
            <h3>{{ r.status === 'completed' ? 'Run complete' : 'Run abandoned' }} — {{ r.percent }}%</h3>
            <p class="text-dim">
              You covered {{ r.covered }} of {{ r.points }} rubric points across
              {{ r.history.length }} {{ r.history.length === 1 ? 'stage' : 'stages' }}.
            </p>
            @if (r.skippedStages.length) {
              <p class="text-dim small">
                You did not reach {{ r.skippedStages.length }}
                {{ r.skippedStages.length === 1 ? 'stage' : 'stages' }} — start again any time to take them.
              </p>
            }
            <div class="actions">
              <button class="btn" [disabled]="busy()" (click)="start()">Run it again</button>
              <a class="btn btn-ghost" routerLink="/scenarios">Back to scenarios</a>
            </div>
          </div>
        }
      }

      @if (error(); as e) { <p class="warn">{{ e }}</p> }
    } @else {
      <p class="text-dim">Loading…</p>
    }
  `,
  styles: `
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
    h1 { margin-bottom: 2px; }
    .small { font-size: 12px; }
    .tally { text-align: right; .pct { display: block; font-size: 26px; font-weight: 700; } }
    .brief { margin-bottom: 16px; }
    .fold {
      background: none; border: 0; color: var(--text); font: inherit; font-weight: 600;
      cursor: pointer; padding: 0; margin-bottom: 6px;
    }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 8px;
      h4 { margin: 0 0 4px; font-size: 13px; color: var(--text-dim); text-transform: uppercase;
           letter-spacing: .04em; } }
    .stage { margin-bottom: 14px; }
    .stage-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .n { font-weight: 700; }
    .label { color: var(--text-dim); }
    .badge.good { background: color-mix(in srgb, var(--success) 20%, transparent); color: var(--success); }
    .badge.bad { background: color-mix(in srgb, var(--danger) 20%, transparent); color: var(--danger); }
    .prompt { white-space: pre-wrap; }
    .answer {
      background: var(--surface-2); border-radius: var(--radius); padding: 12px 14px;
      white-space: pre-wrap; margin: 10px 0;
      .who { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
             color: var(--text-dim); margin-bottom: 4px; }
    }
    .fb { margin: 8px 0; padding-left: 20px; li { margin: 2px 0; } }
    .good-list li::marker { content: '✅ '; }
    .gap-list li::marker { content: '⚠️ '; }
    .senior { margin: 8px 0; }
    .arabic { margin: 8px 0; padding: 10px 14px; background: var(--surface-2);
              border-radius: var(--radius); line-height: 1.9; }
    .coverage { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px; }
    .cov-head { margin-bottom: 8px; }
    .cov {
      display: flex; align-items: flex-start; gap: 12px; padding: 7px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
    }
    .cov-text { flex: 1; display: flex; flex-direction: column; }
    .ev { font-style: italic; margin-top: 2px; }
    .picker { display: flex; gap: 3px; }
    .v {
      width: 26px; height: 26px; border-radius: 6px; cursor: pointer; font-size: 13px;
      background: var(--surface-2); color: var(--text-dim); border: 1px solid var(--border);
      &.on { background: var(--primary); color: #08131f; border-color: var(--primary); font-weight: 700; }
      &:disabled { opacity: .5; cursor: default; }
    }
    .w { flex: 0 0 24px; text-align: right; }
    .probe {
      margin-top: 12px; padding: 12px 14px; border-radius: var(--radius);
      background: color-mix(in srgb, var(--warning) 10%, transparent);
      border-left: 3px solid var(--warning);
      .q { margin: 0 0 8px; font-weight: 500; }
      .a { margin: 0; white-space: pre-wrap; }
    }
    .model { margin-top: 12px; summary { cursor: pointer; font-weight: 600; } }
    .reveal {
      margin-top: 14px; padding: 12px 16px; border-radius: var(--radius);
      background: color-mix(in srgb, var(--primary) 10%, transparent);
      border-left: 3px solid var(--primary);
      .reveal-tag { display: block; font-size: 11px; text-transform: uppercase;
                    letter-spacing: .06em; color: var(--primary); margin-bottom: 4px; }
    }
    .current { border-color: var(--primary); }
    .prompt-md { display: block; }
    .hint { margin: 4px 0 0; }
    textarea {
      width: 100%; margin-top: 10px; background: var(--surface-2); color: var(--text);
      border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px;
      font: inherit; resize: vertical;
    }
    .actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; flex-wrap: wrap; }
    .grow { flex: 1; }
    .danger { color: var(--danger); }
    .outcome h3 { margin: 0 0 4px; }
    .warn { color: var(--warning); }
  `
})
export class ScenarioRunComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  readonly verdicts = VERDICTS;

  readonly detail = signal<ScenarioDetail | null>(null);
  readonly run = signal<ScenarioRun | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly folded = signal(false);

  draft = '';
  probeDraft = '';

  private slug = '';

  constructor() {
    this.slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.api.getScenario(this.slug).subscribe(d => {
      this.detail.set(d);
      if (d.activeRun) this.apply(d.activeRun);
    });
  }

  start() {
    this.busy.set(true);
    this.api.startScenario(this.slug).subscribe({
      next: r => this.apply(r),
      error: e => this.fail(e)
    });
  }

  submit(runId: number, stageId: number) {
    const text = this.draft.trim();
    if (this.busy() || text.length < 10) return;
    this.busy.set(true);
    this.api.submitScenarioAnswer(runId, stageId, text).subscribe({
      next: r => { this.clearDraft(runId, stageId); this.draft = ''; this.apply(r); },
      error: e => this.fail(e)
    });
  }

  regrade(stageId: number) {
    const r = this.run();
    if (!r || this.busy()) return;
    this.busy.set(true);
    this.api.regradeScenarioStage(r.id, stageId).subscribe({
      next: x => this.apply(x),
      error: e => this.fail(e)
    });
  }

  sendProbe(stageId: number) {
    const r = this.run();
    if (!r || this.busy() || !this.probeDraft.trim()) return;
    this.busy.set(true);
    this.api.submitScenarioProbe(r.id, stageId, this.probeDraft.trim()).subscribe({
      next: x => { this.probeDraft = ''; this.apply(x); },
      error: e => this.fail(e)
    });
  }

  /** One verdict, changed by hand. Sends only that point — the rest keep whatever they had. */
  setVerdict(stage: StageResult, point: Coverage, verdict: Verdict) {
    const r = this.run();
    if (!r || this.busy() || !verdict) return;

    // Optimistic: a verdict click should feel instant, and the server response replaces it anyway.
    this.local.update(m => ({ ...m, [this.key(stage, point)]: verdict }));

    if (!stage.graded) return; // ungraded stages batch up until "Save my score"

    this.busy.set(true);
    this.api.setScenarioVerdicts(r.id, stage.stageId, [
      { rubricPointId: point.rubricPointId, verdict }
    ]).subscribe({ next: x => this.apply(x), error: e => this.fail(e) });
  }

  /** Commits a self-scored stage: every point, including the ones left untouched. */
  saveSelfScore(stage: StageResult) {
    const r = this.run();
    if (!r || this.busy()) return;
    this.busy.set(true);
    const verdicts = stage.coverage.map(c => ({
      rubricPointId: c.rubricPointId,
      verdict: this.verdictOf(stage, c) || 'miss'
    }));
    this.api.setScenarioVerdicts(r.id, stage.stageId, verdicts).subscribe({
      next: x => this.apply(x),
      error: e => this.fail(e)
    });
  }

  finish(runId: number) {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.finishScenarioRun(runId).subscribe({
      next: r => this.apply(r),
      error: e => this.fail(e)
    });
  }

  abandon(runId: number) {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.abandonScenarioRun(runId).subscribe({
      next: () => this.api.getScenarioRun(runId).subscribe(r => this.apply(r)),
      error: e => this.fail(e)
    });
  }

  // --------------------------------------------------------------- verdicts

  /** Pending clicks that have not been sent yet, keyed by stage and rubric point. */
  private readonly local = signal<Record<string, Verdict>>({});

  private key(stage: StageResult, point: Coverage) {
    return `${stage.stageId}:${point.rubricPointId}`;
  }

  verdictOf(stage: StageResult, point: Coverage): Verdict {
    return this.local()[this.key(stage, point)] ?? point.verdict;
  }

  mark(v: Verdict) {
    return v === 'hit' ? '✓' : v === 'partial' ? '~' : '✕';
  }

  pct(h: StageResult) {
    return h.points === 0 ? 0 : Math.round((100 * h.covered) / h.points);
  }

  // ----------------------------------------------------------------- drafts

  /** An unsent answer is the one thing here that is expensive to lose, so it survives a crash. */
  saveDraft(runId: number, stageId: number, text: string) {
    try { localStorage.setItem(this.draftKey(runId, stageId), text); } catch { /* private mode */ }
  }

  private loadDraft(runId: number, stageId: number) {
    try { return localStorage.getItem(this.draftKey(runId, stageId)) ?? ''; } catch { return ''; }
  }

  private clearDraft(runId: number, stageId: number) {
    try { localStorage.removeItem(this.draftKey(runId, stageId)); } catch { /* private mode */ }
  }

  private draftKey(runId: number, stageId: number) {
    return `learnmore.scenario.draft.${runId}.${stageId}`;
  }

  // ------------------------------------------------------------------ plumbing

  private apply(r: ScenarioRun) {
    this.run.set(r);
    this.local.set({});
    this.error.set(null);
    this.busy.set(false);
    if (r.currentStage) this.draft = this.loadDraft(r.id, r.currentStage.id);
  }

  private fail(e: { error?: { error?: string } }) {
    this.error.set(e?.error?.error ?? 'Something went wrong.');
    this.busy.set(false);
  }
}
