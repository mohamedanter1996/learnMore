import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { PrefsService } from '../core/prefs.service';
import { RoadmapLesson, RoadmapTopic } from '../core/models';

interface MapLeaf {
  cx: number;
  cy: number;
  lesson: RoadmapLesson;
}
interface MapTier {
  level: number;
  name: string;
  x: number;
  y: number;
  leaves: MapLeaf[];
}
interface TopicMap {
  topicId: number;
  width: number;
  height: number;
  rootX: number;
  rootY: number;
  tiers: MapTier[];
}

@Component({
  selector: 'app-roadmap',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>🗺️ Roadmap</h1>
      <div class="view-toggle">
        <button [class.active]="prefs.roadmapView() === 'ladder'"
                (click)="prefs.setRoadmapView('ladder')">☰ List</button>
        <button [class.active]="prefs.roadmapView() === 'mindmap'"
                (click)="prefs.setRoadmapView('mindmap')">🧠 Mind map</button>
      </div>
    </div>
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

        @if (prefs.roadmapView() === 'mindmap') {
          <!-- ------------------------------- MIND MAP ------------------------------- -->
          @if (maps()[t.topicId]; as m) {
            <div class="map-scroll">
              <svg [attr.viewBox]="'0 0 ' + m.width + ' ' + m.height"
                   [attr.width]="m.width" [attr.height]="m.height" class="mindmap">
                @for (tier of m.tiers; track tier.level) {
                  <path [attr.d]="branch(m.rootX, m.rootY, tier.x, tier.y)"
                        [attr.stroke]="t.color" fill="none" stroke-width="2" opacity="0.5" />
                  @for (leaf of tier.leaves; track leaf.lesson.id) {
                    <line [attr.x1]="tier.x" [attr.y1]="tier.y"
                          [attr.x2]="leaf.cx" [attr.y2]="leaf.cy"
                          [attr.stroke]="t.color" stroke-width="1" opacity="0.22" />
                  }
                }
                <!-- tier bubbles -->
                @for (tier of m.tiers; track tier.level) {
                  <g>
                    <rect [attr.x]="tier.x - 46" [attr.y]="tier.y - 13" width="92" height="26" rx="13"
                          [attr.fill]="t.color" opacity="0.18" />
                    <text [attr.x]="tier.x" [attr.y]="tier.y + 4" text-anchor="middle"
                          class="tier-label">{{ '★'.repeat(tier.level) }} {{ tier.name }}</text>
                  </g>
                  <!-- leaves -->
                  @for (leaf of tier.leaves; track leaf.lesson.id) {
                    <g [class.clickable]="leaf.lesson.status !== 'upcoming'"
                       (click)="openLeaf(leaf.lesson)">
                      <title>{{ leaf.lesson.title }}{{ leaf.lesson.isWeak ? ' — 🎯 weak spot' : '' }}</title>
                      @if (leaf.lesson.isWeak) {
                        <circle [attr.cx]="leaf.cx" [attr.cy]="leaf.cy" r="9"
                                fill="none" stroke="var(--danger)" stroke-width="2" />
                      }
                      <circle [attr.cx]="leaf.cx" [attr.cy]="leaf.cy" r="6"
                              [attr.fill]="leafColor(leaf.lesson.status)"
                              [attr.stroke]="leaf.lesson.status === 'upcoming' ? 'var(--border)' : 'none'" />
                    </g>
                  }
                }
                <!-- root -->
                <circle [attr.cx]="m.rootX" [attr.cy]="m.rootY" r="26" [attr.fill]="t.color" opacity="0.9" />
                <text [attr.x]="m.rootX" [attr.y]="m.rootY + 8" text-anchor="middle" class="root-icon">
                  {{ t.icon }}
                </text>
              </svg>
            </div>
            <div class="map-legend text-dim">
              <span><i class="dot done"></i> completed</span>
              <span><i class="dot today"></i> today</span>
              <span><i class="dot up"></i> upcoming</span>
              <span><i class="dot weak"></i> 🎯 weak spot</span>
            </div>
          }
        } @else {
          <!-- ------------------------------- LADDER ------------------------------- -->
          @for (tier of t.tiers; track tier.level) {
            @if (t.assessmentLevel !== null && t.assessmentLevel === tier.level - 1) {
              <div class="you-are-here"><span>📍 YOU ARE HERE — next: {{ tier.name }}</span></div>
            }
            <div class="tier">
              <div class="tier-head">
                <span class="tier-title">{{ '★'.repeat(tier.level) }} {{ tier.name }}</span>
                <span class="text-dim small">{{ completedIn(tier.lessons) }}/{{ tier.lessons.length }} done</span>
              </div>
              <div class="lessons">
                @for (l of tier.lessons; track l.id) {
                  @if (l.status === 'completed') {
                    <a class="lesson done" [class.weak]="l.isWeak" [routerLink]="['/items', l.id]" [title]="l.title">
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
            <div class="you-are-here mastered"><span>🏆 Senior level achieved — keep the streak alive</span></div>
          }
        }
      </div>
    }
  `,
  styles: `
    .page-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .view-toggle {
      display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
      button {
        background: transparent; color: var(--text-dim); border: none; padding: 7px 14px;
        cursor: pointer; font-size: 13px; font-weight: 600;
        &.active { background: var(--surface-2); color: var(--primary); }
      }
    }
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

    /* mind map */
    .map-scroll { overflow-x: auto; padding: 4px 0; }
    .mindmap { display: block; }
    .mindmap .clickable { cursor: pointer; }
    .mindmap .clickable:hover circle { filter: brightness(1.25); }
    .tier-label { fill: var(--text); font-size: 11px; font-weight: 700; }
    .root-icon { font-size: 20px; }
    .map-legend {
      display: flex; gap: 16px; font-size: 12px; margin-top: 6px; flex-wrap: wrap;
      i.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
      i.done { background: var(--success); }
      i.today { background: var(--primary); }
      i.up { background: var(--surface-2); border: 1px solid var(--border); }
      i.weak { background: transparent; border: 2px solid var(--danger); }
    }

    /* ladder */
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
      margin: 10px 0; padding: 6px 14px; border: 1px dashed var(--warning);
      border-radius: 8px; color: var(--warning); font-weight: 700; font-size: 13px;
      &.mastered { border-color: var(--success); color: var(--success); }
    }
  `
})
export class RoadmapComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  readonly prefs = inject(PrefsService);

  readonly topics = toSignal(this.api.getRoadmap(), { initialValue: [] as RoadmapTopic[] });

  // Precompute an SVG layout per topic (keyed by topicId).
  readonly maps = computed<Record<number, TopicMap>>(() => {
    const result: Record<number, TopicMap> = {};
    for (const t of this.topics()) result[t.topicId] = this.layout(t);
    return result;
  });

  private layout(t: RoadmapTopic): TopicMap {
    const COLS = 6;
    const GAP_X = 30;
    const GAP_Y = 26;
    const rootX = 55;
    const tierX = 200;
    const leavesX = 300;
    const blockPad = 22;

    const tiers: MapTier[] = [];
    let y = 20;
    for (const tier of t.tiers) {
      const rows = Math.max(1, Math.ceil(tier.lessons.length / COLS));
      const blockH = rows * GAP_Y + blockPad;
      const tierY = y + blockH / 2;
      const leaves: MapLeaf[] = tier.lessons.map((lesson, i) => ({
        lesson,
        cx: leavesX + (i % COLS) * GAP_X,
        cy: y + blockPad / 2 + 8 + Math.floor(i / COLS) * GAP_Y
      }));
      tiers.push({ level: tier.level, name: tier.name, x: tierX, y: tierY, leaves });
      y += blockH;
    }

    const height = Math.max(120, y + 10);
    return {
      topicId: t.topicId,
      width: leavesX + COLS * GAP_X + 20,
      height,
      rootX,
      rootY: height / 2,
      tiers
    };
  }

  branch(x1: number, y1: number, x2: number, y2: number): string {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }

  leafColor(status: string): string {
    return status === 'completed' ? 'var(--success)'
      : status === 'today' ? 'var(--primary)'
      : 'var(--surface-2)';
  }

  openLeaf(l: RoadmapLesson) {
    if (l.status === 'completed') this.router.navigate(['/items', l.id]);
    else if (l.status === 'today') this.router.navigate(['/today']);
  }

  completedIn(lessons: { status: string }[]) {
    return lessons.filter(l => l.status === 'completed').length;
  }
}
