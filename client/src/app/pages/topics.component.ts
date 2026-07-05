import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-topics',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Topics</h1>
    <div class="grid">
      @for (t of topics(); track t.id) {
        <a class="card topic" [routerLink]="['/topics', t.id]" [style.border-top]="'3px solid ' + t.color">
          <div class="icon">{{ t.icon }}</div>
          <h3>{{ t.name }}</h3>
          <div class="progress">
            <div class="bar" [style.width.%]="t.total ? (t.completed / t.total) * 100 : 0"
                 [style.background]="t.color"></div>
          </div>
          <div class="text-dim">{{ t.completed }} / {{ t.total }} completed</div>
        </a>
      }
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
    }
    .topic {
      color: var(--text);
      transition: transform 120ms;
      &:hover { transform: translateY(-2px); }
    }
    .icon { font-size: 30px; }
    h3 { margin: 8px 0 12px; }
    .progress {
      height: 6px;
      border-radius: 3px;
      background: var(--surface-2);
      overflow: hidden;
      margin-bottom: 8px;
    }
    .bar { height: 100%; border-radius: 3px; }
  `
})
export class TopicsComponent {
  private api = inject(ApiService);
  readonly topics = toSignal(this.api.getTopics(), { initialValue: [] });
}
