import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Check,
  CircleDot,
  Dna,
  Download,
  Droplets,
  Flame,
  Loader2,
  Pill,
  RefreshCcw,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogPanel,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { addNutrientMaps, firebaseDataService, normalizeNutrientMap } from '@/firebase';
import { NUTRIENTS_CONFIG } from '@/config';
import { useAppStore } from '@/store';
import { sendMessageToAssistant } from '@/features/Chat/chatservice';
import {
  DASHBOARD_MOCK_CONSUMED_NUTRIENTS,
  DASHBOARD_MOCK_REQUIRED_NUTRIENTS,
  DASHBOARD_USE_MOCK_DATA
} from './dashboard.mock';

type NutrientUnit = 'g' | 'mg' | 'mcg' | 'ml' | 'kcal';

interface NutrientDefinition {
  key: string;
  label: string;
  unit: NutrientUnit;
  category: string;
  defaultDaily?: number;
}

interface NutrientProgressItem {
  definition: NutrientDefinition;
  target: number;
  consumed: number;
  remaining: number;
  completionPercent: number;
}

interface SuggestedMealContainItem {
  item: string;
  quantity: string;
}

interface SuggestedMealItem {
  name: string;
  description: string;
  contains: SuggestedMealContainItem[];
  timetoConsume: string;
  nutrientSnapshot: Record<string, number>;
  isConsumed: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  macronutrient: 'Macronutrients',
  amino_acid: 'Amino Acids',
  fatty_acid: 'Fatty Acids',
  vitamin: 'Vitamins',
  mineral: 'Minerals'
};

const CATEGORY_COLORS: Record<string, string> = {
  macronutrient: 'var(--chart-1)',
  amino_acid: 'var(--chart-2)',
  fatty_acid: 'var(--chart-3)',
  vitamin: 'var(--chart-4)',
  mineral: 'var(--chart-5)'
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  macronutrient: Flame,
  amino_acid: Dna,
  fatty_acid: Droplets,
  vitamin: Pill,
  mineral: CircleDot
};

const CATEGORY_ORDER = [
  'macronutrient',
  'amino_acid',
  'fatty_acid',
  'vitamin',
  'mineral'
] as const;

const FALLBACK_MUST_COMPLETE_KEYS = [
  'protein',
  'vitamin_d',
  'magnesium',
  'vitamin_b12',
  'omega3',
  'zinc',
  'potassium',
  'fiber',
  'iron',
  'vitamin_c'
] as const;

const formatAmount = (value: number, unit: NutrientDefinition['unit']) => {
  if (!Number.isFinite(value) || value <= 0) return `0${unit}`;

  if (unit === 'g') {
    return `${value >= 100 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, '')}${unit}`;
  }

  if (unit === 'ml' || unit === 'mg' || unit === 'kcal') {
    return `${value.toFixed(0)}${unit}`;
  }

  return `${value.toFixed(1).replace(/\.0$/, '')}${unit}`;
};

const formatConsumedVsTarget = (
  consumed: number,
  target: number,
  unit: NutrientDefinition['unit']
) => {
  if (target <= 0) return `${formatAmount(consumed, unit)}/--`;

  const consumedValue = formatAmount(consumed, unit).replace(unit, '');
  const targetValue = formatAmount(target, unit).replace(unit, '');
  return `${consumedValue}/${targetValue} ${unit}`;
};

const formatProfileValue = (value: unknown, suffix = '') => {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}${suffix}`;
  }
  if (typeof value === 'string') {
    return suffix ? `${value}${suffix}` : value;
  }
  return 'Not set';
};

const normalizeMealContains = (
  contains: unknown,
  legacyQuantity?: unknown
): SuggestedMealContainItem[] => {
  if (Array.isArray(contains)) {
    return contains
      .map(entry => {
        if (!entry || typeof entry !== 'object') return null;
        const rawEntry = entry as Record<string, unknown>;
        const item = typeof rawEntry.item === 'string' ? rawEntry.item.trim() : '';
        const quantity = typeof rawEntry.quantity === 'string' ? rawEntry.quantity.trim() : '';
        if (!item || !quantity) return null;
        return { item, quantity };
      })
      .filter((entry): entry is SuggestedMealContainItem => Boolean(entry));
  }

  if (typeof contains === 'string' && contains.trim()) {
    const quantity =
      typeof legacyQuantity === 'string' && legacyQuantity.trim()
        ? legacyQuantity.trim()
        : 'NA';
    return [{ item: contains.trim(), quantity }];
  }

  return [];
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const buildSuggestedMealsContext = ({
  nutrientKeys,
  requiredNutrients,
  mustCompleteKeys
}: {
  nutrientKeys: string[];
  requiredNutrients: Record<string, number>;
  mustCompleteKeys: string[];
}) => {
  const suggestedMealsSchema = [
    {
      name: 'string',
      description: 'string',
      contains: [{ item: 'string', quantity: 'string' }],
      timetoConsume: 'string',
      nutrientSnapshot: Object.fromEntries(nutrientKeys.map(key => [key, 0])),
      isConsumed: false
    }
  ];

  return `You are in SUGGESTED MEAL PLAN MODE.
