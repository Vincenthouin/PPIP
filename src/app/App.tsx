import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  ArrowLeft, LayoutDashboard, LogOut, MoreHorizontal, Pencil,
  Plus, Shield, Sparkles, Trash2, Users,
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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "./components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./components/ui/select";
import { ConfirmDelete } from "./components/confirm-delete";
import {
  AssignedCategory, CategoryTemplate, MeetingLine, PALETTE, Product,
  Sprint, SortMode, USER_PALETTE, User, uid, resolveWorkdayHours, lineHoursInSprint,
} from "./components/pi-types";
import { useWorkspace } from "./components/workspace-store";
import { PiSwitcher } from "./components/pi-switcher";
import { PiHeader, computePiEnd } from "./components/pi-header";
import { TemplateLibrary } from "./components/template-library";
import { SprintBoard } from "./components/sprint-board";
import { ProductionSummary } from "./components/production-summary";
import { UserBar } from "./components/user-bar";

type View = "landing" | "dashboard" | "admin" | "team";

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
    return <EmptyWorkspaceState workspace={workspace} canEdit={canEdit} />;
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
          <button onClick={() => setView("landing")} className="flex items-center gap-3 hover:opacity-80">
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
              <Button variant="ghost" size="sm" onClick={() => setView("landing")}>
                <ArrowLeft className="size-4" /> Overall view
              </Button>
            )}
            {canEdit && (
              <Button variant={view === "team" ? "secondary" : "ghost"} size="sm" onClick={() => setView("team")}>
                <Users className="size-4" /> Team
              </Button>
            )}
            {isAdmin && (
              <Button variant={view === "admin" ? "secondary" : "ghost"} size="sm" onClick={() => setView("admin")}>
                <Shield className="size-4" /> Admin
              </Button>
            )}
            <div className="hidden md:flex items-center gap-2 pl-3 ml-1 border-l">
              <div className="text-right">
                <div className="text-xs font-medium leading-tight">{me?.name || me?.email}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{me?.email}</div>
              </div>
              <Badge variant={isAdmin ? "default" : canEdit ? "secondary" : "outline"}>{me?.role}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {view === "landing" && (
          <LandingView workspace={workspace} canEdit={canEdit} onOpenProduct={openDashboard} />
        )}
        {view === "dashboard" && (
          <DndProvider backend={HTML5Backend}>
            <ProductDashboard workspace={workspace} canEdit={canEdit} />
          </DndProvider>
        )}
        {view === "team" && canEdit && <TeamView workspace={workspace} />}
        {view === "admin" && isAdmin && <AdminDashboard />}
      </main>
    </div>
  );
}

// ---- LandingView ------------------------------------------------------------

function LandingView({
  workspace, canEdit, onOpenProduct,
}: {
  workspace: ReturnType<typeof useWorkspace>;
  canEdit: boolean;
  onOpenProduct: (id: string) => void;
}) {
  const { ws, activePi } = workspace;
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const piEnd = computePiEnd(new Date(activePi.startDateISO), activePi.sprintCount, activePi.weeksPerSprint);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Current PI</div>
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
            <p className="text-xs text-muted-foreground">Open a product dashboard for this PI</p>
          </div>
          {canEdit && <NewProductDialog onCreate={workspace.createProduct} />}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ws.products.map((product) => {
            const board = workspace.getBoard(product.id, activePi.id);
            const tag = ws.tags.find((t) => t.id === product.tagId);
            return (
              <ProductCard
                key={product.id}
                product={product}
                tagName={tag?.name}
                assignmentCount={board.categories.length}
                piName={activePi.name}
                canEdit={canEdit}
                canDelete={canEdit && ws.products.length > 1}
                onOpen={() => onOpenProduct(product.id)}
                onEdit={() => setEditingProduct(product)}
                onDelete={() => workspace.deleteProduct(product.id)}
              />
            );
          })}
        </div>
      </div>

      <EditProductDialog
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSave={(patch) => editingProduct && workspace.updateProduct(editingProduct.id, patch)}
      />
    </div>
  );
}

// ---- ProductCard ------------------------------------------------------------

