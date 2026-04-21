import { useEffect, useMemo } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger
} from '@/components/ui/popover';
import { useHomeStore } from '../Home/store';
import { useSkinCareData } from './hooks/useSkinCareData';

interface SkinCarePageProps {
  onBackToHome?: () => void;
}

const SkinCarePage = ({ onBackToHome }: SkinCarePageProps) => {
  const { log, isLoading, isSaving, error, toggleStep } = useSkinCareData();
  const setSkinCareProgress = useHomeStore(state => state.setSkinCareProgress);

  useEffect(() => {
    if (!log) return;
    setSkinCareProgress(log.overallProgress);
  }, [log, setSkinCareProgress]);

  const routineProgress = useMemo(
    () =>
      (log?.routines ?? []).map(routine => {
        const total = routine.steps.length;
        const done = routine.steps.filter(step => step.checked).length;
        const progress = total > 0 ? (done / total) * 100 : 0;
        return { key: routine.key, done, total, progress };
      }),
    [log]
  );

  return (
    <main className=" bg-card text-foreground pb-24">
      <section className="">
        <Card className=" border-none shadow-none ">
          <CardContent className=" space-y-5 px-0  ">
            {onBackToHome ? (
              <Button
                aria-label="Back to Home"
                className=" z-40 rounded-full shadow-md"
                onClick={onBackToHome}
                size="icon"
                type="button"
                variant="outline"
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : null}

            <Card className="bg-muted/25 shadow-none">
              <CardHeader className="space-y-2 p-4">
                <CardTitle className="text-base font-semibold">Skin Care</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Follow your morning and night routine daily. Progress resets automatically each day.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Today&apos;s Progress</span>
                  <span className="font-medium">
                    {Math.round(log?.overallProgress ?? 0)}% ({log?.completedCount ?? 0}/
                    {log?.totalCount ?? 0})
                  </span>
                </div>
                <Progress className="h-2.5" value={log?.overallProgress ?? 0} />
                {error ? <p className="text-xs text-destructive">{error}</p> : null}
                {isSaving ? (
                  <p className="text-xs text-muted-foreground">Saving today&apos;s routine...</p>
                ) : null}
              </CardContent>
            </Card>

            {(log?.routines ?? []).map(routine => {
                const routineStats = routineProgress.find(item => item.key === routine.key);
                return (
                  <Card className="bg-muted/25 shadow-none" key={routine.key}>
                    <CardContent className="p-4">
                      <Accordion defaultValue={[routine.key]} multiple>
                        <AccordionItem className="border-none" value={routine.key}>
                          <AccordionTrigger className="py-0">
                            <div className="w-full space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold">{routine.label}</p>
                                {routineStats?.done === routineStats?.total ? (
                                  <Badge variant="secondary">Done</Badge>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {routineStats?.done ?? 0}/{routineStats?.total ?? 0} completed (
                                {Math.round(routineStats?.progress ?? 0)}%)
                              </p>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-4">
                            <div className="space-y-3">
                              {routine.steps.map(step => (
                                <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3" key={step.id}>
                                  <label className="flex flex-1 items-start gap-3">
                                    <Checkbox
                                      checked={step.checked}
                                      disabled={isLoading || isSaving}
                                      onCheckedChange={next =>
                                        void toggleStep(routine.key, step.id, next === true)
                                      }
                                    />
                                    <span className="space-y-1">
                                      <span className="block text-sm font-medium">{step.label}</span>
                                      {step.optional ? (
                                        <Badge className="text-[10px]" variant="outline">
                                          Optional
                                        </Badge>
                                      ) : null}
                                    </span>
                                  </label>
                                  <Popover>
                                    <PopoverTrigger
                                      render={<Button aria-label={`About ${step.label}`} size="icon-xs" type="button" variant="ghost" />}
                                      type="button"
                                    >
                                      <Info className="size-3" />
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-72 border-border-muted/10">
                                      <div className="space-y-3">
                                        <PopoverTitle className="text-sm">{step.label}</PopoverTitle>
                                        <div className="space-y-2">
                                          <div className="space-y-1">
                                            <p className="text-xs font-semibold">How to apply</p>
                                            <PopoverDescription>{step.how}</PopoverDescription>
                                          </div>
                                          <div className="space-y-1">
                                            <p className="text-xs font-semibold">Quantity</p>
                                            <PopoverDescription>{step.quantity}</PopoverDescription>
                                          </div>
                                          <div className="space-y-1">
                                            <p className="text-xs font-semibold">Use</p>
                                            <PopoverDescription>{step.use}</PopoverDescription>
                                          </div>
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>
                );
              })}
          </CardContent>
        </Card>
      </section>
    </main>
  );
};

export default SkinCarePage;
