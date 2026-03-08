import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogTitle
} from '@/components/ui/dialog';

import { CommunicationStreakCard } from '@/features/Communication/components/CommunicationStreakCard';
import { disciplineStreakService } from '@/features/Home/services/disciplineStreakService';
import type { DisciplineStreakState } from '@/features/Home/types/disciplineStreak';
import { buildEmptyDisciplineStreakState } from '@/features/Home/utils/disciplineStreak';

interface DisciplinePageProps {
  onBackToHome?: () => void;
}



type UnlockStage = {
  day: number;
  badge: string;
  title: string;
  benefits: string[];
};

const UNLOCK_STAGES: UnlockStage[] = [
  {
    day: 1,
    badge: 'Initiate',
    title: 'The Beginning',
    benefits: ['Awareness of urges', 'Discipline journey begins', 'First control over impulses']
  },
  {
    day: 3,
    badge: 'Apprentice',
    title: 'Control Awakens',
    benefits: ['Habit loop starts weakening', 'Slight increase in focus', 'Better trigger awareness']
  },
  {
    day: 5,
    badge: 'Disciplined',
    title: 'First Resistance',
    benefits: ['Early dopamine stabilization', 'Stronger impulse resistance', 'Better mental clarity']
  },
  {
    day: 7,
    badge: 'Warrior',
    title: 'First Victory',
    benefits: ['Noticeable confidence boost', 'Reduced impulsive behavior', 'Increased willpower']
  },
  {
    day: 10,
    badge: 'Guardian',
    title: 'Mind Stabilizing',
    benefits: ['Urges are manageable', 'Improved emotional control', 'Better decisions']
  },
  {
    day: 14,
    badge: 'Knight',
    title: 'Dopamine Reset',
    benefits: ['Cravings reduced', 'Focus and productivity improve', 'Confidence improves']
  },
  {
    day: 21,
    badge: 'Elite',
    title: 'Strong Self-Control',
    benefits: ['Strong impulse control', 'Improved social confidence', 'Better emotional balance']
  },
  {
    day: 30,
    badge: 'Champion',
    title: 'Mental Dominance',
    benefits: ['Strong discipline identity', 'Improved resilience', 'Reduced urge frequency']
  },
  {
    day: 45,
    badge: 'Legend',
    title: 'Rare Discipline',
    benefits: ['Very strong impulse control', 'High personal confidence', 'Long-term focus improves']
  },
  {
    day: 60,
    badge: 'Master',
    title: 'Full Control',
    benefits: ['Deep habit transformation', 'Powerful emotional control', 'Strong long-term focus']
  },
  {
    day: 90,
    badge: 'Grandmaster',
    title: 'Elite Mind',
    benefits: ['Elite discipline mindset', 'High confidence and stability', 'Mastery of personal habits']
  }
];

const CORE_RULES = [
  'Each completed day = +1 streak',
  'Relapse = restart streak (awareness still improves)',
  'Track daily progress',
  'Focus on discipline and self-control'
];

const EMERGENCY_URGE_STEPS = [
  'Use the 5-4-3-2-1 countdown',
  'Stand up immediately',
  'Do 20 pushups or walk',
  'Drink water',
  'Change environment'
];

type DisciplineTimelinePhase = {
  dayRange: string;
  title: string;
  difficulty: string;
  whatHappens: string[];
  reduceEffect: string[];
  bestAction?: string;
  challenge?: string[];
};

