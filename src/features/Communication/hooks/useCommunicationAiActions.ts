import { useMemo, useState } from 'react';
import { communicationAiService } from '../services/communicationAiService';
import type {
  CommunicationAiContentKey,
  CommunicationArticlePractice,
  CommunicationGrammarTestSummary,
  CommunicationSectionItem,
  GrammarQuestionItem
} from '../types/communication';

const normalizeError = (error: unknown) =>
  error instanceof Error ? error.message : 'Unable to complete the AI action.';

export const useCommunicationAiActions = ({
  articlePractice,
  grammarTestSummary,
  saveAiGeneratedContent,
  saveGrammarTestSummary
}: {
  articlePractice: CommunicationArticlePractice;
  grammarTestSummary: CommunicationGrammarTestSummary | null;
  saveAiGeneratedContent: (
    key: CommunicationAiContentKey,
    content: {
      title: string;
      summary: string;
      items: string[];
      generatedAt?: string | null;
    }
  ) => Promise<void>;
  saveGrammarTestSummary: (
    grammarTestSummary: CommunicationGrammarTestSummary
  ) => Promise<void>;
}) => {
  const [isGrammarDialogOpen, setIsGrammarDialogOpen] = useState(false);
  const [grammarAnswers, setGrammarAnswers] = useState<Record<string, string>>({});
  const [isGeneratingGrammarTest, setIsGeneratingGrammarTest] = useState(false);
  const [isGeneratingGrammarExercises, setIsGeneratingGrammarExercises] =
    useState(false);
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentQuestions = useMemo(
    () => grammarTestSummary?.questions ?? [],
    [grammarTestSummary?.questions]
  );

  const openGrammarDialog = () => {
    if (currentQuestions.length > 0) {
      setGrammarAnswers(
        Object.fromEntries(
          currentQuestions.map(question => [question.id, question.answer ?? ''])
        )
      );
    }
    setIsGrammarDialogOpen(true);
  };

  const handleGenerateGrammarTest = async () => {
    setError(null);
    setIsGeneratingGrammarTest(true);

    try {
      const questions = await communicationAiService.generateGrammarTest();
      setGrammarAnswers(
        Object.fromEntries(questions.map(question => [question.id, question.answer]))
      );
      await saveGrammarTestSummary({
        questions,
        weaknesses: [],
        recommendations: [],
        completedAt: null
      });
      setIsGrammarDialogOpen(true);
    } catch (grammarError) {
      setError(normalizeError(grammarError));
    } finally {
      setIsGeneratingGrammarTest(false);
    }
  };

  const handleGrammarAnswerChange = (questionId: string, answer: string) => {
    setGrammarAnswers(current => ({
      ...current,
      [questionId]: answer
    }));
  };

  const handleGenerateGrammarExercises = async () => {
    const answeredQuestions: GrammarQuestionItem[] = currentQuestions.map(question => ({
      ...question,
      answer: grammarAnswers[question.id] ?? ''
    }));

    setError(null);
    setIsGeneratingGrammarExercises(true);

    try {
      const generatedExercises =
        await communicationAiService.generateGrammarExercises(answeredQuestions);

      await saveGrammarTestSummary({
        questions: answeredQuestions,
        weaknesses: generatedExercises.weaknesses,
        recommendations: generatedExercises.recommendations,
        completedAt: new Date().toISOString()
      });

      await saveAiGeneratedContent('grammarExercises', generatedExercises.content);

      setIsGrammarDialogOpen(false);
    } catch (grammarError) {
      setError(normalizeError(grammarError));
    } finally {
      setIsGeneratingGrammarExercises(false);
    }
  };

  const handleGenerateSectionPractice = async (section: CommunicationSectionItem) => {
    setError(null);
    setActiveSectionKey(section.key);

    try {
      const content = await communicationAiService.generateSectionPractice(section);
      await saveAiGeneratedContent(section.key, content);
    } catch (sectionError) {
      setError(normalizeError(sectionError));
    } finally {
      setActiveSectionKey(null);
    }
  };

  const handleGenerateArticleReflection = async () => {
    setError(null);
    setActiveSectionKey('articlePresentation');

    try {
      const content = await communicationAiService.generateArticleReflection(
        articlePractice
      );

      await saveAiGeneratedContent('articleReflection', content);
    } catch (articleError) {
      setError(normalizeError(articleError));
    } finally {
      setActiveSectionKey(null);
    }
  };

  return {
    error,
    currentQuestions,
    grammarAnswers,
    isGrammarDialogOpen,
    isGeneratingGrammarTest,
    isGeneratingGrammarExercises,
    activeSectionKey,
    setIsGrammarDialogOpen,
    openGrammarDialog,
    handleGenerateGrammarTest,
    handleGrammarAnswerChange,
    handleGenerateGrammarExercises,
    handleGenerateSectionPractice,
    handleGenerateArticleReflection
  };
};
