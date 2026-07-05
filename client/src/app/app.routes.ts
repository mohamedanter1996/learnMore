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
  { path: '**', redirectTo: '' }
];
