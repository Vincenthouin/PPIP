import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nextMonday } from "date-fns";
import { supabase } from "../auth/supabase-client";
import {
  AssignedCategory,
  Board,
  CategoryTemplate,
  PALETTE,
  PiState,
  Product,
  SortMode,
  Tag,
  User,
  Workspace,
  boardKey,
  initialsOf,
  uid,
} from "./pi-types";

const UI_PREFS_KEY = "pi-planner:ui-prefs:v1";

interface UiPrefs {
  activePiId?: string;
  activeProductId?: string;
  activeUserId?: string;
  sortMode?: SortMode;
}

const loadUiPrefs = (): UiPrefs => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(UI_PREFS_KEY) ?? "{}");
  } catch {
    return {};
  }
};
const saveUiPrefs = (p: UiPrefs) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(p));
  } catch {}
};

// ---- row <-> domain mappers ----------------------------------------------

const fromDbPi = (r: any): PiState => ({
  id: r.id,
  name: r.name,
  startDateISO: r.start_date_iso,
  sprintCount: r.sprint_count,
  weeksPerSprint: r.weeks_per_sprint,
  workdayHours: Number(r.workday_hours),
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
});
const toDbPi = (p: PiState) => ({
  id: p.id,
  name: p.name,
  start_date_iso: p.startDateISO,
  sprint_count: p.sprintCount,
  weeks_per_sprint: p.weeksPerSprint,
  workday_hours: p.workdayHours,
  updated_at: new Date().toISOString(),
});

const fromDbTag = (r: any): Tag => ({
  id: r.id,
  name: r.name,
  productId: r.product_id ?? undefined,
});
const toDbTag = (t: Tag) => ({
  id: t.id,
  name: t.name,
  product_id: t.productId ?? null,
});

const fromDbProduct = (r: any): Product => ({
  id: r.id,
  name: r.name,
  color: r.color,
  tagId: r.tag_id,
  createdAt: new Date(r.created_at).getTime(),
});
const toDbProduct = (p: Product) => ({
  id: p.id,
  name: p.name,
  color: p.color,
  tag_id: p.tagId,
});

// Amélioration 4 — workdayHours par designer
const fromDbDesigner = (r: any): User => ({
  id: r.id,
  name: r.name,
  color: r.color,
  initials: r.initials ?? undefined,
  workdayHours: r.workday_hours != null ? Number(r.workday_hours) : undefined,
});
const toDbDesigner = (u: User) => ({
  id: u.id,
  name: u.name,
  color: u.color,
  initials: u.initials ?? null,
  workday_hours: u.workdayHours ?? null,
});

const fromDbTemplate = (r: any, tagIds: string[]): CategoryTemplate => ({
  id: r.id,
  name: r.name,
  color: r.color,
  lines: r.lines ?? [],
  defaultSelected: r.default_selected,
  tagIds,
  notes: r.notes ?? undefined, // Amélioration 8
});
const toDbTemplate = (t: CategoryTemplate) => ({
  id: t.id,
  name: t.name,
  color: t.color,
  lines: t.lines,
  default_selected: t.defaultSelected ?? false,
  notes: t.notes ?? null, // Amélioration 8
  updated_at: new Date().toISOString(),
});

// Amélioration 1 + 8 — orderBySprintId + notes
const fromDbAssignment = (r: any): AssignedCategory => ({
  id: r.id,
  templateId: r.template_id ?? "",
  userId: r.designer_id ?? "",
  name: r.name,
  color: r.color,
  sprintIds: r.sprint_ids ?? [],
  lines: r.lines ?? [],
  orderBySprintId: r.order_by_sprint_id ?? undefined,
  notes: r.notes ?? undefined,
});
const toDbAssignment = (
  a: AssignedCategory,
  productId: string,
  piId: string,
) => ({
  id: a.id,
  product_id: productId,
  pi_id: piId,
  template_id: a.templateId || null,
  designer_id: a.userId || null,
  name: a.name,
  color: a.color,
  sprint_ids: a.sprintIds,
  lines: a.lines,
  order_by_sprint_id: a.orderBySprintId ?? null, // Amélioration 1
  notes: a.notes ?? null, // Amélioration 8
  updated_at: new Date().toISOString(),
});

// ---- helpers --------------------------------------------------------------

