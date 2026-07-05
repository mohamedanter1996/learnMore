import { Injectable, effect, signal } from '@angular/core';

const SHOW_ARABIC_KEY = 'learnmore.showArabic';

@Injectable({ providedIn: 'root' })
export class PrefsService {
  readonly showArabic = signal(localStorage.getItem(SHOW_ARABIC_KEY) === '1');

  constructor() {
    effect(() => localStorage.setItem(SHOW_ARABIC_KEY, this.showArabic() ? '1' : '0'));
  }

  toggleArabic() {
    this.showArabic.update(v => !v);
  }
}
