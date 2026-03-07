export type CommunicationSectionKey =
  | 'englishFluency'
  | 'tongueTwisters'
  | 'smoothCalmSpeaking'
  | 'speechClarityDrill'
  | 'thoughtStructuring'
  | 'tonality'
  | 'articlePresentation'
  | 'grammar'
  | 'mindfulSpeaking';

export type CommunicationTaskType = 'checkbox' | 'notes' | 'ai_action';

export type CommunicationArticleSource = 'economic_times' | 'indian_express';

export type CommunicationAiContentKey =
  | CommunicationSectionKey
  | 'grammarExercises'
  | 'articleReflection';

export interface CommunicationTaskItem {
  id: string;
  label: string;
  description?: string;
  type: CommunicationTaskType;
  isDone: boolean;
  notes?: string;
  completedAt?: string | null;
}

export interface CommunicationSectionItem {
  key: CommunicationSectionKey;
  label: string;
  description: string;
  weight: number;
  tasks: CommunicationTaskItem[];
  isComplete: boolean;
  progress: number;
}

export interface CommunicationSectionTemplate {
  key: CommunicationSectionKey;
  label: string;
  description: string;
  weight: number;
  tasks: Array<{
    id: string;
    label: string;
    description?: string;
    type: CommunicationTaskType;
  }>;
}

export interface GrammarQuestionItem {
  id: string;
  prompt: string;
  answer: string;
}

export interface CommunicationAiContent {
  title: string;
  summary: string;
  items: string[];
  generatedAt?: string | null;
}

export interface CommunicationGrammarTestSummary {
  questions: GrammarQuestionItem[];
  weaknesses: string[];
  recommendations: string[];
  completedAt?: string | null;
}

export interface CommunicationArticlePractice {
  source: CommunicationArticleSource | null;
  articleTitle: string;
  articleUrl: string;
  notes: string;
  selfReviewNotes: string;
}

export interface CommunicationDailyLog {
  id: string;
  userId: string;
  logDate: string;
  overallProgress: number;
  completedTaskCount: number;
  totalTaskCount: number;
  completedSectionCount: number;
  totalSectionCount: number;
  sectionProgress: Record<CommunicationSectionKey, number>;
  sections: CommunicationSectionItem[];
  articlePractice: CommunicationArticlePractice;
  grammarTestSummary: CommunicationGrammarTestSummary | null;
  aiGeneratedExercises: Partial<
    Record<CommunicationAiContentKey, CommunicationAiContent>
  >;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CommunicationFeatureStreak {
  currentStreakDays: number;
  currentStreakStartDate: string | null;
  currentStreakEndDate: string | null;
  longestStreakDays: number;
  longestStreakStartDate: string | null;
  longestStreakEndDate: string | null;
  lastQualifiedDate: string | null;
  totalQualifiedDays: number;
  qualificationProgressThreshold: number;
}

export interface CommunicationProgressSnapshot {
  overallProgress: number;
  homeProgress: number;
  completedTaskCount: number;
  totalTaskCount: number;
  completedSectionCount: number;
  totalSectionCount: number;
  sectionProgress: Record<CommunicationSectionKey, number>;
  sections: CommunicationSectionItem[];
}

export interface ParsedGrammarExercises {
  content: CommunicationAiContent;
  weaknesses: string[];
  recommendations: string[];
}
