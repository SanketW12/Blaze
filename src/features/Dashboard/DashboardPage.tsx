import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bell, Check, CircleDot, Dna, Download, Droplets, Flame, Pill, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  DialogTrigger
} from '@/components/ui/dialog';
import { firebaseDataService } from '@/firebase';
import { NUTRIENTS_CONFIG } from '@/config';
import { useAppStore } from '@/store';
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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DashboardPage = () => {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const dailyLog = useAppStore(state => state.dailyLog);
  const userProfile = useAppStore(state => state.userProfile);
  const meals = useAppStore(state => state.meals);
  const setUserProfile = useAppStore(state => state.setUserProfile);
  const setDailyLog = useAppStore(state => state.setDailyLog);
  const setMeals = useAppStore(state => state.setMeals);

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
          </CardContent>
        </Card>
      </section >
    </main >
  );
};

export default DashboardPage;
