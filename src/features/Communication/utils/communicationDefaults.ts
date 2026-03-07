import {
  COMMUNICATION_SECTION_TEMPLATES,
  DEFAULT_COMMUNICATION_USER_ID
} from '../constants/communication';
import type {
  CommunicationArticlePractice,
  CommunicationDailyLog,
  CommunicationSectionItem
} from '../types/communication';
import { applyCommunicationProgressToLog } from './communicationProgress';

export const getTodayCommunicationDate = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

export const buildDefaultCommunicationSections = (): CommunicationSectionItem[] =>
  COMMUNICATION_SECTION_TEMPLATES.map(section => ({
    key: section.key,
    label: section.label,
    description: section.description,
    weight: section.weight,
    progress: 0,
    isComplete: false,
    tasks: section.tasks.map(task => ({
      id: task.id,
      label: task.label,
      description: task.description,
      type: task.type,
      isDone: false,
      notes: '',
      completedAt: null
    }))
  }));

export const buildDefaultArticlePractice =
  (): CommunicationArticlePractice => ({
    source: null,
    articleTitle: '',
    articleUrl: '',
    notes: '',
    selfReviewNotes: ''
  });

export const buildDefaultCommunicationDailyLog = ({
  date = getTodayCommunicationDate(),
  userId = DEFAULT_COMMUNICATION_USER_ID
}: {
  date?: string;
  userId?: string;
} = {}): CommunicationDailyLog =>
  applyCommunicationProgressToLog({
    id: `${userId}_${date}`,
    userId,
    logDate: date,
    overallProgress: 0,
    completedTaskCount: 0,
    totalTaskCount: 0,
    completedSectionCount: 0,
    totalSectionCount: 0,
    sectionProgress: {
      englishFluency: 0,
      tongueTwisters: 0,
      smoothCalmSpeaking: 0,
      speechClarityDrill: 0,
      thoughtStructuring: 0,
      tonality: 0,
      articlePresentation: 0,
      grammar: 0,
      mindfulSpeaking: 0
    },
    sections: buildDefaultCommunicationSections(),
    articlePractice: buildDefaultArticlePractice(),
    grammarTestSummary: null,
    aiGeneratedExercises: {},
    createdAt: null,
    updatedAt: null
  });
