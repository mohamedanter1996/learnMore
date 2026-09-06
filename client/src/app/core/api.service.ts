import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AppSettings, ArtifactType, AssessmentQuestion, AssessmentResult, AssessmentTopic, AttemptSummary,
  CompletionResult, Course, CourseNow, CoursePlanRow, LearningItem, RoadmapTopic, Stats, StudyGoal,
  CoachStatus, ScenarioDetail, ScenarioListRow, ScenarioRun, StudyPlanDetail, StudyPlanSummary, Today,
  TopicItemRow, TopicSummary, UdemyStatus, WeaknessRow, WhatsNewTech
} from './models';

// In the packaged app the API serves this bundle itself, so the API is same-origin and a
// relative path is both correct and portable. Only `ng serve` on 4200 is a separate origin.
const BASE = location.port === '4200' ? 'http://localhost:5199/api' : '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  getToday() {
    return this.http.get<Today>(`${BASE}/today`);
  }

  /** Rich Arabic explanation page (standalone HTML, loaded straight into an iframe). */
  explanationHtmlUrl(itemId: number) {
    return `${BASE}/items/${itemId}/ar-html`;
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

  getCourseNow() {
    return this.http.get<CourseNow>(`${BASE}/course-plan/now`);
  }

  getCoursePlan() {
    return this.http.get<CoursePlanRow[]>(`${BASE}/course-plan`);
  }

  logCourseSession(minutes: number, note: string) {
    return this.http.post<CourseNow>(`${BASE}/course-plan/sessions`, { minutes, note });
  }

  /** Accepts the minutes the last Udemy sync parked — the only way one becomes a session. */
  logUdemySession() {
    return this.http.post<CourseNow>(`${BASE}/course-plan/sessions/from-udemy`, {});
  }

  dismissUdemySession() {
    return this.http.post<CourseNow>(`${BASE}/course-plan/sessions/from-udemy/dismiss`, {});
  }

  addCourseArtifact(type: ArtifactType, title: string, url: string | null) {
    return this.http.post<CourseNow>(`${BASE}/course-plan/artifacts`, { type, title, url });
  }

  deleteCourseArtifact(id: number) {
    return this.http.delete(`${BASE}/course-plan/artifacts/${id}`);
  }

  completeCourse() {
    return this.http.post<CourseNow>(`${BASE}/course-plan/complete`, {});
  }

  continueAfterCheckpoint() {
    return this.http.post<CourseNow>(`${BASE}/course-plan/continue`, {});
  }

  /** Connecting and syncing go through the Electron bridge (DesktopService) — only the
      stored result is read over HTTP. */
  getUdemyStatus() {
    return this.http.get<UdemyStatus>(`${BASE}/udemy/status`);
  }

  // --------------------------------------------------------------- scenarios

  getScenarios() {
    return this.http.get<ScenarioListRow[]>(`${BASE}/scenarios`);
  }

  getScenarioWeaknesses() {
    return this.http.get<WeaknessRow[]>(`${BASE}/scenarios/weaknesses`);
  }

  getScenario(slug: string) {
    return this.http.get<ScenarioDetail>(`${BASE}/scenarios/${slug}`);
  }

  /** Resumes the run already in progress rather than starting a second one. */
  startScenario(slug: string) {
    return this.http.post<ScenarioRun>(`${BASE}/scenarios/${slug}/start`, {});
  }

  getScenarioRun(runId: number) {
    return this.http.get<ScenarioRun>(`${BASE}/scenarios/runs/${runId}`);
  }

  submitScenarioAnswer(runId: number, stageId: number, text: string) {
    return this.http.post<ScenarioRun>(`${BASE}/scenarios/runs/${runId}/answer`, { stageId, text });
  }

  /** Re-runs grading on an answer that failed, without retyping it. */
  regradeScenarioStage(runId: number, stageId: number) {
    return this.http.post<ScenarioRun>(`${BASE}/scenarios/runs/${runId}/regrade`, { stageId, text: '' });
  }

  /** Replies to the coach's follow-up and re-grades the stage with both together. Answerable
      once, so a stage can never cost more than two calls. */
  submitScenarioProbe(runId: number, stageId: number, text: string) {
    return this.http.post<ScenarioRun>(`${BASE}/scenarios/runs/${runId}/probe`, { stageId, text });
  }

  /** Self-scoring and disagreeing with a grade are the same write: your verdict wins. */
  setScenarioVerdicts(runId: number, stageId: number, verdicts: { rubricPointId: number; verdict: string }[]) {
    return this.http.post<ScenarioRun>(`${BASE}/scenarios/runs/${runId}/verdicts`, { stageId, verdicts });
  }

  finishScenarioRun(runId: number) {
    return this.http.post<ScenarioRun>(`${BASE}/scenarios/runs/${runId}/finish`, {});
  }

  abandonScenarioRun(runId: number) {
    return this.http.post(`${BASE}/scenarios/runs/${runId}/abandon`, {});
  }

  // ------------------------------------------------------------------- coach

  getCoachStatus() {
    return this.http.get<CoachStatus>(`${BASE}/coach/status`);
  }

  /** The key is sent once and never comes back — the response carries only a masked hint. */
  saveCoachKey(key: string) {
    return this.http.put<CoachStatus>(`${BASE}/coach/key`, { key });
  }

  disconnectCoach() {
    return this.http.delete<CoachStatus>(`${BASE}/coach/key`);
  }

  saveCoachModel(model: string) {
    return this.http.put<CoachStatus>(`${BASE}/coach/model`, { model });
  }

  getSettings() {
    return this.http.get<AppSettings>(`${BASE}/settings`);
  }

  saveSettings(settings: AppSettings) {
    return this.http.put<AppSettings>(`${BASE}/settings`, settings);
  }
}
