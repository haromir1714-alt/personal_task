import Dexie, { type EntityTable } from "dexie";
import type { Task, Category, Group, Setting } from "../types";
export class TaskDatabase extends Dexie {
  tasks!: EntityTable<Task, "id">;
  categories!: EntityTable<Category, "id">;
  groups!: EntityTable<Group, "id">;
  settings!: EntityTable<Setting, "id">;
  constructor(name = "personal-task") {
    super(name);
    this.version(1).stores({
      tasks: "id, due, categoryId, groupId, order, [groupId+sequence]",
      categories: "id, &name",
      groups: "id",
      settings: "id",
    });
    this.on("populate", async (tx) => {
      await tx.table<Category>("categories").bulkAdd([
        {
          id: "study",
          name: "공부",
          color: "#6366f1",
          version: 1,
          generation: crypto.randomUUID(),
        },
        {
          id: "personal",
          name: "개인",
          color: "#14b8a6",
          version: 1,
          generation: crypto.randomUUID(),
        },
        {
          id: "other",
          name: "기타",
          color: "#f59e0b",
          version: 1,
          generation: crypto.randomUUID(),
        },
      ]);
      await tx.table("settings").add({ id: "theme", value: "system" });
    });
  }
}
export const db = new TaskDatabase();
