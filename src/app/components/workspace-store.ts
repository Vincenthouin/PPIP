import { useEffect, useState } from "react";
import { nextMonday } from "date-fns";
import {
  AssignedCategory,
  Board,
  CategoryTemplate,
  PALETTE,
  PiState,
  Product,
  Tag,
  User,
  Workspace,
  boardKey,
  initialsOf,
  uid,
} from "./pi-types";

const STORAGE_KEY = "pi-planner:v2";
const LEGACY_KEY = "pi-planner:v1";

const seedTemplates = (tagIds: { tahoma: string; explore: string }): CategoryTemplate[] => [
  {
    id: uid(),
    name: "Digital Team",
    color: PALETTE[0],
    defaultSelected: true,
    tagIds: [],
    lines: [
      { id: uid(), label: "Team weekly", cadence: "weekly", hoursPerOccurrence: 1 },
      { id: uid(), label: "UX critique", cadence: "weekly", hoursPerOccurrence: 1.5 },
      { id: uid(), label: "Monthly review", cadence: "monthly", hoursPerOccurrence: 2 },
    ],
  },
  {
    id: uid(),
    name: "Design Center",
    color: PALETTE[2],
    defaultSelected: true,
    tagIds: [],
    lines: [
      { id: uid(), label: "Design Center sync", cadence: "biweekly", hoursPerOccurrence: 1 },
      { id: uid(), label: "Tokens working group", cadence: "monthly", hoursPerOccurrence: 1.5 },
    ],
  },
  {
    id: uid(),
    name: "TaHoma weekly",
    color: PALETTE[3],
    tagIds: [tagIds.tahoma],
    lines: [
      { id: uid(), label: "Product weekly", cadence: "weekly", hoursPerOccurrence: 1 },
      { id: uid(), label: "Roadmap review", cadence: "monthly", hoursPerOccurrence: 1.5 },
    ],
  },
  {
    id: uid(),
    name: "Explore discovery",
    color: PALETTE[4],
    tagIds: [tagIds.explore],
    lines: [
      { id: uid(), label: "Discovery sync", cadence: "weekly", hoursPerOccurrence: 1 },
      { id: uid(), label: "Research readout", cadence: "biweekly", hoursPerOccurrence: 1 },
    ],
  },
];

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
});

const defaultWorkspace = (): Workspace => {
  const tahomaTag: Tag = { id: uid(), name: "TaHoma" };
  const exploreTag: Tag = { id: uid(), name: "Explore" };
  const tahoma: Product = {
    id: uid(),
    name: "TaHoma",
    color: PALETTE[3],
    tagId: tahomaTag.id,
    createdAt: Date.now(),
  };
  const explore: Product = {
    id: uid(),
    name: "Explore",
    color: PALETTE[4],
    tagId: exploreTag.id,
    createdAt: Date.now(),
  };
  tahomaTag.productId = tahoma.id;
  exploreTag.productId = explore.id;

  const templates = seedTemplates({ tahoma: tahomaTag.id, explore: exploreTag.id });
  const me: User = { id: uid(), name: "Me", color: PALETTE[0], initials: "ME" };
  const pi = blankPi("PI 2026.3");
  return {
    templates,
    tags: [tahomaTag, exploreTag],
    products: [tahoma, explore],
    users: [me],
    pis: [pi],
    boards: {
      [boardKey(tahoma.id, pi.id)]: blankBoard(tahoma.id, pi.id, templates),
      [boardKey(explore.id, pi.id)]: blankBoard(explore.id, pi.id, templates),
    },
    activePiId: pi.id,
    activeProductId: tahoma.id,
    activeUserId: me.id,
  };
};

const loadWorkspace = (): Workspace => {
  if (typeof window === "undefined") return defaultWorkspace();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Workspace;
      if (parsed.pis?.length && parsed.products?.length) return parsed;
    }
    // Migrate legacy v1 (single-product) state
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as any;
      if (old?.pis?.length) return migrateLegacy(old);
    }
  } catch {}
  return defaultWorkspace();
};

