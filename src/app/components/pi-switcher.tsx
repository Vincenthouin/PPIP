import { useRef, useState } from "react";
import { format } from "date-fns";
import { Check, ChevronDown, ChevronRight, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "./ui/popover";
import { ConfirmDelete } from "./confirm-delete";
import { PiState } from "./pi-types";

// Amélioration 9 — PI Switcher redesigné avec groupement par année et renommage inline

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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());
  const renameInputRef = useRef<HTMLInputElement>(null);

  const activePi = pis.find((p) => p.id === activePiId) ?? pis[0];

  // Grouper par année à partir de startDateISO, ordre croissant
  const pisByYear = pis
    .slice()
    .sort((a, b) => new Date(a.startDateISO).getTime() - new Date(b.startDateISO).getTime())
    .reduce<Record<string, PiState[]>>((acc, pi) => {
      const year = new Date(pi.startDateISO).getFullYear().toString();
      if (!acc[year]) acc[year] = [];
      acc[year].push(pi);
      return acc;
    }, {});

  const years = Object.keys(pisByYear).sort();

  const toggleYear = (year: string) => {
    setCollapsedYears((prev) => {
      const next = new Set(prev);
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });
  };

  const startRename = (pi: PiState) => {
    setRenamingId(pi.id);
    setRenameValue(pi.name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const commitRename = (id: string) => {
    if (renameValue.trim() && renameValue.trim() !== pis.find((p) => p.id === id)?.name) {
      onRename(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-[260px]">
          <span className="truncate">{activePi?.name ?? "Select PI"}</span>
          <ChevronDown className="size-4 shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        {/* Liste des PIs groupés par année */}
        <div className="max-h-72 overflow-y-auto">
          {years.map((year) => {
            const collapsed = collapsedYears.has(year);
            const yearPis = pisByYear[year];
            return (
              <div key={year}>
                {/* En-tête année cliquable */}
                <button
                  type="button"
                  onClick={() => toggleYear(year)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/50 transition sticky top-0 bg-popover border-b"
                >
                  {collapsed
                    ? <ChevronRight className="size-3" />
                    : <ChevronDown className="size-3" />
                  }
                  {year}
                  <span className="ml-auto">{yearPis.length} PI{yearPis.length > 1 ? "s" : ""}</span>
                </button>

                {!collapsed && yearPis.map((pi) => {
                  const isActive = pi.id === activePiId;
                  const isRenaming = renamingId === pi.id;

                  return (
                    <div
                      key={pi.id}
                      className={`group flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition ${isActive ? "bg-accent/30" : ""}`}
                    >
                      {/* Sélection */}
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left"
                        onClick={() => { onSelect(pi.id); setOpen(false); }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Check className={`size-3.5 shrink-0 ${isActive ? "text-primary" : "opacity-0"}`} />
                          {isRenaming ? (
                            <input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={() => commitRename(pi.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename(pi.id);
                                if (e.key === "Escape") setRenamingId(null);
                                e.stopPropagation();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 min-w-0 text-sm bg-transparent border-b border-primary outline-none py-0"
                            />
                          ) : (
                            <span className="truncate text-sm">{pi.name}</span>
                          )}
                        </div>
                        {!isRenaming && (
                          <div className="text-xs text-muted-foreground pl-5 mt-0.5">
                            {format(new Date(pi.startDateISO), "MMM d, yyyy")} · {pi.sprintCount} sprint{pi.sprintCount > 1 ? "s" : ""}
                          </div>
                        )}
                      </button>

                      {/* Actions inline (visibles au hover) */}
                      {!isRenaming && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                          <Button
                            size="icon" variant="ghost" className="size-6"
                            onClick={(e) => { e.stopPropagation(); startRename(pi); }}
                            title="Rename"
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="size-6"
                            onClick={(e) => { e.stopPropagation(); onDuplicate(pi.id); setOpen(false); }}
                            title="Duplicate"
                          >
                            <Copy className="size-3" />
                          </Button>
                          {pis.length > 1 && (
                            <ConfirmDelete
                              title={`Delete "${pi.name}"?`}
                              description="This will remove the PI and all its boards and assignments. Templates are kept."
                              confirmLabel="Delete PI"
                              onConfirm={() => { onDelete(pi.id); }}
                              trigger={
                                <Button
                                  size="icon" variant="ghost" className="size-6 text-destructive"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Delete"
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              }
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {pis.length === 0 && (
            <div className="px-3 py-6 text-sm text-muted-foreground text-center">
              No PIs yet.
            </div>
          )}
        </div>

        {/* Créer un nouveau PI */}
        <div className="border-t p-3">
          <p className="text-xs text-muted-foreground mb-2">Create new PI</p>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. PI 2026.4"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  onCreate(newName.trim());
                  setNewName("");
                  setOpen(false);
                }
              }}
            />
            <Button
              size="sm" className="shrink-0"
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