export const blankPi = (name: string): PiState => ({
  id: uid(),
  name,
  startDateISO: nextMonday(new Date()).toISOString(),
  sprintCount: 3,
  weeksPerSprint: 3,
  workdayHours: 8,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const blankBoard = (
  productId: string,
  piId: string,
  templates: CategoryTemplate[],
): Board => ({
  productId,
  piId,
  categories: [],
  preselectedIds: templates.filter((t) => t.defaultSelected).map((t) => t.id),
  sortMode: "manual",
});

// ---- initial load --------------------------------------------------------

const loadAll = async (): Promise<Omit<Workspace, "activePiId" | "activeProductId" | "activeUserId">> => {
  const sb = supabase();
  const [pis, tags, products, designers, templates, ttags, boards, assignments, productDesigners] =
    await Promise.all([
      sb.from("pis").select("*"),
      sb.from("tags").select("*"),
      sb.from("products").select("*"),
      sb.from("designers").select("*"),
      sb.from("templates").select("*"),
      sb.from("template_tags").select("*"),
      sb.from("boards").select("*"),
      sb.from("assignments").select("*"),
      sb.from("product_designers").select("*"),
    ]);

  const tagsByTemplate = new Map<string, string[]>();
  for (const r of ttags.data ?? []) {
    const arr = tagsByTemplate.get(r.template_id) ?? [];
    arr.push(r.tag_id);
    tagsByTemplate.set(r.template_id, arr);
  }

  const assignmentsByBoard = new Map<string, AssignedCategory[]>();
  for (const r of assignments.data ?? []) {
    const k = boardKey(r.product_id, r.pi_id);
    const arr = assignmentsByBoard.get(k) ?? [];
    arr.push(fromDbAssignment(r));
    assignmentsByBoard.set(k, arr);
  }

  const boardMap: Record<string, Board> = {};
  for (const r of boards.data ?? []) {
    const k = boardKey(r.product_id, r.pi_id);
    boardMap[k] = {
      productId: r.product_id,
      piId: r.pi_id,
      preselectedIds: r.preselected_ids ?? [],
      categories: assignmentsByBoard.get(k) ?? [],
      sortMode: r.sort_mode ?? "manual", // Amélioration 7
    };
  }

  const productDesignerIds: Record<string, string[]> = {};
  for (const r of productDesigners.data ?? []) {
    const arr = productDesignerIds[r.product_id] ?? [];
    arr.push(r.designer_id);
    productDesignerIds[r.product_id] = arr;
  }

  return {
    pis: (pis.data ?? []).map(fromDbPi),
    tags: (tags.data ?? []).map(fromDbTag),
    products: (products.data ?? []).map(fromDbProduct),
    users: (designers.data ?? []).map(fromDbDesigner),
    productDesignerIds,
    templates: (templates.data ?? []).map((r) =>
      fromDbTemplate(r, tagsByTemplate.get(r.id) ?? []),
    ),
    boards: boardMap,
  };
};

// ---- the hook -------------------------------------------------------------

export function useWorkspace() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Amélioration 10 — tracking des saves en cours
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const wsRef = useRef<Workspace | null>(null);
  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadAll();
        if (cancelled) return;
        const prefs = loadUiPrefs();
        const activePiId =
          (prefs.activePiId && data.pis.find((p) => p.id === prefs.activePiId)?.id) ||
          data.pis[0]?.id || "";
        const activeProductId =
          (prefs.activeProductId &&
            data.products.find((p) => p.id === prefs.activeProductId)?.id) ||
          data.products[0]?.id || "";
        const activeUserId =
          (prefs.activeUserId && data.users.find((u) => u.id === prefs.activeUserId)?.id) ||
          data.users[0]?.id || "";
        setWs({ ...data, activePiId, activeProductId, activeUserId });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      }
    })();

    const sb = supabase();
    const ch = sb.channel("workspace");
    const tables = [
      "pis", "tags", "products", "designers", "templates",
      "template_tags", "boards", "assignments", "product_designers",
    ];
    for (const t of tables) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t },
        (payload) => applyRealtime(t, payload, setWs),
      );
    }
    ch.subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(ch);
    };
  }, []);

  const patchWs = useCallback((u: (w: Workspace) => Workspace) => {
    setWs((w) => (w ? u(w) : w));
  }, []);

  // Amélioration 10 — marquer un id comme en cours de sauvegarde
  const markSaving = useCallback((id: string) => {
    setSavingIds((s) => new Set(s).add(id));
  }, []);
  const markSaved = useCallback((id: string) => {
    setSavingIds((s) => { const n = new Set(s); n.delete(id); return n; });
  }, []);

  const activePi = ws?.pis.find((p) => p.id === ws.activePiId) ?? ws?.pis[0];
  const activeProduct =
    ws?.products.find((p) => p.id === ws.activeProductId) ?? ws?.products[0];

  const ensureBoard = useCallback(
    async (productId: string, piId: string) => {
      const w = wsRef.current;
      if (!w) return;
      const k = boardKey(productId, piId);
      if (w.boards[k]) return;
      const preselectedIds = w.templates.filter((t) => t.defaultSelected).map((t) => t.id);
      patchWs((cur) => ({
        ...cur,
        boards: {
          ...cur.boards,
          [k]: { productId, piId, preselectedIds, categories: [], sortMode: "manual" },
        },
      }));
      await supabase().from("boards").upsert({
        product_id: productId, pi_id: piId,
        preselected_ids: preselectedIds, sort_mode: "manual",
      });
    },
    [patchWs],
  );

  const getBoard = useCallback(
    (productId: string, piId: string): Board => {
      const w = wsRef.current;
      const k = boardKey(productId, piId);
      return (
        w?.boards[k] ?? {
          productId, piId, categories: [],
          preselectedIds: w?.templates.filter((t) => t.defaultSelected).map((t) => t.id) ?? [],
          sortMode: "manual",
        }
      );
    },
    [],
  );

  const updateBoard = useCallback(
    async (
      productId: string,
      piId: string,
      patch: Partial<Board> | ((b: Board) => Partial<Board>),
    ) => {
      const w = wsRef.current;
      if (!w) return;
      const k = boardKey(productId, piId);
      const existing = w.boards[k] ?? {
        productId, piId, categories: [],
        preselectedIds: w.templates.filter((t) => t.defaultSelected).map((t) => t.id),
        sortMode: "manual" as SortMode,
      };
      const next = typeof patch === "function" ? patch(existing) : patch;
      const merged: Board = { ...existing, ...next };

      patchWs((cur) => ({
        ...cur,
        boards: { ...cur.boards, [k]: merged },
        pis: cur.pis.map((p) => p.id === piId ? { ...p, updatedAt: Date.now() } : p),
      }));

      const sb = supabase();
      if (next.preselectedIds !== undefined || next.sortMode !== undefined) {
        await sb.from("boards").upsert({
          product_id: productId, pi_id: piId,
          preselected_ids: merged.preselectedIds,
          sort_mode: merged.sortMode ?? "manual",
          updated_at: new Date().toISOString(),
        });
      }
      if (next.categories !== undefined) {
        // Amélioration 10 — marquer les catégories modifiées
        const changedIds = next.categories
          .filter((c) => {
            const prev = existing.categories.find((x) => x.id === c.id);
            return !prev || !assignmentEqual(prev, c);
          })
          .map((c) => c.id);
        changedIds.forEach(markSaving);
        await syncAssignments(productId, piId, existing.categories, merged.categories);
        changedIds.forEach(markSaved);
      }
    },
    [patchWs, markSaving, markSaved],
  );

  // Amélioration 7 — setter du mode de tri
  const setSortMode = useCallback(
    async (productId: string, piId: string, mode: SortMode) => {
      await updateBoard(productId, piId, { sortMode: mode });
      saveUiPrefs({ ...loadUiPrefs(), sortMode: mode });
    },
    [updateBoard],
  );

  const updatePi = useCallback(
    async (id: string, patch: Partial<PiState>) => {
      const w = wsRef.current;
      if (!w) return;
      const cur = w.pis.find((p) => p.id === id);
      if (!cur) return;
      const merged = { ...cur, ...patch, updatedAt: Date.now() };
      patchWs((s) => ({ ...s, pis: s.pis.map((p) => (p.id === id ? merged : p)) }));
      await supabase().from("pis").update(toDbPi(merged)).eq("id", id);
    },
    [patchWs],
  );

  const renamePi = useCallback(
    (id: string, name: string) => updatePi(id, { name }),
    [updatePi],
  );

  const createPi = useCallback(
    async (name: string) => {
      const pi = blankPi(name);
      const w = wsRef.current;
      const products = w?.products ?? [];
      const templates = w?.templates ?? [];
      patchWs((cur) => {
        const boards = { ...cur.boards };
        for (const prod of cur.products) {
          boards[boardKey(prod.id, pi.id)] = blankBoard(prod.id, pi.id, cur.templates);
        }
        return { ...cur, pis: [...cur.pis, pi], boards, activePiId: pi.id };
      });
      const sb = supabase();
      await sb.from("pis").insert(toDbPi(pi));
      if (products.length) {
        await sb.from("boards").insert(
          products.map((p) => ({
            product_id: p.id, pi_id: pi.id,
            preselected_ids: templates.filter((t) => t.defaultSelected).map((t) => t.id),
            sort_mode: "manual",
          })),
        );
      }
      saveUiPrefs({ ...loadUiPrefs(), activePiId: pi.id });
      return pi.id;
    },
    [patchWs],
  );

  const duplicatePi = useCallback(
    async (id: string) => {
      const w = wsRef.current;
      if (!w) return;
      const src = w.pis.find((p) => p.id === id);
      if (!src) return;
      const copy: PiState = {
        ...src, id: uid(), name: `${src.name} (copy)`,
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      const newBoards: Board[] = w.products.map((prod) => {
        const srcBoard = w.boards[boardKey(prod.id, src.id)];
        return srcBoard
          ? {
              productId: prod.id, piId: copy.id,
              preselectedIds: [...srcBoard.preselectedIds],
              sortMode: srcBoard.sortMode ?? "manual",
              categories: srcBoard.categories.map((c) => ({
                ...c, id: uid(),
                lines: c.lines.map((l) => ({ ...l, id: uid() })),
              })),
            }
          : blankBoard(prod.id, copy.id, w.templates);
      });

      patchWs((cur) => {
        const boards = { ...cur.boards };
        for (const b of newBoards) boards[boardKey(b.productId, b.piId)] = b;
        return { ...cur, pis: [...cur.pis, copy], boards, activePiId: copy.id };
      });

      const sb = supabase();
      await sb.from("pis").insert(toDbPi(copy));
      await sb.from("boards").insert(
        newBoards.map((b) => ({
          product_id: b.productId, pi_id: b.piId,
          preselected_ids: b.preselectedIds, sort_mode: b.sortMode ?? "manual",
        })),
      );
      const allAssignments = newBoards.flatMap((b) =>
        b.categories.map((c) => toDbAssignment(c, b.productId, b.piId)),
      );
      if (allAssignments.length) await sb.from("assignments").insert(allAssignments);
      saveUiPrefs({ ...loadUiPrefs(), activePiId: copy.id });
    },
    [patchWs],
  );

  const deletePi = useCallback(
    async (id: string) => {
      const w = wsRef.current;
      if (!w) return;
      const rest = w.pis.filter((p) => p.id !== id);
      patchWs((cur) => {
        const boards = { ...cur.boards };
        for (const k of Object.keys(boards)) {
          if (boards[k].piId === id) delete boards[k];
        }
        return {
          ...cur, pis: rest, boards,
          activePiId: cur.activePiId === id ? rest[0]?.id ?? "" : cur.activePiId,
        };
      });
      await supabase().from("pis").delete().eq("id", id);
    },
    [patchWs],
  );

  const setActivePi = useCallback(
    (id: string) => {
      patchWs((cur) => ({ ...cur, activePiId: id }));
      saveUiPrefs({ ...loadUiPrefs(), activePiId: id });
    },
    [patchWs],
  );

  const setActiveProduct = useCallback(
    (id: string) => {
      patchWs((cur) => ({ ...cur, activeProductId: id }));
      saveUiPrefs({ ...loadUiPrefs(), activeProductId: id });
    },
    [patchWs],
  );

  const setActiveUser = useCallback(
    (id: string) => {
      patchWs((cur) => ({ ...cur, activeUserId: id }));
      saveUiPrefs({ ...loadUiPrefs(), activeUserId: id });
    },
    [patchWs],
  );

  const setTemplates = useCallback(
    async (
      updater: CategoryTemplate[] | ((t: CategoryTemplate[]) => CategoryTemplate[]),
    ) => {
      const w = wsRef.current;
      if (!w) return;
      const prev = w.templates;
      const next =
        typeof updater === "function"
          ? (updater as (t: CategoryTemplate[]) => CategoryTemplate[])(prev)
          : updater;

      patchWs((cur) => ({ ...cur, templates: next }));

      const prevById = new Map(prev.map((t) => [t.id, t]));
      const nextById = new Map(next.map((t) => [t.id, t]));
      const sb = supabase();

      const toDelete = prev.filter((t) => !nextById.has(t.id));
      if (toDelete.length) {
        await sb.from("templates").delete().in("id", toDelete.map((t) => t.id));
      }
      const upserts: CategoryTemplate[] = [];
      for (const t of next) {
        const before = prevById.get(t.id);
        if (!before || !templateEqual(before, t)) upserts.push(t);
      }
      if (upserts.length) {
        await sb.from("templates").upsert(upserts.map(toDbTemplate));
        for (const t of upserts) {
          const before = new Set(prevById.get(t.id)?.tagIds ?? []);
          const after = new Set(t.tagIds ?? []);
          const removed = [...before].filter((x) => !after.has(x));
          const added = [...after].filter((x) => !before.has(x));
          if (removed.length) {
            await sb.from("template_tags").delete().eq("template_id", t.id).in("tag_id", removed);
          }
          if (added.length) {
            await sb.from("template_tags").insert(added.map((tag_id) => ({ template_id: t.id, tag_id })));
          }
        }
      }
    },
    [patchWs],
  );

  const createProduct = useCallback(
    async (name: string, color: string) => {
      const trimmed = name.trim() || "Product";
      const productId = uid();
      const tag: Tag = { id: uid(), name: trimmed, productId };
      const product: Product = { id: productId, name: trimmed, color, tagId: tag.id, createdAt: Date.now() };
      const w = wsRef.current;
      const pis = w?.pis ?? [];
      const templates = w?.templates ?? [];

      patchWs((cur) => {
        const boards = { ...cur.boards };
        for (const pi of cur.pis) {
          boards[boardKey(product.id, pi.id)] = blankBoard(product.id, pi.id, cur.templates);
        }
        return { ...cur, tags: [...cur.tags, tag], products: [...cur.products, product], boards, activeProductId: product.id };
      });

      const sb = supabase();
      await sb.from("tags").insert({ id: tag.id, name: tag.name, product_id: null });
      await sb.from("products").insert(toDbProduct(product));
      await sb.from("tags").update({ product_id: productId }).eq("id", tag.id);
      if (pis.length) {
        await sb.from("boards").insert(
          pis.map((p) => ({
            product_id: productId, pi_id: p.id,
            preselected_ids: templates.filter((t) => t.defaultSelected).map((t) => t.id),
            sort_mode: "manual",
          })),
        );
      }
      saveUiPrefs({ ...loadUiPrefs(), activeProductId: product.id });
      return product.id;
    },
    [patchWs],
  );

  const updateProduct = useCallback(
    async (id: string, patch: Partial<Product>) => {
      const w = wsRef.current;
      if (!w) return;
      const cur = w.products.find((p) => p.id === id);
      if (!cur) return;
      const merged = { ...cur, ...patch };
      patchWs((s) => ({
        ...s,
        products: s.products.map((p) => (p.id === id ? merged : p)),
        tags: patch.name !== undefined
          ? s.tags.map((t) => (t.productId === id ? { ...t, name: patch.name! } : t))
          : s.tags,
      }));
      const sb = supabase();
      await sb.from("products").update(toDbProduct(merged)).eq("id", id);
      if (patch.name !== undefined) {
        await sb.from("tags").update({ name: patch.name }).eq("product_id", id);
      }
    },
    [patchWs],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const w = wsRef.current;
      if (!w || w.products.length <= 1) return;
      patchWs((cur) => {
        const products = cur.products.filter((p) => p.id !== id);
        const removedTagIds = cur.tags.filter((t) => t.productId === id).map((t) => t.id);
        const tags = cur.tags.filter((t) => t.productId !== id);
        const boards = { ...cur.boards };
        for (const k of Object.keys(boards)) {
          if (boards[k].productId === id) delete boards[k];
        }
        const templates = cur.templates.map((t) => ({
          ...t,
          tagIds: (t.tagIds ?? []).filter((tid) => !removedTagIds.includes(tid)),
        }));
        const { [id]: _drop, ...productDesignerIds } = cur.productDesignerIds;
        return {
          ...cur, products, tags, boards, templates, productDesignerIds,
          activeProductId: cur.activeProductId === id ? products[0]?.id ?? "" : cur.activeProductId,
        };
      });
      await supabase().from("products").delete().eq("id", id);
    },
    [patchWs],
  );

  const createTag = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const w = wsRef.current;
      const existing = w?.tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing.id;
      const tag: Tag = { id: uid(), name: trimmed };
      patchWs((cur) => ({ ...cur, tags: [...cur.tags, tag] }));
      await supabase().from("tags").insert(toDbTag(tag));
      return tag.id;
    },
    [patchWs],
  );

  const deleteTag = useCallback(
    async (id: string) => {
      patchWs((cur) => ({
        ...cur,
        tags: cur.tags.filter((t) => t.id !== id),
        templates: cur.templates.map((t) => ({
          ...t, tagIds: (t.tagIds ?? []).filter((tid) => tid !== id),
        })),
        products: cur.products.map((p) => (p.tagId === id ? { ...p, tagId: "" } : p)),
      }));
      await supabase().from("tags").delete().eq("id", id);
    },
    [patchWs],
  );

  const renameTag = useCallback(
    async (id: string, name: string) => {
      patchWs((cur) => ({
        ...cur,
        tags: cur.tags.map((t) => (t.id === id ? { ...t, name } : t)),
        products: cur.products.map((p) => (p.tagId === id ? { ...p, name } : p)),
      }));
      const sb = supabase();
      await sb.from("tags").update({ name }).eq("id", id);
      await sb.from("products").update({ name }).eq("tag_id", id);
    },
    [patchWs],
  );

  // Amélioration 4 — updateUser inclut workdayHours
  const addUser = useCallback(
    async (name: string, color: string, workdayHours?: number) => {
      const u: User = {
        id: uid(),
        name: name.trim() || "Designer",
        color,
        initials: initialsOf(name),
        workdayHours,
      };
      patchWs((cur) => ({ ...cur, users: [...cur.users, u], activeUserId: u.id }));
      await supabase().from("designers").insert(toDbDesigner(u));
      saveUiPrefs({ ...loadUiPrefs(), activeUserId: u.id });
      return u.id;
    },
    [patchWs],
  );

  const updateUser = useCallback(
    async (id: string, patch: Partial<User>) => {
      const w = wsRef.current;
      if (!w) return;
      const cur = w.users.find((u) => u.id === id);
      if (!cur) return;
      const merged: User = {
        ...cur, ...patch,
        initials: patch.name ? initialsOf(patch.name) : cur.initials,
      };
      patchWs((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? merged : u)) }));
      await supabase().from("designers").update(toDbDesigner(merged)).eq("id", id);
    },
    [patchWs],
  );

  const removeUser = useCallback(
    async (id: string) => {
      const w = wsRef.current;
      if (!w || w.users.length <= 1) return;
      patchWs((cur) => {
        const users = cur.users.filter((u) => u.id !== id);
        const boards = { ...cur.boards };
        for (const k of Object.keys(boards)) {
          boards[k] = { ...boards[k], categories: boards[k].categories.filter((c) => c.userId !== id) };
        }
        const productDesignerIds: Record<string, string[]> = {};
        for (const [pid, ids] of Object.entries(cur.productDesignerIds)) {
          productDesignerIds[pid] = ids.filter((x) => x !== id);
        }
        return {
          ...cur, users, boards, productDesignerIds,
          activeUserId: cur.activeUserId === id ? users[0]?.id ?? "" : cur.activeUserId,
        };
      });
      await supabase().from("designers").delete().eq("id", id);
    },
    [patchWs],
  );

  const addDesignerToProduct = useCallback(
    async (productId: string, designerId: string) => {
      const w = wsRef.current;
      if (!w) return;
      const current = w.productDesignerIds[productId] ?? [];
      if (current.includes(designerId)) return;
      patchWs((cur) => ({
        ...cur,
        productDesignerIds: {
          ...cur.productDesignerIds,
          [productId]: [...(cur.productDesignerIds[productId] ?? []), designerId],
        },
      }));
      await supabase().from("product_designers").insert({ product_id: productId, designer_id: designerId });
    },
    [patchWs],
  );

  const createDesignerForProduct = useCallback(
    async (productId: string, name: string, color: string, workdayHours?: number) => {
      const u: User = {
        id: uid(),
        name: name.trim() || "Designer",
        color,
        initials: initialsOf(name),
        workdayHours,
      };
      patchWs((cur) => ({
        ...cur,
        users: [...cur.users, u],
        productDesignerIds: {
          ...cur.productDesignerIds,
          [productId]: [...(cur.productDesignerIds[productId] ?? []), u.id],
        },
        activeUserId: u.id,
      }));
      const sb = supabase();
      await sb.from("designers").insert(toDbDesigner(u));
      await sb.from("product_designers").insert({ product_id: productId, designer_id: u.id });
      saveUiPrefs({ ...loadUiPrefs(), activeUserId: u.id });
      return u.id;
    },
    [patchWs],
  );

  const removeDesignerFromProduct = useCallback(
    async (productId: string, designerId: string) => {
      const w = wsRef.current;
      if (!w) return;
      patchWs((cur) => {
        const boards = { ...cur.boards };
        for (const k of Object.keys(boards)) {
          if (boards[k].productId !== productId) continue;
          const before = boards[k].categories;
          const after = before.filter((c) => c.userId !== designerId);
          if (after.length !== before.length) boards[k] = { ...boards[k], categories: after };
        }
        return {
          ...cur,
          productDesignerIds: {
            ...cur.productDesignerIds,
            [productId]: (cur.productDesignerIds[productId] ?? []).filter((x) => x !== designerId),
          },
          boards,
        };
      });
      const sb = supabase();
      await sb.from("product_designers").delete().eq("product_id", productId).eq("designer_id", designerId);
      await sb.from("assignments").delete().eq("product_id", productId).eq("designer_id", designerId);
    },
    [patchWs],
  );

  return useMemo(
    () => ({
      ws: ws as Workspace,
      activePi: activePi as PiState,
      activeProduct: activeProduct as Product,
      loading: ws === null,
      error,
      savingIds, // Amélioration 10
      getBoard,
      ensureBoard,
      updateBoard,
      updatePi,
      renamePi,
      createPi,
      duplicatePi,
      deletePi,
      setActivePi,
      setActiveProduct,
      setTemplates,
      createProduct,
      updateProduct,
      deleteProduct,
      createTag,
      deleteTag,
      renameTag,
      addUser,
      updateUser,
      removeUser,
      setActiveUser,
      setSortMode,
      addDesignerToProduct,
      removeDesignerFromProduct,
      createDesignerForProduct,
    }),
    [
      ws, activePi, activeProduct, error, savingIds,
      getBoard, ensureBoard, updateBoard, updatePi, renamePi,
      createPi, duplicatePi, deletePi, setActivePi, setActiveProduct,
      setTemplates, createProduct, updateProduct, deleteProduct,
      createTag, deleteTag, renameTag, addUser, updateUser, removeUser,
      setActiveUser, setSortMode, addDesignerToProduct,
      removeDesignerFromProduct, createDesignerForProduct,
    ],
  );
}

