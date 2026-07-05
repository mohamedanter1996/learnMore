import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from './core/api.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private api = inject(ApiService);

  readonly todayDone = signal<boolean | null>(null);
  readonly streak = signal(0);

  constructor(router: Router) {
    // Refresh the sidebar status after every navigation (cheap calls, local API).
    router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.refreshStatus());
    this.refreshStatus();
  }

  private refreshStatus() {
    this.api.getToday().subscribe({
      next: t => this.todayDone.set(t.status === 'completed'),
      error: () => this.todayDone.set(null)
    });
    this.api.getStats().subscribe({
      next: s => this.streak.set(s.currentStreak),
      error: () => this.streak.set(0)
    });
  }
}
