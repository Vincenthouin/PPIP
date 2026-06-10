export type Cadence = "weekly" | "biweekly" | "monthly" | "once";
export type FrequencyMode = "cadence" | "quantity" | "perWeek";

export interface MeetingLine {
  id: string;
  label: string;
  hoursPerOccurrence: number;
  mode?: FrequencyMode;
  cadence: Cadence;
  quantityPerSprint?: number;
  perWeek?: number[];
}

export interface CategoryTemplate {
  id: string;
  name: string;
  color: string;
  lines: MeetingLine[];
  defaultSelected?: boolean;
  tagIds?: string[];
}

export interface Tag {
  id: string;
  name: string;
  productId?: string;
}

export interface Product {
  id: string;
  name: string;
  color: string;
  tagId: string;
  createdAt: number;
}

export interface Board {
  productId: string;
  piId: string;
  categories: AssignedCategory[];
  preselectedIds: string[];
}

export interface User {
  id: string;
  name: string;
  color: string;
  initials?: string;
}

export interface AssignedCategory {
  id: string;
  templateId: string;
  userId: string;
  name: string;
  color: string;
  sprintIds: string[];
  lines: MeetingLine[];
}

export interface Sprint {
  id: string;
  index: number;
  start: Date;
  end: Date;
}

export interface PiState {
  id: string;
  name: string;
  startDateISO: string;
  sprintCount: number;
  weeksPerSprint: number;
  workdayHours: number;
  createdAt: number;
  updatedAt: number;
}

export interface Workspace {
  templates: CategoryTemplate[];
  tags: Tag[];
  products: Product[];
  users: User[];
  pis: PiState[];
  boards: Record<string, Board>;
  activePiId: string;
  activeProductId: string;
  activeUserId: string;
}

export const boardKey = (productId: string, piId: string) => `${productId}:${piId}`;

export const PALETTE = [
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#0ea5e9",
  "#22c55e",
];

export const USER_PALETTE = [
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#0ea5e9",
];

export const uid = () => Math.random().toString(36).slice(2, 10);

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

export const occurrencesInSprint = (cadence: Cadence, weeks: number) => {
  switch (cadence) {
    case "weekly":
      return weeks;
    case "biweekly":
      return Math.ceil(weeks / 2);
    case "monthly":
      return weeks >= 4 ? 1 : 0;
    case "once":
      return 1;
  }
};

const cadencePerWeek = (cadence: Cadence, weeks: number): number[] => {
  const arr = new Array(weeks).fill(0);
  switch (cadence) {
    case "weekly":
      return arr.map(() => 1);
    case "biweekly":
      return arr.map((_, i) => (i % 2 === 0 ? 1 : 0));
    case "monthly":
      if (weeks >= 4) arr[Math.floor(weeks / 2)] = 1;
      return arr;
    case "once":
      arr[0] = 1;
      return arr;
  }
};

export const linePerWeek = (line: MeetingLine, weeks: number): number[] => {
  const mode = line.mode ?? "cadence";
  if (mode === "perWeek") {
    return Array.from({ length: weeks }, (_, i) => line.perWeek?.[i] ?? 0);
  }
  if (mode === "quantity") {
    const arr = new Array(weeks).fill(0);
    const q = Math.max(0, Math.floor(line.quantityPerSprint ?? 0));
    for (let i = 0; i < q; i++) arr[i % weeks] += 1;
    return arr;
  }
  return cadencePerWeek(line.cadence, weeks);
};

export const lineOccurrencesInSprint = (line: MeetingLine, weeks: number): number =>
  linePerWeek(line, weeks).reduce((a, b) => a + b, 0);

export const lineHoursInSprint = (line: MeetingLine, weeks: number) =>
  line.hoursPerOccurrence * lineOccurrencesInSprint(line, weeks);

export const linesEqual = (a: MeetingLine, b: MeetingLine): boolean => {
  if (a.label !== b.label) return false;
  if (a.hoursPerOccurrence !== b.hoursPerOccurrence) return false;
  if ((a.mode ?? "cadence") !== (b.mode ?? "cadence")) return false;
  if (a.cadence !== b.cadence) return false;
  if ((a.quantityPerSprint ?? null) !== (b.quantityPerSprint ?? null)) return false;
  const ap = a.perWeek ?? null;
  const bp = b.perWeek ?? null;
  if ((ap === null) !== (bp === null)) return false;
  if (ap && bp) {
    if (ap.length !== bp.length) return false;
    for (let i = 0; i < ap.length; i++) if (ap[i] !== bp[i]) return false;
  }
  return true;
};

export const summarizeLine = (line: MeetingLine, weeks: number): string => {
  const mode = line.mode ?? "cadence";
  if (mode === "quantity") {
    return `${line.quantityPerSprint ?? 0}× / sprint`;
  }
  if (mode === "perWeek") {
    return linePerWeek(line, weeks).join(" · ") + " / wk";
  }
  switch (line.cadence) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Bi-weekly";
    case "monthly":
      return "Monthly";
    case "once":
      return "Once / sprint";
  }
};
