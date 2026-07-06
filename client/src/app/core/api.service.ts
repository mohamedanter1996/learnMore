import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AppSettings, AssessmentQuestion, AssessmentResult, AssessmentTopic, AttemptSummary,
  CompletionResult, Course, LearningItem, RoadmapTopic, Stats, StudyGoal, StudyPlanDetail,
  StudyPlanSummary, Today, TopicItemRow, TopicSummary, WhatsNewTech
} from './models';

const BASE = 'http://localhost:5199/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getToday() {
    return this.http.get<Today>(`${BASE}/today`);
  }

  completeToday(answers: { questionId: number; selectedIndex: number }[]) {
    return this.http.post<CompletionResult>(`${BASE}/today/complete`, { answers });
  }

  getTopics() {
    return this.http.get<TopicSummary[]>(`${BASE}/topics`);
  }

  getTopicItems(topicId: number) {
    return this.http.get<TopicItemRow[]>(`${BASE}/topics/${topicId}/items`);
  }

  getItem(id: number) {
    return this.http.get<LearningItem>(`${BASE}/items/${id}`);
  }

  getStats() {
    return this.http.get<Stats>(`${BASE}/stats`);
  }

  getAssessmentOverview() {
    return this.http.get<AssessmentTopic[]>(`${BASE}/assessment`);
  }

  getAssessmentQuestions(topicId: number) {
    return this.http.get<AssessmentQuestion[]>(`${BASE}/assessment/${topicId}`);
  }

  submitAssessment(topicId: number, answers: { questionId: number; selectedIndex: number }[]) {
    return this.http.post<AssessmentResult>(`${BASE}/assessment/${topicId}/submit`, { answers });
  }

  getAssessmentHistory(topicId: number) {
    return this.http.get<AttemptSummary[]>(`${BASE}/assessment/${topicId}/history`);
  }

  getRoadmap() {
    return this.http.get<RoadmapTopic[]>(`${BASE}/roadmap`);
  }

  getCourses(topicId: number, level?: number) {
    const params = level != null ? `?level=${level}` : '';
    return this.http.get<Course[]>(`${BASE}/courses?topicId=${topicId}${params.replace('?', '&')}`);
  }

  getWhatsNew() {
    return this.http.get<WhatsNewTech[]>(`${BASE}/whatsnew`);
  }

  getPlans() {
    return this.http.get<StudyPlanSummary[]>(`${BASE}/plans`);
  }

  getPlan(id: number) {
    return this.http.get<StudyPlanDetail>(`${BASE}/plans/${id}`);
  }

  createPlan(title: string, startDate: string, endDate: string) {
    return this.http.post<StudyPlanSummary>(`${BASE}/plans`, { title, startDate, endDate });
  }

  deletePlan(id: number) {
    return this.http.delete(`${BASE}/plans/${id}`);
  }

  addGoal(planId: number, text: string) {
    return this.http.post<StudyGoal>(`${BASE}/plans/${planId}/goals`, { text });
  }

  toggleGoal(goalId: number) {
    return this.http.put(`${BASE}/goals/${goalId}/toggle`, {});
  }

  deleteGoal(goalId: number) {
    return this.http.delete(`${BASE}/goals/${goalId}`);
  }

  toggleDay(planId: number, date: string) {
    return this.http.put(`${BASE}/plans/${planId}/day/${date}/toggle`, {});
  }

  getSettings() {
    return this.http.get<AppSettings>(`${BASE}/settings`);
  }

  saveSettings(settings: AppSettings) {
    return this.http.put<AppSettings>(`${BASE}/settings`, settings);
  }
}