const migrateLegacy = (old: any): Workspace => {
  const fresh = defaultWorkspace();
  const tahoma = fresh.products[0];
  const templates: CategoryTemplate[] = (old.templates ?? fresh.templates).map(
    (t: any) => ({ tagIds: [], ...t }),
  );
  const users: User[] = old.users ?? fresh.users;
  const pis: PiState[] = (old.pis ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    startDateISO: p.startDateISO,
    sprintCount: p.sprintCount,
    weeksPerSprint: p.weeksPerSprint,
    workdayHours: p.workdayHours,
    createdAt: p.createdAt ?? Date.now(),
    updatedAt: p.updatedAt ?? Date.now(),
  }));
  const boards: Record<string, Board> = {};
  for (const p of old.pis ?? []) {
    boards[boardKey(tahoma.id, p.id)] = {
      productId: tahoma.id,
      piId: p.id,
      categories: (p.categories ?? []) as AssignedCategory[],
      preselectedIds: p.preselectedIds ?? [],
    };
    boards[boardKey(fresh.products[1].id, p.id)] = blankBoard(
      fresh.products[1].id,
      p.id,
      templates,
    );
  }
  return {
    ...fresh,
    templates,
    users,
    pis,
    boards,
    activePiId: old.activePiId ?? pis[0]?.id ?? fresh.activePiId,
    activeUserId: old.activeUserId ?? users[0]?.id ?? fresh.activeUserId,
  };
};

