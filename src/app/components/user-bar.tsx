import { useState } from "react";
import { Plus, Trash2, UserPlus, Eye, EyeOff, Crown, MoreHorizontal, Calendar } from "lucide-react";
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
  activeUserId,
  visibleUserIds,
  onSelectActive,
  onToggleVisible,
  onShowOnly,
  onShowAll,
  onAdd,
  onUpdate,
  onRemove,
  detailed,
  onToggleDetailed,
}: {
  users: User[];
  activeUserId: string;
  visibleUserIds: string[];
  onSelectActive: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onShowOnly: (id: string) => void;
  onShowAll: () => void;
  onAdd: (name: string, color: string) => void;
  onUpdate: (id: string, patch: Partial<User>) => void;
  onRemove: (id: string) => void;
  detailed: boolean;
  onToggleDetailed: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(USER_PALETTE[0]);
  const [addOpen, setAddOpen] = useState(false);

  const allVisible = visibleUserIds.length === users.length;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm">Designers on this PI</h3>
          <p className="text-xs text-muted-foreground">
            Click a chip to set the drop target. Use the eye to toggle visibility on the board and charts.
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
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <UserPlus className="size-4" /> Add
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3" align="end">
              <Label className="text-xs">New designer</Label>
              <Input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-1.5">
                {USER_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="size-6 rounded-full border-2"
                    style={{
                      background: c,
                      borderColor: color === c ? "#000" : "transparent",
                    }}
                  />
                ))}
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={!name.trim()}
                onClick={() => {
                  onAdd(name.trim(), color);
                  setName("");
                  setAddOpen(false);
                }}
              >
                <Plus className="size-4" /> Add
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Separator className="mb-3" />

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
                    title="Edit"
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
                  {users.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive"
                      onClick={() => {
                        if (
                          confirm(
                            `Remove ${u.name}? Their assignments will be deleted.`,
                          )
                        )
                          onRemove(u.id);
                      }}
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          );
        })}
      </div>
    </div>
  );
}
