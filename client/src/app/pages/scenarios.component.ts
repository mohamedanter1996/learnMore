import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ScenarioListRow, WeaknessRow } from '../core/models';
import { skillTagLabel } from '../core/skill-tags';


@Component({
  selector: 'app-scenarios',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>🧠 Scenarios</h1>
    <p class="text-dim intro">
      Real situations from a .NET / Angular / SQL Server shop. You type what you would actually do —
      no multiple choice. Each answer is scored against what a senior engineer would have covered.
    </p>

    @if (weak().length >= 3) {
      <div class="card weak">
        <h3>Where you keep losing points</h3>
        <p class="text-dim small">Across every stage you have answered, including runs you abandoned.</p>
        <div class="bars">
          @for (w of weakest(); track w.tag) {
            <div class="bar-row">
              <span class="tag">{{ label(w.tag) }}</span>
              <span class="track"><span class="fill" [style.width.%]="w.percent"></span></span>
              <span class="pct" [class.bad]="w.percent < 40">{{ w.percent }}%</span>
              <span class="text-dim small seen">{{ w.covered }}/{{ w.seen }}</span>
            </div>
          }
        </div>
      </div>
    }

    <div class="rows">
      @for (s of rows(); track s.id) {
        <a class="card row" [routerLink]="['/scenarios', s.slug]">
          <div class="main">
            <div class="head">
              <span class="title">{{ s.title }}</span>
              @if (s.hasActiveRun) { <span class="badge live">▶ In progress</span> }
            </div>
            <div class="meta text-dim small">
              {{ s.domain }} · {{ difficulty(s.difficulty) }} · {{ s.stageCount }} stages ·
              ~{{ s.estimatedMinutes }} min
              @if (s.runs > 0) { · run {{ s.runs }}× }
            </div>
          </div>
          @if (s.bestPercent !== null) {
            <div class="score">
              <span class="pct">{{ s.bestPercent }}%</span>
              <span class="text-dim small">best</span>
            </div>
          } @else {
            <span class="text-dim small start">Not tried →</span>
          }
        </a>
      } @empty {
        <p class="text-dim">Loading…</p>
      }
    </div>
  `,
  styles: `
    .intro { max-width: 640px; }
    .weak { margin-bottom: 18px; h3 { margin: 0 0 2px; } }
    .small { font-size: 12px; }
    .bars { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    .bar-row { display: flex; align-items: center; gap: 12px; }
    .tag { flex: 0 0 200px; font-size: 13px; }
    .track {
      flex: 1; height: 8px; border-radius: 4px; overflow: hidden;
      background: var(--surface-2);
    }
    .fill { display: block; height: 100%; background: var(--warning); border-radius: 4px; }
    .pct { flex: 0 0 42px; text-align: right; font-weight: 600; font-size: 13px; }
    .pct.bad { color: var(--danger); }
    .seen { flex: 0 0 44px; }
    .rows { display: flex; flex-direction: column; gap: 10px; }
    .row {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 14px 18px; text-decoration: none; color: inherit;
      &:hover { border-color: var(--primary); }
    }
    .head { display: flex; align-items: center; gap: 10px; }
    .title { font-weight: 600; }
    .meta { margin-top: 3px; }
    .badge.live {
      background: color-mix(in srgb, var(--primary) 20%, transparent);
      color: var(--primary);
    }
    .score { text-align: right; .pct { display: block; font-size: 20px; font-weight: 700; } }
    .start { white-space: nowrap; }
  `
})
export class ScenariosComponent {
  private api = inject(ApiService);

  readonly rows = signal<ScenarioListRow[]>([]);
  readonly weak = signal<WeaknessRow[]>([]);

  /** The three habits you cover least often. Sorted worst-first by the API. */
  readonly weakest = computed(() => this.weak().slice(0, 3));

  constructor() {
    this.api.getScenarios().subscribe(r => this.rows.set(r));
    this.api.getScenarioWeaknesses().subscribe(w => this.weak.set(w));
  }

  label(tag: string) {
    return skillTagLabel(tag);
  }

  difficulty(level: number) {
    return level === 1 ? 'Warm-up' : level === 2 ? 'Realistic' : 'Nasty';
  }
}
