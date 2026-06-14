import { useState } from "react";
import {
  Plus,
  UserMinus,
  UserPlus,
  Eye,
  EyeOff,
  Crown,
  MoreHorizontal,
  Calendar,
  Users,
} from "lucide-react";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Separator } from "./ui/separator";
import { User, USER_PALETTE, initialsOf } from "./pi-types";

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
}: {
  /** Designers currently scheduled on the active product. */
  users: User[];
  /** Designers from the global pool not yet on this product. */
  availableDesigners: User[];
  activeUserId: string;
  visibleUserIds: string[];
  onSelectActive: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onShowOnly: (id: string) => void;
  onShowAll: () => void;
  /** Link an existing global designer to this product. */
  onAddExisting: (designerId: string) => void;
  /** Create a brand-new designer AND link them to this product. */
  onCreateNew: (name: string, color: string) => void;
  onUpdate: (id: string, patch: Partial<User>) => void;
  /** Unlink from this product (the designer stays in the global pool). */
  onRemoveFromProduct: (id: string) => void;
  detailed: boolean;
  onToggleDetailed: (v: boolean) => void;
}) {
  const allVisible = users.length > 0 && visibleUserIds.length === users.length;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm">Designers on this project</h3>
          <p className="text-xs text-muted-foreground">
            Pick someone from your team or create a new designer for this project.
            Click a chip to set the drop target; use the eye to toggle visibility.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground pr-2 border-r mr-1">
            <Calendar className="size-3.5" />
            Detailed view
            <Switch checked={detailed} onCheckedChange={onToggleDetailed} />
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowAll}
            disabled={allVisible}
          >
            Show all
          </Button>
          <AddDesignerPopover
            availableDesigners={availableDesigners}
            onAddExisting={onAddExisting}
            onCreateNew={onCreateNew}
          />
        </div>
      </div>

      <Separator className="mb-3" />

      {users.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          No designers on this project yet.
          <br />
          Use the <strong>Add</strong> button to pick from your team or create a new one.
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {users.map((u) => {
            const isActive = u.id === activeUserId;
            const isVisible = visibleUserIds.includes(u.id);
            return (
              <div
                key={u.id}
                className={`group flex items-center rounded-full border transition ${
                  isActive
                    ? "border-foreground bg-accent shadow-sm"
                    : "border-border hover:border-foreground/40"
                } ${!isVisible ? "opacity-40" : ""}`}
              >
                <button
                  onClick={() => onSelectActive(u.id)}
                  className="flex items-center gap-2 pl-1 pr-2.5 py-1"
                  title={isActive ? "Drop target" : "Set as drop target"}
                >
                  <div className="relative">
                    <Avatar className="size-6">
                      <AvatarFallback
                        style={{ background: u.color, color: "white", fontSize: 11 }}
                      >
                        {u.initials ?? initialsOf(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    {isActive && (
                      <Crown className="absolute -top-1.5 -right-1.5 size-3 text-amber-500 fill-amber-400" />
                    )}
                  </div>
                  <span className="text-sm">{u.name}</span>
                </button>
                <button
                  onClick={() => onToggleVisible(u.id)}
                  onDoubleClick={() => onShowOnly(u.id)}
                  className="px-2 py-1 border-l border-inherit hover:bg-background/40 rounded-r-full"
                  title={
                    isVisible
                      ? "Hide (double-click: only this)"
                      : "Show on board"
                  }
                >
                  {isVisible ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <EyeOff className="size-3.5 text-muted-foreground" />
                  )}
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="px-2 py-1 border-l border-inherit hover:bg-background/40 rounded-r-full opacity-0 group-hover:opacity-100 transition"
                      title="Edit / remove"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 space-y-3" align="end">
                    <Label className="text-xs">Edit designer</Label>
                    <Input
                      value={u.name}
                      onChange={(e) => onUpdate(u.id, { name: e.target.value })}
                    />
                    <div className="flex gap-1.5">
                      {USER_PALETTE.map((c) => (
                        <button
                          key={c}
                          onClick={() => onUpdate(u.id, { color: c })}
                          className="size-6 rounded-full border-2"
                          style={{
                            background: c,
                            borderColor: u.color === c ? "#000" : "transparent",
                          }}
                        />
                      ))}
                    </div>
                    <Separator />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive"
                      onClick={() => {
                        if (
                          confirm(
                            `Remove ${u.name} from this project? Their assignments on this product's boards will be deleted. The designer stays in your team and on other projects.`,
                          )
                        )
                          onRemoveFromProduct(u.id);
                      }}
                    >
                      <UserMinus className="size-3.5" /> Remove from project
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddDesignerPopover({
  availableDesigners,
  onAddExisting,
  onCreateNew,
}: {
  availableDesigners: User[];
  onAddExisting: (id: string) => void;
  onCreateNew: (name: string, color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"pick" | "create">(
    availableDesigners.length > 0 ? "pick" : "create",
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState(USER_PALETTE[0]);
  const [filter, setFilter] = useState("");

  // Reset internal state when reopening.
  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      setMode(availableDesigners.length > 0 ? "pick" : "create");
      setName("");
      setColor(USER_PALETTE[0]);
      setFilter("");
    }
  };

  const filtered = filter.trim()
    ? availableDesigners.filter((u) =>
        u.name.toLowerCase().includes(filter.trim().toLowerCase()),
      )
    : availableDesigners;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="size-4" /> Add
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="flex gap-1 rounded-md bg-muted p-1">
          <button
            onClick={() => setMode("pick")}
            disabled={availableDesigners.length === 0}
            className={`flex-1 text-xs py-1.5 rounded transition ${
              mode === "pick"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Users className="size-3.5 inline mr-1" /> From team
          </button>
          <button
            onClick={() => setMode("create")}
            className={`flex-1 text-xs py-1.5 rounded transition ${
              mode === "create"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="size-3.5 inline mr-1" /> Create new
          </button>
        </div>

        {mode === "pick" ? (
          <div className="space-y-2">
            <Input
              autoFocus
              placeholder="Search team…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="max-h-56 overflow-y-auto -mx-1 px-1">
              {filtered.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  {availableDesigners.length === 0
                    ? "Everyone in your team is already on this project."
                    : "No match."}
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        onAddExisting(u.id);
                        setOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-left"
                    >
                      <Avatar className="size-6">
                        <AvatarFallback
                          style={{
                            background: u.color,
                            color: "white",
                            fontSize: 11,
                          }}
                        >
                          {u.initials ?? initialsOf(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{u.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs">Name</Label>
            <Input
              placeholder="e.g. Charlotte"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1.5">
              {USER_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-6 rounded-full border-2"
                  style={{
                    background: c,
                    borderColor: color === c ? "#000" : "transparent",
                  }}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Creates a new designer in the team pool and adds them to this project.
            </p>
            <Button
              size="sm"
              className="w-full"
              disabled={!name.trim()}
              onClick={() => {
                onCreateNew(name.trim(), color);
                setOpen(false);
              }}
            >
              <Plus className="size-4" /> Create and add
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
