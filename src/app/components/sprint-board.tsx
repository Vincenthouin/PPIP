import { useEffect, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { format, differenceInCalendarDays, addDays } from "date-fns";
import {
  Trash2, ArrowLeftRight, Clock, Settings, Pencil, Plus,
  GripVertical, AlignLeft, Loader2,
} from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "./ui/popover";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Progress } from "./ui/progress";
import { Switch } from "./ui/switch";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "./ui/tooltip";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "./ui/dialog";
import { ConfirmDelete } from "./confirm-delete";
import {
  AssignedCategory, CategoryTemplate, MeetingLine, Sprint, SortMode, User,
  FrequencyMode, initialsOf, lineHoursInSprint, linePerWeek,
  linesEqual, summarizeLine, uid, hoursToDays, resolveWorkdayHours,
} from "./pi-types";
import { DRAG_TYPE } from "./template-library";

// Amélioration 1 — type pour le drag de réordonnancement
const CARD_DRAG_TYPE = "ASSIGNED_CARD";

// ---- Amélioration 7 — Tri des cartes ----------------------------------------

function sortCategories(
  cats: AssignedCategory[],
  sprintId: string,
  mode: SortMode,
  users: User[],
): AssignedCategory[] {
  if (mode === "manual") {
    return [...cats].sort(
      (a, b) => (a.orderBySprintId?.[sprintId] ?? 0) - (b.orderBySprintId?.[sprintId] ?? 0),
    );
  }
  if (mode === "designer") {
    return [...cats].sort((a, b) => {
      const ua = users.find((u) => u.id === a.userId)?.name ?? "";
      const ub = users.find((u) => u.id === b.userId)?.name ?? "";
      return ua.localeCompare(ub) || a.name.localeCompare(b.name);
    });
  }
  // template
  return [...cats].sort((a, b) => a.name.localeCompare(b.name));
}

// ---- SprintColumn -----------------------------------------------------------

