import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Check,
  CircleDot,
  RefreshCcw, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { addNutrientMaps, firebaseDataService, normalizeNutrientMap } from '@/firebase';
import { NUTRIENTS_CONFIG } from '@/config';
import { useAppStore } from '@/store';
import { sendMessageToAssistant, STREAM_END_MARKER } from '@/features/Chat/chatservice';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  FALLBACK_MUST_COMPLETE_KEYS,
  REMAINING_NUTRIENTS_PLAN_PROMPT
} from './constants/dashboard';
import type {
  NutrientDefinition,
  NutrientProgressItem,
  SuggestedMealItem
} from './types/dashboard';
import { formatAmount, formatConsumedVsTarget, normalizeMealContains } from './utils/formatters';
import { buildReplaceMealContext, buildSuggestedMealsContext } from './utils/mealPlanPrompts';
import { parseReplacementMeal, parseSuggestedMealPlan } from './utils/mealPlanParsers';
import { useDashboardDataRefresh } from './hooks/useDashboardDataRefresh';
import { GeneratePlanDialog } from './components/dashboard/GeneratePlanDialog';
import { SuggestedMealsCard } from './components/dashboard/SuggestedMealsCard';
import { TodaysMealsCard } from './components/dashboard/TodaysMealsCard';
import { ReplaceMealDialog } from './components/dashboard/ReplaceMealDialog';

interface NutritionPageProps {
  onBackToHome?: () => void;
}