const DISCIPLINE_TIMELINE: DisciplineTimelinePhase[] = [
  {
    dayRange: 'Day 1-2',
    title: 'Habit Withdrawal Begins',
    difficulty: 'Low',
    whatHappens: [
      'Brain expects the usual dopamine spike.',
      'Mild urges appear.',
      'Thoughts about the habit may occur frequently.'
    ],
    reduceEffect: [
      'Remove triggers (adult content, reels, etc.).',
      'Avoid staying alone with your phone.',
      'Start a daily routine immediately.',
      'Drink more water and move your body.'
    ],
    bestAction: 'Keep your mind busy and avoid idle time.',
    challenge: ['Avoid triggers like social media or late-night phone usage.']
  },
  {
    dayRange: 'Day 3-5',
    title: 'Dopamine Craving Phase',
    difficulty: 'Medium',
    whatHappens: [
      'Stronger cravings.',
      'Brain tries to push you back into old habit.',
      'Increased restlessness.'
    ],
    reduceEffect: [
      'Do intense physical activity (gym, running).',
      'Limit social media scrolling.',
      'Sleep earlier.',
      'Eat clean and avoid excess sugar.'
    ],
    bestAction: 'Use physical exercise to burn excess energy.',
    challenge: ['Keep yourself busy.', 'Exercise helps release excess energy.']
  },
  {
    dayRange: 'Day 6-7',
    title: 'First Urge Peak',
    difficulty: 'High',
    whatHappens: [
      'One of the strongest urge phases.',
      'Brain strongly wants dopamine reward.',
      'You may feel frustration or tension.'
    ],
    reduceEffect: [
      'Take a cold shower when urges spike.',
      'Do pushups or a quick workout.',
      'Leave your room and change environment.',
      'Avoid late-night phone usage.'
    ],
    bestAction: 'Change environment immediately when urges appear.',
    challenge: ['Avoid isolation.', 'Use physical activity to release pressure.']
  },
  {
    dayRange: 'Day 8-10',
    title: 'Mental Resistance',
    difficulty: 'Medium',
    whatHappens: [
      'Brain starts adapting to new pattern.',
      'Urges still appear but are less frequent.',
      'Slight increase in self-control.'
    ],
    reduceEffect: [
      'Stay productive.',
      'Continue gym or sports.',
      'Focus on learning or projects.',
      'Maintain sleep routine.'
    ],
    bestAction: 'Replace idle time with productive tasks.',
    challenge: ["Don't become overconfident."]
  },
  {
    dayRange: 'Day 11-14',
    title: 'Dopamine Adjustment Phase',
    difficulty: 'Medium',
    whatHappens: [
      'Brain chemistry stabilizing.',
      'Urges come in waves instead of constant pressure.',
      'Focus may improve.'
    ],
    reduceEffect: [
      'Avoid boredom.',
      'Maintain a structured daily schedule.',
      'Continue exercise routine.',
      'Reduce screen time before sleep.'
    ],
    bestAction: 'Consistency in routine is key.',
    challenge: ['Maintain routines and discipline.']
  },
  {
    dayRange: 'Day 15-21',
    title: 'Habit Rewiring Phase',
    difficulty: 'Medium',
    whatHappens: [
      'Old habit loop weakening.',
      'Some random urge spikes may occur.',
      'Emotional fluctuations possible.'
    ],
    reduceEffect: [
      'Focus on long-term goals.',
      'Track streak progress daily.',
      'Stay socially active.',
      'Work on personal growth.'
    ],
    bestAction: 'Stay committed to your streak identity.',
    challenge: ['Stay consistent with productive routines.']
  },
  {
    dayRange: 'Day 22-30',
    title: 'Discipline Test',
    difficulty: 'Medium',
    whatHappens: ['Urges less intense but still present.', 'Mind may try the "just once" trap.'],
    reduceEffect: [
      'Remind yourself why you started.',
      'Avoid risky situations (late-night browsing).',
      'Set short-term goals.'
    ],
    bestAction: 'Protect your progress and avoid complacency.',
    challenge: ['Avoid complacency.']
  },
  {
    dayRange: 'Day 31-45',
    title: 'Psychological Adjustment',
    difficulty: 'Low-Medium',
    whatHappens: [
      'Self-control feels more natural.',
      'Less impulsive thinking.',
      'Urges are weaker.'
    ],
    reduceEffect: [
      'Keep consistent habits.',
      'Avoid boredom.',
      'Focus on skill development.'
    ],
    bestAction: 'Use the extra energy for growth.',
    challenge: ['Avoid boredom and laziness.']
  },
  {
    dayRange: 'Day 46-60',
    title: 'Identity Shift Phase',
    difficulty: 'Low',
    whatHappens: [
      'Discipline becomes part of identity.',
      'Increased confidence and mental clarity.',
      'Urges become rare.'
    ],
    reduceEffect: [
      'Maintain a balanced lifestyle.',
      'Continue productive routines.',
      'Stay physically active.'
    ],
    bestAction: 'Reinforce disciplined identity.',
    challenge: ['Maintain productive lifestyle.']
  },
  {
    dayRange: 'Day 61-75',
    title: 'Stability Phase',
    difficulty: 'Low',
    whatHappens: ['Habit transformation.', 'Strong impulse control.'],
    reduceEffect: ['Avoid returning to old triggers.', 'Maintain structured life habits.'],
    bestAction: 'Protect your environment and habits.',
    challenge: ['Avoid falling back into old triggers.']
  },
  {
    dayRange: 'Day 76-90',
    title: 'Mastery Phase',
    difficulty: 'Very Low',
    whatHappens: [
      'Discipline feels natural.',
      'Strong emotional stability.',
      'Clear focus and motivation.'
    ],
    reduceEffect: [
      'Continue balanced routine.',
      'Focus on bigger life goals.',
      'Maintain physical and mental health.'
    ]
  }
];

