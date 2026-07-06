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
}

export interface Today {
  assignmentId: number;
  date: string;
  status: 'pending' | 'completed';
  completedAt: string | null;
  item: LearningItem;
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

export interface WhatsNewTech {
  technology: string;
  icon: string;
  color: string;
  entries: WhatsNewEntry[];
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
