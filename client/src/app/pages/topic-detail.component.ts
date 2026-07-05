import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-topic-detail',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/topics" class="back text-dim">← All topics</a>

    @if (topic(); as t) {
      <h1>{{ t.icon }} {{ t.name }}</h1>
      <p class="text-dim">{{ t.completed }} of {{ t.total }} lessons completed</p>
    }

    <div class="items">
      @for (item of items(); track item.id; let i = $index) {
        @if (item.status === 'locked') {
          <div class="card item locked">
            <span class="status">🔒</span>
            <span class="title">{{ i + 1 }}. {{ item.title }}</span>
            <span class="meta text-dim">{{ '★'.repeat(item.difficulty) }} · {{ item.estimatedMinutes }} min</span>
          </div>
        } @else {
          <a class="card item" [routerLink]="item.status === 'today' ? ['/today'] : ['/items', item.id]">
            <span class="status">{{ item.status === 'completed' ? '✅' : '📖' }}</span>
            <span class="title">{{ i + 1 }}. {{ item.title }}</span>
            <span class="meta text-dim">{{ '★'.repeat(item.difficulty) }} · {{ item.estimatedMinutes }} min</span>
          </a>
        }
      }
    </div>

    <p class="text-dim hint">
      🔒 Locked lessons unlock when the daily engine assigns them — one new lesson every day.
    </p>
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 12px; }
    .items { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      color: var(--text);

      &:not(.locked):hover { background: var(--surface-2); }
      &.locked { opacity: 0.55; }
    }
    .title { flex: 1; min-width: 0; }
    .meta { white-space: nowrap; font-size: 13px; }
    .hint { margin-top: 16px; font-size: 13px; }
  `
})
export class TopicDetailComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  private topicId$ = this.route.paramMap.pipe(map(p => Number(p.get('id'))));

  readonly items = toSignal(
    this.topicId$.pipe(switchMap(id => this.api.getTopicItems(id))),
    { initialValue: [] }
  );

  readonly topic = toSignal(
    this.topicId$.pipe(
      switchMap(id => this.api.getTopics().pipe(map(ts => ts.find(t => t.id === id))))
    )
  );
}
