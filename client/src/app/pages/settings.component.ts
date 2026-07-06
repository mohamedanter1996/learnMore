import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AppSettings } from '../core/models';

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
          <select [value]="s.reminderRepeatHours"
                  (change)="patch({ reminderRepeatHours: +$any($event.target).value })">
            <option [value]="1">1 hour</option>
            <option [value]="2">2 hours</option>
            <option [value]="3">3 hours</option>
            <option [value]="4">4 hours</option>
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
  `,
  styles: `
    .form { max-width: 460px; display: flex; flex-direction: column; gap: 16px; }
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

  readonly settings = signal<AppSettings | null>(null);
  readonly saving = signal(false);
  readonly saved = signal(false);

  constructor() {
    this.api.getSettings().subscribe(s => this.settings.set(s));
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
