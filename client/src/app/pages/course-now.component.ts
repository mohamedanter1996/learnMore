import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ArtifactType, CourseNow } from '../core/models';

@Component({
  selector: 'app-course-now',
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (checkpoint(); as cp) {
        <div class="checkpoint">
          <div class="checkpoint-inner">
            <div class="checkpoint-icon">🛑</div>
            <h1>Checkpoint</h1>
            <p class="checkpoint-text">{{ cp.message }}</p>
            <p class="text-dim">
              Finished: {{ cp.completedOrder }}. {{ cp.completedTitle }}
            </p>
            <button class="btn big" (click)="continueAfterCheckpoint()">
              Continue to course {{ cp.nextOrder }}
            </button>
            <p class="text-dim small">Next up: {{ cp.nextTitle }}</p>
          </div>
        </div>
    }

    @if (course(); as c) {
        <div class="head">
          <span class="badge course-badge">Course {{ c.order }} of 7</span>
          <a routerLink="/course/plan" class="text-dim small">See the full plan →</a>
        </div>

        <h1 class="title">{{ c.title }}</h1>
        <p class="text-dim instructor">{{ c.instructor }}</p>

        <a class="btn big open" [href]="c.url" target="_blank" rel="noopener">▶ Open the course</a>

        <div class="card">
          <div class="bar"><div class="fill" [style.width.%]="pct(c.hoursLogged, c.estimatedHours)"></div></div>
          <div class="bar-label text-dim">{{ c.hoursLogged }} / {{ c.estimatedHours }}h</div>
        </div>

        <div class="card">
          <h3>⏱ Log a session</h3>
          <div class="fields">
            <label>Minutes <input type="number" min="1" max="1440" [(ngModel)]="minutes" /></label>
            <input class="note" type="text" placeholder="What did you cover? (optional)"
                   [(ngModel)]="note" (keyup.enter)="logSession()" />
            <button class="btn" [disabled]="saving()" (click)="logSession()">Save session</button>
          </div>
          @if (c.recentSessions.length > 0) {
            <ul class="sessions">
              @for (s of c.recentSessions; track s.id) {
                <li>
                  <span class="text-dim">{{ s.date }}</span>
                  <span>{{ s.minutes }} min</span>
                  @if (s.note) { <span class="text-dim">— {{ s.note }}</span> }
                </li>
              }
            </ul>
          }
        </div>

        <div class="card">
          <div class="artifact-head">
            <h3>🧱 Artifacts</h3>
            <span class="badge" [class.met]="c.artifactCount >= c.requiredArtifacts">
              {{ c.artifactCount }} / {{ c.requiredArtifacts }} required
            </span>
          </div>
          <p class="text-dim small">Proof you produced something — an article, a post, a commit.</p>

          @for (a of c.artifacts; track a.id) {
            <div class="artifact">
              <span class="badge type">{{ a.type }}</span>
              @if (a.url) {
                <a [href]="a.url" target="_blank" rel="noopener">{{ a.title }}</a>
              } @else {
                <span>{{ a.title }}</span>
              }
              <button class="x" title="Remove" (click)="deleteArtifact(a.id)">×</button>
            </div>
          }

          <div class="fields add-artifact">
            <select [(ngModel)]="artifactType">
              <option value="Article">Article</option>
              <option value="Post">Post</option>
              <option value="Commit">Commit</option>
              <option value="Other">Other</option>
            </select>
            <input class="note" type="text" placeholder="Title" [(ngModel)]="artifactTitle" />
            <input class="note" type="text" placeholder="URL (optional)" [(ngModel)]="artifactUrl" />
            <button class="btn" [disabled]="!artifactTitle || saving()" (click)="addArtifact()">Add</button>
          </div>
        </div>

        <div class="card streak-card">
          <div class="streak-value">🔥 {{ c.streak }}</div>
          <div class="text-dim">
            day streak — consecutive days with a session of 10 minutes or more
          </div>
        </div>

        <!-- Title sits on the wrapper: a disabled button swallows its own hover,
             and it would otherwise replace the button's accessible name. -->
        <span class="complete-wrap" [title]="c.canComplete ? '' : c.blockedReason">
          <button class="btn big complete" [disabled]="!c.canComplete || saving()" (click)="complete()">
            ✅ Mark course complete
          </button>
        </span>
        @if (!c.canComplete) {
          <p class="text-dim small blocked">{{ c.blockedReason }}</p>
        }
        @if (error(); as e) {
          <p class="error">{{ e }}</p>
        }
    }

    @if (now()?.state === 'finished') {
      <div class="checkpoint">
        <div class="checkpoint-inner">
          <div class="checkpoint-icon">🏁</div>
          <h1>Plan complete</h1>
          <p class="text-dim">All 7 courses are done. Nothing left to open.</p>
          <a class="btn" routerLink="/course/plan">See the plan</a>
        </div>
      </div>
    }

    @if (!now()) {
      <p class="text-dim">Loading…</p>
    }
  `,
  styles: `
    .small { font-size: 12px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .course-badge { background: color-mix(in srgb, var(--primary) 20%, transparent); color: var(--primary); }
    .title { margin: 12px 0 0; }
    .instructor { margin: 2px 0 16px; }

    .card { margin-bottom: 16px; h3 { margin: 0 0 8px; } }

    .btn.big { padding: 14px 26px; font-size: 16px; }
    .open { margin-bottom: 16px; }

    .bar { height: 12px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
    .fill { height: 100%; background: var(--primary); }
    .bar-label { margin-top: 6px; font-size: 13px; }

    .fields { display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
      input, select { background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
        border-radius: 8px; padding: 8px 12px; font-size: 14px; }
      input[type="number"] { width: 80px; }
      .note { flex: 1; min-width: 180px; }
      label { display: flex; gap: 6px; align-items: center; color: var(--text-dim); font-size: 13px; }
    }
    .add-artifact { margin-top: 12px; }

    .sessions { list-style: none; margin: 12px 0 0; padding: 0; font-size: 13px;
      li { display: flex; gap: 8px; padding: 4px 0; border-top: 1px solid var(--border); } }

    .artifact-head { display: flex; align-items: center; justify-content: space-between; gap: 10px;
      h3 { margin: 0; }
      .badge { background: var(--surface-2); color: var(--text-dim); }
      .badge.met { background: color-mix(in srgb, var(--success) 20%, transparent); color: var(--success); } }
    .artifact { display: flex; align-items: center; gap: 10px; padding: 6px 0;
      border-top: 1px solid var(--border);
      .type { background: var(--surface-2); color: var(--text-dim); }
      span:not(.badge), a { flex: 1; }
      .x { background: transparent; border: none; color: var(--text-dim); font-size: 20px;
        cursor: pointer; line-height: 1; &:hover { color: var(--danger); } } }

    .streak-card { display: flex; align-items: center; gap: 14px; }
    .streak-value { font-size: 26px; font-weight: 700; }

    .complete-wrap { display: inline-block; }
    .complete { background: var(--success); color: #06281c; }
    .blocked { margin: 8px 0 0; }
    .error { color: var(--danger); }

    /* Checkpoint / finished take over the screen — nothing else to look at. */
    .checkpoint { display: flex; align-items: center; justify-content: center;
      min-height: calc(100vh - 80px); text-align: center; }
    .checkpoint-inner { max-width: 620px;
      h1 { margin: 8px 0 16px; } }
    .checkpoint-icon { font-size: 46px; }
    .checkpoint-text { font-size: 18px; line-height: 1.7; margin-bottom: 24px; }
  `
})
export class CourseNowComponent {
  private api = inject(ApiService);

  readonly now = signal<CourseNow | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  // The three states are mutually exclusive server-side, so each renders on its own.
  readonly course = computed(() => this.now()?.course ?? null);
  readonly checkpoint = computed(() => this.now()?.checkpoint ?? null);

  minutes = 30;
  note = '';
  artifactType: ArtifactType = 'Article';
  artifactTitle = '';
  artifactUrl = '';

  constructor() {
    this.api.getCourseNow().subscribe(n => this.now.set(n));
  }

  pct(logged: number, estimated: number) {
    return estimated > 0 ? Math.min(100, Math.round((logged / estimated) * 100)) : 0;
  }

  logSession() {
    if (this.saving() || !this.minutes || this.minutes < 1) return;
    this.saving.set(true);
    this.api.logCourseSession(this.minutes, this.note).subscribe({
      next: n => { this.apply(n); this.minutes = 30; this.note = ''; },
      error: e => this.fail(e)
    });
  }

  addArtifact() {
    if (this.saving() || !this.artifactTitle.trim()) return;
    this.saving.set(true);
    this.api.addCourseArtifact(this.artifactType, this.artifactTitle.trim(), this.artifactUrl.trim() || null)
      .subscribe({
        next: n => { this.apply(n); this.artifactTitle = ''; this.artifactUrl = ''; },
        error: e => this.fail(e)
      });
  }

  deleteArtifact(id: number) {
    this.api.deleteCourseArtifact(id).subscribe(() => this.reload());
  }

  complete() {
    this.saving.set(true);
    this.api.completeCourse().subscribe({ next: n => this.apply(n), error: e => this.fail(e) });
  }

  continueAfterCheckpoint() {
    this.saving.set(true);
    this.api.continueAfterCheckpoint().subscribe({ next: n => this.apply(n), error: e => this.fail(e) });
  }

  private reload() {
    this.api.getCourseNow().subscribe(n => this.now.set(n));
  }

  private apply(n: CourseNow) {
    this.now.set(n);
    this.error.set(null);
    this.saving.set(false);
  }

  private fail(e: { error?: { error?: string } }) {
    this.error.set(e?.error?.error ?? 'Something went wrong.');
    this.saving.set(false);
  }
}