export function useWorkspace() {
  const [ws, setWs] = useState<Workspace>(loadWorkspace);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ws));
    } catch {}
  }, [ws]);

  const activePi =
    ws.pis.find((p) => p.id === ws.activePiId) ?? ws.pis[0];
  const activeProduct =
    ws.products.find((p) => p.id === ws.activeProductId) ?? ws.products[0];

  const ensureBoard = (productId: string, piId: string) => {
    const key = boardKey(productId, piId);
    if (ws.boards[key]) return;
    setWs((w) => ({
      ...w,
      boards: { ...w.boards, [key]: blankBoard(productId, piId, w.templates) },
    }));
  };

  const getBoard = (productId: string, piId: string): Board => {
    const key = boardKey(productId, piId);
    return (
      ws.boards[key] ?? {
        productId,
        piId,
        categories: [],
        preselectedIds: ws.templates
          .filter((t) => t.defaultSelected)
          .map((t) => t.id),
      }
    );
  };

  const updateBoard = (
    productId: string,
    piId: string,
    patch: Partial<Board> | ((b: Board) => Partial<Board>),
  ) =>
    setWs((w) => {
      const key = boardKey(productId, piId);
      const existing =
        w.boards[key] ?? blankBoard(productId, piId, w.templates);
      const next =
        typeof patch === "function" ? patch(existing) : patch;
      return {
        ...w,
        boards: { ...w.boards, [key]: { ...existing, ...next } },
        pis: w.pis.map((p) =>
          p.id === piId ? { ...p, updatedAt: Date.now() } : p,
        ),
      };
    });

  const updatePi = (id: string, patch: Partial<PiState>) =>
    setWs((w) => ({
      ...w,
      pis: w.pis.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p,
      ),
    }));

  const createPi = (name: string) => {
    const pi = blankPi(name);
    setWs((w) => {
      const boards = { ...w.boards };
      for (const prod of w.products) {
        boards[boardKey(prod.id, pi.id)] = blankBoard(prod.id, pi.id, w.templates);
      }
      return { ...w, pis: [...w.pis, pi], boards, activePiId: pi.id };
    });
    return pi.id;
  };

  const duplicatePi = (id: string) => {
    const src = ws.pis.find((p) => p.id === id);
    if (!src) return;
    const copy: PiState = {
      ...src,
      id: uid(),
      name: `${src.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setWs((w) => {
      const boards = { ...w.boards };
      for (const prod of w.products) {
        const srcBoard = w.boards[boardKey(prod.id, src.id)];
        boards[boardKey(prod.id, copy.id)] = srcBoard
          ? {
              productId: prod.id,
              piId: copy.id,
              preselectedIds: [...srcBoard.preselectedIds],
              categories: srcBoard.categories.map((c) => ({
                ...c,
                id: uid(),
                lines: c.lines.map((l) => ({ ...l, id: uid() })),
              })),
            }
          : blankBoard(prod.id, copy.id, w.templates);
      }
      return { ...w, pis: [...w.pis, copy], boards, activePiId: copy.id };
    });
  };

  const deletePi = (id: string) =>
    setWs((w) => {
      const rest = w.pis.filter((p) => p.id !== id);
      const pis = rest.length ? rest : [blankPi("PI")];
      const boards = { ...w.boards };
      for (const k of Object.keys(boards)) {
        if (boards[k].piId === id) delete boards[k];
      }
      if (!rest.length) {
        for (const prod of w.products)
          boards[boardKey(prod.id, pis[0].id)] = blankBoard(prod.id, pis[0].id, w.templates);
      }
      return {
        ...w,
        pis,
        boards,
        activePiId: w.activePiId === id ? pis[0].id : w.activePiId,
      };
    });

  const setActivePi = (id: string) => setWs((w) => ({ ...w, activePiId: id }));
  const setActiveProduct = (id: string) =>
    setWs((w) => ({ ...w, activeProductId: id }));

  const renamePi = (id: string, name: string) => updatePi(id, { name });

  const setTemplates = (
    updater: CategoryTemplate[] | ((t: CategoryTemplate[]) => CategoryTemplate[]),
  ) =>
    setWs((w) => ({
      ...w,
      templates: typeof updater === "function" ? (updater as any)(w.templates) : updater,
    }));

  // ---- Products / Tags ----
  const createProduct = (name: string, color: string) => {
    const productId = uid();
    const tag: Tag = { id: uid(), name: name.trim() || "Product", productId };
    const product: Product = {
      id: productId,
      name: name.trim() || "Product",
      color,
      tagId: tag.id,
      createdAt: Date.now(),
    };
    setWs((w) => {
      const boards = { ...w.boards };
      for (const pi of w.pis) {
        boards[boardKey(product.id, pi.id)] = blankBoard(product.id, pi.id, w.templates);
      }
      return {
        ...w,
        tags: [...w.tags, tag],
        products: [...w.products, product],
        boards,
        activeProductId: product.id,
      };
    });
    return product.id;
  };

  const updateProduct = (id: string, patch: Partial<Product>) =>
    setWs((w) => ({
      ...w,
      products: w.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      tags:
        patch.name !== undefined
          ? w.tags.map((t) =>
              t.productId === id ? { ...t, name: patch.name! } : t,
            )
          : w.tags,
    }));

  const deleteProduct = (id: string) =>
    setWs((w) => {
      if (w.products.length <= 1) return w;
      const products = w.products.filter((p) => p.id !== id);
      const removedTagIds = w.tags.filter((t) => t.productId === id).map((t) => t.id);
      const tags = w.tags.filter((t) => t.productId !== id);
      const boards = { ...w.boards };
      for (const k of Object.keys(boards)) {
        if (boards[k].productId === id) delete boards[k];
      }
      const templates = w.templates.map((t) => ({
        ...t,
        tagIds: (t.tagIds ?? []).filter((tid) => !removedTagIds.includes(tid)),
      }));
      return {
        ...w,
        products,
        tags,
        boards,
        templates,
        activeProductId: w.activeProductId === id ? products[0].id : w.activeProductId,
      };
    });

  const createTag = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = ws.tags.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing.id;
    const tag: Tag = { id: uid(), name: trimmed };
    setWs((w) => ({ ...w, tags: [...w.tags, tag] }));
    return tag.id;
  };

  const deleteTag = (id: string) =>
    setWs((w) => {
      const tag = w.tags.find((t) => t.id === id);
      if (!tag) return w;
      // Deleting a product-tag does NOT delete its product
      return {
        ...w,
        tags: w.tags.filter((t) => t.id !== id),
        templates: w.templates.map((t) => ({
          ...t,
          tagIds: (t.tagIds ?? []).filter((tid) => tid !== id),
        })),
        products: w.products.map((p) =>
          p.tagId === id ? { ...p, tagId: "" } : p,
        ),
      };
    });

  const renameTag = (id: string, name: string) =>
    setWs((w) => ({
      ...w,
      tags: w.tags.map((t) => (t.id === id ? { ...t, name } : t)),
      products: w.products.map((p) =>
        p.tagId === id ? { ...p, name } : p,
      ),
    }));

  const addUser = (name: string, color: string) => {
    const u: User = {
      id: uid(),
      name: name.trim() || "Designer",
      color,
      initials: initialsOf(name),
    };
    setWs((w) => ({ ...w, users: [...w.users, u], activeUserId: u.id }));
    return u.id;
  };

  const updateUser = (id: string, patch: Partial<User>) =>
    setWs((w) => ({
      ...w,
      users: w.users.map((u) =>
        u.id === id
          ? { ...u, ...patch, initials: patch.name ? initialsOf(patch.name) : u.initials }
          : u,
      ),
    }));

  const removeUser = (id: string) =>
    setWs((w) => {
      if (w.users.length <= 1) return w;
      const users = w.users.filter((u) => u.id !== id);
      const boards = { ...w.boards };
      for (const k of Object.keys(boards)) {
        boards[k] = {
          ...boards[k],
          categories: boards[k].categories.filter((c) => c.userId !== id),
        };
      }
      return {
        ...w,
        users,
        boards,
        activeUserId: w.activeUserId === id ? users[0].id : w.activeUserId,
      };
    });

  const setActiveUser = (id: string) => setWs((w) => ({ ...w, activeUserId: id }));

  return {
    ws,
    activePi,
    activeProduct,
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
  };
}
