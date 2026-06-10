import { useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Plus, GripVertical, Trash2, Pencil, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Switch } from "./ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";
import { addDays, format } from "date-fns";
import { ConfirmDelete } from "./confirm-delete";
import {
  CategoryTemplate,
  FrequencyMode,
  MeetingLine,
  PALETTE,
  Tag,
  linePerWeek,
  uid,
} from "./pi-types";
import { X as XIcon } from "lucide-react";

const ensurePerWeek = (line: MeetingLine, weeks: number): number[] => {
  const cur = line.perWeek;
  if (cur && cur.length === weeks) return cur;
  return linePerWeek(line, weeks);
};

export const DRAG_TYPE = "CATEGORY_TEMPLATE";
const LINE_DRAG_TYPE = "MEETING_LINE";

function LineRow({
  line,
  index,
  weeksPerSprint,
  detailed,
  referenceStart,
  moveLine,
  updateLine,
  removeLine,
}: {
  line: MeetingLine;
  index: number;
  weeksPerSprint: number;
  detailed: boolean;
  referenceStart?: Date;
  moveLine: (from: number, to: number) => void;
  updateLine: (id: string, patch: Partial<MeetingLine>) => void;
  removeLine: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [, drop] = useDrop({
    accept: LINE_DRAG_TYPE,
    hover(item: { index: number }) {
      if (item.index !== index) {
        moveLine(item.index, index);
        item.index = index;
      }
    },
  });
  const [{ isDragging }, drag, preview] = useDrag({
    type: LINE_DRAG_TYPE,
    item: { id: line.id, index },
    collect: (m) => ({ isDragging: m.isDragging() }),
  });
  preview(drop(ref));

  const mode: FrequencyMode = line.mode ?? "cadence";
  const perWeek = linePerWeek(line, weeksPerSprint);

  const setMode = (m: FrequencyMode) => {
    const patch: Partial<MeetingLine> = { mode: m };
    if (m === "perWeek") patch.perWeek = ensurePerWeek(line, weeksPerSprint);
    if (m === "quantity" && line.quantityPerSprint == null)
      patch.quantityPerSprint = perWeek.reduce((a, b) => a + b, 0);
    updateLine(line.id, patch);
  };

  const updateWeek = (i: number, v: number) => {
    const arr = ensurePerWeek(line, weeksPerSprint).slice();
    arr[i] = Math.max(0, v);
    updateLine(line.id, { perWeek: arr, mode: "perWeek" });
  };

  return (
    <div
      ref={ref}
      className={`rounded-md p-2 transition border ${
        isDragging ? "opacity-30" : "hover:bg-accent/40 border-transparent hover:border-border"
      }`}
    >
      <div className="flex items-end gap-2">
        <button
          ref={drag as any}
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 self-center"
          aria-label="Reorder"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="flex-1 min-w-0 self-center">
          <Input
            value={line.label}
            onChange={(e) => updateLine(line.id, { label: e.target.value })}
          />
        </div>

        {detailed && (
          <div className="flex items-end gap-1">
            {Array.from({ length: weeksPerSprint }, (_, i) => {
              const start = referenceStart ? addDays(referenceStart, i * 7) : null;
              const end = start ? addDays(start, 4) : null;
              return (
                <div key={i} className="flex flex-col items-center w-12">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground mb-0.5 cursor-help bg-transparent border-0 p-0"
                      >
                        W{i + 1}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {start && end ? (
                        <div className="space-y-0.5 text-xs">
                          <div>
                            <span className="opacity-70">Begin:</span>{" "}
                            {format(start, "EEE, MMM d, yyyy")}
                          </div>
                          <div>
                            <span className="opacity-70">End:</span>{" "}
                            {format(end, "EEE, MMM d, yyyy")}
                          </div>
                        </div>
                      ) : (
                        <span>Week {i + 1} (set PI start date)</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={perWeek[i] ?? 0}
                    onChange={(e) =>
                      updateWeek(i, parseInt(e.target.value) || 0)
                    }
                    className="h-9 text-center px-1"
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="w-[120px] self-center">
          <Select value={mode} onValueChange={(v: any) => setMode(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cadence">Cadence</SelectItem>
              <SelectItem value="quantity">Quantity</SelectItem>
              <SelectItem value="perWeek">Per week</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[130px] self-center">
          {mode === "cadence" && (
            <Select
              value={line.cadence}
              onValueChange={(v: any) => updateLine(line.id, { cadence: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="once">Once / sprint</SelectItem>
              </SelectContent>
            </Select>
          )}
          {mode === "quantity" && (
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={1}
                value={line.quantityPerSprint ?? 0}
                onChange={(e) =>
                  updateLine(line.id, {
                    quantityPerSprint: Math.max(0, parseInt(e.target.value) || 0),
                    mode: "quantity",
                  })
                }
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                ×
              </span>
            </div>
          )}
          {mode === "perWeek" && (
            <div className="h-9 px-3 rounded-md border bg-muted/40 grid place-items-center text-xs text-muted-foreground">
              {perWeek.join(" · ")}
            </div>
          )}
        </div>
        <div className="relative w-[80px] self-center">
          <Input
            type="number"
            step={0.5}
            min={0}
            value={line.hoursPerOccurrence}
            onChange={(e) =>
              updateLine(line.id, {
                hoursPerOccurrence: parseFloat(e.target.value) || 0,
              })
            }
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            h
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 self-center"
          onClick={() => removeLine(line.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function TemplateCard({
  tpl,
  tags,
  onEdit,
  onDelete,
  onToggleDefault,
}: {
  tpl: CategoryTemplate;
  tags: Tag[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleDefault: (v: boolean) => void;
}) {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: DRAG_TYPE,
    item: { templateId: tpl.id },
    collect: (m) => ({ isDragging: m.isDragging() }),
  }), [tpl.id]);

  return (
    <div
      ref={dragRef as any}
      className="group rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing transition hover:shadow-sm"
      style={{
        opacity: isDragging ? 0.4 : 1,
        borderLeft: `4px solid ${tpl.color}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="size-4 text-muted-foreground shrink-0" />
          <span className="truncate">{tpl.name}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <Button size="icon" variant="ghost" className="size-7" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <ConfirmDelete
            trigger={
              <Button size="icon" variant="ghost" className="size-7">
                <Trash2 className="size-3.5" />
              </Button>
            }
            title={`Delete "${tpl.name}" template?`}
            description="This will remove the template from your library. Existing assignments on the board are not affected."
            onConfirm={onDelete}
          />
        </div>
      </div>
      {(tpl.tagIds ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {(tpl.tagIds ?? [])
            .map((id) => tags.find((t) => t.id === id))
            .filter(Boolean)
            .map((t) => (
              <span
                key={t!.id}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                {t!.name}
              </span>
            ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {tpl.lines.slice(0, 3).map((l) => (
          <Badge key={l.id} variant="secondary" className="text-xs">
            {l.label} · {l.hoursPerOccurrence}h
          </Badge>
        ))}
        {tpl.lines.length > 3 && (
          <Badge variant="secondary" className="text-xs">
            +{tpl.lines.length - 3}
          </Badge>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Default in new PIs</span>
        <Switch checked={!!tpl.defaultSelected} onCheckedChange={onToggleDefault} />
      </div>
    </div>
  );
}

function TagPicker({
  selectedIds,
  tags,
  onChange,
  onCreateTag,
}: {
  selectedIds: string[];
  tags: Tag[];
  onChange: (ids: string[]) => void;
  onCreateTag: (name: string) => string | null;
}) {
  const [input, setInput] = useState("");
  const selected = tags.filter((t) => selectedIds.includes(t.id));
  const lower = input.trim().toLowerCase();
  const suggestions = lower
    ? tags.filter(
        (t) =>
          !selectedIds.includes(t.id) && t.name.toLowerCase().includes(lower),
      )
    : tags.filter((t) => !selectedIds.includes(t.id));
  const canCreate =
    lower && !tags.some((t) => t.name.toLowerCase() === lower);

  const addTag = (id: string) => {
    onChange([...selectedIds, id]);
    setInput("");
  };

  const create = () => {
    if (!canCreate) return;
    const id = onCreateTag(input.trim());
    if (id) onChange([...selectedIds, id]);
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-7">
        {selected.length === 0 && (
          <span className="text-xs text-muted-foreground self-center">
            No tags yet
          </span>
        )}
        {selected.map((t) => (
          <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
            {t.name}
            <button
              type="button"
              onClick={() => onChange(selectedIds.filter((x) => x !== t.id))}
              className="hover:bg-background/50 rounded-full p-0.5"
              aria-label={`Remove ${t.name}`}
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canCreate) create();
              else if (suggestions[0]) addTag(suggestions[0].id);
            }
          }}
          placeholder="Add or create a tag…"
        />
        {(suggestions.length > 0 || canCreate) && input && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md p-1 max-h-48 overflow-auto">
            {suggestions.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => addTag(t.id)}
                className="w-full text-left px-2 py-1 text-sm rounded hover:bg-accent"
              >
                {t.name}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={create}
                className="w-full text-left px-2 py-1 text-sm rounded hover:bg-accent text-primary"
              >
                + Create "{input.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateEditor({
  initial,
  weeksPerSprint,
  referenceStart,
  tags,
  onCreateTag,
  onSave,
  onCancel,
}: {
  initial: CategoryTemplate;
  weeksPerSprint: number;
  referenceStart?: Date;
  tags: Tag[];
  onCreateTag: (name: string) => string | null;
  onSave: (t: CategoryTemplate) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CategoryTemplate>(initial);
  const [detailed, setDetailed] = useState(false);

  const updateLine = (id: string, patch: Partial<MeetingLine>) =>
    setDraft({
      ...draft,
      lines: draft.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });

  const addLine = () =>
    setDraft({
      ...draft,
      lines: [
        ...draft.lines,
        { id: uid(), label: "New meeting", cadence: "weekly", hoursPerOccurrence: 1 },
      ],
    });

  const removeLine = (id: string) =>
    setDraft({ ...draft, lines: draft.lines.filter((l) => l.id !== id) });

  const moveLine = (from: number, to: number) =>
    setDraft((d) => {
      const next = [...d.lines];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...d, lines: next };
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Category name</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Digital Team"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Color</Label>
          <div className="flex gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft({ ...draft, color: c })}
                className="size-6 rounded-full border-2 transition"
                style={{
                  background: c,
                  borderColor: draft.color === c ? "#000" : "transparent",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Tags</Label>
        <TagPicker
          selectedIds={draft.tagIds ?? []}
          tags={tags}
          onChange={(ids) => setDraft({ ...draft, tagIds: ids })}
          onCreateTag={onCreateTag}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Meeting / activity lines</Label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={detailed} onCheckedChange={setDetailed} />
              More details
            </label>
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="size-3.5" /> Add line
            </Button>
          </div>
        </div>
        <ScrollArea className={detailed ? "h-[420px] rounded-md border p-2" : "h-80 rounded-md border p-2"}>
          <div className="space-y-1">
            {draft.lines.map((l, i) => (
              <LineRow
                key={l.id}
                line={l}
                index={i}
                weeksPerSprint={weeksPerSprint}
                detailed={detailed}
                referenceStart={referenceStart}
                moveLine={moveLine}
                updateLine={updateLine}
                removeLine={removeLine}
              />
            ))}
            {draft.lines.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                No lines yet — add your first meeting.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          <X className="size-4" /> Cancel
        </Button>
        <Button onClick={() => onSave(draft)} disabled={!draft.name.trim()}>
          <Check className="size-4" /> Save template
        </Button>
      </DialogFooter>
    </div>
  );
}

export function TemplateLibrary({
  templates,
  onChange,
  collapsed,
  onToggleCollapsed,
  weeksPerSprint,
  referenceStart,
  tags,
  onCreateTag,
}: {
  templates: CategoryTemplate[];
  onChange: (t: CategoryTemplate[]) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  weeksPerSprint: number;
  referenceStart?: Date;
  tags: Tag[];
  onCreateTag: (name: string) => string | null;
}) {
  const [editing, setEditing] = useState<CategoryTemplate | null>(null);
  const [open, setOpen] = useState(false);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const visibleTemplates =
    filterTagIds.length === 0
      ? templates
      : templates.filter((t) =>
          filterTagIds.every((id) => (t.tagIds ?? []).includes(id)),
        );

  const startNew = () => {
    setEditing({
      id: uid(),
      name: "",
      color: PALETTE[templates.length % PALETTE.length],
      tagIds: [],
      lines: [
        { id: uid(), label: "Weekly sync", cadence: "weekly", hoursPerOccurrence: 1 },
      ],
    });
    setOpen(true);
  };

  const startEdit = (t: CategoryTemplate) => {
    setEditing({ ...t, lines: t.lines.map((l) => ({ ...l })) });
    setOpen(true);
  };

  const save = (t: CategoryTemplate) => {
    const exists = templates.some((x) => x.id === t.id);
    onChange(exists ? templates.map((x) => (x.id === t.id ? t : x)) : [...templates, t]);
    setOpen(false);
    setEditing(null);
  };

  if (collapsed) {
    return (
      <Card className="p-2 h-full flex flex-col items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          onClick={onToggleCollapsed}
          title="Expand templates"
        >
          <ChevronRight className="size-4" />
        </Button>
        <div
          className="flex-1 flex items-center"
          style={{ writingMode: "vertical-rl" }}
        >
          <span className="text-xs text-muted-foreground tracking-wide rotate-180">
            Templates · {templates.length}
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 h-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3>Category templates</h3>
          <p className="text-xs text-muted-foreground">Drag onto a sprint to assign</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={onToggleCollapsed}
            title="Collapse"
          >
            <ChevronLeft className="size-4" />
          </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={startNew}>
              <Plus className="size-4" /> New
            </Button>
          </DialogTrigger>
          {editing && (
            <DialogContent className="sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>
                  {templates.some((x) => x.id === editing.id) ? "Edit" : "New"} category
                </DialogTitle>
                <DialogDescription>
                  Configure the meetings and recurring activities for this category.
                </DialogDescription>
              </DialogHeader>
              <TemplateEditor
                initial={editing}
                weeksPerSprint={weeksPerSprint}
                referenceStart={referenceStart}
                tags={tags}
                onCreateTag={onCreateTag}
                onSave={save}
                onCancel={() => {
                  setOpen(false);
                  setEditing(null);
                }}
              />
            </DialogContent>
          )}
        </Dialog>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 -mt-1">
          {tags.map((t) => {
            const active = filterTagIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setFilterTagIds(
                    active
                      ? filterTagIds.filter((x) => x !== t.id)
                      : [...filterTagIds, t.id],
                  )
                }
                className={`px-2 py-0.5 rounded-full text-xs border transition ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent"
                }`}
              >
                {t.name}
              </button>
            );
          })}
          {filterTagIds.length > 0 && (
            <button
              type="button"
              onClick={() => setFilterTagIds([])}
              className="px-2 py-0.5 rounded-full text-xs text-muted-foreground hover:bg-accent"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-2">
          {visibleTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              tpl={t}
              tags={tags}
              onEdit={() => startEdit(t)}
              onDelete={() => onChange(templates.filter((x) => x.id !== t.id))}
              onToggleDefault={(v) =>
                onChange(
                  templates.map((x) =>
                    x.id === t.id ? { ...x, defaultSelected: v } : x,
                  ),
                )
              }
            />
          ))}
          {visibleTemplates.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              {templates.length === 0
                ? "No templates yet."
                : "No templates match the selected tags."}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