function SprintColumn({
  sprint,
  weeksPerSprint,
  workdayHours,
  activeUser,
  users,
  allCategories,
  visibleUserIds,
  allSprints,
  detailed,
  templates,
  sortMode,
  savingIds,
  onAddFromTemplate,
  onUpdate,
  onRemove,
  onToggleSprint,
  onReassignUser,
  onUpdateTemplateLine,
  onReorder,
  onSortModeChange,
}: {
  sprint: Sprint;
  weeksPerSprint: number;
  workdayHours: number;
  activeUser: User;
  users: User[];
  allCategories: AssignedCategory[];
  visibleUserIds: string[];
  allSprints: Sprint[];
  detailed: boolean;
  templates: CategoryTemplate[];
  sortMode: SortMode;
  savingIds: Set<string>;
  onAddFromTemplate: (templateId: string, sprintId: string, userId: string) => void;
  onUpdate: (id: string, patch: Partial<AssignedCategory>) => void;
  onRemove: (id: string) => void;
  onToggleSprint: (id: string, sprintId: string) => void;
  onReassignUser: (id: string, userId: string) => void;
  onUpdateTemplateLine: (templateId: string, lineId: string, patch: Partial<MeetingLine>) => void;
  onReorder: (sprintId: string, orderedIds: string[]) => void;
  onSortModeChange: (mode: SortMode) => void;
}) {
  const weekRanges = Array.from({ length: weeksPerSprint }, (_, i) => {
    const s = addDays(sprint.start, i * 7);
    const e = addDays(s, 4);
    return { start: s, end: e };
  });

  const [{ isOver, canDrop }, dropRef] = useDrop(() => ({
    accept: DRAG_TYPE,
    drop: (item: { templateId: string }) => {
      onAddFromTemplate(item.templateId, sprint.id, activeUser.id);
    },
    collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
  }), [sprint.id, activeUser.id, onAddFromTemplate]);

  const baseCats = allCategories.filter(
    (c) => c.sprintIds.includes(sprint.id) && visibleUserIds.includes(c.userId),
  );

  // Amélioration 1 — ordre local pour drag & drop intra-colonne
  const [localOrder, setLocalOrder] = useState(() => sortCategories(baseCats, sprint.id, sortMode, users));

  useEffect(() => {
    setLocalOrder(sortCategories(baseCats, sprint.id, sortMode, users));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategories, visibleUserIds, sortMode]);

  const moveCard = (from: number, to: number) => {
    setLocalOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleMoveEnd = () => {
    // Bascule automatiquement en mode manuel si on était en tri auto
    if (sortMode !== "manual") onSortModeChange("manual");
    onReorder(sprint.id, localOrder.map((c) => c.id));
  };

  const visibleUsersHere = users.filter((u) => visibleUserIds.includes(u.id));
  const workingDays = Math.max(
    0,
    Math.round((differenceInCalendarDays(sprint.end, sprint.start) + 1) * (5 / 7)),
  );

  // Amélioration 4+5 — capacité par designer avec son propre workdayHours
  const userStats = visibleUsersHere.map((u) => {
    const userWorkday = resolveWorkdayHours(u, workdayHours);
    const capacityHours = workingDays * userWorkday;
    const meetings = allCategories
      .filter((c) => c.sprintIds.includes(sprint.id) && c.userId === u.id)
      .reduce((sum, c) => sum + c.lines.reduce((s, l) => s + lineHoursInSprint(l, weeksPerSprint), 0), 0);
    const production = Math.max(0, capacityHours - meetings);
    return { user: u, meetings, production, capacityHours, userWorkday };
  });

  return (
    <div
      ref={dropRef as any}
      className={`flex flex-col rounded-xl border bg-card transition ${
        isOver && canDrop ? "ring-2 ring-primary border-primary" : ""
      }`}
    >
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Sprint {sprint.index + 1}
            </div>
            <div className="mt-0.5">
              {format(sprint.start, "MMM d")} → {format(sprint.end, "MMM d")}
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <Clock className="size-3" />
            {weeksPerSprint}w
          </Badge>
        </div>

        <div className="mt-3 space-y-2">
          {userStats.length === 0 && (
            <p className="text-xs text-muted-foreground">No designers visible.</p>
          )}
          {userStats.map(({ user, meetings, production, capacityHours, userWorkday }) => {
            const util = capacityHours ? (meetings / capacityHours) * 100 : 0;
            return (
              <div key={user.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Avatar className="size-4">
                      <AvatarFallback style={{ background: user.color, color: "white", fontSize: 8 }}>
                        {user.initials ?? initialsOf(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{user.name}</span>
                  </span>
                  {/* Amélioration 5 — jours (heures) */}
                  <span className="text-emerald-600 shrink-0">
                    {hoursToDays(production, userWorkday)}
                  </span>
                </div>
                <Progress value={Math.min(100, util)} />
              </div>
            );
          })}
        </div>
      </div>

      {detailed && (
        <div className="px-3 py-2 border-b bg-muted/30">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${weeksPerSprint}, minmax(0,1fr))` }}
          >
            {weekRanges.map((w, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div className="text-center cursor-help">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">W{i + 1}</div>
                    <div className="text-[11px]">
                      {format(w.start, "dd/MM")} – {format(w.end, "dd/MM")}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {format(w.start, "EEE, MMM d")} – {format(w.end, "EEE, MMM d")}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 p-3 space-y-2 min-h-32">
        {localOrder.length === 0 && (
          <div className="h-full min-h-32 grid place-items-center text-xs text-muted-foreground text-center px-4 border-2 border-dashed rounded-lg">
            Drag a category — will be assigned to {activeUser.name}
          </div>
        )}
        {localOrder.map((c, i) => (
          <CategoryCard
            key={c.id}
            category={c}
            index={i}
            sprintId={sprint.id}
            user={users.find((u) => u.id === c.userId)!}
            users={users}
            template={templates.find((t) => t.id === c.templateId)}
            weeksPerSprint={weeksPerSprint}
            workdayHours={workdayHours}
            sprintStart={sprint.start}
            allSprints={allSprints}
            detailed={detailed}
            dimmed={c.userId !== activeUser.id}
            isSaving={savingIds.has(c.id)} // Amélioration 10
            moveCard={moveCard}
            onMoveEnd={handleMoveEnd}
            onUpdate={(patch) => onUpdate(c.id, patch)}
            onRemove={() => onRemove(c.id)}
            onToggleSprint={(sid) => onToggleSprint(c.id, sid)}
            onReassignUser={(uid) => onReassignUser(c.id, uid)}
            onUpdateTemplateLine={onUpdateTemplateLine}
          />
        ))}
      </div>
    </div>
  );
}

// ---- CategoryCard -----------------------------------------------------------

function CategoryCard({
  category,
  index,
  sprintId,
  user,
  users,
  template,
  weeksPerSprint,
  workdayHours,
  sprintStart,
  allSprints,
  detailed,
  dimmed,
  isSaving,
  moveCard,
  onMoveEnd,
  onUpdate,
  onRemove,
  onToggleSprint,
  onReassignUser,
  onUpdateTemplateLine,
}: {
  category: AssignedCategory;
  index: number;
  sprintId: string;
  user: User;
  users: User[];
  template?: CategoryTemplate;
  weeksPerSprint: number;
  workdayHours: number;
  sprintStart: Date;
  allSprints: Sprint[];
  detailed: boolean;
  dimmed: boolean;
  isSaving: boolean;
  moveCard: (from: number, to: number) => void;
  onMoveEnd: () => void;
  onUpdate: (patch: Partial<AssignedCategory>) => void;
  onRemove: () => void;
  onToggleSprint: (sid: string) => void;
  onReassignUser: (uid: string) => void;
  onUpdateTemplateLine: (templateId: string, lineId: string, patch: Partial<MeetingLine>) => void;
}) {
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState(false); // Amélioration 2
  const [editingNotes, setEditingNotes] = useState(false); // Amélioration 8

  const totalHours = category.lines.reduce(
    (s, l) => s + lineHoursInSprint(l, weeksPerSprint), 0,
  );
  const userWorkday = resolveWorkdayHours(user, workdayHours);

  // Amélioration 1 — drag & drop réordonnancement
  const ref = useRef<HTMLDivElement>(null);

  const [, drop] = useDrop({
    accept: CARD_DRAG_TYPE,
    hover(item: { index: number; sprintId: string }) {
      if (item.sprintId !== sprintId || item.index === index) return;
      moveCard(item.index, index);
      item.index = index;
    },
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: CARD_DRAG_TYPE,
    item: { id: category.id, index, sprintId },
    end: onMoveEnd,
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  preview(drop(ref));

  const updateLine = (id: string, patch: Partial<MeetingLine>) =>
    onUpdate({ lines: category.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  const addLine = () =>
    onUpdate({
      lines: [...category.lines, { id: uid(), label: "New line", cadence: "weekly", hoursPerOccurrence: 1 }],
    });

  const removeLine = (id: string) =>
    onUpdate({ lines: category.lines.filter((l) => l.id !== id) });

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <Card
        className={`p-3 gap-2 transition ${dimmed ? "opacity-60" : ""} ${isSaving ? "ring-1 ring-primary/30" : ""}`}
        style={{ borderLeft: `4px solid ${category.color}` }}
      >
        {/* Amélioration 10 — indicateur de sauvegarde */}
        {isSaving && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Loader2 className="size-3 animate-spin" />
            Saving…
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Amélioration 1 — poignée drag */}
            <button
              ref={drag as any}
              type="button"
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 shrink-0"
              aria-label="Reorder"
            >
              <GripVertical className="size-3.5" />
            </button>
            <Avatar className="size-5">
              <AvatarFallback style={{ background: user.color, color: "white", fontSize: 9 }}>
                {user.initials ?? initialsOf(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{category.name}</span>
            {category.sprintIds.length > 1 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <ArrowLeftRight className="size-3" />
                {category.sprintIds.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Amélioration 2 — édition globale de la carte */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingCard(true)}>
                  <Pencil className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit card</TooltipContent>
            </Tooltip>

            {/* Amélioration 8 — notes de la carte */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={category.notes ? "secondary" : "ghost"}
                  className="size-7"
                  onClick={() => setEditingNotes(true)}
                >
                  <AlignLeft className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{category.notes ? "Edit notes" : "Add notes"}</TooltipContent>
            </Tooltip>

            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="size-7">
                  <ArrowLeftRight className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 space-y-3" align="end">
                <div className="space-y-2">
                  <Label className="text-xs">Assigned to</Label>
                  <Select value={category.userId} onValueChange={onReassignUser}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          <span className="flex items-center gap-2">
                            <span className="size-2 rounded-full" style={{ background: u.color }} />
                            {u.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-1.5">
                  <Label className="text-xs">Spans sprints</Label>
                  {allSprints.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={category.sprintIds.includes(s.id)}
                        onCheckedChange={() => onToggleSprint(s.id)}
                      />
                      Sprint {s.index + 1}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <ConfirmDelete
              trigger={
                <Button size="icon" variant="ghost" className="size-7">
                  <Trash2 className="size-3.5" />
                </Button>
              }
              title={`Remove "${category.name}" from this sprint group?`}
              description={
                category.sprintIds.length > 1
                  ? `This category spans ${category.sprintIds.length} sprints — it will be removed from all of them for ${user.name}.`
                  : `This will remove the category from ${user.name}'s sprint.`
              }
              confirmLabel="Remove"
              onConfirm={onRemove}
            />
          </div>
        </div>

        {/* Amélioration 8 — affichage note carte si présente */}
        {category.notes && (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 mt-1 whitespace-pre-wrap">
            {category.notes}
          </div>
        )}

        <div className="space-y-1">
          {category.lines.map((l, idx) => {
            const tplLine = template?.lines[idx];
            const edited = tplLine ? !linesEqual(l, tplLine) : false;
            const hours = lineHoursInSprint(l, weeksPerSprint);
            return (
              <div
                key={l.id}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate text-sm">{l.label}</span>
                    {edited && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center text-amber-600">
                            <Pencil className="size-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">Edited — differs from template</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {summarizeLine(l, weeksPerSprint)} · {l.hoursPerOccurrence}h
                    {/* Amélioration 5 — jours (heures) */}
                    <span className="opacity-60"> · {hoursToDays(hours, userWorkday)}</span>
                  </div>
                  {/* Amélioration 8 — note par ligne */}
                  {l.notes && (
                    <div className="text-xs text-muted-foreground/70 mt-0.5 italic truncate">
                      {l.notes}
                    </div>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 opacity-60 group-hover:opacity-100 shrink-0"
                  onClick={() => setEditingLineId(l.id)}
                  title="Edit line"
                >
                  <Settings className="size-3.5" />
                </Button>
              </div>
            );
          })}
          <button
            onClick={addLine}
            className="w-full text-xs text-muted-foreground hover:text-foreground py-1 border border-dashed rounded flex items-center justify-center gap-1"
          >
            <Plus className="size-3" /> Add line
          </button>
        </div>

        {/* Amélioration 5 — total en jours */}
        <div className="flex justify-between text-xs pt-1 border-t">
          <span className="text-muted-foreground">Per sprint</span>
          <span>{hoursToDays(totalHours, userWorkday)}</span>
        </div>

        {/* Amélioration 2 — dialog édition globale de la carte */}
        {editingCard && (
          <CardEditDialog
            category={category}
            template={template}
            weeksPerSprint={weeksPerSprint}
            sprintStart={sprintStart}
            onClose={() => setEditingCard(false)}
            onSaveSprint={(patch) => { onUpdate(patch); setEditingCard(false); }}
            onSaveTemplate={(patch) => {
              if (template) {
                // Propager le nom/couleur/notes au template
                onUpdateTemplateLine(template.id, "", patch as any);
              }
              onUpdate(patch);
              setEditingCard(false);
            }}
          />
        )}

        {/* Amélioration 8 — dialog notes carte */}
        {editingNotes && (
          <CardNotesDialog
            notes={category.notes ?? ""}
            templateNotes={template?.notes ?? ""}
            onClose={() => setEditingNotes(false)}
            onSaveSprint={(notes) => { onUpdate({ notes }); setEditingNotes(false); }}
            onSaveTemplate={(notes) => {
              if (template) {
                // sera géré via setTemplates dans App.tsx
                onUpdateTemplateLine(template.id, "__notes__", { label: notes } as any);
              }
              onUpdate({ notes });
              setEditingNotes(false);
            }}
          />
        )}
      </Card>

      {editingLineId && (() => {
        const line = category.lines.find((x) => x.id === editingLineId);
        if (!line) return null;
        const idx = category.lines.findIndex((x) => x.id === editingLineId);
        const tplLine = template?.lines[idx];
        return (
          <LineEditDialog
            line={line}
            templateLine={tplLine}
            templateName={template?.name}
            weeksPerSprint={weeksPerSprint}
            sprintStart={sprintStart}
            onClose={() => setEditingLineId(null)}
            onSaveSprint={(patch) => { updateLine(line.id, patch); setEditingLineId(null); }}
            onSaveTemplate={
              tplLine && template
                ? (patch) => { onUpdateTemplateLine(template.id, tplLine.id, patch); setEditingLineId(null); }
                : undefined
            }
            onRemove={() => { removeLine(line.id); setEditingLineId(null); }}
          />
        );
      })()}
    </div>
  );
}

// ---- Amélioration 2 — CardEditDialog ----------------------------------------

function CardEditDialog({
  category,
  template,
  weeksPerSprint,
  sprintStart,
  onClose,
  onSaveSprint,
  onSaveTemplate,
}: {
  category: AssignedCategory;
  template?: CategoryTemplate;
  weeksPerSprint: number;
  sprintStart: Date;
  onClose: () => void;
  onSaveSprint: (patch: Partial<AssignedCategory>) => void;
  onSaveTemplate: (patch: Partial<AssignedCategory>) => void;
}) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [lines, setLines] = useState(category.lines.map((l) => ({ ...l })));

  const dirty = name !== category.name || color !== category.color ||
    JSON.stringify(lines) !== JSON.stringify(category.lines);

  const updateLine = (id: string, patch: Partial<MeetingLine>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((ls) => [...ls, { id: uid(), label: "New line", cadence: "weekly", hoursPerOccurrence: 1 }]);

  const removeLine = (id: string) =>
    setLines((ls) => ls.filter((l) => l.id !== id));

  const patch = { name, color, lines };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* Amélioration 3 — fix overflow horizontal : sm:max-w-2xl + overflow-y-auto */}
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit card — {category.name}</DialogTitle>
          <DialogDescription>
            Apply changes to this sprint only, or push them back to the
            {template ? ` "${template.name}"` : ""} template (affects all sprints using it).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Color</Label>
              <div className="flex gap-1.5">
                {["#6366f1","#ec4899","#14b8a6","#f59e0b","#8b5cf6","#ef4444","#0ea5e9","#22c55e"].map((c) => (
                  <button
                    key={c} type="button" onClick={() => setColor(c)}
                    className="size-6 rounded-full border-2"
                    style={{ background: c, borderColor: color === c ? "#000" : "transparent" }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Lines</Label>
            {lines.map((l) => (
              <div key={l.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/40">
                <div className="flex-1 min-w-0">
                  <Input
                    value={l.label}
                    onChange={(e) => updateLine(l.id, { label: e.target.value })}
                    className="h-7 text-sm"
                  />
                </div>
                <div className="relative w-20 shrink-0">
                  <Input
                    type="number" min={0} step={0.5}
                    value={l.hoursPerOccurrence}
                    onChange={(e) => updateLine(l.id, { hoursPerOccurrence: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-sm pr-5"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
                </div>
                <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => removeLine(l.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <button
              onClick={addLine}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1 border border-dashed rounded flex items-center justify-center gap-1"
            >
              <Plus className="size-3" /> Add line
            </button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            <Button variant="outline" disabled={!dirty || !template} onClick={() => onSaveTemplate(patch)}>
              Save to template
            </Button>
            <Button disabled={!dirty} onClick={() => onSaveSprint(patch)}>
              Save to this sprint
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Amélioration 8 — CardNotesDialog ---------------------------------------

function CardNotesDialog({
  notes,
  templateNotes,
  onClose,
  onSaveSprint,
  onSaveTemplate,
}: {
  notes: string;
  templateNotes: string;
  onClose: () => void;
  onSaveSprint: (notes: string) => void;
  onSaveTemplate: (notes: string) => void;
}) {
  const [draft, setDraft] = useState(notes);
  const dirty = draft !== notes;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Card notes</DialogTitle>
          <DialogDescription>
            Add context to this card. Save to this sprint only or push to the template.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add context, links, or any relevant information…"
          rows={5}
          className="resize-none"
        />
        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            <Button variant="outline" disabled={!dirty} onClick={() => onSaveTemplate(draft)}>
              Save to template
            </Button>
            <Button disabled={!dirty} onClick={() => onSaveSprint(draft)}>
              Save to this sprint
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- SprintBoard ------------------------------------------------------------

export function SprintBoard({
  sprints,
  weeksPerSprint,
  workdayHours,
  categories,
  users,
  activeUser,
  visibleUserIds,
  detailed,
  templates,
  sortMode,
  savingIds,
  onAddFromTemplate,
  onUpdate,
  onRemove,
  onToggleSprint,
  onReassignUser,
  onUpdateTemplateLine,
  onReorder,
  onSortModeChange,
}: {
  sprints: Sprint[];
  weeksPerSprint: number;
  workdayHours: number;
  categories: AssignedCategory[];
  users: User[];
  activeUser: User;
  visibleUserIds: string[];
  detailed: boolean;
  templates: CategoryTemplate[];
  sortMode: SortMode;
  savingIds: Set<string>;
  onAddFromTemplate: (templateId: string, sprintId: string, userId: string) => void;
  onUpdate: (id: string, patch: Partial<AssignedCategory>) => void;
  onRemove: (id: string) => void;
  onToggleSprint: (id: string, sprintId: string) => void;
  onReassignUser: (id: string, userId: string) => void;
  onUpdateTemplateLine: (templateId: string, lineId: string, patch: Partial<MeetingLine>) => void;
  onReorder: (sprintId: string, orderedIds: string[]) => void;
  onSortModeChange: (mode: SortMode) => void;
}) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${sprints.length}, minmax(300px, 1fr))` }}
    >
      {sprints.map((s) => (
        <SprintColumn
          key={s.id}
          sprint={s}
          weeksPerSprint={weeksPerSprint}
          workdayHours={workdayHours}
          activeUser={activeUser}
          users={users}
          allCategories={categories}
          visibleUserIds={visibleUserIds}
          allSprints={sprints}
          detailed={detailed}
          templates={templates}
          sortMode={sortMode}
          savingIds={savingIds}
          onAddFromTemplate={onAddFromTemplate}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onToggleSprint={onToggleSprint}
          onReassignUser={onReassignUser}
          onUpdateTemplateLine={onUpdateTemplateLine}
          onReorder={onReorder}
          onSortModeChange={onSortModeChange}
        />
      ))}
    </div>
  );
}

// ---- LineEditDialog (existant, fix amélioration 3 + ajout notes amél. 8) ----

function LineEditDialog({
  line,
  templateLine,
  templateName,
  weeksPerSprint,
  sprintStart,
  onClose,
  onSaveSprint,
  onSaveTemplate,
  onRemove,
}: {
  line: MeetingLine;
  templateLine?: MeetingLine;
  templateName?: string;
  weeksPerSprint: number;
  sprintStart: Date;
  onClose: () => void;
  onSaveSprint: (patch: Partial<MeetingLine>) => void;
  onSaveTemplate?: (patch: Partial<MeetingLine>) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<MeetingLine>(line);
  const [detailed, setDetailed] = useState(false);
  const mode: FrequencyMode = draft.mode ?? "cadence";
  const perWeek = linePerWeek(draft, weeksPerSprint);

  const setMode = (m: FrequencyMode) => {
    const next: MeetingLine = { ...draft, mode: m };
    if (m === "perWeek" && (!next.perWeek || next.perWeek.length !== weeksPerSprint))
      next.perWeek = perWeek;
    if (m === "quantity" && next.quantityPerSprint == null)
      next.quantityPerSprint = perWeek.reduce((a, b) => a + b, 0);
    setDraft(next);
  };

  const updateWeek = (i: number, v: number) => {
    const arr =
      draft.perWeek && draft.perWeek.length === weeksPerSprint
        ? draft.perWeek.slice()
        : perWeek.slice();
    arr[i] = Math.max(0, v);
    setDraft({ ...draft, perWeek: arr, mode: "perWeek" });
  };

  const dirty = !linesEqual(draft, line) || (draft.notes ?? "") !== (line.notes ?? "");
  const patch: Partial<MeetingLine> = {
    label: draft.label,
    hoursPerOccurrence: draft.hoursPerOccurrence,
    mode: draft.mode,
    cadence: draft.cadence,
    quantityPerSprint: draft.quantityPerSprint,
    perWeek: draft.perWeek,
    notes: draft.notes,
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* Amélioration 3 — fix débordement horizontal : w-full min-w-0 sur le contenu */}
      <DialogContent className="sm:max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>Edit line</DialogTitle>
          <DialogDescription>
            Apply changes to this sprint only, or push them back to the
            {templateName ? ` "${templateName}"` : ""} template (affects all sprints using it).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 min-w-0 w-full">
          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
            <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </div>

          <div className="flex items-center justify-end">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={detailed} onCheckedChange={setDetailed} />
              More details
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs">Frequency mode</Label>
              <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cadence">Cadence</SelectItem>
                  <SelectItem value="quantity">Quantity</SelectItem>
                  <SelectItem value="perWeek">Per week</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs">
                {mode === "cadence" ? "Cadence" : mode === "quantity" ? "Quantity / sprint" : "Per week"}
              </Label>
              {mode === "cadence" && (
                <Select value={draft.cadence} onValueChange={(v: any) => setDraft({ ...draft, cadence: v })}>
                  <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="once">Once / sprint</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {mode === "quantity" && (
                <Input
                  type="number" min={0} step={1}
                  value={draft.quantityPerSprint ?? 0}
                  onChange={(e) => setDraft({ ...draft, quantityPerSprint: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              )}
              {mode === "perWeek" && (
                <div className="h-9 px-2 rounded-md border bg-muted/40 grid place-items-center text-xs text-muted-foreground truncate">
                  {perWeek.join(" · ")}
                </div>
              )}
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label className="text-xs">Hours each</Label>
              <div className="relative">
                <Input
                  type="number" min={0} step={0.5}
                  value={draft.hoursPerOccurrence}
                  onChange={(e) => setDraft({ ...draft, hoursPerOccurrence: parseFloat(e.target.value) || 0 })}
                  className="pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
              </div>
            </div>
          </div>

          {detailed && (
            <div className="space-y-1.5">
              <Label className="text-xs">Per-week occurrences</Label>
              <div className="flex items-end gap-2 flex-wrap">
                {Array.from({ length: weeksPerSprint }, (_, i) => {
                  const start = addDays(sprintStart, i * 7);
                  const end = addDays(start, 4);
                  return (
                    <div key={i} className="flex flex-col items-center w-14">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-[10px] text-muted-foreground mb-0.5 cursor-help bg-transparent border-0 p-0">
                            W{i + 1}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <div className="space-y-0.5 text-xs">
                            <div><span className="opacity-70">Begin:</span> {format(start, "EEE, MMM d, yyyy")}</div>
                            <div><span className="opacity-70">End:</span> {format(end, "EEE, MMM d, yyyy")}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <Input
                        type="number" min={0} step={1}
                        value={perWeek[i] ?? 0}
                        onChange={(e) => updateWeek(i, parseInt(e.target.value) || 0)}
                        className="h-9 text-center px-1"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Amélioration 8 — notes par ligne */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={draft.notes ?? ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value || undefined })}
              placeholder="Add context for this line…"
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {templateLine && !linesEqual(line, templateLine) && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
              This line currently differs from the template.
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <Button variant="ghost" className="text-destructive" onClick={onRemove}>
            <Trash2 className="size-4" /> Remove from sprint
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              variant="outline"
              disabled={!dirty || !onSaveTemplate}
              onClick={() => onSaveTemplate?.(patch)}
              title={onSaveTemplate ? "Update the template (and all sprints using it)" : "Original template no longer exists"}
            >
              Save to template
            </Button>
            <Button disabled={!dirty} onClick={() => onSaveSprint(patch)}>
              Save to this sprint
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
