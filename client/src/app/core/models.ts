export interface TopicSummary {
  id: number;
  name: string;
  color: string;
  icon: string;
  total: number;
  completed: number;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number | null;
  explanation: string | null;
}

export interface LearningItem {
  id: number;
  title: string;
  difficulty: number;
  estimatedMinutes: number;
  bodyMarkdown: string;
  explanationArabic: string | null;
  practiceTask: string;
  externalLinks: string[];
  topicId: number;
  topicName: string;
  topicColor: string;
  topicIcon: string;
  quiz: QuizQuestion[];
  /** True when the lesson ships a rich animated Arabic page (seed/ar-html). */
  hasArabicHtml: boolean;
}

export interface Today {
  assignmentId: number;
  date: string;
  status: 'pending' | 'completed';
  completedAt: string | null;
  item: LearningItem;
  /** Set when this lesson was carried over from a day that was missed. */
  carriedFromDate: string | null;
}

export interface TopicItemRow {
  id: number;
  title: string;
  difficulty: number;
  estimatedMinutes: number;
  status: 'completed' | 'today' | 'locked';
}

export interface CalendarDay {
  date: string;
  status: 'completed' | 'missed' | 'pending' | 'none';
}

export interface Stats {
  currentStreak: number;
  longestStreak: number;
  totalCompleted: number;
  totalItems: number;
  perTopic: TopicSummary[];
  calendar: CalendarDay[];
}

export interface AppSettings {
  reminderTime: string;
  reminderRepeatHours: number;
  notificationsEnabled: boolean;
}

export interface QuestionResult {
  questionId: number;
  correct: boolean;
  correctIndex: number;
  explanation: string;
}

export interface CompletionResult {
  completed: boolean;
  allCorrect: boolean;
  results: QuestionResult[];
}

// ---------------------------------------------------------------- assessment

export interface TierScore {
  level: number;
  correct: number;
  total: number;
}

export interface AttemptSummary {
  attemptId: number;
  takenAt: string;
  resultLevel: number;
  levelName: string;
  tiers: TierScore[];
}

export interface AssessmentTopic {
  topicId: number;
  name: string;
  color: string;
  icon: string;
  questionCount: number;
  lastAttempt: AttemptSummary | null;
}

export interface AssessmentQuestion {
  id: number;
  level: number;
  question: string;
  options: string[];
}

export interface RelatedLesson {
  id: number;
  title: string;
  status: string;
}

export interface WrongAnswer {
  questionId: number;
  question: string;
  selectedIndex: number;
  correctIndex: number;
  options: string[];
  explanation: string;
  relatedLesson: RelatedLesson | null;
}

export interface Course {
  title: string;
  provider: string;
  url: string;
  level: number;
  isPaid: boolean;
  lang: 'en' | 'ar';
}

export interface AssessmentResult {
  attemptId: number;
  topicId: number;
  topicName: string;
  resultLevel: number;
  levelName: string;
  nextLevelName: string;
  tiers: TierScore[];
  wrongAnswers: WrongAnswer[];
  recommendedCourses: Course[];
}

export interface RoadmapLesson {
  id: number;
  title: string;
  status: 'completed' | 'today' | 'upcoming';
  isWeak: boolean;
}

export interface RoadmapTier {
  level: number;
  name: string;
  lessons: RoadmapLesson[];
}

export interface RoadmapTopic {
  topicId: number;
  name: string;
  color: string;
  icon: string;
  assessmentLevel: number | null;
  assessmentLevelName: string | null;
  assessedAt: string | null;
  tiers: RoadmapTier[];
}

// ---------------------------------------------------------------- what's new

export interface WhatsNewEntry {
  version: string;
  date: string;
  title: string;
  bodyMarkdown: string;
  url: string | null;
}

export interface LivePost {
  title: string;
  published: string;
  summary: string;
  url: string;
  source: string;
}

export interface WhatsNewTech {
  technology: string;
  icon: string;
  color: string;
  docsUrl: string | null;
  entries: WhatsNewEntry[];
  livePosts: LivePost[];
}

// ---------------------------------------------------------------- study plans

export interface StudyGoal {
  id: number;
  text: string;
  isDone: boolean;
  sortOrder: number;
}

export interface StudyDay {
  date: string;
  studied: boolean;
}

export interface StudyPlanSummary {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  goalsDone: number;
  goalsTotal: number;
  studiedDays: number;
  totalDays: number;
  daysRemaining: number;
}

export interface StudyPlanDetail extends StudyPlanSummary {
  studyStreak: number;
  goals: StudyGoal[];
  days: StudyDay[];
}

