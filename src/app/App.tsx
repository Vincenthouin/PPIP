import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  Plus,
  Shield,
  Sparkles,
} from "lucide-react";
import { addDays, format } from "date-fns";
import { AuthProvider, useAuth } from "./auth/auth-context";
import { AuthGate } from "./auth/auth-gate";
import { AdminDashboard } from "./auth/admin-dashboard";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import { useWorkspace } from "./components/workspace-store";
import {
  AssignedCategory,
  CategoryTemplate,
  MeetingLine,
  PALETTE,
  Sprint,
  uid,
} from "./components/pi-types";
import { PiSwitcher } from "./components/pi-switcher";
import { PiHeader, computePiEnd } from "./components/pi-header";
import { TemplateLibrary } from "./components/template-library";
import { SprintBoard } from "./components/sprint-board";
import { ProductionSummary } from "./components/production-summary";
import { UserBar } from "./components/user-bar";

type View = "landing" | "dashboard" | "admin";

function Shell() {
  const { me, signOut } = useAuth();
  const [view, setView] = useState<View>("landing");
  const isAdmin = me?.role === "admin";
  const canEdit = me?.role !== "viewer";
  const workspace = useWorkspace();

  if (workspace.loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading workspace…
      </div>
    );
  }
  if (workspace.error) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-destructive">
        Workspace error: {workspace.error}
      </div>
    );
  }
  if (!workspace.activePi || !workspace.activeProduct) {
    return (
      <EmptyWorkspaceState workspace={workspace} canEdit={canEdit} />
    );
  }

  const openDashboard = (productId: string) => {
    workspace.setActiveProduct(productId);
    workspace.ensureBoard(productId, workspace.activePi.id);
    setView("dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => setView("landing")}
            className="flex items-center gap-3 hover:opacity-80"
          >
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <LayoutDashboard className="size-4" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold">PI Production Planner</div>
              <div className="text-xs text-muted-foreground">Somfy designers</div>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {view === "dashboard" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView("landing")}
              >
                <ArrowLeft className="size-4" /> Overall view
              </Button>
            )}
            {isAdmin && (
              <Button
                variant={view === "admin" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("admin")}
              >
                <Shield className="size-4" />
                Admin
              </Button>
            )}
            <div className="hidden md:flex items-center gap-2 pl-3 ml-1 border-l">
              <div className="text-right">
                <div className="text-xs font-medium leading-tight">
                  {me?.name || me?.email}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  {me?.email}
                </div>
              </div>
              <Badge variant={isAdmin ? "default" : canEdit ? "secondary" : "outline"}>
                {me?.role}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {view === "landing" && (
          <LandingView
            workspace={workspace}
            canEdit={canEdit}
            onOpenProduct={openDashboard}
          />
        )}
        {view === "dashboard" && (
          <DndProvider backend={HTML5Backend}>
            <ProductDashboard workspace={workspace} canEdit={canEdit} />
          </DndProvider>
        )}
        {view === "admin" && isAdmin && <AdminDashboard />}
      </main>
    </div>
  );
}