Return ONLY valid JSON. No markdown. No prose.
Output schema:
${JSON.stringify(suggestedMealsSchema, null, 2)}
User required_nutrients target:
${JSON.stringify(requiredNutrients, null, 2)}
User must_complete_keys priority:
${JSON.stringify(mustCompleteKeys, null, 2)}
Rules:
- Return an array of suggested meals for a full day.
- JSON must be parseable.
- Each nutrientSnapshot value must be a number.
- nutrientSnapshot must include exactly these keys (no extras, no missing): ${nutrientKeys.join(', ')}.
- Plan should target completion of required_nutrients.
- Prioritize must_complete_keys while distributing meals through the day.
- isConsumed must be boolean.
- Keep meal names practical and real foods.
- description must clearly explain what the meal is and what it contains (key ingredients / preparation style) in 1-2 short lines.
- contains must be an array of objects: [{ item, quantity }].
- Each contains item must include a clear ingredient name in item and serving amount in quantity (example: "200gm", "2 slices", "350ml").`;
};

const buildReplaceMealContext = ({
  nutrientKeys,
  requiredNutrients,
  mustCompleteKeys,
  mealToReplace,
  replaceInstruction
}: {
  nutrientKeys: string[];
  requiredNutrients: Record<string, number>;
  mustCompleteKeys: string[];
  mealToReplace: SuggestedMealItem;
  replaceInstruction: string;
}) => {
  const replacementSchema = {
    name: 'string',
    description: 'string',
    contains: [{ item: 'string', quantity: 'string' }],
    timetoConsume: mealToReplace.timetoConsume,
    nutrientSnapshot: Object.fromEntries(nutrientKeys.map(key => [key, 0])),
    isConsumed: false
  };

  return `You are in REPLACE MEAL MODE.