// ---------------------------------------------------------------- course plan

export type ArtifactType = 'Article' | 'Post' | 'Commit' | 'Other';

export interface CourseArtifact {
  id: number;
  type: ArtifactType;
  title: string;
  url: string | null;
  createdOn: string;
}

export interface CourseSession {
  id: number;
  date: string;
  minutes: number;
  note: string;
  /** Where the minutes came from. Both kinds count toward the streak. */
  source: 'Manual' | 'Udemy';
}

export interface ActiveCourse {
  id: number;
  order: number;
  title: string;
  instructor: string;
  url: string;
  estimatedHours: number;
  hoursLogged: number;
  requiredArtifacts: number;
  artifactCount: number;
  streak: number;
  canComplete: boolean;
  blockedReason: string | null;
  artifacts: CourseArtifact[];
  recentSessions: CourseSession[];
  /** Read-only mirror of Udemy completion — never gates anything. */
  udemyPercent: number | null;
  udemySyncedAt: string | null;
  /** Minutes a sync parked for you to accept or throw away. Never logged on its own. */
  udemySuggestedMinutes: number | null;
  udemySuggestionSince: string | null;
  udemySuggestionEstimated: boolean;
}

export interface CourseCheckpoint {
  completedOrder: number;
  completedTitle: string;
  nextOrder: number;
  nextTitle: string;
  message: string;
}

export interface CourseNow {
  state: 'active' | 'checkpoint' | 'finished';
  course: ActiveCourse | null;
  checkpoint: CourseCheckpoint | null;
}

export interface CoursePlanRow {
  id: number;
  order: number;
  title: string;
  instructor: string;
  url: string;
  estimatedHours: number;
  status: 'locked' | 'active' | 'done';
  hoursLogged: number;
  artifactCount: number;
  requiredArtifacts: number;
  isCheckpoint: boolean;
  startedOn: string | null;
  completedOn: string | null;
  udemyPercent: number | null;
  udemySyncedAt: string | null;
}

export interface UdemyStatus {
  connected: boolean;
  account: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  matchedCourses: number;
  totalCourses: number;
  unmatchedCourses: string[];
}

// ----------------------------------------------------------------- scenarios

export type Verdict = 'hit' | 'partial' | 'miss' | '';

export interface ScenarioListRow {
  id: number;
  slug: string;
  title: string;
  domain: string;
  difficulty: number;
  estimatedMinutes: number;
  stageCount: number;
  hasActiveRun: boolean;
  runs: number;
  lastPercent: number | null;
  bestPercent: number | null;
  lastRunAt: string | null;
}

export interface ScenarioStage {
  id: number;
  order: number;
  label: string | null;
  prompt: string;
  inputHint: string;
}

export interface Coverage {
  rubricPointId: number;
  text: string;
  tag: string;
  weight: number;
  verdict: Verdict;
  llmVerdict: Verdict | null;
  evidence: string;
  quoteUnverified: boolean;
}

export interface CoachFeedback {
  strengths: string[];
  gaps: string[];
  seniorMove: string;
  arabicSummary: string;
}

export interface StageResult {
  stageId: number;
  order: number;
  label: string | null;
  prompt: string;
  answerText: string;
  submittedAt: string;
  graded: boolean;
  gradeError: string | null;
  probeQuestion: string | null;
  probeAnswerText: string | null;
  coverage: Coverage[];
  feedback: CoachFeedback | null;
  modelAnswerMarkdown: string;
  revealMarkdown: string;
  score: number;
  maxScore: number;
  covered: number;
  points: number;
}

export interface ScenarioRun {
  id: number;
  scenarioId: number;
  slug: string;
  title: string;
  status: 'inprogress' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt: string | null;
  stageCount: number;
  currentStage: ScenarioStage | null;
  history: StageResult[];
  percent: number;
  covered: number;
  points: number;
  canFinishEarly: boolean;
  skippedStages: ScenarioStage[];
}

export interface ScenarioDetail {
  id: number;
  slug: string;
  title: string;
  domain: string;
  difficulty: number;
  estimatedMinutes: number;
  contextMarkdown: string;
  stakeholdersMarkdown: string;
  constraintsMarkdown: string;
  stageCount: number;
  activeRun: ScenarioRun | null;
}

export interface WeaknessRow {
  tag: string;
  seen: number;
  covered: number;
  percent: number;
}

export interface CoachStatus {
  connected: boolean;
  keyHint: string | null;
  model: string;
  lastError: string | null;
  lastCallAt: string | null;
  callsToday: number;
  dailyLimit: number;
}
