import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MarkdownComponent } from 'ngx-markdown';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-whatsnew',
  imports: [MarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>📰 What's New in Tech</h1>
    <p class="text-dim">
      Stay current with the tools you work in — latest highlights and what to learn next.
      Refreshed with each app update.
    </p>

    @for (tech of feed(); track tech.technology) {
      <div class="card tech" [style.border-left]="'4px solid ' + tech.color">
        <button class="tech-head" (click)="toggle(tech.technology)">
          <span class="tech-name">{{ tech.icon }} {{ tech.technology }}</span>
          <span class="text-dim">{{ tech.entries.length }} updates {{ isOpen(tech.technology) ? '▲' : '▼' }}</span>
        </button>

        @if (isOpen(tech.technology)) {
          <div class="entries">
            @for (e of tech.entries; track e.title) {
              <div class="entry">
                <div class="entry-head">
                  <span class="version" [style.background]="tech.color + '22'" [style.color]="tech.color">
                    {{ e.version }}
                  </span>
                  <span class="text-dim small">{{ e.date }}</span>
                </div>
                <h3>{{ e.title }}</h3>
                <markdown [data]="e.bodyMarkdown" />
                @if (e.url) {
                  <a class="read-more" [href]="e.url" target="_blank" rel="noopener">Read the docs →</a>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    .tech { margin-bottom: 14px; padding: 0; overflow: hidden; }
    .tech-head {
      width: 100%; display: flex; justify-content: space-between; align-items: center;
      background: transparent; border: none; color: var(--text); cursor: pointer;
      padding: 16px 20px; font-size: 16px;
      &:hover { background: var(--surface-2); }
    }
    .tech-name { font-weight: 700; }
    .small { font-size: 12px; }

    .entries { padding: 0 20px 12px; }
    .entry { padding: 14px 0; border-top: 1px solid var(--border); }
    .entry-head { display: flex; align-items: center; gap: 10px; }
    .version { padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .entry h3 { margin: 8px 0; }
    .read-more { display: inline-block; margin-top: 6px; font-weight: 600; }
  `
})
export class WhatsNewComponent {
  private api = inject(ApiService);
  readonly feed = toSignal(this.api.getWhatsNew(), { initialValue: [] });
  private readonly openSet = signal<Set<string>>(new Set());

  isOpen(tech: string) {
    return this.openSet().has(tech);
  }

  toggle(tech: string) {
    this.openSet.update(s => {
      const next = new Set(s);
      next.has(tech) ? next.delete(tech) : next.add(tech);
      return next;
    });
  }
}