const NutritionPage = ({ onBackToHome }: NutritionPageProps) => {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planPrompt, setPlanPrompt] = useState('');
  const [planGenerationMode, setPlanGenerationMode] = useState<'full' | 'remaining'>('full');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [consumingMealKey, setConsumingMealKey] = useState<string | null>(null);
  const [deletingMealKey, setDeletingMealKey] = useState<string | null>(null);
  const [generatedPlanDraft, setGeneratedPlanDraft] = useState<SuggestedMealItem[] | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [replaceInstructions, setReplaceInstructions] = useState('');
  const [replaceMealIndex, setReplaceMealIndex] = useState<number | null>(null);
  const [replacementDraft, setReplacementDraft] = useState<SuggestedMealItem | null>(null);
  const [isGeneratingReplacement, setIsGeneratingReplacement] = useState(false);
  const [isSavingReplacement, setIsSavingReplacement] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const dailyLog = useAppStore(state => state.dailyLog);
  const userProfile = useAppStore(state => state.userProfile);
  const meals = useAppStore(state => state.meals);
  const setUserProfile = useAppStore(state => state.setUserProfile);
  const setDailyLog = useAppStore(state => state.setDailyLog);
  const setMeals = useAppStore(state => state.setMeals);
  const addMeal = useAppStore(state => state.addMeal);
  const { isRefreshing, handleRefreshDashboardData } = useDashboardDataRefresh({
    setUserProfile,
    setDailyLog,
    setMeals
  });

  const nutrientKeysForPlan = useMemo(
    () => (NUTRIENTS_CONFIG.nutrients as NutrientDefinition[]).map(item => item.key),
    []
  );
  const aminoAcidKeysForPlan = useMemo(
    () =>
      (NUTRIENTS_CONFIG.nutrients as NutrientDefinition[])
        .filter(item => item.category === 'amino_acid')
        .map(item => item.key),
    []
  );
  const suggestedMealsFromLog = useMemo(
    () => (dailyLog?.suggested_meals as SuggestedMealItem[] | undefined) ?? [],
    [dailyLog?.suggested_meals]
  );
  const replacementContainsList = useMemo(
    () => (replacementDraft ? normalizeMealContains(replacementDraft.contains) : []),
    [replacementDraft]
  );
  const hasSavedSuggestedMeals = suggestedMealsFromLog.length > 0;
  const areAllSuggestedMealsConsumed =
    hasSavedSuggestedMeals && suggestedMealsFromLog.every(meal => meal.isConsumed);

  const consumedNutrients = useMemo(
    () => dailyLog?.consumed_nutrients ?? {},
    [dailyLog?.consumed_nutrients]
  );
  const profileRequirements = useMemo(
    () => userProfile?.required_nutrients ?? {},
    [userProfile?.required_nutrients]
  );

  const mustCompleteKeys = useMemo(() => {
    const rawProfile = userProfile as unknown as Record<string, unknown> | null;
    const profileKeys =
      (rawProfile?.must_complete_keys as string[] | undefined) ??
      (rawProfile?.mustCompleteKeys as string[] | undefined);

    if (Array.isArray(profileKeys) && profileKeys.length > 0) {
      return profileKeys;
    }

    return [...FALLBACK_MUST_COMPLETE_KEYS];
  }, [userProfile]);

  const nutrientProgress = useMemo<NutrientProgressItem[]>(() => {
    return (NUTRIENTS_CONFIG.nutrients as NutrientDefinition[]).map(definition => {
      const rawTarget = profileRequirements[definition.key] ?? 0;
      const target = Number.isFinite(rawTarget) ? Math.max(rawTarget, 0) : 0;
      const rawConsumed = consumedNutrients[definition.key] ?? 0;
      const consumed = Number.isFinite(rawConsumed) ? Math.max(rawConsumed, 0) : 0;
      const completion = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
      const remaining = target > 0 ? Math.max(target - consumed, 0) : 0;

      return {
        definition,
        target,
        consumed,
        remaining,
        completionPercent: completion
      };
    });
  }, [consumedNutrients, profileRequirements]);

  const caloriesConsumed = consumedNutrients.calories ?? 0;
  const caloriesTarget = profileRequirements.calories ?? 0;
  const caloriesLeft = Math.max(caloriesTarget - caloriesConsumed, 0);
  const caloriesProgress =
    caloriesTarget > 0 ? Math.min((caloriesConsumed / caloriesTarget) * 100, 100) : 0;
  const maintenanceRange = useMemo(() => {
    const rawData = userProfile as unknown as Record<string, unknown> | null;
    const maintenance = rawData?.maintenanceCalories as Record<string, unknown> | undefined;
    const label = maintenance?.label;
    if (typeof label === 'string' && label.trim().length > 0) {
      return label
        .replace(/\s*kcal\/day$/i, '')
        .replace(/\s*kcal per day$/i, '')
        .trim();
    }

    const min = Number(maintenance?.min);
    const max = Number(maintenance?.max);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return `${min.toFixed(0)}-${max.toFixed(0)}`;
    }

    return 'NA';
  }, [userProfile]);

  const categoryCards = useMemo(() => {
    const grouped = nutrientProgress.reduce<
      Record<
        string,
        {
          tracked: number;
          completed: number;
          completionSum: number;
        }
      >
    >((accumulator, item) => {
      const { category } = item.definition;
      if (!accumulator[category]) {
        accumulator[category] = { tracked: 0, completed: 0, completionSum: 0 };
      }

      if (item.target > 0) {
        accumulator[category].tracked += 1;
        accumulator[category].completionSum += item.completionPercent;
        if (item.completionPercent >= 100) {
          accumulator[category].completed += 1;
        }
      }

      return accumulator;
    }, {});

    return Object.entries(grouped).map(([category, data]) => ({
      key: category,
      label: CATEGORY_LABELS[category] ?? category,
      color: CATEGORY_COLORS[category] ?? 'var(--chart-1)',
      Icon: CATEGORY_ICONS[category] ?? CircleDot,
      tracked: data.tracked,
      completed: data.completed,
      completionPercent: data.tracked > 0 ? data.completionSum / data.tracked : 0
    }));
  }, [nutrientProgress]);

  const nutrientSections = useMemo(
    () =>
      CATEGORY_ORDER.map(category => ({
        category,
        label: CATEGORY_LABELS[category],
        items: nutrientProgress.filter(item => item.definition.category === category)
      })).filter(section => section.items.length > 0),
    [nutrientProgress]
  );

  const mustCompleteNutrients = useMemo(() => {
    const keySet = new Set(mustCompleteKeys);
    const byKey = nutrientProgress.reduce<Record<string, NutrientProgressItem>>((accumulator, item) => {
      if (keySet.has(item.definition.key)) {
        accumulator[item.definition.key] = item;
      }
      return accumulator;
    }, {});

    return mustCompleteKeys.map(key => byKey[key]).filter(
      (item): item is NutrientProgressItem => Boolean(item)
    );
  }, [mustCompleteKeys, nutrientProgress]);

  const availableNutrientCount = nutrientProgress.length;
  const todaysMeals = meals;
  const nutrientDefinitionByKey = useMemo(
    () =>
      (NUTRIENTS_CONFIG.nutrients as NutrientDefinition[]).reduce<Record<string, NutrientDefinition>>(
        (accumulator, definition) => {
          accumulator[definition.key] = definition;
          return accumulator;
        },
        {}
      ),
    []
  );
  const mustCompleteRankByKey = useMemo(
    () =>
      mustCompleteKeys.reduce<Record<string, number>>((accumulator, key, index) => {
        accumulator[key] = index;
        return accumulator;
      }, {}),
    [mustCompleteKeys]
  );
  const handleGenerateSuggestedPlan = async () => {
    setPlanError(null);
    setIsGeneratingPlan(true);

    try {
      const extraInstructions = planPrompt.trim();
      const baseContent =
        planGenerationMode === 'remaining'
          ? 'Generate only additional meals for remaining nutrients today, not a full-day plan.'
          : 'Generate a practical meal plan to complete my nutrient goals for today.';
      const content = extraInstructions
        ? `${baseContent} Extra preference: ${extraInstructions}`
        : baseContent;

      const { assistantText } = await sendMessageToAssistant({
        content,
        mealContext: buildSuggestedMealsContext({
          nutrientKeys: nutrientKeysForPlan,
          requiredNutrients: profileRequirements,
          consumedNutrients,
          mustCompleteKeys,
          aminoAcidKeys: aminoAcidKeysForPlan,
          generationMode: planGenerationMode
        }),
        mode: 'responses',
        stream: true,
        endMarker: STREAM_END_MARKER
      });

      const parsedPlan = parseSuggestedMealPlan(assistantText, nutrientKeysForPlan);
      if (!parsedPlan) {
        throw new Error('AI returned an invalid plan format. Please try again.');
      }
      const remainingCalories = Math.max(
        Number(profileRequirements.calories ?? 0) - Number(consumedNutrients.calories ?? 0),
        0
      );
      const remainingTopUpMealCount = remainingCalories <= 450 ? 1 : 2;
      const normalizedPlan =
        planGenerationMode === 'remaining'
          ? parsedPlan.slice(0, remainingTopUpMealCount).map((meal, index) => ({
            ...meal,
            timetoConsume: index === 0 ? 'Next meal' : 'Later today'
          }))
          : parsedPlan;
      setGeneratedPlanDraft(normalizedPlan);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Failed to generate meal plan.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleSaveSuggestedPlan = async () => {
    if (!generatedPlanDraft || generatedPlanDraft.length === 0) return;
    setPlanError(null);
    setIsSavingPlan(true);
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}`;
      const activeDate = dailyLog?.log_date ?? today;

      await firebaseDataService.upsertSuggestedMealsForDate(activeDate, generatedPlanDraft);

      if (dailyLog) {
        setDailyLog({
          ...dailyLog,
          suggested_meals: generatedPlanDraft,
          updated_at: now.toISOString()
        });
      } else {
        setDailyLog({
          id: activeDate,
          user_id: 'sanket',
          log_date: activeDate,
          consumed_nutrients: {},
          suggested_meals: generatedPlanDraft,
          completion_score: 0,
          notes: null,
          nutrient_snapshot: {},
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        });
      }

      setIsPlanModalOpen(false);
      setGeneratedPlanDraft(null);
      setPlanPrompt('');
      setPlanGenerationMode('full');
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Failed to save meal plan.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleConsumeSuggestedMeal = async (meal: SuggestedMealItem, index: number) => {
    if (meal.isConsumed) return;
    const mealKey = `${meal.name}-${meal.timetoConsume}-${index}`;
    setPlanError(null);
    setConsumingMealKey(mealKey);
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}`;
      const activeDate = dailyLog?.log_date ?? today;

      const mealId = await firebaseDataService.addMealAndUpdateDailyLog({
        name: meal.name,
        quantity: 1,
        unit: 'serving',
        source: 'text',
        logDate: activeDate,
        nutrientSnapshot: meal.nutrientSnapshot
      });

      const nextSuggestedMeals = suggestedMealsFromLog.map((item, itemIndex) =>
        itemIndex === index ? { ...item, isConsumed: true } : item
      );
      await firebaseDataService.upsertSuggestedMealsForDate(activeDate, nextSuggestedMeals);

      addMeal({
        id: mealId,
        user_id: 'sanket',
        daily_log_id: dailyLog?.id ?? activeDate,
        food_name: meal.name,
        nutrient_snapshot: meal.nutrientSnapshot,
        quantity: 1,
        unit: 'serving',
        source: 'text',
        logged_at: now.toISOString(),
        created_at: now.toISOString()
      });

      const updatedConsumed = addNutrientMaps(
        normalizeNutrientMap(dailyLog?.consumed_nutrients ?? {}),
        normalizeNutrientMap(meal.nutrientSnapshot)
      );

      if (dailyLog) {
        setDailyLog({
          ...dailyLog,
          consumed_nutrients: updatedConsumed,
          suggested_meals: nextSuggestedMeals,
          updated_at: now.toISOString()
        });
      } else {
        setDailyLog({
          id: activeDate,
          user_id: 'sanket',
          log_date: activeDate,
          consumed_nutrients: updatedConsumed,
          suggested_meals: nextSuggestedMeals,
          completion_score: 0,
          notes: null,
          nutrient_snapshot: {},
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        });
      }
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Failed to mark suggested meal as consumed.');
    } finally {
      setConsumingMealKey(null);
    }
  };

  const handleDeleteSuggestedMeal = async (meal: SuggestedMealItem, index: number) => {
    if (meal.isConsumed) return;
    const mealKey = `${meal.name}-${meal.timetoConsume}-${index}`;
    setPlanError(null);
    setDeletingMealKey(mealKey);
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}`;
      const activeDate = dailyLog?.log_date ?? today;

      const nextSuggestedMeals = suggestedMealsFromLog.filter((_, itemIndex) => itemIndex !== index);
      await firebaseDataService.upsertSuggestedMealsForDate(activeDate, nextSuggestedMeals);

      if (dailyLog) {
        setDailyLog({
          ...dailyLog,
          suggested_meals: nextSuggestedMeals,
          updated_at: now.toISOString()
        });
      } else {
        setDailyLog({
          id: activeDate,
          user_id: 'sanket',
          log_date: activeDate,
          consumed_nutrients: {},
          suggested_meals: nextSuggestedMeals,
          completion_score: 0,
          notes: null,
          nutrient_snapshot: {},
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        });
      }
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : 'Failed to delete suggested meal.');
    } finally {
      setDeletingMealKey(null);
    }
  };

  const openReplaceMealModal = (index: number) => {
    setReplaceError(null);
    setReplacementDraft(null);
    setReplaceInstructions('');
    setReplaceMealIndex(index);
    setIsReplaceModalOpen(true);
  };

  const handleGenerateReplacementMeal = async () => {
    if (replaceMealIndex === null) return;
    const mealToReplace = suggestedMealsFromLog[replaceMealIndex];
    if (!mealToReplace || mealToReplace.isConsumed) return;

    setReplaceError(null);
    setIsGeneratingReplacement(true);
    try {
      const content =
        replaceInstructions.trim().length > 0
          ? `Replace this meal with better option. Extra instruction: ${replaceInstructions.trim()}`
          : 'Replace this meal with a better option for nutrient goals.';

      const { assistantText } = await sendMessageToAssistant({
        content,
        mealContext: buildReplaceMealContext({
          nutrientKeys: nutrientKeysForPlan,
          requiredNutrients: profileRequirements,
          mustCompleteKeys,
          mealToReplace,
          replaceInstruction: replaceInstructions.trim()
        }),
        mode: 'conversation'
      });

      const parsed = parseReplacementMeal(assistantText, nutrientKeysForPlan);
      if (!parsed) {
        throw new Error('AI returned invalid replacement meal format.');
      }
      // Keep same time slot as requested.
      setReplacementDraft({
        ...parsed,
        timetoConsume: mealToReplace.timetoConsume,
        isConsumed: false
      });
    } catch (error) {
      setReplaceError(error instanceof Error ? error.message : 'Failed to generate replacement meal.');
    } finally {
      setIsGeneratingReplacement(false);
    }
  };

  const handleSaveReplacementMeal = async () => {
    if (replaceMealIndex === null || !replacementDraft) return;
    const mealToReplace = suggestedMealsFromLog[replaceMealIndex];
    if (!mealToReplace || mealToReplace.isConsumed) return;

    setReplaceError(null);
    setIsSavingReplacement(true);
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}`;
      const activeDate = dailyLog?.log_date ?? today;

      const nextSuggestedMeals = suggestedMealsFromLog.map((item, index) =>
        index === replaceMealIndex
          ? { ...replacementDraft, timetoConsume: item.timetoConsume, isConsumed: false }
          : item
      );
      await firebaseDataService.upsertSuggestedMealsForDate(activeDate, nextSuggestedMeals);

      if (dailyLog) {
        setDailyLog({
          ...dailyLog,
          suggested_meals: nextSuggestedMeals,
          updated_at: now.toISOString()
        });
      } else {
        setDailyLog({
          id: activeDate,
          user_id: 'sanket',
          log_date: activeDate,
          consumed_nutrients: {},
          suggested_meals: nextSuggestedMeals,
          completion_score: 0,
          notes: null,
          nutrient_snapshot: {},
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        });
      }

      setIsReplaceModalOpen(false);
      setReplaceMealIndex(null);
      setReplacementDraft(null);
      setReplaceInstructions('');
    } catch (error) {
      setReplaceError(error instanceof Error ? error.message : 'Failed to save replacement meal.');
    } finally {
      setIsSavingReplacement(false);
    }
  };

  return (
    <main className=" bg-card text-foreground pb-24">
      <section className="">
        <Card className=" border-none shadow-none ">
          <CardContent className="  space-y-5 px-0 ">
            {onBackToHome ? (
              <Button
                className=" z-40 rounded-full shadow-md"
                onClick={onBackToHome}
                size="icon"
                type="button"
                variant="outline"
              >
                <ArrowLeft className={`size-4 `} />
              </Button>
            ) : null}
            <Card className="bg-muted/40 shadow-none">
              <CardContent className="space-y-4 p-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                      Estimated Maintenance
                    </p>
                    <Button
                      aria-label="Refresh dashboard"
                      disabled={isRefreshing}
                      onClick={() => {
                        void handleRefreshDashboardData();
                      }}
                      size="icon"
                      variant="ghost"
                    >
                      <RefreshCcw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <p className="text-lg font-semibold">
                    {maintenanceRange === 'NA'
                      ? '🎯 NA'
                      : `🎯 ~${maintenanceRange} kcal per day`}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/60 bg-muted/55 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Consumed
                    </p>
                    <p className="mt-1 text-2xl font-bold leading-none">
                      {caloriesConsumed.toFixed(0)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">kcal</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/55 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Left
                    </p>
                    <p className="mt-1 text-2xl font-bold leading-none">{caloriesLeft.toFixed(0)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">kcal</p>
                  </div>
                </div>

                <Progress className="h-3" value={caloriesProgress} />
              </CardContent>
            </Card>





            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold tracking-wide uppercase">Nutrients</p>
                <div className="text-center">
                  <Button
                    onClick={() => setShowAllCategories(prev => !prev)}
                    variant="link"
                  >
                    {showAllCategories ? 'Show less' : 'View all'}
                  </Button>
                </div>
              </div>

            </div>





            {showAllCategories ? (
              <Card className="bg-muted/25 shadow-none py-5">
                <CardHeader className="">
                  <CardTitle className=''>
                    Nutrients Progress Today ({availableNutrientCount})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Tabs defaultValue="nutrient">
                    <TabsList className="mb-4 w-full justify-start" variant="line">
                      <TabsTrigger value="nutrient">Nutrient</TabsTrigger>
                      <TabsTrigger value="amount">Amount</TabsTrigger>
                      <TabsTrigger value="targets">Targets</TabsTrigger>
                    </TabsList>

                    <TabsContent value="nutrient">

                      <Card className="h-[50vh] overflow-y-auto p-2 bg-muted/35 shadow-none">
                        <div className="space-y-5">
                          {nutrientSections.map(section => (
                            <div className="space-y-3 " key={section.category}>
                              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                                {section.label}
                              </p>
                              {section.items.map(item => (
                                <div className="space-y-2" key={item.definition.key}>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{item.definition.label}</p>
                                    {item.completionPercent >= 100 ? (
                                      <div className="flex items-center gap-1 text-green-600">
                                        <Check className="size-4" />
                                        <p className="shrink-0 whitespace-nowrap text-right text-xs">
                                          {formatConsumedVsTarget(
                                            item.consumed,
                                            item.target,
                                            item.definition.unit
                                          )}
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-muted-foreground shrink-0 whitespace-nowrap text-right text-xs">
                                        {formatConsumedVsTarget(
                                          item.consumed,
                                          item.target,
                                          item.definition.unit
                                        )}
                                      </p>
                                    )}
                                  </div>
                                  <Progress className="h-3" value={item.completionPercent} />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </Card>

                    </TabsContent>

                    <TabsContent value="amount">
                      <Card className="h-[50vh] overflow-y-auto p-2 bg-muted/35 shadow-none">
                        <div className="space-y-5">
                          {nutrientSections.map(section => (
                            <div className="space-y-3" key={section.category}>
                              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                                {section.label}
                              </p>
                              {section.items.map(item => (
                                <div className="space-y-2" key={item.definition.key}>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="min-w-0 flex-1 truncate font-medium">{item.definition.label}</p>
                                    <p className="text-muted-foreground shrink-0 whitespace-nowrap text-right text-sm">
                                      {formatAmount(item.consumed, item.definition.unit)}
                                    </p>
                                  </div>
                                  <Progress className="h-3" value={item.completionPercent} />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </Card>
                    </TabsContent>

                    <TabsContent value="targets">
                      <Card className="h-[50vh] overflow-y-auto p-2 bg-muted/35 shadow-none">
                        <div className="space-y-5">
                          {nutrientSections.map(section => (
                            <div className="space-y-3" key={section.category}>
                              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                                {section.label}
                              </p>
                              {section.items.map(item => (
                                <div className="space-y-2" key={item.definition.key}>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="min-w-0 flex-1 truncate font-medium">{item.definition.label}</p>
                                    <p className="text-muted-foreground shrink-0 whitespace-nowrap text-right text-sm">
                                      {item.target > 0
                                        ? `${formatAmount(item.remaining, item.definition.unit)} left`
                                        : 'Target not set'}
                                    </p>
                                  </div>
                                  <Progress className="h-3" value={item.completionPercent} />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (<Card className="bg-muted/25 shadow-none py-5">
              <CardHeader>
                <CardTitle>Must Complete Nutrients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {mustCompleteNutrients.map(item => (
                  <div className="space-y-1.5" key={item.definition.key}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{item.definition.label}</p>
                      {item.completionPercent >= 100 ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="size-4" />
                          <p className="text-xs">
                            {formatConsumedVsTarget(
                              item.consumed,
                              item.target,
                              item.definition.unit
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          {formatConsumedVsTarget(item.consumed, item.target, item.definition.unit)}
                        </p>
                      )}
                    </div>
                    <Progress className="h-2.5" value={item.completionPercent} />
                  </div>
                ))}
              </CardContent>
            </Card>)}

            <SuggestedMealsCard
              areAllSuggestedMealsConsumed={areAllSuggestedMealsConsumed}
              consumingMealKey={consumingMealKey}
              deletingMealKey={deletingMealKey}
              hasSavedSuggestedMeals={hasSavedSuggestedMeals}
              mustCompleteRankByKey={mustCompleteRankByKey}
              nutrientDefinitionByKey={nutrientDefinitionByKey}
              onConsumeSuggestedMeal={(meal, index) => {
                void handleConsumeSuggestedMeal(meal, index);
              }}
              onDeleteSuggestedMeal={(meal, index) => {
                void handleDeleteSuggestedMeal(meal, index);
              }}
              onGeneratePlan={() => {
                setPlanError(null);
                setGeneratedPlanDraft(null);
                setPlanPrompt('');
                setPlanGenerationMode('full');
                setIsPlanModalOpen(true);
              }}
              onGenerateRemaining={() => {
                setPlanError(null);
                setGeneratedPlanDraft(null);
                setPlanPrompt(REMAINING_NUTRIENTS_PLAN_PROMPT);
                setPlanGenerationMode('remaining');
                setIsPlanModalOpen(true);
              }}
              onOpenReplaceMealModal={openReplaceMealModal}
              planError={planError}
              suggestedMealsFromLog={suggestedMealsFromLog}
            />

            <TodaysMealsCard
              mustCompleteRankByKey={mustCompleteRankByKey}
              nutrientDefinitionByKey={nutrientDefinitionByKey}
              todaysMeals={todaysMeals}
            />
            <div className="grid grid-cols-2 gap-3">
              {categoryCards.map(card => (
                <Card className="bg-muted/35 shadow-none" key={card.key}>
                  <CardContent className="space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      <card.Icon className="text-muted-foreground size-4" />
                      <p className="text-sm font-medium">{card.label}</p>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {card.completed}/{card.tracked} nutrients done
                    </p>
                    <Progress
                      className="h-2"
                      style={
                        {
                          '--color-primary': card.color
                        } as CSSProperties
                      }
                      value={card.completionPercent}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>

            <GeneratePlanDialog
              generatedPlanDraft={generatedPlanDraft}
              isGeneratingPlan={isGeneratingPlan}
              isSavingPlan={isSavingPlan}
              mustCompleteRankByKey={mustCompleteRankByKey}
              nutrientDefinitionByKey={nutrientDefinitionByKey}
              onGenerate={() => {
                void handleGenerateSuggestedPlan();
              }}
              onOpenChange={open => {
                setIsPlanModalOpen(open);
                if (!open) {
                  setPlanError(null);
                  setGeneratedPlanDraft(null);
                  setPlanGenerationMode('full');
                }
              }}
              onPlanPromptChange={setPlanPrompt}
              onSave={() => {
                void handleSaveSuggestedPlan();
              }}
              open={isPlanModalOpen}
              planError={planError}
              planPrompt={planPrompt}
            />

            <ReplaceMealDialog
              isGeneratingReplacement={isGeneratingReplacement}
              isSavingReplacement={isSavingReplacement}
              mustCompleteRankByKey={mustCompleteRankByKey}
              nutrientDefinitionByKey={nutrientDefinitionByKey}
              onGenerateReplacement={() => {
                void handleGenerateReplacementMeal();
              }}
              onOpenChange={open => {
                setIsReplaceModalOpen(open);
                if (!open) {
                  setReplaceError(null);
                  setReplacementDraft(null);
                  setReplaceMealIndex(null);
                }
              }}
              onReplaceInstructionsChange={setReplaceInstructions}
              onSaveReplacement={() => {
                void handleSaveReplacementMeal();
              }}
              open={isReplaceModalOpen}
              replaceError={replaceError}
              replaceInstructions={replaceInstructions}
              replacementContainsList={replacementContainsList}
              replacementDraft={replacementDraft}
            />
          </CardContent>
        </Card>
      </section >
    </main >
  );
};

export default NutritionPage;