const DisciplinePage = ({ onBackToHome }: DisciplinePageProps) => {

  const [streak, setStreak] = useState<DisciplineStreakState>(buildEmptyDisciplineStreakState());
  const [isUpdatingStreak, setIsUpdatingStreak] = useState(false);
  const [selectedTimelinePhase, setSelectedTimelinePhase] = useState<DisciplineTimelinePhase | null>(
    null
  );




  const streakLevels = useMemo(
    () =>
      UNLOCK_STAGES.map(stage => ({
        day: stage.day,
        title: stage.title,
        level: stage.badge
      })),
    []
  );
  const trackerDays = useMemo(() => Array.from({ length: 14 }, (_, index) => index + 1), []);

  useEffect(() => {
    let isActive = true;

    const loadStreak = async () => {
      try {
        const data = await disciplineStreakService.getDisciplineStreak();
        if (!isActive) return;
        setStreak(data);
      } catch {
        if (!isActive) return;
        setStreak(buildEmptyDisciplineStreakState());
      }
    };

    void loadStreak();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="bg-card text-foreground pb-24">
      <section>
        <Card className="border-none shadow-none">
          <CardContent className="space-y-5 px-0">
            {onBackToHome ? (
              <Button
                className="z-40 rounded-full shadow-md"
                onClick={onBackToHome}
                size="icon"
                type="button"
                variant="outline"
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : null}





            <Card className="bg-muted/25 shadow-none">
              <CardContent className="space-y-4 p-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Discipline Progress
                  </p>


                </div>
                <CommunicationStreakCard
                  currentStreak={streak.currentStreakDays}
                  longestStreak={streak.longestStreakDays}
                  subtitle="Track discipline streak and self-control momentum"
                  title="Discipline Streak"
                  totalPracticeDays={streak.totalQualifiedDays}
                  weekDays={streak.weekDays}
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={isUpdatingStreak}
                    onClick={() => {
                      void (async () => {
                        try {
                          setIsUpdatingStreak(true);
                          const updated = await disciplineStreakService.completeToday();
                          setStreak(updated);
                        } finally {
                          setIsUpdatingStreak(false);
                        }
                      })();
                    }}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Mark day complete
                  </Button>
                  <Button
                    disabled={isUpdatingStreak}
                    onClick={() => {
                      void (async () => {
                        try {
                          setIsUpdatingStreak(true);
                          const updated = await disciplineStreakService.resetCurrentStreak();
                          setStreak(updated);
                        } finally {
                          setIsUpdatingStreak(false);
                        }
                      })();
                    }}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Relapse (restart current streak)
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/25 shadow-none">
              <CardContent className="space-y-5 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Recovery Timeline</p>
                  <p className="text-muted-foreground text-xs">
                    Day-by-day discipline phases and challenges.
                  </p>
                </div>

                <div className="space-y-0">
                  {DISCIPLINE_TIMELINE.map((phase, index) => (
                    <div className="relative pl-6 pb-5" key={phase.dayRange}>
                      {index < DISCIPLINE_TIMELINE.length - 1 ? (
                        <span className="bg-border/70 absolute top-6 left-[7px] h-[calc(100%-8px)] w-px" />
                      ) : null}
                      <span className="bg-primary absolute top-1.5 left-0 size-4 rounded-full border-2 border-background" />
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">
                            {phase.dayRange} - {phase.title}
                          </p>
                          <Button
                            aria-label={`Open help for ${phase.dayRange}`}
                            className="size-6 rounded-full p-0"
                            onClick={() => {
                              setSelectedTimelinePhase(phase);
                            }}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Info className="size-3" />
                          </Button>
                          <Badge className="text-[10px]" variant="secondary">
                            Difficulty: {phase.difficulty}
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <p className="text-muted-foreground text-xs font-semibold uppercase">
                            What happens
                          </p>
                          <ul className="text-muted-foreground space-y-1 text-sm">
                            {phase.whatHappens.map(point => (
                              <li key={point}>- {point}</li>
                            ))}
                          </ul>
                        </div>

                        {phase.challenge && phase.challenge.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs font-semibold uppercase">
                              Challenge
                            </p>
                            <ul className="text-muted-foreground space-y-1 text-sm">
                              {phase.challenge.map(point => (
                                <li key={`${phase.dayRange}-${point}`}>- {point}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {UNLOCK_STAGES[index]?.benefits?.length ? (
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs font-semibold uppercase">
                              Benefits
                            </p>
                            <ul className="text-muted-foreground space-y-1 text-sm">
                              {UNLOCK_STAGES[index].benefits.map(item => (
                                <li key={`${phase.dayRange}-benefit-${item}`}>- {item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/25 shadow-none">
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold">Emergency Urge Protocol</p>
                <ol className="text-muted-foreground space-y-1 text-sm">
                  {EMERGENCY_URGE_STEPS.map((step, index) => (
                    <li key={step}>
                      {index + 1}. {step}
                    </li>
                  ))}
                </ol>
                <p className="text-muted-foreground text-xs">
                  Most urges disappear within 10-15 minutes.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-muted/25 shadow-none">
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold">Streak Tracker</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {trackerDays.map(day => (
                    <div
                      className="rounded-md border border-border/40 bg-muted/35 px-2 py-1 text-xs"
                      key={day}
                    >
                      <label className="flex items-center gap-2">
                        <Checkbox checked={day <= streak.currentStreakDays} disabled />
                        <span className="font-medium">Day {day}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Dialog
              onOpenChange={open => {
                if (!open) {
                  setSelectedTimelinePhase(null);
                }
              }}
              open={Boolean(selectedTimelinePhase)}
            >
              <DialogContent className="border-border-muted/10">
                <DialogHeader>
                  <DialogTitle>
                    {selectedTimelinePhase
                      ? `${selectedTimelinePhase.dayRange} - ${selectedTimelinePhase.title}`
                      : 'Phase details'}
                  </DialogTitle>
                  <DialogDescription>
                    Practical actions to reduce urge intensity and stay consistent.
                  </DialogDescription>
                </DialogHeader>
                {selectedTimelinePhase ? (
                  <DialogPanel className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs font-semibold uppercase">
                        What happens
                      </p>
                      <ul className="text-muted-foreground space-y-1 text-sm">
                        {selectedTimelinePhase.whatHappens.map(point => (
                          <li key={`modal-happens-${point}`}>- {point}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs font-semibold uppercase">
                        How to reduce the effect
                      </p>
                      <ul className="text-muted-foreground space-y-1 text-sm">
                        {selectedTimelinePhase.reduceEffect.map(point => (
                          <li key={`modal-reduce-${point}`}>- {point}</li>
                        ))}
                      </ul>
                    </div>

                    {selectedTimelinePhase.bestAction ? (
                      <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                        <p className="text-muted-foreground text-xs font-semibold uppercase">
                          Best Action
                        </p>
                        <p className="mt-1 text-sm font-medium">{selectedTimelinePhase.bestAction}</p>
                      </div>
                    ) : null}
                  </DialogPanel>
                ) : null}
              </DialogContent>
            </Dialog>

            <Card className="bg-muted/25 shadow-none">
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold">A Discipline & Self-Mastery Progression System</p>
                <p className="text-muted-foreground text-sm">
                  This system turns daily consistency into a progression path.
                </p>
                <p className="text-muted-foreground text-xs">Each streak day helps build:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">discipline</Badge>
                  <Badge variant="outline">dopamine balance</Badge>
                  <Badge variant="outline">confidence</Badge>
                  <Badge variant="outline">mental clarity</Badge>
                  <Badge variant="outline">emotional stability</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/25 shadow-none">
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-semibold">Core Rules</p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  {CORE_RULES.map(rule => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-muted/25 shadow-none">
              <CardContent className="space-y-4 p-4">
                <p className="text-sm font-semibold">Streak Levels & Titles</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border/40 text-xs uppercase">
                        <th className="py-2 pr-3">Days</th>
                        <th className="py-2 pr-3">Title</th>
                        <th className="py-2">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {streakLevels.map(level => (
                        <tr className="border-b border-border/20" key={level.day}>
                          <td className="py-2 pr-3">{level.day}</td>
                          <td className="py-2 pr-3">{level.title}</td>
                          <td className="py-2">{level.level}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/25 shadow-none">
              <CardContent className="space-y-4 p-4">
                <p className="text-sm font-semibold">Level Unlocks</p>
                <div className="space-y-3">
                  {UNLOCK_STAGES.map(stage => (
                    <Card className="bg-muted/35 shadow-none" key={stage.day}>
                      <CardContent className="space-y-2 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Day {stage.day}</Badge>
                          <p className="text-sm font-semibold">{stage.badge}</p>
                        </div>
                        <p className="text-muted-foreground text-xs">{stage.title}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>


            <Card className="bg-muted/25 shadow-none">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-semibold">Final Principle</p>
                <p className="text-muted-foreground text-sm">Discipline builds identity.</p>
                <p className="text-muted-foreground text-sm">The goal is not perfection.</p>
                <p className="text-muted-foreground text-sm">
                  The goal is becoming someone who controls impulses and builds strength daily.
                </p>
              </CardContent>
            </Card>


          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default DisciplinePage;
