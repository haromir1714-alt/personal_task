import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import type { Fields, Frequency, Task, Category } from "../types";
import { db, type TaskDatabase } from "../db/database";
import { localDay, validDay } from "../utils/dates";
import { nextOccurrence } from "./recurrence";
export const conflictMessage =
  "다른 탭 또는 반복 일정에서 변경된 데이터입니다. 창을 닫고 최신 내용을 다시 확인해 주세요.";
export function shiftedStart(
  fields: Fields,
  due: string | null,
): string | null {
  return fields.startDate && fields.due && due
    ? localDay(
        addDays(
          parseISO(due),
          -differenceInCalendarDays(
            parseISO(fields.due),
            parseISO(fields.startDate),
          ),
        ),
      )
    : null;
}
function validate(fields: Fields, frequency: Frequency | null) {
  if (!fields.title.trim()) throw new Error("제목을 입력해 주세요.");
  if (fields.due !== null && !validDay(fields.due))
    throw new Error("유효한 마감일을 입력해 주세요.");
  if (
    fields.startDate !== null &&
    (!validDay(fields.startDate) ||
      !fields.due ||
      fields.startDate > fields.due)
  )
    throw new Error(
      "시작일과 종료일을 확인해 주세요. 시작일은 종료일 이후일 수 없습니다.",
    );
  if (frequency && !fields.due)
    throw new Error("반복 일정에는 마감일이 필요합니다.");
}
export function taskService(database: TaskDatabase = db) {
  const checked = async (id: string, version: number, generation: string) => {
    const task = await database.tasks.get(id);
    if (!task || task.version !== version || task.generation !== generation)
      throw new Error(conflictMessage);
    return task;
  };
  return {
    async save(fields: Fields, frequency: Frequency | null, original?: Task) {
      validate(fields, frequency);
      const values = { ...fields, title: fields.title.trim() };
      return database.transaction(
        "rw",
        database.tasks,
        database.groups,
        database.categories,
        async () => {
          if (
            values.categoryId &&
            !(await database.categories.get(values.categoryId))
          )
            throw new Error("카테고리가 삭제되었습니다. 다시 선택해 주세요.");
          const now = new Date().toISOString();
          if (!original) {
            const id = crypto.randomUUID();
            const groupId = frequency ? crypto.randomUUID() : null;
            if (groupId)
              await database.groups.add({
                id: groupId,
                frequency: frequency!,
                anchor: values.due!,
                active: true,
                revision: 1,
                fields: values,
              });
            const count = await database.tasks.orderBy("order").last();
            await database.tasks.add({
              ...values,
              id,
              createdAt: now,
              updatedAt: now,
              completedAt: null,
              order: (count?.order ?? -1) + 1,
              version: 1,
              generation: crypto.randomUUID(),
              groupId,
              sequence: 0,
              nextId: null,
              successorCreated: false,
              groupRevision: groupId ? 1 : 0,
            });
            return;
          }
          const current = await checked(
            original.id,
            original.version,
            original.generation,
          );
          if (current.groupId) {
            const group = await database.groups.get(current.groupId);
            if (!group) throw new Error("반복 그룹을 찾을 수 없습니다.");
            if (current.completedAt)
              throw new Error(
                "완료된 반복 기록은 수정할 수 없습니다. 완료 취소 후 수정해 주세요.",
              );
            const future = (
              await database.tasks.where("groupId").equals(group.id).toArray()
            ).filter((t) => t.sequence > current.sequence && !t.completedAt);
            if (future.some((t) => t.groupRevision !== current.groupRevision))
              throw new Error(
                "미래 반복 작업이 별도로 수정되었습니다. 해당 작업의 최신 내용을 먼저 확인해 주세요.",
              );
            const revision = group.revision + 1;
            const anchor =
              values.due !== current.due ? values.due! : group.anchor;
            await database.groups.put({
              ...group,
              fields: values,
              active: !!frequency,
              frequency: frequency ?? group.frequency,
              anchor: anchor ?? group.anchor,
              revision,
            });
            let priorDue = values.due;
            for (const task of future.sort((a, b) => a.sequence - b.sequence)) {
              const due: string | null = frequency
                ? nextOccurrence(anchor, frequency, priorDue!, priorDue!)
                : task.due;
              await database.tasks.put({
                ...task,
                ...values,
                due,
                startDate: shiftedStart(values, due),
                version: task.version + 1,
                updatedAt: now,
                groupRevision: revision,
              });
              priorDue = due;
            }
            await database.tasks.put({
              ...current,
              ...values,
              version: current.version + 1,
              updatedAt: now,
              groupRevision: revision,
            });
          } else {
            const groupId = frequency ? crypto.randomUUID() : null;
            if (groupId)
              await database.groups.add({
                id: groupId,
                frequency: frequency!,
                anchor: values.due!,
                active: true,
                revision: 1,
                fields: values,
              });
            await database.tasks.put({
              ...current,
              ...values,
              groupId,
              groupRevision: groupId ? 1 : 0,
              version: current.version + 1,
              updatedAt: now,
            });
          }
        },
      );
    },
    async toggle(original: Task, now = new Date()) {
      return database.transaction(
        "rw",
        database.tasks,
        database.groups,
        async () => {
          const task = await checked(
            original.id,
            original.version,
            original.generation,
          );
          const stamp = now.toISOString();
          if (task.completedAt) {
            await database.tasks.put({
              ...task,
              completedAt: null,
              updatedAt: stamp,
              version: task.version + 1,
            });
            return null;
          }
          let createdDue: string | null = null;
          let nextId = task.nextId;
          let successorCreated = task.successorCreated;
          const group = task.groupId
            ? await database.groups.get(task.groupId)
            : undefined;
          if (group?.active && !successorCreated) {
            const due = nextOccurrence(
              group.anchor,
              group.frequency,
              localDay(now),
              task.due!,
            );
            const max = await database.tasks.orderBy("order").last();
            createdDue = due;
            nextId = crypto.randomUUID();
            successorCreated = true;
            await database.tasks.add({
              ...group.fields,
              id: nextId,
              due,
              startDate: shiftedStart(group.fields, due),
              createdAt: stamp,
              updatedAt: stamp,
              completedAt: null,
              order: (max?.order ?? -1) + 1,
              version: 1,
              generation: crypto.randomUUID(),
              groupId: group.id,
              sequence: task.sequence + 1,
              nextId: null,
              successorCreated: false,
              groupRevision: group.revision,
            });
          }
          await database.tasks.put({
            ...task,
            completedAt: stamp,
            updatedAt: stamp,
            version: task.version + 1,
            nextId,
            successorCreated,
          });
          return createdDue;
        },
      );
    },
    async remove(original: Task) {
      await database.transaction(
        "rw",
        database.tasks,
        database.groups,
        async () => {
          const task = await checked(
            original.id,
            original.version,
            original.generation,
          );
          const parents = await database.tasks
            .filter((t) => t.nextId === task.id)
            .toArray();
          for (const parent of parents)
            await database.tasks.put({
              ...parent,
              nextId: null,
              version: parent.version + 1,
              updatedAt: new Date().toISOString(),
            });
          await database.tasks.delete(task.id);
        },
      );
    },
    async stopGroup(id: string, revision: number) {
      await database.transaction(
        "rw",
        database.groups,
        database.tasks,
        async () => {
          const group = await database.groups.get(id);
          if (!group || group.revision !== revision)
            throw new Error(conflictMessage);
          await database.groups.put({
            ...group,
            active: false,
            revision: group.revision + 1,
          });
          await database.tasks
            .where("groupId")
            .equals(id)
            .modify((t) => {
              t.version++;
              t.updatedAt = new Date().toISOString();
            });
        },
      );
    },
    async reorder(ids: string[], versions: number[], generations: string[]) {
      await database.transaction("rw", database.tasks, async () => {
        const all = await database.tasks.toArray();
        if (all.length !== ids.length || new Set(ids).size !== ids.length)
          throw new Error(conflictMessage);
        for (let i = 0; i < ids.length; i++) {
          const task = await checked(ids[i], versions[i], generations[i]);
          await database.tasks.put({
            ...task,
            order: i,
            version: task.version + 1,
            updatedAt: new Date().toISOString(),
          });
        }
      });
    },
    async saveCategory(name: string, color: string, original?: Category) {
      const clean = name.trim();
      if (!clean) throw new Error("카테고리 이름을 입력해 주세요.");
      if (!/^#[\da-f]{6}$/i.test(color))
        throw new Error("색상 값이 올바르지 않습니다.");
      await database.transaction("rw", database.categories, async () => {
        if (original) {
          const current = await database.categories.get(original.id);
          if (
            !current ||
            current.version !== original.version ||
            current.generation !== original.generation
          )
            throw new Error(conflictMessage);
        }
        const duplicates = await database.categories
          .filter(
            (c) =>
              c.name.toLocaleLowerCase() === clean.toLocaleLowerCase() &&
              c.id !== original?.id,
          )
          .count();
        if (duplicates) throw new Error("같은 이름의 카테고리가 있습니다.");
        await database.categories.put({
          id: original?.id ?? crypto.randomUUID(),
          name: clean,
          color,
          version: (original?.version ?? 0) + 1,
          generation: original?.generation ?? crypto.randomUUID(),
        });
      });
    },
    async removeCategory(category: Category) {
      await database.transaction(
        "rw",
        database.categories,
        database.tasks,
        database.groups,
        async () => {
          const current = await database.categories.get(category.id);
          if (
            !current ||
            current.version !== category.version ||
            current.generation !== category.generation
          )
            throw new Error(conflictMessage);
          await database.tasks
            .where("categoryId")
            .equals(category.id)
            .modify((t) => {
              t.categoryId = null;
              t.version++;
              t.updatedAt = new Date().toISOString();
            });
          await database.groups
            .filter((g) => g.fields.categoryId === category.id)
            .modify((g) => {
              g.fields.categoryId = null;
              g.revision++;
            });
          await database.categories.delete(category.id);
        },
      );
    },
  };
}
export const tasks = taskService();