function LandingView({
  workspace,
  canEdit,
  onOpenProduct,
}: {
  workspace: ReturnType<typeof useWorkspace>;
  canEdit: boolean;
  onOpenProduct: (id: string) => void;
}) {
  const { ws, activePi } = workspace;
  const piEnd = computePiEnd(
    new Date(activePi.startDateISO),
    activePi.sprintCount,
    activePi.weeksPerSprint,
  );

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Current PI
            </div>
            <div className="text-2xl mt-0.5">{activePi.name}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {format(new Date(activePi.startDateISO), "MMM d, yyyy")} →{" "}
              {format(piEnd, "MMM d, yyyy")} · {activePi.sprintCount} sprints ·{" "}
              {activePi.weeksPerSprint} wks each
            </div>
          </div>
          <PiSwitcher
            pis={ws.pis}
            activePiId={ws.activePiId}
            onSelect={workspace.setActivePi}
            onCreate={(name) => workspace.createPi(name)}
            onDuplicate={workspace.duplicatePi}
            onDelete={workspace.deletePi}
            onRename={workspace.renamePi}
          />
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base">Products</h2>
            <p className="text-xs text-muted-foreground">
              Open a product dashboard for this PI
            </p>
          </div>
          {canEdit && (
            <NewProductDialog onCreate={workspace.createProduct} />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ws.products.map((product) => {
            const board = workspace.getBoard(product.id, activePi.id);
            const tag = ws.tags.find((t) => t.id === product.tagId);
            const cats = board.categories.length;
            return (
              <button
                key={product.id}
                onClick={() => onOpenProduct(product.id)}
                className="text-left rounded-xl border bg-card p-4 hover:shadow-sm hover:border-foreground/40 transition"
                style={{ borderLeft: `4px solid ${product.color}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{product.name}</span>
                  {tag && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      #{tag.name}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {cats === 0
                    ? "No assignments yet"
                    : `${cats} assignment${cats > 1 ? "s" : ""} on ${activePi.name}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmptyWorkspaceState({
  workspace,
  canEdit,
}: {
  workspace: ReturnType<typeof useWorkspace>;
  canEdit: boolean;
}) {
  const [name, setName] = useState("PI 2026.3");
  const hasPi = workspace.ws.pis.length > 0;
  const hasProduct = workspace.ws.products.length > 0;
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="p-6 max-w-md space-y-4">
        <div>
          <div className="text-base font-semibold">Workspace is empty</div>
          <div className="text-xs text-muted-foreground mt-1">
            {!canEdit
              ? "Ask an admin to create the first PI and product."
              : "Create the first PI and product to get started."}
          </div>
        </div>
        {canEdit && !hasPi && (
          <div className="space-y-2">
            <Label className="text-xs">First PI name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              size="sm"
              className="w-full"
              disabled={!name.trim()}
              onClick={() => workspace.createPi(name.trim())}
            >
              Create PI
            </Button>
          </div>
        )}
        {canEdit && hasPi && !hasProduct && (
          <NewProductDialog onCreate={workspace.createProduct} />
        )}
      </Card>
    </div>
  );
}

function NewProductDialog({
  onCreate,
}: {
  onCreate: (name: string, color: string) => void | Promise<string>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> New product
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create product</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Connexoon"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1.5">
              {PALETTE.map((c) => (
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
          </div>
          <p className="text-xs text-muted-foreground">
            A tag with the same name will be created and can be applied to
            category templates.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onCreate(name.trim(), color);
              setName("");
              setOpen(false);
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductDashboard({
  workspace,
  canEdit,
}: {
  workspace: ReturnType<typeof useWorkspace>;
  canEdit: boolean;
}) {
  const { ws, activePi, activeProduct } = workspace;
  const board = workspace.getBoard(activeProduct.id, activePi.id);
  const [collapsedTemplates, setCollapsedTemplates] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>(() =>
    ws.users.map((u) => u.id),
  );

  useEffect(() => {
    setVisibleUserIds((v) => v.filter((id) => ws.users.some((u) => u.id === id)));
  }, [ws.users]);

  const sprints: Sprint[] = useMemo(() => {
    const start = new Date(activePi.startDateISO);
    return Array.from({ length: activePi.sprintCount }, (_, i) => {
      const s = addDays(start, i * activePi.weeksPerSprint * 7);
      const e = addDays(s, activePi.weeksPerSprint * 7 - 3);
      return { id: `${activePi.id}-s${i}`, index: i, start: s, end: e };
    });
  }, [activePi.id, activePi.startDateISO, activePi.sprintCount, activePi.weeksPerSprint]);

  const activeUser =
    ws.users.find((u) => u.id === ws.activeUserId) ?? ws.users[0];
  const piEnd = computePiEnd(
    new Date(activePi.startDateISO),
    activePi.sprintCount,
    activePi.weeksPerSprint,
  );

  const setCategories = (
    next: AssignedCategory[] | ((cs: AssignedCategory[]) => AssignedCategory[]),
  ) =>
    workspace.updateBoard(activeProduct.id, activePi.id, (b) => ({
      categories: typeof next === "function" ? (next as any)(b.categories) : next,
    }));

  const onAddFromTemplate = (
    templateId: string,
    sprintId: string,
    userId: string,
  ) => {
    const tpl = ws.templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const cat: AssignedCategory = {
      id: uid(),
      templateId: tpl.id,
      userId,
      name: tpl.name,
      color: tpl.color,
      sprintIds: [sprintId],
      lines: tpl.lines.map((l) => ({ ...l, id: uid() })),
    };
    setCategories((cs) => [...cs, cat]);
  };

  const onUpdate = (id: string, patch: Partial<AssignedCategory>) =>
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const onRemove = (id: string) =>
    setCategories((cs) => cs.filter((c) => c.id !== id));

  const onToggleSprint = (id: string, sprintId: string) =>
    setCategories((cs) =>
      cs.map((c) =>
        c.id === id
          ? {
              ...c,
              sprintIds: c.sprintIds.includes(sprintId)
                ? c.sprintIds.filter((s) => s !== sprintId)
                : [...c.sprintIds, sprintId],
            }
          : c,
      ),
    );

  const onReassignUser = (id: string, userId: string) =>
    onUpdate(id, { userId });

  const onUpdateTemplateLine = (
    templateId: string,
    lineId: string,
    patch: Partial<MeetingLine>,
  ) => {
    workspace.setTemplates((ts) =>
      ts.map((t) =>
        t.id === templateId
          ? {
              ...t,
              lines: t.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
            }
          : t,
      ),
    );
    // also propagate to existing assignments referencing this template line
    setCategories((cs) =>
      cs.map((c) =>
        c.templateId === templateId
          ? {
              ...c,
              lines: c.lines.map((l) =>
                l.id === lineId ? { ...l, ...patch } : l,
              ),
            }
          : c,
      ),
    );
  };

  const applyPreselected = () => {
    const allUserId = activeUser.id;
    const toAdd: AssignedCategory[] = [];
    for (const tid of board.preselectedIds) {
      const tpl = ws.templates.find((t) => t.id === tid);
      if (!tpl) continue;
      for (const s of sprints) {
        toAdd.push({
          id: uid(),
          templateId: tpl.id,
          userId: allUserId,
          name: tpl.name,
          color: tpl.color,
          sprintIds: [s.id],
          lines: tpl.lines.map((l) => ({ ...l, id: uid() })),
        });
      }
    }
    setCategories((cs) => [...cs, ...toAdd]);
    toast.success(`Applied ${board.preselectedIds.length} preselected categor${board.preselectedIds.length === 1 ? "y" : "ies"} to all sprints`);
  };

  const tag = ws.tags.find((t) => t.id === activeProduct.tagId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="size-8 rounded-lg grid place-items-center text-white"
            style={{ background: activeProduct.color }}
          >
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="text-lg leading-tight">{activeProduct.name}</div>
            <div className="text-xs text-muted-foreground">
              {activePi.name} · {format(new Date(activePi.startDateISO), "MMM d")} → {format(piEnd, "MMM d")}
              {tag && <> · #{tag.name}</>}
            </div>
          </div>
        </div>
        <PiSwitcher
          pis={ws.pis}
          activePiId={ws.activePiId}
          onSelect={(id) => {
            workspace.setActivePi(id);
            workspace.ensureBoard(activeProduct.id, id);
          }}
          onCreate={(name) => {
            // createPi inserts boards for every product internally
            workspace.createPi(name);
          }}
          onDuplicate={workspace.duplicatePi}
          onDelete={workspace.deletePi}
          onRename={workspace.renamePi}
        />
      </div>

      <PiHeader
        startDate={new Date(activePi.startDateISO)}
        setStartDate={(d) =>
          workspace.updatePi(activePi.id, { startDateISO: d.toISOString() })
        }
        sprintCount={activePi.sprintCount}
        setSprintCount={(n) => workspace.updatePi(activePi.id, { sprintCount: n })}
        weeksPerSprint={activePi.weeksPerSprint}
        setWeeksPerSprint={(n) =>
          workspace.updatePi(activePi.id, { weeksPerSprint: n })
        }
        workdayHours={activePi.workdayHours}
        setWorkdayHours={(n) =>
          workspace.updatePi(activePi.id, { workdayHours: n })
        }
        endDate={piEnd}
        templates={ws.templates}
        preselectedIds={board.preselectedIds}
        setPreselectedIds={(ids) =>
          workspace.updateBoard(activeProduct.id, activePi.id, {
            preselectedIds: ids,
          })
        }
        onApplyPreselected={applyPreselected}
      />

      <UserBar
        users={ws.users}
        activeUserId={activeUser.id}
        visibleUserIds={visibleUserIds}
        onSelectActive={workspace.setActiveUser}
        onToggleVisible={(id) =>
          setVisibleUserIds((v) =>
            v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
          )
        }
        onShowOnly={(id) => setVisibleUserIds([id])}
        onShowAll={() => setVisibleUserIds(ws.users.map((u) => u.id))}
        onAdd={async (name, color) => {
          const id = await workspace.addUser(name, color);
          setVisibleUserIds((v) => [...v, id]);
        }}
        onUpdate={workspace.updateUser}
        onRemove={workspace.removeUser}
        detailed={detailed}
        onToggleDetailed={setDetailed}
      />

      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: collapsedTemplates ? "auto 1fr" : "320px 1fr",
        }}
      >
        <TemplateLibrary
          templates={ws.templates}
          onChange={(t) => workspace.setTemplates(t)}
          collapsed={collapsedTemplates}
          onToggleCollapsed={() => setCollapsedTemplates((c) => !c)}
          weeksPerSprint={activePi.weeksPerSprint}
          referenceStart={sprints[0]?.start}
          tags={ws.tags}
          onCreateTag={workspace.createTag}
        />
        <SprintBoard
          sprints={sprints}
          weeksPerSprint={activePi.weeksPerSprint}
          workdayHours={activePi.workdayHours}
          categories={board.categories}
          users={ws.users}
          activeUser={activeUser}
          visibleUserIds={visibleUserIds}
          detailed={detailed}
          templates={ws.templates}
          onAddFromTemplate={onAddFromTemplate}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onToggleSprint={onToggleSprint}
          onReassignUser={onReassignUser}
          onUpdateTemplateLine={onUpdateTemplateLine}
        />
      </div>

      <ProductionSummary
        sprints={sprints}
        categories={board.categories}
        users={ws.users}
        visibleUserIds={visibleUserIds}
        weeksPerSprint={activePi.weeksPerSprint}
        workdayHours={activePi.workdayHours}
      />
    </div>
  );
}

function Root() {
  const { loading, me } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!me) return <AuthGate />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
      <Toaster richColors closeButton position="top-right" />
    </AuthProvider>
  );
}
