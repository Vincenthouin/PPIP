import { useState } from "react";
import { Eye, EyeOff, Plus, Settings, Target, UserPlus } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "./ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "./ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { User, USER_PALETTE, initialsOf } from "./pi-types";

// Amélioration 6 — redesign UserBar en sidebar latérale Option D

export function UserBar({
  users,
  availableDesigners,
  activeUserId,
  visibleUserIds,
  onSelectActive,
  onToggleVisible,
  onShowOnly,
  onShowAll,
  onAddExisting,
  onCreateNew,
  onUpdate,
  onRemoveFromProduct,
  detailed,
  onToggleDetailed,
  // Amélioration 5 — données de charge par designer par sprint
  userStats,
}: {
  users: User[];
  availableDesigners: User[];
  activeUserId: string;
  visibleUserIds: string[];
  onSelectActive: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onShowOnly: (id: string) => void;
  onShowAll: () => void;
  onAddExisting: (id: string) => void;
  onCreateNew: (name: string, color: string, workdayHours?: number) => void;
  onUpdate: (id: string, patch: Partial<User>) => void;
  onRemoveFromProduct: (id: string) => void;
  detailed: boolean;
  onToggleDetailed: () => void;
  userStats?: Record<string, { totalMeetingHours: number; totalProductionHours: number }>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const allVisible = users.every((u) => visibleUserIds.includes(u.id));

  return (
    <div className="flex flex-col gap-1 w-48 shrink-0">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Designers
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm" variant="ghost" className="h-6 px-2 text-xs"
            onClick={onToggleDetailed}
          >
            {detailed ? "Simple" : "Detailed"}
          </Button>
          <Button
            size="sm" variant="ghost" className="h-6 px-2 text-xs"
            onClick={allVisible ? () => {} : onShowAll}
            disabled={allVisible}
          >
            All
          </Button>
        </div>
      </div>

      {/* Liste des designers */}
      <div className="flex flex-col gap-1">
        {users.map((u) => {
          const isActive = u.id === activeUserId;
          const isVisible = visibleUserIds.includes(u.id);
          const stats = userStats?.[u.id];

          return (
            <div
              key={u.id}
              className={`group flex items-center gap-2 rounded-lg border px-2 py-2 cursor-pointer transition ${
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-transparent hover:border-border hover:bg-accent/40"
              } ${!isVisible ? "opacity-40" : ""}`}
              onClick={() => { onSelectActive(u.id); }}
            >
              {/* Avatar + indicateur cible */}
              <div className="relative shrink-0">
                <Avatar className="size-7">
                  <AvatarFallback
                    style={{ background: u.color, color: "white", fontSize: 10 }}
                  >
                    {u.initials ?? initialsOf(u.name)}
                  </AvatarFallback>
                </Avatar>
                {isActive && (
                  <div className="absolute -top-1 -right-1 size-3.5 rounded-full bg-primary border-2 border-background grid place-items-center">
                    <Target className="size-2 text-primary-foreground" />
                  </div>
                )}
              </div>

              {/* Nom + charge */}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate leading-tight">{u.name}</div>
                {u.workdayHours != null && (
                  <div className="text-[10px] text-muted-foreground">{u.workdayHours}h/j</div>
                )}
                {stats && (
                  <div className="text-[10px] text-muted-foreground">
                    <span className="text-emerald-600">{stats.totalProductionHours.toFixed(0)}h prod</span>
                  </div>
                )}
              </div>

              {/* Toggle visibilité */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleVisible(u.id); }}
                className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition text-muted-foreground hover:text-foreground"
                aria-label={isVisible ? "Hide" : "Show"}
              >
                {isVisible
                  ? <Eye className="size-3.5" />
                  : <EyeOff className="size-3.5" />
                }
              </button>

              {/* Settings designer */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditingUser(u); }}
                className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition text-muted-foreground hover:text-foreground"
                aria-label="Edit designer"
              >
                <Settings className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Bouton ajouter */}
      <Button
        size="sm" variant="ghost"
        className="mt-1 h-7 text-xs gap-1 justify-start text-muted-foreground"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="size-3.5" /> Add designer
      </Button>

      {/* Dialog ajout designer */}
      {addOpen && (
        <AddDesignerDialog
          availableDesigners={availableDesigners}
          onAddExisting={(id) => { onAddExisting(id); setAddOpen(false); }}
          onCreateNew={(name, color, wh) => { onCreateNew(name, color, wh); setAddOpen(false); }}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* Dialog édition designer */}
      {editingUser && (
        <EditDesignerDialog
          user={editingUser}
          onSave={(patch) => { onUpdate(editingUser.id, patch); setEditingUser(null); }}
          onRemove={() => { onRemoveFromProduct(editingUser.id); setEditingUser(null); }}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  );
}

// ---- AddDesignerDialog -------------------------------------------------------

function AddDesignerDialog({
  availableDesigners,
  onAddExisting,
  onCreateNew,
  onClose,
}: {
  availableDesigners: User[];
  onAddExisting: (id: string) => void;
  onCreateNew: (name: string, color: string, workdayHours?: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"existing" | "new">(availableDesigners.length > 0 ? "existing" : "new");
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(USER_PALETTE[0]);
  const [workdayHours, setWorkdayHours] = useState<string>("8");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add designer to project</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b mb-3">
          {availableDesigners.length > 0 && (
            <button
              type="button"
              onClick={() => setTab("existing")}
              className={`px-3 py-1.5 text-sm border-b-2 transition ${tab === "existing" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              From team
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab("new")}
            className={`px-3 py-1.5 text-sm border-b-2 transition ${tab === "new" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            New designer
          </button>
        </div>

        {tab === "existing" && (
          <div className="space-y-3">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger><SelectValue placeholder="Pick a designer…" /></SelectTrigger>
              <SelectContent>
                {availableDesigners.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: u.color }} />
                      {u.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button disabled={!selectedId} onClick={() => onAddExisting(selectedId)}>
                Add to project
              </Button>
            </DialogFooter>
          </div>
        )}

        {tab === "new" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Charlotte" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Color</Label>
              <div className="flex gap-1.5">
                {USER_PALETTE.map((c) => (
                  <button
                    key={c} type="button" onClick={() => setColor(c)}
                    className="size-6 rounded-full border-2"
                    style={{ background: c, borderColor: color === c ? "#000" : "transparent" }}
                  />
                ))}
              </div>
            </div>
            {/* Amélioration 4 — heures/jour à la création */}
            <div className="space-y-1.5">
              <Label className="text-xs">Working hours / day</Label>
              <div className="relative w-28">
                <Input
                  type="number" min={1} max={24} step={0.5}
                  value={workdayHours}
                  onChange={(e) => setWorkdayHours(e.target.value)}
                  className="pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Used to compute production time in days.</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                disabled={!name.trim()}
                onClick={() => onCreateNew(name.trim(), color, parseFloat(workdayHours) || undefined)}
              >
                Add to project
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- EditDesignerDialog ------------------------------------------------------

function EditDesignerDialog({
  user,
  onSave,
  onRemove,
  onClose,
}: {
  user: User;
  onSave: (patch: Partial<User>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [color, setColor] = useState(user.color);
  const [workdayHours, setWorkdayHours] = useState(String(user.workdayHours ?? 8));

  const dirty =
    name !== user.name ||
    color !== user.color ||
    parseFloat(workdayHours) !== (user.workdayHours ?? 8);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit designer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1.5">
              {USER_PALETTE.map((c) => (
                <button
                  key={c} type="button" onClick={() => setColor(c)}
                  className="size-6 rounded-full border-2"
                  style={{ background: c, borderColor: color === c ? "#000" : "transparent" }}
                />
              ))}
            </div>
          </div>
          {/* Amélioration 4 */}
          <div className="space-y-1.5">
            <Label className="text-xs">Working hours / day</Label>
            <div className="relative w-28">
              <Input
                type="number" min={1} max={24} step={0.5}
                value={workdayHours}
                onChange={(e) => setWorkdayHours(e.target.value)}
                className="pr-6"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2 mt-2">
          <Button variant="ghost" className="text-destructive text-xs" onClick={onRemove}>
            Remove from project
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!name.trim() || !dirty}
              onClick={() => {
                const patch: Partial<User> = {};
                if (name.trim() !== user.name) patch.name = name.trim();
                if (color !== user.color) patch.color = color;
                const wh = parseFloat(workdayHours);
                if (!isNaN(wh) && wh !== (user.workdayHours ?? 8)) patch.workdayHours = wh;
                if (Object.keys(patch).length > 0) onSave(patch);
                else onClose();
              }}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
