import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Plus, Copy, Trash2, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { PiState } from "./pi-types";

export function PiSwitcher({
  pis,
  activePiId,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onRename,
}: {
  pis: PiState[];
  activePiId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const active = pis.find((p) => p.id === activePiId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-56 justify-between">
          <span className="truncate">{active?.name ?? "Select PI"}</span>
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2">
          <Label className="text-xs px-2">Your PIs</Label>
          <ScrollArea className="max-h-64 mt-1">
            <div className="space-y-0.5">
              {pis
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent ${
                      p.id === activePiId ? "bg-accent" : ""
                    }`}
                    onClick={() => {
                      onSelect(p.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`size-3.5 ${
                        p.id === activePiId ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(p.startDateISO), "MMM d, yyyy")} ·{" "}
                        {p.sprintCount} sprints
                      </div>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(p.id);
                        }}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${p.name}"?`)) onDelete(p.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>
        </div>
        <Separator />
        <div className="p-2 space-y-2">
          <Label className="text-xs px-1">Create new PI</Label>
          <div className="flex gap-1.5">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. PI 2026.4"
              className="h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  onCreate(newName.trim());
                  setNewName("");
                  setOpen(false);
                }
              }}
            />
            <Button
              size="sm"
              disabled={!newName.trim()}
              onClick={() => {
                onCreate(newName.trim());
                setNewName("");
                setOpen(false);
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {active && (
            <RenameField
              key={active.id}
              value={active.name}
              onSave={(v) => onRename(active.id, v)}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RenameField({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <div className="space-y-1">
      <Label className="text-xs px-1">Rename current PI</Label>
      <div className="flex gap-1.5">
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="h-8"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!v.trim() || v === value}
          onClick={() => onSave(v.trim())}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
