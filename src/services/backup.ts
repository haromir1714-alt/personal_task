import type { Backup, Fields, Task, Group, Category, Setting } from "../types";
import { db, type TaskDatabase } from "../db/database";
import { validDay, validTime } from "../utils/dates";
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const id = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 200;
const nullableId = (value: unknown) => value === null || id(value);
const priority = (value: unknown) =>
  typeof value === "string" && ["high", "normal", "low"].includes(value);
const frequency = (value: unknown) =>
  typeof value === "string" && ["daily", "weekly", "monthly"].includes(value);
function fail(): never {
  throw new Error(
    "백업 형식, 날짜 또는 데이터 연결이 올바르지 않습니다. 기존 데이터는 유지됩니다.",
  );
}
function fields(value: unknown): value is Fields {
  return (
    record(value) &&
    typeof value.title === "string" &&
    !!value.title.trim() &&
    typeof value.notes === "string" &&
    (value.due === null || validDay(value.due)) &&
    priority(value.priority) &&
    nullableId(value.categoryId)
  );
}
function unique(items: { id: string }[]) {
  if (new Set(items.map((t) => t.id)).size !== items.length) fail();
}
export function validateBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("JSON 파일을 읽을 수 없습니다.");
  }
  if (
    !record(raw) ||
    raw.formatVersion !== 1 ||
    !validTime(raw.createdAt) ||
    !Array.isArray(raw.tasks) ||
    !Array.isArray(raw.categories) ||
    !Array.isArray(raw.groups) ||
    !Array.isArray(raw.settings)
  )
    fail();
  const tasks: Task[] = raw.tasks.map((t: unknown) => {
    if (
      !record(t) ||
      !fields(t) ||
      !id(t.id) ||
      !id(t.generation) ||
      !validTime(t.createdAt) ||
      !validTime(t.updatedAt) ||
      (t.completedAt !== null && !validTime(t.completedAt)) ||
      !integer(t.order) ||
      !integer(t.version) ||
      Number(t.version) < 1 ||
      !nullableId(t.groupId) ||
      !integer(t.sequence) ||
      !nullableId(t.nextId) ||
      typeof t.successorCreated !== "boolean" ||
      !integer(t.groupRevision)
    )
      fail();
    return {
      id: t.id,
      generation: t.generation,
      title: t.title,
      notes: t.notes,
      due: t.due,
      priority: t.priority,
      categoryId: t.categoryId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      completedAt: t.completedAt as string | null,
      order: t.order as number,
      version: t.version as number,
      groupId: t.groupId as string | null,
      sequence: t.sequence as number,
      nextId: t.nextId as string | null,
      successorCreated: t.successorCreated,
      groupRevision: t.groupRevision as number,
    };
  });
  const categories: Category[] = raw.categories.map((c: unknown) => {
    if (
      !record(c) ||
      !id(c.id) ||
      !id(c.generation) ||
      typeof c.name !== "string" ||
      !c.name.trim() ||
      typeof c.color !== "string" ||
      !/^#[\da-f]{6}$/i.test(c.color) ||
      !integer(c.version) ||
      Number(c.version) < 1
    )
      fail();
    return {
      id: c.id,
      generation: c.generation,
      name: c.name.trim(),
      color: c.color,
      version: c.version as number,
    };
  });
  const groups: Group[] = raw.groups.map((g: unknown) => {
    if (
      !record(g) ||
      !id(g.id) ||
      !frequency(g.frequency) ||
      !validDay(g.anchor) ||
      typeof g.active !== "boolean" ||
      !integer(g.revision) ||
      Number(g.revision) < 1 ||
      !fields(g.fields) ||
      (g.active && !g.fields.due)
    )
      fail();
    return {
      id: g.id,
      frequency: g.frequency as Group["frequency"],
      anchor: g.anchor,
      active: g.active,
      revision: g.revision as number,
      fields: { ...g.fields },
    };
  });
  const settings: Setting[] = raw.settings.map((s: unknown) => {
    if (
      !record(s) ||
      s.id !== "theme" ||
      typeof s.value !== "string" ||
      !["system", "light", "dark"].includes(s.value)
    )
      fail();
    return { id: "theme", value: s.value as Setting["value"] };
  });
  unique(tasks);
  unique(categories);
  unique(groups);
  unique(settings);
  if (
    settings.length !== 1 ||
    new Set(categories.map((c) => c.name.toLocaleLowerCase())).size !==
      categories.length
  )
    fail();
  const categoryIds = new Set(categories.map((c) => c.id));
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const occurrences = new Set<string>();
  for (const g of groups)
    if (g.fields.categoryId && !categoryIds.has(g.fields.categoryId)) fail();
  for (const t of tasks) {
    if (t.categoryId && !categoryIds.has(t.categoryId)) fail();
    if (t.groupId) {
      const g = groupMap.get(t.groupId);
      if (
        !g ||
        (g.active && !t.due) ||
        t.groupRevision < 1 ||
        t.groupRevision > g.revision
      )
        fail();
      const key = `${t.groupId}:${t.sequence}`;
      if (occurrences.has(key)) fail();
      occurrences.add(key);
    } else if (
      t.nextId ||
      t.successorCreated ||
      t.sequence !== 0 ||
      t.groupRevision !== 0
    )
      fail();
    if (t.nextId) {
      const next = taskMap.get(t.nextId);
      if (
        !t.successorCreated ||
        !next ||
        !t.groupId ||
        next.groupId !== t.groupId ||
        next.sequence !== t.sequence + 1
      )
        fail();
    }
  }
  return {
    formatVersion: 1,
    createdAt: raw.createdAt,
    tasks,
    categories,
    groups,
    settings,
  };
}
export async function exportBackup(
  database: TaskDatabase = db,
): Promise<Backup> {
  return database.transaction(
    "r",
    database.tasks,
    database.categories,
    database.groups,
    database.settings,
    async () => ({
      formatVersion: 1 as const,
      createdAt: new Date().toISOString(),
      tasks: await database.tasks.toArray(),
      categories: await database.categories.toArray(),
      groups: await database.groups.toArray(),
      settings: await database.settings.toArray(),
    }),
  );
}
export async function restoreBackup(
  backup: Backup,
  database: TaskDatabase = db,
) {
  const valid = validateBackup(JSON.stringify(backup));
  await database.transaction(
    "rw",
    database.tasks,
    database.categories,
    database.groups,
    database.settings,
    async () => {
      // Keep restored versions above current versions to invalidate stale open editors.
      const old = new Map(
        (await database.tasks.toArray()).map((t) => [t.id, t.version]),
      );
      const oldCategories = new Map(
        (await database.categories.toArray()).map((c) => [c.id, c.version]),
      );
      await database.tasks.clear();
      await database.categories.clear();
      await database.groups.clear();
      await database.settings.clear();
      await database.tasks.bulkAdd(
        valid.tasks.map((t) => ({
          ...t,
          version: Math.max(t.version, old.get(t.id) ?? 0) + 1,
          generation: crypto.randomUUID(),
        })),
      );
      await database.categories.bulkAdd(
        valid.categories.map((c) => ({
          ...c,
          version: Math.max(c.version, oldCategories.get(c.id) ?? 0) + 1,
          generation: crypto.randomUUID(),
        })),
      );
      await database.groups.bulkAdd(valid.groups);
      await database.settings.bulkAdd(valid.settings);
    },
  );
}
