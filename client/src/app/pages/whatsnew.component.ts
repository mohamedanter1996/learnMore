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
            @if (tech.docsUrl) {
              <a class="docs-link" [href]="tech.docsUrl" target="_blank" rel="noopener"
                 [style.border-color]="tech.color">
                📖 Official What's New in {{ tech.technology }} — always current →
              </a>
            }
            @if (tech.livePosts.length > 0) {
              <div class="live">
                <div class="live-head">
                  <h4>📡 Latest posts</h4>
                  <span class="text-dim small">live from official blogs — refreshes automatically</span>
                </div>
                @for (p of tech.livePosts; track p.url) {
                  <a class="live-post" [href]="p.url" target="_blank" rel="noopener">
                    <div class="live-title">{{ p.title }}</div>
                    @if (p.summary) { <div class="live-summary text-dim">{{ p.summary }}</div> }
                    <div class="live-meta text-dim">{{ p.source }} · {{ ago(p.published) }}</div>
                  </a>
                }
              </div>
              <h4 class="curated-head">📚 Guides &amp; what to learn next</h4>
            }
            @for (e of tech.entries; track e.title) {
              <div class="entry">
                @if (e.version) {
                  <span class="version" [style.background]="tech.color + '22'" [style.color]="tech.color">
                    {{ e.version }}
                  </span>
                }
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
    .small { font-size: 12px; }

    .docs-link {
      display: block; margin: 4px 0 14px; padding: 10px 14px;
      border: 1px solid var(--border); border-left-width: 4px; border-radius: 8px;
      font-weight: 600; color: var(--text);
      &:hover { background: var(--surface-2); }
    }

    .live { padding: 8px 0 4px; }
    .live-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 6px;
      h4 { margin: 0; } }
    .live-post {
      display: block; padding: 10px 12px; margin-bottom: 8px;
      border: 1px solid var(--border); border-radius: 8px; color: var(--text);
      &:hover { background: var(--surface-2); }
    }
    .live-title { font-weight: 600; }
    .live-summary { font-size: 13px; margin-top: 3px; }
    .live-meta { font-size: 12px; margin-top: 5px; }
    .curated-head { margin: 18px 0 4px; }

    .entry { padding: 14px 0; border-top: 1px solid var(--border); }
    .version { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
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

  /** Relative age like "3 days ago" from a yyyy-MM-dd string. */
  ago(dateStr: string): string {
    if (!dateStr) return '';
    const then = new Date(dateStr).getTime();
    if (isNaN(then)) return dateStr;
    const days = Math.floor((Date.now() - then) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
    if (days < 365) return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
    return `${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`;
  }
}
