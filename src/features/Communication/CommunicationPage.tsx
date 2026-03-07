import { useMemo } from 'react';
import { AlertCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCommunicationAiActions } from './hooks/useCommunicationAiActions';
import { useCommunicationData } from './hooks/useCommunicationData';
import { useCommunicationProgress } from './hooks/useCommunicationProgress';
import { ArticlePracticeCard } from './components/ArticlePracticeCard';
import { CommunicationSectionCard } from './components/CommunicationSectionCard';
import { CommunicationSummaryCard } from './components/CommunicationSummaryCard';
import { CommunicationStreakCard } from './components/CommunicationStreakCard';
import { GrammarTestDialog } from './components/GrammarTestDialog';

interface CommunicationPageProps {
  onBackToHome?: () => void;
}

const CommunicationPage = ({ onBackToHome }: CommunicationPageProps) => {
  const {
    log,
    recentLogs,
    streak,
    isLoading,
    isSaving,
    error,
    refreshData,
    toggleTask,
    saveGrammarTestSummary,
    saveAiGeneratedContent,
    updateArticlePractice
  } = useCommunicationData();
  const progress = useCommunicationProgress(log);
  const aiActions = useCommunicationAiActions({
    articlePractice: log?.articlePractice ?? {
      source: null,
      articleTitle: '',
      articleUrl: '',
      notes: '',
      selfReviewNotes: ''
    },
    grammarTestSummary: log?.grammarTestSummary ?? null,
    saveAiGeneratedContent,
    saveGrammarTestSummary
  });

  const sections = useMemo(() => log?.sections ?? [], [log?.sections]);
  const orderedSections = useMemo(
    () =>
      sections
        .map((section, index) => ({ section, index }))
        .sort((left, right) => {
          if (left.section.isComplete === right.section.isComplete) {
            return left.index - right.index;
          }

          return left.section.isComplete ? 1 : -1;
        })
        .map(item => item.section),
    [sections]
  );
  const streakStats = useMemo(() => {
    const activeDates = new Set(
      recentLogs
        .filter(item => item.overallProgress >= (streak?.qualificationProgressThreshold ?? 80))
        .map(item => item.logDate)
    );

    const formatDate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
    const addDays = (date: Date, days: number) => {
      const next = new Date(date);
      next.setDate(next.getDate() + days);
      return next;
    };

    let currentStreak = 0;
    let cursor = new Date();
    while (activeDates.has(formatDate(cursor))) {
      currentStreak += 1;
      cursor = addDays(cursor, -1);
    }

    const sortedActiveDates = [...activeDates].sort();
    let longestStreak = 0;
    let runningStreak = 0;
    let previousDate: Date | null = null;

    sortedActiveDates.forEach(dateValue => {
      const currentDate = new Date(`${dateValue}T00:00:00`);
      if (!previousDate) {
        runningStreak = 1;
      } else {
        const diffInDays = Math.round(
          (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        runningStreak = diffInDays === 1 ? runningStreak + 1 : 1;
      }

      previousDate = currentDate;
      longestStreak = Math.max(longestStreak, runningStreak);
    });

    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = addDays(today, mondayOffset);
    const weekLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const weekDays = weekLabels.map((label, index) => {
      const date = addDays(monday, index);
      return {
        label,
        active: activeDates.has(formatDate(date))
      };
    });

    return {
      currentStreak: streak?.currentStreakDays ?? currentStreak,
      longestStreak: streak?.longestStreakDays ?? longestStreak,
      totalPracticeDays: streak?.totalQualifiedDays ?? activeDates.size,
      weekDays
    };
  }, [recentLogs, streak]);

  return (
    <main className=" bg-card text-foreground pb-24">
      <section className="">
        <Card className=" border-none shadow-none ">
          <CardContent className=" space-y-5 px-0  ">
            {onBackToHome ? (
              <Button
                className=" z-40 rounded-full shadow-md"
                onClick={onBackToHome}
                size="icon-xs"
                type="button"
                variant="outline"
              >
                <ArrowLeft className="size-3" />
              </Button>
            ) : null}
            <CommunicationSummaryCard
              completedSections={progress.completedSectionCount}
              completedTasks={progress.completedTaskCount}
              isRefreshing={isLoading}
              isSaving={isSaving}
              onRefresh={() => {
                void refreshData();
              }}
              overallProgress={progress.overallProgress}
              totalSections={progress.totalSectionCount}
              totalTasks={progress.totalTaskCount}
            />

            {error || aiActions.error ? (
              <Card className="border-destructive/30 bg-destructive/5 shadow-none">
                <CardContent className="flex items-start gap-3 p-4">
                  <AlertCircle className="text-destructive mt-0.5 size-4" />
                  <p className="text-sm text-destructive">{error ?? aiActions.error}</p>
                </CardContent>
              </Card>
            ) : null}

            <CommunicationStreakCard
              currentStreak={streakStats.currentStreak}
              longestStreak={streakStats.longestStreak}
              totalPracticeDays={streakStats.totalPracticeDays}
              weekDays={streakStats.weekDays}
            />

            {orderedSections.map(section => {
              if (section.key === 'grammar') {
                const hasGeneratedGrammarTest = aiActions.currentQuestions.length > 0;

                return (
                  <CommunicationSectionCard
                    actionHandlers={{
                      generateGrammarTest: {
                        label: 'Generate test',
                        generated: hasGeneratedGrammarTest,
                        generatedLabel: 'Test ready',
                        loading: aiActions.isGeneratingGrammarTest,
                        onClick: () => {
                          void aiActions.handleGenerateGrammarTest();
                        }
                      }
                    }}
                    aiContent={log?.aiGeneratedExercises.grammarExercises}
                    isSaving={isSaving}
                    key={section.key}
                    onToggleTask={(taskId, checked) => {
                      void toggleTask('grammar', taskId, checked);
                    }}
                    section={section}
                  >
                    {hasGeneratedGrammarTest ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={aiActions.openGrammarDialog}
                          size="xs"
                          type="button"
                          variant="outline"
                        >
                          Continue grammar test
                        </Button>
                      </div>
                    ) : null}

                    {log?.grammarTestSummary?.weaknesses?.length ? (
                      <Card className="bg-muted/35 shadow-none">
                        <CardContent className="space-y-3 p-4">
                          <p className="text-sm font-semibold">Grammar weak areas</p>
                          <ul className="space-y-2">
                            {log.grammarTestSummary.weaknesses.map(item => (
                              <li className="text-sm" key={item}>
                                {item}
                              </li>
                            ))}
                          </ul>
                          {log.grammarTestSummary.recommendations.length ? (
                            <div className="space-y-2">
                              <p className="text-sm font-semibold">Recommendations</p>
                              <ul className="space-y-2">
                                {log.grammarTestSummary.recommendations.map(item => (
                                  <li className="text-sm" key={item}>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ) : null}
                  </CommunicationSectionCard>
                );
              }

              if (section.key === 'articlePresentation') {
                return (
                  <ArticlePracticeCard
                    articlePractice={
                      log?.articlePractice ?? {
                        source: null,
                        articleTitle: '',
                        articleUrl: '',
                        notes: '',
                        selfReviewNotes: ''
                      }
                    }
                    articleReflection={log?.aiGeneratedExercises.articleReflection}
                    isLoadingReflection={
                      aiActions.activeSectionKey === 'articlePresentation'
                    }
                    isSaving={isSaving}
                    key={section.key}
                    onGenerateReflection={() => {
                      void aiActions.handleGenerateArticleReflection();
                    }}
                    onToggleTask={(taskId, checked) => {
                      void toggleTask('articlePresentation', taskId, checked);
                    }}
                    onUpdateArticlePractice={patch => {
                      void updateArticlePractice(patch);
                    }}
                    section={section}
                  />
                );
              }

              return (
                <CommunicationSectionCard
                  actionHandlers={
                    section.key === 'tongueTwisters'
                      ? {
                        generateTongueTwisters: {
                          label: 'Generate set',
                          generated: Boolean(log?.aiGeneratedExercises[section.key]),
                          generatedLabel: 'Saved result',
                          loading: aiActions.activeSectionKey === section.key,
                          onClick: () => {
                            void aiActions.handleGenerateSectionPractice(section);
                          }
                        }
                      }
                      : section.key === 'thoughtStructuring'
                        ? {
                          generateThoughtPrompt: {
                            label: 'Generate prompt',
                            generated: Boolean(log?.aiGeneratedExercises[section.key]),
                            generatedLabel: 'Saved result',
                            loading: aiActions.activeSectionKey === section.key,
                            onClick: () => {
                              void aiActions.handleGenerateSectionPractice(section);
                            }
                          }
                        }
                        : undefined
                  }
                  aiContent={log?.aiGeneratedExercises[section.key]}
                  isSaving={isSaving}
                  key={section.key}
                  onToggleTask={(taskId, checked) => {
                    void toggleTask(section.key, taskId, checked);
                  }}
                  section={section}
                >
                  {section.key !== 'tongueTwisters' &&
                    section.key !== 'thoughtStructuring' &&
                    section.key !== 'speechClarityDrill' &&
                    !log?.aiGeneratedExercises[section.key] ? (
                    <Button
                      disabled={aiActions.activeSectionKey === section.key}
                      onClick={() => {
                        void aiActions.handleGenerateSectionPractice(section);
                      }}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      <Sparkles className="size-3" />
                      {aiActions.activeSectionKey === section.key
                        ? 'Generating...'
                        : 'Generate practice with AI'}
                    </Button>
                  ) : null}
                </CommunicationSectionCard>
              );
            })}

            <GrammarTestDialog
              answers={aiActions.grammarAnswers}
              isGeneratingExercises={aiActions.isGeneratingGrammarExercises}
              onAnswerChange={aiActions.handleGrammarAnswerChange}
              onGenerateExercises={() => {
                void aiActions.handleGenerateGrammarExercises();
              }}
              onOpenChange={aiActions.setIsGrammarDialogOpen}
              open={aiActions.isGrammarDialogOpen}
              questions={aiActions.currentQuestions}
            />
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default CommunicationPage;
