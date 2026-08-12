import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, signal, viewChild
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { MarkdownComponent } from 'ngx-markdown';
import { ApiService } from '../core/api.service';

/**
 * The Egyptian-Arabic explanation panel.
 *
 * Lessons that ship a rich page (seed/ar-html/*.html) get it in a sandboxed iframe — the page
 * carries its own CSS animations, SVG diagrams and JS, all of which Angular's sanitizer would
 * strip if it were inlined. Everything else falls back to the original markdown explanation.
 * The page reports its own height over postMessage so the frame never scrolls internally.
 */
@Component({
  selector: 'app-arabic-explanation',
  imports: [MarkdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rich()) {
      <iframe #frame class="ar-frame" [src]="url()" [style.height.px]="height()"
              sandbox="allow-scripts" title="الشرح بالمصري"></iframe>
      <div class="ar-actions" dir="rtl">
        <button class="btn btn-ghost" (click)="openWindow()">🪟 افتح الشرح في نافذة لوحده</button>
        @if (fallbackMarkdown()) {
          <button class="btn btn-ghost" (click)="showText.set(!showText())">
            {{ showText() ? 'إخفاء النسخة النصية' : '📄 النسخة النصية' }}
          </button>
        }
      </div>
      @if (showText() && fallbackMarkdown()) {
        <div class="card arabic-panel" dir="rtl" lang="ar">
          <markdown [data]="fallbackMarkdown()" />
        </div>
      }
    } @else if (fallbackMarkdown()) {
      <div class="card arabic-panel" dir="rtl" lang="ar">
        <h3>🇪🇬 الشرح بالمصري</h3>
        <markdown [data]="fallbackMarkdown()" />
      </div>
    }
  `,
  styles: `
    :host { display: block; }

    .ar-frame {
      display: block;
      width: 100%;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      margin-bottom: 10px;
    }

    .ar-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .ar-actions .btn { padding: 6px 14px; font-size: 14px; }
  `
})
export class ArabicExplanationComponent {
  private api = inject(ApiService);
  private sanitizer = inject(DomSanitizer);

  readonly itemId = input.required<number>();
  /** True when the lesson has a rich animated page; otherwise the markdown fallback renders. */
  readonly rich = input(false);
  // Not named `markdown`: ngx-markdown also owns the [markdown] attribute selector, so the
  // binding would pull a second component onto this element (NG0300).
  readonly fallbackMarkdown = input<string | null>(null);

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  readonly height = signal(1200);
  readonly showText = signal(false);

  /** Escape hatch: opens the page in its own window (Electron gives it a real BrowserWindow). */
  openWindow() {
    window.open(this.api.explanationHtmlUrl(this.itemId()), '_blank');
  }

  readonly url = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.api.explanationHtmlUrl(this.itemId())));

  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent) {
    if (event.source !== this.frame()?.nativeElement.contentWindow) return;
    const data = event.data;
    if (data?.type !== 'lm-ar-height' || typeof data.height !== 'number') return;
    this.height.set(Math.min(Math.max(Math.ceil(data.height), 400), 40000));
  }
}
