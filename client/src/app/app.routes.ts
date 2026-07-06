import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'today',
    loadComponent: () => import('./pages/today.component').then(m => m.TodayComponent)
  },
  {
    path: 'topics',
    loadComponent: () => import('./pages/topics.component').then(m => m.TopicsComponent)
  },
  {
    path: 'topics/:id',
    loadComponent: () => import('./pages/topic-detail.component').then(m => m.TopicDetailComponent)
  },
  {
    path: 'items/:id',
    loadComponent: () => import('./pages/item.component').then(m => m.ItemComponent)
  },
  {
    path: 'stats',
    loadComponent: () => import('./pages/stats.component').then(m => m.StatsComponent)
  },
  {
    path: 'assessment',
    loadComponent: () => import('./pages/assessment.component').then(m => m.AssessmentComponent)
  },
  {
    path: 'assessment/:id',
    loadComponent: () => import('./pages/assessment-exam.component').then(m => m.AssessmentExamComponent)
  },
  {
    path: 'roadmap',
    loadComponent: () => import('./pages/roadmap.component').then(m => m.RoadmapComponent)
  },
  {
    path: 'plans',
    loadComponent: () => import('./pages/plans.component').then(m => m.PlansComponent)
  },
  {
    path: 'plans/:id',
    loadComponent: () => import('./pages/plan-detail.component').then(m => m.PlanDetailComponent)
  },
  {
    path: 'whatsnew',
    loadComponent: () => import('./pages/whatsnew.component').then(m => m.WhatsNewComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings.component').then(m => m.SettingsComponent)
  },
  { path: '**', redirectTo: '' }
];
