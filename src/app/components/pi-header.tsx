import { useState } from "react";
import { format, addDays, nextMonday, isMonday } from "date-fns";
import { CalendarIcon, Settings2, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Checkbox } from "./ui/checkbox";
import { Separator } from "./ui/separator";
import { CategoryTemplate } from "./pi-types";

export function PiHeader({
  startDate,
  setStartDate,
  sprintCount,
  setSprintCount,
  weeksPerSprint,
  setWeeksPerSprint,
  workdayHours,
  setWorkdayHours,
  endDate,
  templates,
  preselectedIds,
  setPreselectedIds,
  onApplyPreselected,
}: {
  startDate: Date;
  setStartDate: (d: Date) => void;
  sprintCount: number;
  setSprintCount: (n: number) => void;
  weeksPerSprint: number;
  setWeeksPerSprint: (n: number) => void;
  workdayHours: number;
  setWorkdayHours: (n: number) => void;
  endDate: Date;
  templates: CategoryTemplate[];
  preselectedIds: string[];
  setPreselectedIds: (ids: string[]) => void;
  onApplyPreselected: () => void;
}) {
  const [open, setOpen] = useState(false);
  const snapToMonday = (d: Date) => (isMonday(d) ? d : nextMonday(d));

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border bg-card">
      <div className="space-y-1.5">
        <Label className="text-xs">PI start date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start gap-2 w-44">
              <CalendarIcon className="size-4" />
              {format(startDate, "EEE, MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(d) => d && setStartDate(snapToMonday(d))}
              weekStartsOn={1}
            />
            <div className="p-2 text-xs text-muted-foreground border-t">
              Will snap to nearest Monday.
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">PI end date</Label>
        <div className="h-9 px-3 rounded-md border bg-muted/40 grid place-items-center text-sm w-44">
          {format(endDate, "EEE, MMM d, yyyy")}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Sprints</Label>
        <Input
          type="number"
          min={1}
          max={8}
          value={sprintCount}
          onChange={(e) => setSprintCount(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-20"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Weeks / sprint</Label>
        <Input
          type="number"
          min={1}
          max={8}
          value={weeksPerSprint}
          onChange={(e) =>
            setWeeksPerSprint(Math.max(1, parseInt(e.target.value) || 1))
          }
          className="w-20"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Workday hours</Label>
        <Input
          type="number"
          min={1}
          max={24}
          step={0.5}
          value={workdayHours}
          onChange={(e) => setWorkdayHours(parseFloat(e.target.value) || 8)}
          className="w-20"
        />
      </div>

      <div className="flex-1" />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Settings2 className="size-4" />
            Pre-selected categories
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Pre-selected categories</SheetTitle>
            <SheetDescription>
              Pick the categories to auto-apply to every sprint of a new PI.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2 px-4">
            {templates.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-3 rounded-md border p-2 cursor-pointer hover:bg-accent"
              >
                <Checkbox
                  checked={preselectedIds.includes(t.id)}
                  onCheckedChange={(v) =>
                    setPreselectedIds(
                      v
                        ? [...preselectedIds, t.id]
                        : preselectedIds.filter((x) => x !== t.id),
                    )
                  }
                />
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: t.color }}
                />
                <span className="flex-1">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t.lines.length} lines
                </span>
              </label>
            ))}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No templates yet — create one from the library.
              </p>
            )}
            <Separator className="my-2" />
            <Button
              className="w-full gap-2"
              onClick={() => {
                onApplyPreselected();
                setOpen(false);
              }}
              disabled={preselectedIds.length === 0}
            >
              <Sparkles className="size-4" />
              Apply to all sprints now
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export const computePiEnd = (start: Date, sprints: number, weeks: number) => {
  return addDays(start, sprints * weeks * 7 - 3);
};
