import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { RoadmapTopic } from '../core/models';

@Component({
  selector: 'app-roadmap',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>🗺️ Roadmap</h1>
    <p class="text-dim">
      Each track climbs Junior → Mid → Senior. Take an <a routerLink="/assessment">assessment</a>
      to place your marker and flag weak spots 🎯.
    </p>

    @for (t of topics(); track t.topicId) {
      <div class="card track" [style.border-left]="'4px solid ' + t.color">
        <div class="track-head">
          <h2>{{ t.icon }} {{ t.name }}</h2>
          @if (t.assessmentLevelName) {
            <span class="level-badge" [class]="'lvl-' + t.assessmentLevel">
              {{ t.assessmentLevelName }}
            </span>
            <span class="text-dim small">assessed {{ t.assessedAt | date: 'MMM d' }}</span>
          } @else {
            <a class="btn btn-ghost small-btn" [routerLink]="['/assessment', t.topicId]">
              Take assessment to place yourself →
            </a>
          }
        </div>

        @for (tier of t.tiers; track tier.level) {
          @if (t.assessmentLevel !== null && t.assessmentLevel === tier.level - 1) {
            <div class="you-are-here">
              <span>📍 YOU ARE HERE — next: {{ tier.name }}</span>
            </div>
          }
          <div class="tier">
            <div class="tier-head">
              <span class="tier-title">{{ '★'.repeat(tier.level) }} {{ tier.name }}</span>
              <span class="text-dim small">
                {{ completedIn(tier.lessons) }}/{{ tier.lessons.length }} done
              </span>
            </div>
            <div class="lessons">
              @for (l of tier.lessons; track l.id) {
                @if (l.status === 'completed') {
                  <a class="lesson done" [class.weak]="l.isWeak" [routerLink]="['/items', l.id]"
                     [title]="l.title">
                    ✅ <span class="lesson-title">{{ l.title }}</span>
                    @if (l.isWeak) { <span class="weak-tag">🎯 review</span> }
                  </a>
                } @else if (l.status === 'today') {
                  <a class="lesson today" routerLink="/today" [title]="l.title">
                    📖 <span class="lesson-title">{{ l.title }}</span>
                    <span class="today-tag">today</span>
                  </a>
                } @else {
                  <div class="lesson upcoming" [class.weak]="l.isWeak" [title]="l.title">
                    ◻ <span class="lesson-title">{{ l.title }}</span>
                    @if (l.isWeak) { <span class="weak-tag">🎯 weak spot</span> }
                  </div>
                }
              }
            </div>
          </div>
        }
        @if (t.assessmentLevel === 3) {
          <div class="you-are-here mastered">
            <span>🏆 Senior level achieved — keep the streak alive</span>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .small { font-size: 12px; }
    .track { margin-bottom: 20px; }
    .track-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 10px;
      h2 { margin: 0; font-size: 19px; } }
    .small-btn { padding: 5px 12px; font-size: 13px; }

    .level-badge {
      padding: 3px 12px; border-radius: 999px; font-weight: 700; font-size: 13px;
      &.lvl-0 { background: #47556933; color: var(--text-dim); }
      &.lvl-1 { background: #38bdf833; color: var(--primary); }
      &.lvl-2 { background: #fbbf2433; color: var(--warning); }
      &.lvl-3 { background: #34d39933; color: var(--success); }
    }

    .tier { margin-top: 12px; }
    .tier-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
    .tier-title { font-weight: 600; color: var(--warning); }

    .lessons { display: flex; flex-direction: column; gap: 3px; }
    .lesson {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 10px; border-radius: 6px; font-size: 14px; color: var(--text);
      .lesson-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      &.done:hover, &.today:hover { background: var(--surface-2); }
      &.upcoming { color: var(--text-dim); }
      &.weak { background: color-mix(in srgb, var(--danger) 8%, transparent); }
      &.today { border: 1px solid var(--primary); }
    }
    .weak-tag { font-size: 11px; color: var(--danger); white-space: nowrap; }
    .today-tag { font-size: 11px; color: var(--primary); white-space: nowrap; }

    .you-are-here {
      margin: 10px 0;
      padding: 6px 14px;
      border: 1px dashed var(--warning);
      border-radius: 8px;
      color: var(--warning);
      font-weight: 700;
      font-size: 13px;
      &.mastered { border-color: var(--success); color: var(--success); }
    }
  `
})
export class RoadmapComponent {
  private api = inject(ApiService);
  readonly topics = toSignal(this.api.getRoadmap(), { initialValue: [] as RoadmapTopic[] });

  completedIn(lessons: { status: string }[]) {
    return lessons.filter(l => l.status === 'completed').length;
  }
}
