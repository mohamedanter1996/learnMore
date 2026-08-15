import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { DesktopService } from '../core/desktop.service';
import { AppSettings, UdemyStatus } from '../core/models';

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
  `,
  styles: `
    .form { max-width: 460px; display: flex; flex-direction: column; gap: 16px; }
    .udemy { margin-top: 18px; gap: 12px; h3 { margin: 0; } }
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

  constructor() {
    this.api.getSettings().subscribe(s => this.settings.set(s));
    this.api.getUdemyStatus().subscribe(u => this.udemy.set(u));
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