// ---- realtime application -------------------------------------------------

const applyRealtime = (
  table: string,
  payload: any,
  setWs: React.Dispatch<React.SetStateAction<Workspace | null>>,
) => {
  setWs((w) => {
    if (!w) return w;
    const { eventType, new: row, old } = payload;
    switch (table) {
      case "pis":
        if (eventType === "DELETE") return { ...w, pis: w.pis.filter((p) => p.id !== old.id) };
        return mergeOne(w, "pis", fromDbPi(row));
      case "tags":
        if (eventType === "DELETE") return { ...w, tags: w.tags.filter((t) => t.id !== old.id) };
        return mergeOne(w, "tags", fromDbTag(row));
      case "products":
        if (eventType === "DELETE") return { ...w, products: w.products.filter((p) => p.id !== old.id) };
        return mergeOne(w, "products", fromDbProduct(row));
      case "designers":
        if (eventType === "DELETE") return { ...w, users: w.users.filter((u) => u.id !== old.id) };
        return mergeOne(w, "users", fromDbDesigner(row));
      case "templates": {
        if (eventType === "DELETE") return { ...w, templates: w.templates.filter((t) => t.id !== old.id) };
        const prevTagIds = w.templates.find((t) => t.id === row.id)?.tagIds ?? [];
        return mergeOne(w, "templates", fromDbTemplate(row, prevTagIds));
      }
      case "template_tags": {
        const tid = (eventType === "DELETE" ? old : row).template_id;
        const tagId = (eventType === "DELETE" ? old : row).tag_id;
        return {
          ...w,
          templates: w.templates.map((t) => {
            if (t.id !== tid) return t;
            const current = t.tagIds ?? [];
            if (eventType === "DELETE") return { ...t, tagIds: current.filter((x) => x !== tagId) };
            return current.includes(tagId) ? t : { ...t, tagIds: [...current, tagId] };
          }),
        };
      }
      case "boards": {
        const k = boardKey(row?.product_id ?? old.product_id, row?.pi_id ?? old.pi_id);
        if (eventType === "DELETE") {
          const boards = { ...w.boards };
          delete boards[k];
          return { ...w, boards };
        }
        const existing = w.boards[k];
        return {
          ...w,
          boards: {
            ...w.boards,
            [k]: {
              productId: row.product_id, piId: row.pi_id,
              preselectedIds: row.preselected_ids ?? [],
              sortMode: row.sort_mode ?? "manual",
              categories: existing?.categories ?? [],
            },
          },
        };
      }
      case "product_designers": {
        const pid = (eventType === "DELETE" ? old : row).product_id;
        const did = (eventType === "DELETE" ? old : row).designer_id;
        const cur = w.productDesignerIds[pid] ?? [];
        if (eventType === "DELETE") {
          return { ...w, productDesignerIds: { ...w.productDesignerIds, [pid]: cur.filter((x) => x !== did) } };
        }
        if (cur.includes(did)) return w;
        return { ...w, productDesignerIds: { ...w.productDesignerIds, [pid]: [...cur, did] } };
      }
      case "assignments": {
        const k = boardKey(row?.product_id ?? old.product_id, row?.pi_id ?? old.pi_id);
        const existing = w.boards[k];
        if (!existing) return w;
        if (eventType === "DELETE") {
          return {
            ...w,
            boards: { ...w.boards, [k]: { ...existing, categories: existing.categories.filter((c) => c.id !== old.id) } },
          };
        }
        const next = fromDbAssignment(row);
        const found = existing.categories.some((c) => c.id === next.id);
        return {
          ...w,
          boards: {
            ...w.boards,
            [k]: {
              ...existing,
              categories: found
                ? existing.categories.map((c) => (c.id === next.id ? next : c))
                : [...existing.categories, next],
            },
          },
        };
      }
    }
    return w;
  });
};

