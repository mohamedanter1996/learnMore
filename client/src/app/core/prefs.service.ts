import { Injectable, effect, signal } from '@angular/core';

const SHOW_ARABIC_KEY = 'learnmore.showArabic';
const ROADMAP_VIEW_KEY = 'learnmore.roadmapView';

export type RoadmapView = 'ladder' | 'mindmap';

@Injectable({ providedIn: 'root' })
export class PrefsService {
  readonly showArabic = signal(localStorage.getItem(SHOW_ARABIC_KEY) === '1');
  readonly roadmapView = signal<RoadmapView>(
    localStorage.getItem(ROADMAP_VIEW_KEY) === 'mindmap' ? 'mindmap' : 'ladder');

  constructor() {
    effect(() => localStorage.setItem(SHOW_ARABIC_KEY, this.showArabic() ? '1' : '0'));
    effect(() => localStorage.setItem(ROADMAP_VIEW_KEY, this.roadmapView()));
  }

  toggleArabic() {
    this.showArabic.update(v => !v);
  }

  setRoadmapView(view: RoadmapView) {
    this.roadmapView.set(view);
  }
}