Return ONLY valid JSON. No markdown. No prose.
Output schema:
${JSON.stringify(replacementSchema, null, 2)}
Meal being replaced:
${JSON.stringify(mealToReplace, null, 2)}
User required_nutrients target:
${JSON.stringify(requiredNutrients, null, 2)}
User must_complete_keys priority:
${JSON.stringify(mustCompleteKeys, null, 2)}
Replace instruction:
${replaceInstruction || 'No additional instruction'}
Rules:
- Keep timetoConsume exactly as "${mealToReplace.timetoConsume}".
- Return one replacement meal object only.
- nutrientSnapshot values must be numbers.
- nutrientSnapshot must include exactly these keys (no extras, no missing): ${nutrientKeys.join(', ')}.
- Prefer better fit toward required_nutrients and must_complete_keys than the replaced meal.
- isConsumed must be false.
- description must clearly explain what the replacement meal is and what it contains (main ingredients / preparation style) in 1-2 short lines.
- contains must be an array of objects: [{ item, quantity }].
- Each contains item must include a clear ingredient name in item and serving amount in quantity (example: "200gm", "2 slices", "350ml").`;
};

const DashboardPage = () => {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planPrompt, setPlanPrompt] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [consumingMealKey, setConsumingMealKey] = useState<string | null>(null);
  const [generatedPlanDraft, setGeneratedPlanDraft] = useState<SuggestedMealItem[] | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [replaceInstructions, setReplaceInstructions] = useState('');
  const [replaceMealIndex, setReplaceMealIndex] = useState<number | null>(null);
  const [replacementDraft, setReplacementDraft] = useState<SuggestedMealItem | null>(null);
  const [isGeneratingReplacement, setIsGeneratingReplacement] = useState(false);
  const [isSavingReplacement, setIsSavingReplacement] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const dailyLog = useAppStore(state => state.dailyLog);
  const userProfile = useAppStore(state => state.userProfile);
  const meals = useAppStore(state => state.meals);
  const setUserProfile = useAppStore(state => state.setUserProfile);
  const setDailyLog = useAppStore(state => state.setDailyLog);
  const setMeals = useAppStore(state => state.setMeals);
  const addMeal = useAppStore(state => state.addMeal);

  const nutrientKeysForPlan = useMemo(
    () => (NUTRIENTS_CONFIG.nutrients as NutrientDefinition[]).map(item => item.key),
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

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const consumedNutrients = useMemo(
    () =>
      DASHBOARD_USE_MOCK_DATA
        ? DASHBOARD_MOCK_CONSUMED_NUTRIENTS
        : (dailyLog?.consumed_nutrients ?? {}),
    [dailyLog?.consumed_nutrients]
  );
  const profileRequirements = useMemo(
    () =>
      DASHBOARD_USE_MOCK_DATA
        ? DASHBOARD_MOCK_REQUIRED_NUTRIENTS
        : (userProfile?.required_nutrients ?? {}),
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
  const rawProfile = userProfile as unknown as Record<string, unknown> | null;
  const profileInfoRows = useMemo(
    () => [
      { label: 'Name', value: formatProfileValue(rawProfile?.name) },
      { label: 'Age', value: formatProfileValue(rawProfile?.age, ' years') },
      { label: 'Gender', value: formatProfileValue(rawProfile?.gender) },
      {
        label: 'Height',
        value: formatProfileValue(rawProfile?.height_cm ?? rawProfile?.heightCm, ' cm')
      },
      {
        label: 'Weight',
        value: formatProfileValue(rawProfile?.weight_kg ?? rawProfile?.weightKg, ' kg')
      },
      { label: 'Activity Level', value: formatProfileValue(rawProfile?.activity_level ?? rawProfile?.activityLevel) },
      { label: 'BMI', value: formatProfileValue(rawProfile?.bmi) },
      { label: 'BMR', value: formatProfileValue(rawProfile?.bmr, ' kcal/day') }
    ],
    [rawProfile]
  );

  const profileName = formatProfileValue(rawProfile?.name) === 'Not set' ? 'NA' : formatProfileValue(rawProfile?.name);

  const parseSuggestedMealPlan = (assistantText: string): SuggestedMealItem[] | null => {
    const trimmed = assistantText.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonCandidate = (fencedMatch?.[1] ?? trimmed).trim();

    try {
      const parsed = JSON.parse(jsonCandidate) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return null;

      const normalizedMeals = parsed
        .map(item => {
          if (!item || typeof item !== 'object') return null;
          const rawItem = item as Record<string, unknown>;
          if (typeof rawItem.name !== 'string' || !rawItem.name.trim()) return null;
          if (typeof rawItem.description !== 'string' || !rawItem.description.trim()) return null;
          const contains = normalizeMealContains(rawItem.contains);
          if (contains.length === 0) return null;
          if (typeof rawItem.timetoConsume !== 'string' || !rawItem.timetoConsume.trim()) return null;
          if (typeof rawItem.isConsumed !== 'boolean') return null;

          const rawSnapshot = rawItem.nutrientSnapshot as Record<string, unknown> | undefined;
          if (!rawSnapshot || typeof rawSnapshot !== 'object') return null;
          const snapshotKeys = Object.keys(rawSnapshot);
          const hasAllRequiredKeys = nutrientKeysForPlan.every(key => snapshotKeys.includes(key));
          const hasOnlyAllowedKeys = snapshotKeys.every(key => nutrientKeysForPlan.includes(key));
          if (!hasAllRequiredKeys || !hasOnlyAllowedKeys) return null;

          const nutrientSnapshot = Object.fromEntries(
            nutrientKeysForPlan.map(key => [key, Number(rawSnapshot[key]) || 0])
          );

          return {
            name: rawItem.name,
            description: rawItem.description,
            contains,
            timetoConsume: rawItem.timetoConsume,
            nutrientSnapshot,
            isConsumed: rawItem.isConsumed
          } as SuggestedMealItem;
        })
        .filter((item): item is SuggestedMealItem => Boolean(item));

      return normalizedMeals.length > 0 ? normalizedMeals : null;
    } catch {
      return null;
    }
  };

  const parseReplacementMeal = (assistantText: string): SuggestedMealItem | null => {
    const trimmed = assistantText.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonCandidate = (fencedMatch?.[1] ?? trimmed).trim();
    try {
      const parsed = JSON.parse(jsonCandidate) as unknown;
      const candidate =
        Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : parsed;
      if (!candidate || typeof candidate !== 'object') return null;
      const rawItem = candidate as Record<string, unknown>;
      if (typeof rawItem.name !== 'string' || !rawItem.name.trim()) return null;
      if (typeof rawItem.description !== 'string' || !rawItem.description.trim()) return null;
      const contains = normalizeMealContains(rawItem.contains);
      if (contains.length === 0) return null;
      if (typeof rawItem.timetoConsume !== 'string' || !rawItem.timetoConsume.trim()) return null;
      if (typeof rawItem.isConsumed !== 'boolean') return null;

      const rawSnapshot = rawItem.nutrientSnapshot as Record<string, unknown> | undefined;
      if (!rawSnapshot || typeof rawSnapshot !== 'object') return null;
      const snapshotKeys = Object.keys(rawSnapshot);
      const hasAllRequiredKeys = nutrientKeysForPlan.every(key => snapshotKeys.includes(key));
      const hasOnlyAllowedKeys = snapshotKeys.every(key => nutrientKeysForPlan.includes(key));
      if (!hasAllRequiredKeys || !hasOnlyAllowedKeys) return null;

      const nutrientSnapshot = Object.fromEntries(
        nutrientKeysForPlan.map(key => [key, Number(rawSnapshot[key]) || 0])
      );

      return {
        name: rawItem.name,
        description: rawItem.description,
        contains,
        timetoConsume: rawItem.timetoConsume,
        nutrientSnapshot,
        isConsumed: false
      };
    } catch {
      return null;
    }
  };

  const handleRefreshDashboardData = async () => {
    setIsRefreshing(true);
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(now.getDate()).padStart(2, '0')}`;

      const [profile, todayLog] = await Promise.all([
        firebaseDataService.getUserProfile(),
        firebaseDataService.getDailyLog(today)
      ]);

      const dailyLogData = todayLog ?? (await firebaseDataService.getLatestDailyLog());
      const activeLogDate =
        (dailyLogData as Record<string, unknown> | null)?.date?.toString() ?? today;
      const mealsForActiveDate = await firebaseDataService.listMealsForDate(activeLogDate);

      if (profile) {
        const rawData = profile as unknown as Record<string, unknown>;
        setUserProfile({
          id: 'profile',
          user_id: 'sanket',
          name: (rawData.name as string | null) ?? null,
          age: (rawData.age as number | null) ?? null,
          gender: (rawData.gender as string | null) ?? null,
          weight_kg:
            (rawData.weightKg as number | null) ??
            (rawData.weight_kg as number | null) ??
            null,
          height_cm:
            (rawData.heightCm as number | null) ??
            (rawData.height_cm as number | null) ??
            null,
          activity_level:
            (rawData.activityLevel as string | null) ??
            (rawData.activity_level as string | null) ??
            null,
          bmi: (rawData.bmi as number | null) ?? null,
          bmr: (rawData.bmr as number | null) ?? null,
          maintenanceCalories:
            (rawData.maintenanceCalories as
              | { min?: number; max?: number; unit?: string; label?: string }
              | undefined) ?? null,
          required_nutrients:
            (rawData.requiredNutrients as Record<string, number> | undefined) ??
            (rawData.required_nutrients as Record<string, number> | undefined) ??
            {},
          must_complete_keys:
            (rawData.mustCompleteKeys as string[] | undefined) ??
            (rawData.must_complete_keys as string[] | undefined) ??
            undefined,
          created_at: '',
          updated_at: new Date().toISOString()
        });
      }

      if (dailyLogData) {
        const rawData = dailyLogData as unknown as Record<string, unknown>;
        setDailyLog({
          id: today,
          user_id: 'sanket',
          log_date: (rawData.date as string | undefined) ?? today,
          consumed_nutrients:
            (rawData.consumedNutrients as Record<string, number> | undefined) ??
            (rawData.consumed_nutrients as Record<string, number> | undefined) ??
            {},
          suggested_meals:
            (rawData.suggestedMeals as SuggestedMealItem[] | undefined) ??
            (rawData.suggested_meals as SuggestedMealItem[] | undefined) ??
            [],
          completion_score: 0,
          notes: (rawData.notes as string | null | undefined) ?? null,
          nutrient_snapshot: {},
          created_at: '',
          updated_at: new Date().toISOString()
        });
      } else {
        setDailyLog(null);
      }

      setMeals(
        mealsForActiveDate.map(meal => ({
          id: meal.id,
          user_id: 'sanket',
          daily_log_id:
            ((dailyLogData as Record<string, unknown> | null)?.id as string | null) ??
            null,
          food_name: meal.name,
          nutrient_snapshot: meal.nutrientSnapshot,
          quantity: meal.quantity,
          unit: meal.unit,
          source: meal.source,
          logged_at: meal.loggedAt,
          created_at:
            typeof meal.createdAt === 'string'
              ? meal.createdAt
              : new Date().toISOString()
        }))
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGenerateSuggestedPlan = async () => {
    setPlanError(null);
    setIsGeneratingPlan(true);

    try {
      const extraInstructions = planPrompt.trim();
      const content = extraInstructions
        ? `Generate a practical meal plan to complete my nutrient goals. Extra preference: ${extraInstructions}`
        : 'Generate a practical meal plan to complete my nutrient goals for today.';

      const { assistantText } = await sendMessageToAssistant({
        content,
        mealContext: buildSuggestedMealsContext({
          nutrientKeys: nutrientKeysForPlan,
          requiredNutrients: profileRequirements,
          mustCompleteKeys
        }),
        mode: 'conversation'
      });

      const parsedPlan = parseSuggestedMealPlan(assistantText);
      if (!parsedPlan) {
        throw new Error('AI returned an invalid plan format. Please try again.');
      }
      setGeneratedPlanDraft(parsedPlan);
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

      const parsed = parseReplacementMeal(assistantText);
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

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  };

  return (
    <main className="min-h-screen bg-card text-foreground pb-24">
      <section className="mx-auto w-full max-w-lg ">
        <Card className=" border-none shadow-none ">
          <CardContent className="space-y-5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hi,</p>
                <h1 className="text-2xl font-semibold">Sanket</h1>
              </div>
              <div className="flex items-center gap-2">

                <Button
                  aria-label="Install app"
                  disabled={!installPromptEvent}
                  onClick={() => {
                    void handleInstallClick();
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <Download />
                </Button>

                <Button size="icon" variant="ghost">
                  <Bell />
                </Button>
                <Dialog>
                  <DialogTrigger aria-label="Open profile details">
                    <Avatar size="lg">
                      <AvatarImage
                        alt="Profile avatar"
                        src="https://sanketw.netlify.app/assets/sanket5-CUpPUPkP.jpg"
                      />
                      <AvatarFallback>AS</AvatarFallback>
                    </Avatar>
                  </DialogTrigger>
                  <DialogContent className="before:hidden sm:max-w-md border-none shadow-lg">

                    <DialogPanel className="space-y-4 p-0">
                      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                        <div className="h-12 bg-linear-to-r from-slate-300/20 via-slate-200/10 to-slate-300/20" />
                        <div className="px-4 pb-4">
                          <div className="-mt-6 flex items-end justify-center">
                            <Avatar className="size-[80px] border-4 border-card">
                              <AvatarImage
                                alt="Profile avatar"
                                src="https://sanketw.netlify.app/assets/sanket5-CUpPUPkP.jpg"
                              />
                              <AvatarFallback>AS</AvatarFallback>
                            </Avatar>

                          </div>

                          <div className="mt-3 flex justify-center">
                            <p className="text-2xl font-semibold">{profileName}</p>

                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            {profileInfoRows.map(row => (
                              <div
                                className="rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                                key={row.label}
                              >
                                <p className="text-muted-foreground text-xs">{row.label}</p>
                                <p className="mt-1 text-sm font-semibold">{row.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </DialogPanel>
                  </DialogContent>
                </Dialog>
              </div>
            </div>



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

            <Card className="bg-muted/25 shadow-none py-5">
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
            </Card>



            {showAllCategories ? (
              <Card className="bg-muted/25 shadow-none py-6">
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
            ) : (<div className="grid grid-cols-2 gap-3">
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
            </div>)}
            <Card className="bg-muted/25 shadow-none py-5">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Suggested Meals Plan</CardTitle>
                  {!hasSavedSuggestedMeals ? (
                    <Button
                      onClick={() => {
                        setPlanError(null);
                        setGeneratedPlanDraft(null);
                        setIsPlanModalOpen(true);
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      <Sparkles className="mr-1.5 size-4" />
                      Generate meal plan
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  AI-generated daily meals to help complete your nutrient goals.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {suggestedMealsFromLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No suggested meal plan yet. Generate one to plan your day.
                  </p>
                ) : (
                  <Accordion className="rounded-lg border border-border/60 bg-card/70 px-3">
                    {suggestedMealsFromLog.map((meal, index) => {
                      const containsList = normalizeMealContains(
                        meal.contains,
                        (meal as unknown as { quantity?: unknown }).quantity
                      );
                      const mealKey = `${meal.name}-${meal.timetoConsume}-${index}`;
                      const mealNutrients = Object.entries(meal.nutrientSnapshot ?? {})
                        .filter(([, value]) => Number(value) > 0)
                        .sort(([keyA, valueA], [keyB, valueB]) => {
                          const rankA = mustCompleteRankByKey[keyA];
                          const rankB = mustCompleteRankByKey[keyB];
                          if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
                          if (rankA !== undefined) return -1;
                          if (rankB !== undefined) return 1;
                          return Number(valueB) - Number(valueA);
                        });

                      return (
                        <AccordionItem className="border-border/60" key={mealKey} value={mealKey}>
                          <AccordionTrigger className="items-center py-3 max-w-full  ">
                            <div className="flex w-full min-w-0 items-start gap-2">
                              <div
                                className="shrink-0 pt-1"
                                onClick={event => event.stopPropagation()}
                              >
                                <Checkbox
                                  checked={meal.isConsumed}
                                  disabled={meal.isConsumed || consumingMealKey === mealKey}
                                  onCheckedChange={checked => {
                                    if (checked === true) {
                                      void handleConsumeSuggestedMeal(meal, index);
                                    }
                                  }}
                                />
                              </div>
                              <div className="w-full">
                                <p className="block max-w-[90%] overflow-hidden text-ellipsis whitespace-nowrap  font-medium">
                                  {meal.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {meal.timetoConsume} •{' '}
                                  {Number(meal.nutrientSnapshot.calories ?? 0).toFixed(0)}kcal
                                  {meal.isConsumed
                                    ? ' • Consumed'
                                    : consumingMealKey === mealKey
                                      ? ' • Saving...'
                                      : ''}
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-3 flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-6">
                              <div className="min-w-0">
                                <p className="flex wrap-break-word font-medium">
                                  {meal.name}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {meal.description?.trim() || 'No meal description available yet.'}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">Contains:</p>
                                {containsList.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">NA</p>
                                ) : (
                                  <div className="space-y-1">
                                    {containsList.map((item, itemIndex) => (
                                      <p
                                        className="text-xs text-muted-foreground"
                                        key={`${item.item}-${item.quantity}-${itemIndex}`}
                                      >
                                        {item.item} - {item.quantity}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {!meal.isConsumed ? (
                                <Button
                                  onClick={() => openReplaceMealModal(index)}
                                  size="xs"
                                  type="button"
                                  variant="outline"
                                >
                                  Replace
                                </Button>
                              ) : null}

                            </div>

                            {mealNutrients.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No nutrient details available.</p>
                            ) : (
                              <div className="space-y-1">
                                {mealNutrients.map(([key, value]) => {
                                  const definition = nutrientDefinitionByKey[key];
                                  const unit = definition?.unit ?? '';
                                  const label = definition?.label ?? key.replaceAll('_', ' ');
                                  return (
                                    <div className="flex items-center justify-between text-xs" key={key}>
                                      <p className="capitalize text-muted-foreground">{label}</p>
                                      <p className="font-medium">
                                        {formatAmount(Number(value), unit as NutrientUnit)}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
                {planError ? <p className="text-sm text-destructive">{planError}</p> : null}
              </CardContent>
            </Card>

            <Card className="bg-muted/25 shadow-none py-5">
              <CardHeader>
                <CardTitle>Today&apos;s Meals ({todaysMeals.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {todaysMeals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No meals logged yet.</p>
                ) : (
                  <Accordion className="rounded-lg border border-border/60 bg-card/70 px-3">
                    {todaysMeals.map(meal => {
                      const mealNutrients = Object.entries(meal.nutrient_snapshot ?? {})
                        .filter(([, value]) => Number(value) > 0)
                        .sort(([keyA, valueA], [keyB, valueB]) => {
                          const rankA = mustCompleteRankByKey[keyA];
                          const rankB = mustCompleteRankByKey[keyB];

                          if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
                          if (rankA !== undefined) return -1;
                          if (rankB !== undefined) return 1;
                          return Number(valueB) - Number(valueA);
                        });

                      return (
                        <AccordionItem className="border-border/60" key={meal.id} value={meal.id}>
                          <AccordionTrigger className="items-center py-3">
                            <div className="flex w-full items-center justify-between gap-2">
                              <div>
                                <p className="font-medium">{meal.food_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {meal.quantity} {meal.unit}
                                </p>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {Number(meal.nutrient_snapshot.calories ?? 0).toFixed(0)}kcal
                              </p>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            {mealNutrients.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No nutrient details available.</p>
                            ) : (
                              <div className="space-y-1">
                                {mealNutrients.map(([key, value]) => {
                                  const definition = nutrientDefinitionByKey[key];
                                  const unit = definition?.unit ?? '';
                                  const label = definition?.label ?? key.replaceAll('_', ' ');
                                  return (
                                    <div className="flex items-center justify-between text-xs" key={key}>
                                      <p className="capitalize text-muted-foreground">{label}</p>
                                      <p className="font-medium">
                                        {formatAmount(Number(value), unit as NutrientUnit)}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>

            <Dialog
              onOpenChange={open => {
                setIsPlanModalOpen(open);
                if (!open) {
                  setPlanError(null);
                  setGeneratedPlanDraft(null);
                }
              }}
              open={isPlanModalOpen}
            >
              <DialogContent className="before:hidden sm:max-w-lg border-none shadow-lg">
                <DialogPanel className="space-y-4 ">
                  <DialogTitle>Generate Suggested Meal Plan</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Add optional preferences, then generate an AI plan for the day.
                  </p>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm outline-none ring-ring/30 focus:ring-2"
                    onChange={event => setPlanPrompt(event.target.value)}
                    placeholder="Optional notes (e.g., vegetarian, no dairy, high protein breakfast)"
                    value={planPrompt}
                  />

                  <Button
                    className="w-full"
                    disabled={isGeneratingPlan}
                    onClick={() => {
                      void handleGenerateSuggestedPlan();
                    }}
                    type="button"
                  >
                    {isGeneratingPlan ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Generating plan...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 size-4" />
                        Generate
                      </>
                    )}
                  </Button>

                  {generatedPlanDraft ? (
                    <div className="space-y-3">
                      <div className="max-h-64 overflow-y-auto rounded-md border border-border/60 p-2">
                        <Accordion className="rounded-md border border-border/40 bg-card/70 px-3">
                          {generatedPlanDraft.map((meal, index) => {
                            const containsList = normalizeMealContains(meal.contains);
                            const mealNutrients = Object.entries(meal.nutrientSnapshot ?? {})
                              .filter(([, value]) => Number(value) > 0)
                              .sort(([keyA, valueA], [keyB, valueB]) => {
                                const rankA = mustCompleteRankByKey[keyA];
                                const rankB = mustCompleteRankByKey[keyB];
                                if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
                                if (rankA !== undefined) return -1;
                                if (rankB !== undefined) return 1;
                                return Number(valueB) - Number(valueA);
                              });

                            return (
                              <AccordionItem
                                className="border-border/60"
                                key={`${meal.name}-${meal.timetoConsume}-${index}`}
                                value={`${meal.name}-${meal.timetoConsume}-${index}`}
                              >
                                <AccordionTrigger className="items-center py-3">
                                  <div className="flex w-full items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="block w-full overflow-hidden text-ellipsis whitespace-nowrap font-medium">
                                        {meal.name}
                                      </p>
                                      <p className="line-clamp-2 text-left text-xs text-muted-foreground">
                                        {meal.description?.trim() || 'No meal description available yet.'}
                                      </p>
                                      <p className="text-xs text-muted-foreground">{meal.timetoConsume}</p>
                                    </div>
                                    <p className="shrink-0 text-xs text-muted-foreground">
                                      {Number(meal.nutrientSnapshot.calories ?? 0).toFixed(0)}kcal
                                    </p>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-3">
                                  <p className="text-xs text-muted-foreground">
                                    Contains:
                                  </p>
                                  {containsList.length === 0 ? (
                                    <p className="mb-2 text-xs text-muted-foreground">NA</p>
                                  ) : (
                                    <div className="mb-2 space-y-1">
                                      {containsList.map((item, itemIndex) => (
                                        <p
                                          className="text-xs text-muted-foreground"
                                          key={`${item.item}-${item.quantity}-${itemIndex}`}
                                        >
                                          {item.item} - {item.quantity}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                  {mealNutrients.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                      No nutrient details available.
                                    </p>
                                  ) : (
                                    <div className="space-y-1">
                                      {mealNutrients.map(([key, value]) => {
                                        const definition = nutrientDefinitionByKey[key];
                                        const unit = definition?.unit ?? '';
                                        const label = definition?.label ?? key.replaceAll('_', ' ');
                                        return (
                                          <div className="flex items-center justify-between text-xs" key={key}>
                                            <p className="capitalize text-muted-foreground">{label}</p>
                                            <p className="font-medium">
                                              {formatAmount(Number(value), unit as NutrientUnit)}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>

                      <Button
                        className="w-full"
                        disabled={isSavingPlan}
                        onClick={() => {
                          void handleSaveSuggestedPlan();
                        }}
                        type="button"
                        variant="secondary"
                      >
                        {isSavingPlan ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Saving plan...
                          </>
                        ) : (
                          'Save meal plan'
                        )}
                      </Button>
                    </div>
                  ) : null}

                  {planError ? <p className="text-sm text-destructive">{planError}</p> : null}
                </DialogPanel>
              </DialogContent>
            </Dialog>

            <Dialog
              onOpenChange={open => {
                setIsReplaceModalOpen(open);
                if (!open) {
                  setReplaceError(null);
                  setReplacementDraft(null);
                  setReplaceMealIndex(null);
                }
              }}
              open={isReplaceModalOpen}
            >
              <DialogContent className="before:hidden sm:max-w-lg border-none shadow-lg">
                <DialogPanel className="space-y-4 ">
                  <DialogTitle>Replace Suggested Meal</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Add optional instructions for the replacement meal. Time slot stays the same.
                  </p>

                  <textarea
                    className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm outline-none ring-ring/30 focus:ring-2"
                    onChange={event => setReplaceInstructions(event.target.value)}
                    placeholder="Optional notes (e.g., lower calories, vegetarian, no dairy)"
                    value={replaceInstructions}
                  />

                  <Button
                    className="w-full"
                    disabled={isGeneratingReplacement}
                    onClick={() => {
                      void handleGenerateReplacementMeal();
                    }}
                    type="button"
                  >
                    {isGeneratingReplacement ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Generating replacement...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 size-4" />
                        Generate replacement
                      </>
                    )}
                  </Button>

                  {replacementDraft ? (
                    <div className="space-y-3">
                      <div className="rounded-md border border-border/60 p-3">
                        <p className="font-medium">{replacementDraft.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {replacementDraft.description}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Contains:
                        </p>
                        {replacementContainsList.length === 0 ? (
                          <p className="text-xs text-muted-foreground">NA</p>
                        ) : (
                          <div className="space-y-1">
                            {replacementContainsList.map((item, itemIndex) => (
                              <p
                                className="text-xs text-muted-foreground"
                                key={`${item.item}-${item.quantity}-${itemIndex}`}
                              >
                                {item.item} - {item.quantity}
                              </p>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">{replacementDraft.timetoConsume}</p>
                        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                          {Object.entries(replacementDraft.nutrientSnapshot)
                            .filter(([, value]) => Number(value) > 0)
                            .sort(([keyA, valueA], [keyB, valueB]) => {
                              const rankA = mustCompleteRankByKey[keyA];
                              const rankB = mustCompleteRankByKey[keyB];
                              if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
                              if (rankA !== undefined) return -1;
                              if (rankB !== undefined) return 1;
                              return Number(valueB) - Number(valueA);
                            })
                            .map(([key, value]) => {
                              const definition = nutrientDefinitionByKey[key];
                              const unit = definition?.unit ?? '';
                              const label = definition?.label ?? key.replaceAll('_', ' ');
                              return (
                                <div className="flex items-center justify-between text-xs" key={key}>
                                  <p className="capitalize text-muted-foreground">{label}</p>
                                  <p className="font-medium">
                                    {formatAmount(Number(value), unit as NutrientUnit)}
                                  </p>
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      <Button
                        className="w-full"
                        disabled={isSavingReplacement}
                        onClick={() => {
                          void handleSaveReplacementMeal();
                        }}
                        type="button"
                        variant="secondary"
                      >
                        {isSavingReplacement ? (
                          <>
                            <Loader2 className="mr-2 size-4 animate-spin" />
                            Saving replacement...
                          </>
                        ) : (
                          'Save replacement'
                        )}
                      </Button>
                    </div>
                  ) : null}

                  {replaceError ? <p className="text-sm text-destructive">{replaceError}</p> : null}
                </DialogPanel>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </section >
    </main >
  );
};

export default DashboardPage;