const mergeOne = <K extends "pis" | "products" | "tags" | "users" | "templates">(
  w: Workspace,
  key: K,
  item: Workspace[K] extends (infer T)[] ? T : never,
): Workspace => {
  const arr = w[key] as any[];
  const idx = arr.findIndex((x) => x.id === (item as any).id);
  const next = idx === -1 ? [...arr, item] : arr.map((x, i) => (i === idx ? item : x));
  return { ...w, [key]: next };
};

// ---- assignment diff ------------------------------------------------------

const syncAssignments = async (
  productId: string,
  piId: string,
  prev: AssignedCategory[],
  next: AssignedCategory[],
) => {
  const prevById = new Map(prev.map((c) => [c.id, c]));
  const nextById = new Map(next.map((c) => [c.id, c]));
  const sb = supabase();

  const toDelete = prev.filter((c) => !nextById.has(c.id));
  if (toDelete.length) {
    await sb.from("assignments").delete().in("id", toDelete.map((c) => c.id));
  }
  const toUpsert: AssignedCategory[] = [];
  for (const c of next) {
    const before = prevById.get(c.id);
    if (!before || !assignmentEqual(before, c)) toUpsert.push(c);
  }
  if (toUpsert.length) {
    await sb.from("assignments").upsert(toUpsert.map((c) => toDbAssignment(c, productId, piId)));
  }
};

const assignmentEqual = (a: AssignedCategory, b: AssignedCategory) =>
  a.name === b.name &&
  a.color === b.color &&
  a.templateId === b.templateId &&
  a.userId === b.userId &&
  arrEq(a.sprintIds, b.sprintIds) &&
  JSON.stringify(a.lines) === JSON.stringify(b.lines) &&
  JSON.stringify(a.orderBySprintId ?? {}) === JSON.stringify(b.orderBySprintId ?? {}) &&
  (a.notes ?? "") === (b.notes ?? "");

const templateEqual = (a: CategoryTemplate, b: CategoryTemplate) =>
  a.name === b.name &&
  a.color === b.color &&
  (a.defaultSelected ?? false) === (b.defaultSelected ?? false) &&
  arrEq(a.tagIds ?? [], b.tagIds ?? []) &&
  JSON.stringify(a.lines) === JSON.stringify(b.lines) &&
  (a.notes ?? "") === (b.notes ?? "");

const arrEq = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);