function ProductCard({
  product, tagName, assignmentCount, piName, canEdit, canDelete, onOpen, onEdit, onDelete,
}: {
  product: Product; tagName: string | undefined; assignmentCount: number; piName: string;
  canEdit: boolean; canDelete: boolean; onOpen: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div
      className="group relative rounded-xl border bg-card hover:shadow-sm hover:border-foreground/40 transition"
      style={{ borderLeft: `4px solid ${product.color}` }}
    >
      <button type="button" onClick={onOpen} className="text-left w-full p-4 pr-12">
        <div className="flex items-center gap-2">
          <span className="text-base">{product.name}</span>
          {tagName && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              #{tagName}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {assignmentCount === 0
            ? "No assignments yet"
            : `${assignmentCount} assignment${assignmentCount > 1 ? "s" : ""} on ${piName}`}
        </div>
      </button>
      {canEdit && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Product actions" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}><Pencil className="size-4" /> Edit</DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <ConfirmDelete
                    title={`Delete "${product.name}"?`}
                    description="This removes the product, its auto-created tag, every board for this product, and all its assignments. Templates and other products are kept."
                    confirmLabel="Delete product"
                    onConfirm={onDelete}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    }
                  />
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

// ---- EditProductDialog -------------------------------------------------------

function EditProductDialog({
  product, onClose, onSave,
}: {
  product: Product | null; onClose: () => void; onSave: (patch: Partial<Product>) => void;
}) {
  const open = product !== null;
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);

  useEffect(() => {
    if (product) { setName(product.name); setColor(product.color); }
  }, [product?.id]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit product</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <p className="text-[11px] text-muted-foreground">Renaming the product also renames its auto-tag.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1.5">
              {PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="size-6 rounded-full border-2"
                  style={{ background: c, borderColor: color === c ? "#000" : "transparent" }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim() || !product} onClick={() => {
            const patch: Partial<Product> = {};
            if (product) {
              if (name.trim() !== product.name) patch.name = name.trim();
              if (color !== product.color) patch.color = color;
            }
            if (Object.keys(patch).length > 0) onSave(patch);
            onClose();
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- EmptyWorkspaceState ----------------------------------------------------

function EmptyWorkspaceState({
  workspace, canEdit,
}: {
  workspace: ReturnType<typeof useWorkspace>; canEdit: boolean;
}) {
  const hasPi = workspace.ws.pis.length > 0;
  const hasProduct = workspace.ws.products.length > 0;
  const [piName, setPiName] = useState("PI 2026.3");

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="p-6 max-w-md w-full space-y-4">
        <div>
          <div className="text-base font-semibold">
            {!hasPi ? "Create your first PI" : !hasProduct ? "Create your first product" : "Workspace setup"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {!canEdit ? "Ask an admin to finish workspace setup." : "Two quick steps before you can open the dashboard."}
          </div>
        </div>
        {canEdit && !hasPi && (
          <div className="space-y-2">
            <Label className="text-xs">PI name</Label>
            <Input value={piName} onChange={(e) => setPiName(e.target.value)} />
            <Button size="sm" className="w-full" disabled={!piName.trim()} onClick={() => workspace.createPi(piName.trim())}>
              Create PI
            </Button>
          </div>
        )}
        {canEdit && hasPi && !hasProduct && <NewProductDialog onCreate={workspace.createProduct} />}
      </Card>
    </div>
  );
}

// ---- TeamView ---------------------------------------------------------------

function TeamView({ workspace }: { workspace: ReturnType<typeof useWorkspace> }) {
  const { ws } = workspace;
  const [editing, setEditing] = useState<User | null>(null);

  const productsForDesigner = (designerId: string): string[] => {
    const out: string[] = [];
    for (const p of ws.products) {
      if ((ws.productDesignerIds[p.id] ?? []).includes(designerId)) out.push(p.name);
    }
    return out;
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Team</div>
            <div className="text-2xl mt-0.5">Designers in your organization</div>
            <div className="text-sm text-muted-foreground mt-1">
              {ws.users.length} designer{ws.users.length === 1 ? "" : "s"} in the pool.
            </div>
          </div>
          <NewDesignerDialog onCreate={workspace.addUser} />
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2 px-4">Designer</th>
                <th className="py-2 px-4">Hours/day</th>
                <th className="py-2 px-4">Projects</th>
                <th className="py-2 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ws.users.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No designers yet.</td></tr>
              )}
              {ws.users.map((u) => {
                const products = productsForDesigner(u.id);
                return (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-full grid place-items-center text-white text-xs" style={{ background: u.color }}>
                          {u.initials ?? u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span>{u.name}</span>
                      </div>
                    </td>
                    {/* Amélioration 4 */}
                    <td className="py-2 px-4 text-muted-foreground text-xs">
                      {u.workdayHours != null ? `${u.workdayHours}h` : "—"}
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      {products.length === 0 ? (
                        <span className="text-xs italic">Not on any project</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {products.map((p) => (
                            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted">{p}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-4 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                        <ConfirmDelete
                          title={`Remove ${u.name} from the team?`}
                          description={products.length === 0 ? "This designer is on no project." : `This designer is on ${products.length} project(s).`}
                          confirmLabel="Remove from team"
                          onConfirm={() => workspace.removeUser(u.id)}
                          trigger={
                            <Button size="sm" variant="ghost" className="text-destructive" disabled={ws.users.length <= 1}>
                              <Trash2 className="size-4" /> Remove
                            </Button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {editing && (
        <TeamEditDesignerDialog
          designer={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => { editing && workspace.updateUser(editing.id, patch); setEditing(null); }}
        />
      )}
    </div>
  );
}

function TeamEditDesignerDialog({
  designer, onClose, onSave,
}: {
  designer: User; onClose: () => void; onSave: (patch: Partial<User>) => void;
}) {
  const [name, setName] = useState(designer.name);
  const [color, setColor] = useState(designer.color);
  const [workdayHours, setWorkdayHours] = useState(String(designer.workdayHours ?? ""));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit designer</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1.5">
              {PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="size-6 rounded-full border-2"
                  style={{ background: c, borderColor: color === c ? "#000" : "transparent" }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Working hours / day</Label>
            <div className="relative w-28">
              <Input type="number" min={1} max={24} step={0.5} value={workdayHours}
                onChange={(e) => setWorkdayHours(e.target.value)} className="pr-6" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">h</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!name.trim()} onClick={() => {
            const patch: Partial<User> = {};
            if (name.trim() !== designer.name) patch.name = name.trim();
            if (color !== designer.color) patch.color = color;
            const wh = parseFloat(workdayHours);
            if (!isNaN(wh) && wh !== (designer.workdayHours ?? 0)) patch.workdayHours = wh;
            onSave(patch);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- NewDesignerDialog / NewProductDialog -----------------------------------

function NewDesignerDialog({ onCreate }: { onCreate: (name: string, color: string) => void | Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(USER_PALETTE[0]);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setName(""); setColor(USER_PALETTE[0]); } }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4" /> New designer</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add a designer to your team</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Charlotte" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1.5">
              {USER_PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className="size-6 rounded-full border-2"
                  style={{ background: c, borderColor: color === c ? "#000" : "transparent" }} />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!name.trim()} onClick={() => { onCreate(name.trim(), color); setOpen(false); }}>
            Add to team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewProductDialog({ onCreate }: { onCreate: (name: string, color: string) => void | Promise<string> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="size-4" /> New product</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create product</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Connexoon" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1.5">
              {PALETTE.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className="size-6 rounded-full border-2"
                  style={{ background: c, borderColor: color === c ? "#000" : "transparent" }} />
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">A tag with the same name will be created.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!name.trim()} onClick={() => { onCreate(name.trim(), color); setName(""); setOpen(false); }}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- ProductDashboard -------------------------------------------------------

function ProductDashboard({
  workspace, canEdit,
}: {
  workspace: ReturnType<typeof useWorkspace>; canEdit: boolean;
}) {
  const { ws, activePi, activeProduct } = workspace;
  const board = workspace.getBoard(activeProduct.id, activePi.id);
  const [collapsedTemplates, setCollapsedTemplates] = useState(false);
  const [detailed, setDetailed] = useState(false);

  const productDesignerIds = ws.productDesignerIds[activeProduct.id] ?? [];
  const productDesigners = useMemo(
    () => ws.users.filter((u) => productDesignerIds.includes(u.id)),
    [ws.users, productDesignerIds.join("|")],
  );
  const availableDesigners = useMemo(
    () => ws.users.filter((u) => !productDesignerIds.includes(u.id)),
    [ws.users, productDesignerIds.join("|")],
  );

  const [visibleUserIds, setVisibleUserIds] = useState<string[]>(() => productDesigners.map((u) => u.id));

  useEffect(() => {
    setVisibleUserIds((v) => {
      const kept = v.filter((id) => productDesigners.some((u) => u.id === id));
      const newIds = productDesigners.map((u) => u.id).filter((id) => !kept.includes(id));
      return [...kept, ...newIds];
    });
  }, [productDesigners]);

  const sprints: Sprint[] = useMemo(() => {
    const start = new Date(activePi.startDateISO);
    return Array.from({ length: activePi.sprintCount }, (_, i) => {
      const s = addDays(start, i * activePi.weeksPerSprint * 7);
      const e = addDays(s, activePi.weeksPerSprint * 7 - 3);
      return { id: `${activePi.id}-s${i}`, index: i, start: s, end: e };
    });
  }, [activePi.id, activePi.startDateISO, activePi.sprintCount, activePi.weeksPerSprint]);

  const activeUser: User | undefined =
    productDesigners.find((u) => u.id === ws.activeUserId) ?? productDesigners[0];

  const piEnd = computePiEnd(new Date(activePi.startDateISO), activePi.sprintCount, activePi.weeksPerSprint);

  // Amélioration 7 — sort mode depuis le board
  const sortMode: SortMode = board.sortMode ?? "manual";

  const setCategories = (
    next: AssignedCategory[] | ((cs: AssignedCategory[]) => AssignedCategory[]),
  ) =>
    workspace.updateBoard(activeProduct.id, activePi.id, (b) => ({
      categories: typeof next === "function" ? (next as any)(b.categories) : next,
    }));

  const onAddFromTemplate = (templateId: string, sprintId: string, userId: string) => {
    const tpl = ws.templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const cat: AssignedCategory = {
      id: uid(), templateId: tpl.id, userId,
      name: tpl.name, color: tpl.color,
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

  const onReassignUser = (id: string, userId: string) => onUpdate(id, { userId });

  const onUpdateTemplateLine = (templateId: string, lineId: string, patch: Partial<MeetingLine>) => {
    // Amélioration 8 — cas spécial notes de carte (__notes__ sentinel)
    if (lineId === "__notes__") {
      workspace.setTemplates((ts) =>
        ts.map((t) => t.id === templateId ? { ...t, notes: patch.label } : t),
      );
      return;
    }
    workspace.setTemplates((ts) =>
      ts.map((t) =>
        t.id === templateId
          ? { ...t, lines: t.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }
          : t,
      ),
    );
    // Amélioration 10 — propager immédiatement aux assignments
    setCategories((cs) =>
      cs.map((c) =>
        c.templateId === templateId
          ? { ...c, lines: c.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }
          : c,
      ),
    );
  };

  // Amélioration 1 — réordonnancement persisté
  const onReorder = (sprintId: string, orderedIds: string[]) =>
    setCategories((cs) =>
      cs.map((c) => {
        const idx = orderedIds.indexOf(c.id);
        if (idx === -1) return c;
        return { ...c, orderBySprintId: { ...(c.orderBySprintId ?? {}), [sprintId]: idx } };
      }),
    );

  // Amélioration 7 — changer le mode de tri
  const onSortModeChange = (mode: SortMode) =>
    workspace.setSortMode(activeProduct.id, activePi.id, mode);

  const applyPreselected = () => {
    if (!activeUser) return;
    const toAdd: AssignedCategory[] = [];
    for (const tid of board.preselectedIds) {
      const tpl = ws.templates.find((t) => t.id === tid);
      if (!tpl) continue;
      for (const s of sprints) {
        toAdd.push({
          id: uid(), templateId: tpl.id, userId: activeUser.id,
          name: tpl.name, color: tpl.color, sprintIds: [s.id],
          lines: tpl.lines.map((l) => ({ ...l, id: uid() })),
        });
      }
    }
    setCategories((cs) => [...cs, ...toAdd]);
    toast.success(`Applied ${board.preselectedIds.length} preselected categor${board.preselectedIds.length === 1 ? "y" : "ies"} to all sprints`);
  };

  const tag = ws.tags.find((t) => t.id === activeProduct.tagId);

  // Amélioration 5+6 — stats par designer pour la UserBar
  const userStats = useMemo(() => {
    const stats: Record<string, { totalMeetingHours: number; totalProductionHours: number }> = {};
    for (const u of productDesigners) {
      const userWorkday = resolveWorkdayHours(u, activePi.workdayHours);
      let totalMeeting = 0;
      let totalCapacity = 0;
      for (const sprint of sprints) {
        const workingDays = Math.max(0, Math.round(
          (new Date(sprint.end).getTime() - new Date(sprint.start).getTime()) / (1000 * 60 * 60 * 24 + 1) * (5 / 7)
        ));
        totalCapacity += workingDays * userWorkday;
        totalMeeting += board.categories
          .filter((c) => c.sprintIds.includes(sprint.id) && c.userId === u.id)
          .reduce((sum, c) => sum + c.lines.reduce((s, l) => s + lineHoursInSprint(l, activePi.weeksPerSprint), 0), 0);
      }
      stats[u.id] = {
        totalMeetingHours: totalMeeting,
        totalProductionHours: Math.max(0, totalCapacity - totalMeeting),
      };
    }
    return stats;
  }, [productDesigners, board.categories, sprints, activePi.weeksPerSprint, activePi.workdayHours]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg grid place-items-center text-white" style={{ background: activeProduct.color }}>
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
          onSelect={(id) => { workspace.setActivePi(id); workspace.ensureBoard(activeProduct.id, id); }}
          onCreate={(name) => workspace.createPi(name)}
          onDuplicate={workspace.duplicatePi}
          onDelete={workspace.deletePi}
          onRename={workspace.renamePi}
        />
      </div>

      <PiHeader
        startDate={new Date(activePi.startDateISO)}
        setStartDate={(d) => workspace.updatePi(activePi.id, { startDateISO: d.toISOString() })}
        sprintCount={activePi.sprintCount}
        setSprintCount={(n) => workspace.updatePi(activePi.id, { sprintCount: n })}
        weeksPerSprint={activePi.weeksPerSprint}
        setWeeksPerSprint={(n) => workspace.updatePi(activePi.id, { weeksPerSprint: n })}
        workdayHours={activePi.workdayHours}
        setWorkdayHours={(n) => workspace.updatePi(activePi.id, { workdayHours: n })}
        endDate={piEnd}
        templates={ws.templates}
        preselectedIds={board.preselectedIds}
        setPreselectedIds={(ids) => workspace.updateBoard(activeProduct.id, activePi.id, { preselectedIds: ids })}
        onApplyPreselected={applyPreselected}
      />

      {productDesigners.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">
          Add at least one designer to <strong>{activeProduct.name}</strong> from the bar above to start scheduling.
        </Card>
      ) : (
        <>
          {/* Amélioration 7 — sélecteur de tri + Amélioration 6 — sidebar redesign */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-md border p-0.5 text-xs">
              {(["manual", "designer", "template"] as SortMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSortModeChange(m)}
                  className={`px-2.5 py-1 rounded transition ${
                    sortMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {m === "manual" ? "Manual" : m === "designer" ? "By designer" : "By template"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            {/* Amélioration 6 — UserBar sidebar Option D */}
            <UserBar
              users={productDesigners}
              availableDesigners={availableDesigners}
              activeUserId={activeUser?.id ?? ""}
              visibleUserIds={visibleUserIds}
              onSelectActive={workspace.setActiveUser}
              onToggleVisible={(id) =>
                setVisibleUserIds((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id])
              }
              onShowOnly={(id) => setVisibleUserIds([id])}
              onShowAll={() => setVisibleUserIds(productDesigners.map((u) => u.id))}
              onAddExisting={(id) => workspace.addDesignerToProduct(activeProduct.id, id)}
              onCreateNew={(name, color, wh) => workspace.createDesignerForProduct(activeProduct.id, name, color, wh)}
              onUpdate={workspace.updateUser}
              onRemoveFromProduct={(id) => workspace.removeDesignerFromProduct(activeProduct.id, id)}
              detailed={detailed}
              onToggleDetailed={() => setDetailed((d) => !d)}
              userStats={userStats}
            />

            <div className="flex-1 min-w-0 space-y-4">
              <div className="grid gap-4" style={{ gridTemplateColumns: collapsedTemplates ? "auto 1fr" : "320px 1fr" }}>
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
                  users={productDesigners}
                  activeUser={activeUser!}
                  visibleUserIds={visibleUserIds}
                  detailed={detailed}
                  templates={ws.templates}
                  sortMode={sortMode}
                  savingIds={workspace.savingIds}
                  onAddFromTemplate={onAddFromTemplate}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  onToggleSprint={onToggleSprint}
                  onReassignUser={onReassignUser}
                  onUpdateTemplateLine={onUpdateTemplateLine}
                  onReorder={onReorder}
                  onSortModeChange={onSortModeChange}
                />
              </div>

              <ProductionSummary
                sprints={sprints}
                categories={board.categories}
                users={productDesigners}
                visibleUserIds={visibleUserIds}
                weeksPerSprint={activePi.weeksPerSprint}
                workdayHours={activePi.workdayHours}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Root / App -------------------------------------------------------------

function Root() {
  const { loading, me } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>
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
