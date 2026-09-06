import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { DesktopService } from '../core/desktop.service';
import { AppSettings, CoachStatus, UdemyStatus } from '../core/models';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>⚙️ Settings</h1>

    @if (settings(); as s) {
      <div class="card form">
        <label class="row">
          <span>Enable notifications</span>
          <input type="checkbox" [checked]="s.notificationsEnabled"
                 (change)="patch({ notificationsEnabled: $any($event.target).checked })" />
        </label>

        <label class="row">
          <span>Daily reminder time</span>
          <input type="time" [value]="s.reminderTime"
                 (change)="patch({ reminderTime: $any($event.target).value })" />
        </label>

        <label class="row">
          <span>Remind me every</span>
          <select (change)="patch({ reminderRepeatHours: +$any($event.target).value })">
            <option [value]="1" [selected]="s.reminderRepeatHours === 1">1 hour</option>
            <option [value]="2" [selected]="s.reminderRepeatHours === 2">2 hours</option>
            <option [value]="3" [selected]="s.reminderRepeatHours === 3">3 hours</option>
            <option [value]="4" [selected]="s.reminderRepeatHours === 4">4 hours</option>
          </select>
        </label>

        <p class="text-dim hint">
          Reminders repeat from your chosen time until today's lesson is done. You'll also get a
          morning kickoff and an evening streak-saver nudge — with rotating bilingual encouragement 🇪🇬.
        </p>

        <div class="actions">
          <button class="btn" [disabled]="saving()" (click)="save()">
            {{ saving() ? 'Saving…' : 'Save settings' }}
          </button>
          @if (saved()) { <span class="saved">✅ Saved</span> }
        </div>
      </div>
    } @else {
      <p class="text-dim">Loading…</p>
    }

    <div class="card form udemy">
      <h3>🎓 Udemy account</h3>

      @if (!desktop.isDesktop) {
        <p class="text-dim hint">Open the LearnMore desktop app to connect your Udemy account.</p>
      } @else if (udemy()) {
        @let u = udemy()!;
        @if (u.connected) {
          <div class="row">
            <span>{{ u.account || 'Connected' }}</span>
            <span class="text-dim small">last synced {{ when(u.lastSyncAt) }}</span>
          </div>
          <p class="text-dim hint">
            {{ u.matchedCourses }} of {{ u.totalCourses }} plan courses matched in your enrollments —
            see them on <b>🪜 Course plan</b>.
          </p>
          @if (u.unmatchedCourses.length > 0) {
            <p class="text-dim small">Not found on your Udemy account: {{ u.unmatchedCourses.join(' · ') }}</p>
          }
          @if (u.lastError) {
            <p class="warn">⚠️ {{ u.lastError }}</p>
          }
          <div class="actions">
            <button class="btn" [disabled]="busy() !== null" (click)="syncUdemy()">
              {{ busy() === 'sync' ? 'Syncing…' : '🔄 Sync now' }}
            </button>
            <button class="btn btn-ghost" [disabled]="busy() !== null" (click)="disconnectUdemy()">
              {{ busy() === 'disconnect' ? 'Disconnecting…' : 'Disconnect' }}
            </button>
          </div>
        } @else {
          <p class="text-dim hint">
            Sign in to Udemy once and 🪜 Course plan shows how far you actually are in each course.
            You sign in on Udemy's own page — the app never sees your password, only the session it
            leaves behind. Progress is read-only: it never unlocks or completes a course.
          </p>
          <div class="actions">
            <button class="btn" [disabled]="busy() !== null" (click)="connectUdemy()">
              {{ busy() === 'connect' ? 'Waiting for Udemy…' : 'Connect Udemy account' }}
            </button>
          </div>
        }
      } @else {
        <p class="text-dim">Loading…</p>
      }

      @if (udemyError(); as e) {
        <p class="warn">{{ e }}</p>
      }
    </div>

    <div class="card form coach">
      <h3>🤖 AI coach</h3>

      @if (coach(); as c) {
        @if (c.connected) {
          <div class="row">
            <span>Key stored {{ c.keyHint }}</span>
            <span class="text-dim small">{{ c.callsToday }}/{{ c.dailyLimit }} graded today</span>
          </div>

          <label class="row">
            <span>Grading model</span>
            <select [disabled]="coachBusy()"
                    (change)="setModel($any($event.target).value)">
              @for (m of models; track m.id) {
                <option [value]="m.id" [selected]="c.model === m.id">{{ m.label }}</option>
              }
            </select>
          </label>

          @if (c.lastError) { <p class="warn">⚠️ {{ c.lastError }}</p> }

          <div class="actions">
            <button class="btn btn-ghost" [disabled]="coachBusy()" (click)="disconnectCoach()">
              {{ coachBusy() ? 'Working…' : 'Remove key' }}
            </button>
          </div>
        } @else {
          <p class="text-dim hint">
            Paste an Anthropic API key and 🧠 Scenarios will grade what you write, push back when
            you hand-wave, and show what a senior would have added. Without a key the scenarios
            still work — you score yourself against the same rubric.
          </p>
          <input type="password" placeholder="sk-ant-…" autocomplete="off"
                 [disabled]="coachBusy()" [(ngModel)]="keyInput" />
          <div class="actions">
            <button class="btn" [disabled]="coachBusy() || keyInput.trim().length < 20"
                    (click)="saveKey()">
              {{ coachBusy() ? 'Checking…' : 'Check and save' }}
            </button>
          </div>
          @if (coachError(); as e) { <p class="warn">{{ e }}</p> }
          <p class="text-dim small">
            The key is encrypted with your Windows account before it is stored, and no screen or
            endpoint ever shows it again. That protects a copied database file — it does not
            protect against software already running as you. Roughly $0.03 per graded answer.
          </p>
        }
      } @else {
        <p class="text-dim">Loading…</p>
      }
    </div>
  `,
  styles: `
    .form { max-width: 460px; display: flex; flex-direction: column; gap: 16px; }
    .udemy, .coach { margin-top: 18px; gap: 12px; h3 { margin: 0; } }
    .coach input[type="password"] {
      background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
      border-radius: 8px; padding: 8px 12px; font: inherit;
    }
    .warn { color: var(--warning); font-size: 13px; margin: 0; }
    .small { font-size: 12px; }
    .row {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      span { font-weight: 500; }
      input[type="time"], select {
        background: var(--surface-2); color: var(--text);
        border: 1px solid var(--border); border-radius: 8px; padding: 7px 12px; font-size: 14px;
      }
      input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--primary); }
    }
    .hint { font-size: 13px; margin: 0; }
    .actions { display: flex; align-items: center; gap: 14px; }
    .saved { color: var(--success); font-weight: 600; }
  `
})
export class SettingsComponent {
  private api = inject(ApiService);
  readonly desktop = inject(DesktopService);

  readonly settings = signal<AppSettings | null>(null);
  readonly saving = signal(false);
  readonly saved = signal(false);

  readonly udemy = signal<UdemyStatus | null>(null);
  readonly busy = signal<'connect' | 'sync' | 'disconnect' | null>(null);
  readonly udemyError = signal<string | null>(null);

  readonly models = [
    { id: 'claude-opus-5', label: 'Claude Opus 5 — best judgment' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — cheaper' },
    { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — cheapest' }
  ];

  readonly coach = signal<CoachStatus | null>(null);
  readonly coachBusy = signal(false);
  readonly coachError = signal<string | null>(null);
  keyInput = '';

  constructor() {
    this.api.getSettings().subscribe(s => this.settings.set(s));
    this.api.getUdemyStatus().subscribe(u => this.udemy.set(u));
    this.api.getCoachStatus().subscribe(c => this.coach.set(c));
  }

  saveKey() {
    const key = this.keyInput.trim();
    if (this.coachBusy() || key.length < 20) return;
    this.coachBusy.set(true);
    this.coachError.set(null);
    this.api.saveCoachKey(key).subscribe({
      // Cleared the moment it is accepted — it never needs to sit in a component field again.
      next: c => { this.keyInput = ''; this.coach.set(c); this.coachBusy.set(false); },
      error: e => this.coachFail(e)
    });
  }

  disconnectCoach() {
    this.coachBusy.set(true);
    this.api.disconnectCoach().subscribe({
      next: c => { this.coach.set(c); this.coachBusy.set(false); },
      error: e => this.coachFail(e)
    });
  }

  setModel(model: string) {
    this.coachBusy.set(true);
    this.api.saveCoachModel(model).subscribe({
      next: c => { this.coach.set(c); this.coachBusy.set(false); },
      error: e => this.coachFail(e)
    });
  }

  private coachFail(e: { error?: { error?: string } }) {
    this.coachError.set(e?.error?.error ?? 'Something went wrong.');
    this.coachBusy.set(false);
  }

  connectUdemy() {
    this.run('connect', () => this.desktop.connectUdemy());
  }

  syncUdemy() {
    this.run('sync', () => this.desktop.syncUdemy());
  }

  disconnectUdemy() {
    this.run('disconnect', () => this.desktop.disconnectUdemy());
  }

  /** The shell answers with the API's status object, so one call refreshes the card. */
  private run(action: 'connect' | 'sync' | 'disconnect', call: () => Promise<UdemyStatus>) {
    this.busy.set(action);
    this.udemyError.set(null);
    Promise.resolve()
      .then(call)
      .then(status => this.udemy.set(status))
      .catch(err => this.udemyError.set(err?.message ?? 'Udemy request failed.'))
      .finally(() => this.busy.set(null));
  }

  when(iso: string | null) {
    if (!iso) return 'never';
    return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  }

  patch(partial: Partial<AppSettings>) {
    this.settings.update(s => (s ? { ...s, ...partial } : s));
    this.saved.set(false);
  }

  save() {
    const s = this.settings();
    if (!s) return;
    this.saving.set(true);
    this.api.saveSettings(s).subscribe({
      next: () => { this.saving.set(false); this.saved.set(true); },
      error: () => this.saving.set(false)
    });
  }
}
