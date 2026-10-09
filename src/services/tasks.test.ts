import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskDatabase } from "../db/database";
import { taskService } from "./tasks";
import { exportBackup, restoreBackup, validateBackup } from "./backup";
import type { Fields } from "../types";
let db: TaskDatabase;
let service: ReturnType<typeof taskService>;
const fields: Fields = {
  title: "시험 준비",
  notes: "메모",
  due: "2026-01-31",
  categoryId: "study",
  priority: "normal",
};
beforeEach(async () => {
  db = new TaskDatabase(`test-${crypto.randomUUID()}`);
  service = taskService(db);
  await db.open();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});
const first = async () => {
  const task = await db.tasks.toCollection().first();
  if (!task) throw new Error("task missing");
  return task;
};
describe("작업과 데이터 안정성", () => {
  it("같은 제목을 개별 ID로 저장하고 재실행 후 보존한다", async () => {
    await service.save(fields, null);
    await service.save(fields, null);
    const name = db.name;
    db.close();
    db = new TaskDatabase(name);
    await db.open();
    expect(await db.tasks.count()).toBe(2);
    expect(new Set((await db.tasks.toArray()).map((t) => t.id)).size).toBe(2);
  });
  it("제목과 반복 마감일을 검사한다", async () => {
    await expect(
      service.save({ ...fields, title: "  " }, null),
    ).rejects.toThrow();
    await expect(
      service.save({ ...fields, due: null }, "daily"),
    ).rejects.toThrow();
    await expect(
      service.save({ ...fields, due: "2026-02-30" }, null),
    ).rejects.toThrow();
    await service.save({ ...fields, due: null }, null);
    expect((await first()).due).toBeNull();
  });
  it("삭제된 카테고리를 참조하는 입력을 거부한다", async () => {
    await expect(
      service.save({ ...fields, categoryId: "missing" }, null),
    ).rejects.toThrow();
    expect(await db.tasks.count()).toBe(0);
  });
  it("반복 완료 취소 및 재완료는 기존 발생 건을 재사용한다", async () => {
    await service.save(fields, "monthly");
    const task = await first();
    await service.toggle(task, new Date(2026, 0, 31, 12));
    expect(await db.tasks.count()).toBe(2);
    const next = await db.tasks.get((await db.tasks.get(task.id))!.nextId!);
    expect(next!.due).toBe("2026-02-28");
    await service.toggle((await db.tasks.get(task.id))!);
    await service.toggle(
      (await db.tasks.get(task.id))!,
      new Date(2026, 2, 5, 12),
    );
    expect(await db.tasks.count()).toBe(2);
    expect((await db.tasks.get(task.id))!.completedAt).toBe(
      new Date(2026, 2, 5, 12).toISOString(),
    );
    expect((await db.tasks.get(next!.id))!.due).toBe("2026-02-28");
  });
  it("동시 완료 시 하나만 성공하고 다음 작업은 하나만 생성한다", async () => {
    await service.save(fields, "daily");
    const task = await first();
    const result = await Promise.allSettled([
      service.toggle(task),
      service.toggle(task),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.tasks.count()).toBe(2);
  });
  it("오래된 편집을 거부한다", async () => {
    await service.save(fields, null);
    const old = await first();
    await service.save({ ...fields, title: "최신" }, null, old);
    await expect(
      service.save({ ...fields, title: "오래됨" }, null, old),
    ).rejects.toThrow("다른 탭");
    expect((await first()).title).toBe("최신");
  });
  it("반복 완료 트랜잭션 실패 시 전체 롤백", async () => {
    await service.save(fields, "daily");
    const old = await first();
    vi.spyOn(db.tasks, "add").mockRejectedValueOnce(new Error("disk full"));
    await expect(service.toggle(old)).rejects.toThrow();
    expect((await first()).completedAt).toBeNull();
    expect(await db.tasks.count()).toBe(1);
  });
  it("반복 수정은 현재와 미완료 미래에만 적용한다", async () => {
    await service.save(fields, "monthly");
    const past = await first();
    await service.toggle(past, new Date(2026, 0, 31, 12));
    let current = (await db.tasks.get((await db.tasks.get(past.id))!.nextId!))!;
    await service.toggle(current, new Date(2026, 1, 28, 12));
    await service.toggle((await db.tasks.get(current.id))!);
    current = (await db.tasks.get(current.id))!;
    await service.save({ ...fields, title: "새 반복" }, "weekly", current);
    expect((await db.tasks.get(past.id))!.title).toBe("시험 준비");
    expect((await db.tasks.get(current.id))!.title).toBe("새 반복");
    expect((await db.tasks.get(current.nextId!))!.title).toBe("새 반복");
  });
  it("별도 편집된 미래 작업은 상위 변경으로 덮어쓰지 않는다", async () => {
    await service.save(fields, "monthly");
    const parent = await first();
    await service.toggle(parent, new Date(2026, 0, 31, 12));
    let current = (await db.tasks.get(
      (await db.tasks.get(parent.id))!.nextId!,
    ))!;
    await service.save(
      { ...fields, title: "미래 개별 수정", due: current.due },
      "monthly",
      current,
    );
    await service.toggle((await db.tasks.get(parent.id))!);
    const reopened = (await db.tasks.get(parent.id))!;
    await expect(
      service.save({ ...fields, title: "덮어쓰기" }, "monthly", reopened),
    ).rejects.toThrow("별도로 수정");
    current = (await db.tasks.get(current.id))!;
    expect(current.title).toBe("미래 개별 수정");
  });
  it("반복 해제 후 추가 생성은 멈추고 기록을 보존한다", async () => {
    await service.save(fields, "daily");
    const old = await first();
    await service.save(fields, null, old);
    await service.toggle(await first());
    expect(await db.tasks.count()).toBe(1);
    expect((await db.groups.toCollection().first())!.active).toBe(false);
  });
  it("발생 건 삭제는 반복을 종료하지 않으며 삭제된 다음 건을 재생성하지 않는다", async () => {
    await service.save(fields, "daily");
    const old = await first();
    await service.toggle(old);
    const parent = (await db.tasks.get(old.id))!;
    const next = (await db.tasks.get(parent.nextId!))!;
    await service.remove(next);
    await service.toggle((await db.tasks.get(old.id))!);
    await service.toggle((await db.tasks.get(old.id))!);
    expect(await db.tasks.count()).toBe(1);
    expect((await db.groups.toCollection().first())!.active).toBe(true);
    validateBackup(JSON.stringify(await exportBackup(db)));
  });
  it("모든 발생 건 삭제 후에도 반복 설정은 별도 종료한다", async () => {
    await service.save(fields, "daily");
    await service.remove(await first());
    const group = (await db.groups.toCollection().first())!;
    expect(group.active).toBe(true);
    await service.stopGroup(group.id, group.revision);
    expect((await db.groups.get(group.id))!.active).toBe(false);
  });
  it("카테고리 삭제 시 작업과 반복 템플릿을 미분류로 전환한다", async () => {
    await service.save(fields, "monthly");
    const category = (await db.categories.get("study"))!;
    await service.removeCategory(category);
    expect((await first()).categoryId).toBeNull();
    expect(
      (await db.groups.toCollection().first())!.fields.categoryId,
    ).toBeNull();
    expect(await db.categories.get("study")).toBeUndefined();
  });
  it("카테고리 중복과 빈 이름을 거부하고 수정 버전을 확인한다", async () => {
    await expect(service.saveCategory("  ", "#ffffff")).rejects.toThrow();
    await expect(service.saveCategory("공부", "#ffffff")).rejects.toThrow();
    const old = (await db.categories.get("study"))!;
    await service.saveCategory("학습", "#123456", old);
    await expect(service.removeCategory(old)).rejects.toThrow();
  });
  it("정렬을 저장하고 오래된 순서 변경은 롤백한다", async () => {
    await service.save(fields, null);
    await service.save({ ...fields, title: "두 번째" }, null);
    const all = await db.tasks.orderBy("order").toArray();
    await service.reorder(
      [...all].reverse().map((t) => t.id),
      [...all].reverse().map((t) => t.version),
      [...all].reverse().map((t) => t.generation),
    );
    expect((await db.tasks.orderBy("order").first())!.title).toBe("두 번째");
    await expect(
      service.reorder(
        all.map((t) => t.id),
        all.map((t) => t.version),
        all.map((t) => t.generation),
      ),
    ).rejects.toThrow();
    expect((await db.tasks.orderBy("order").first())!.title).toBe("두 번째");
  });
  it("카테고리 트랜잭션 실패 시 작업 변경도 롤백한다", async () => {
    await service.save(fields, "daily");
    const cat = (await db.categories.get("study"))!;
    vi.spyOn(db.categories, "delete").mockRejectedValueOnce(new Error("실패"));
    await expect(service.removeCategory(cat)).rejects.toThrow();
    expect((await first()).categoryId).toBe("study");
    expect((await db.groups.toCollection().first())!.fields.categoryId).toBe(
      "study",
    );
  });
});
describe("JSON 백업 및 원자적 복원", () => {
  it("전체 관계, 설정, 완료 기록을 복원하고 편집 버전을 무효화한다", async () => {
    await service.save(fields, "monthly");
    await service.toggle(await first());
    await db.settings.put({ id: "theme", value: "dark" });
    const backup = validateBackup(JSON.stringify(await exportBackup(db)));
    const before = await first();
    await service.save({ ...fields, title: "추가" }, null);
    await restoreBackup(backup, db);
    expect(await db.tasks.count()).toBe(2);
    expect((await db.settings.get("theme"))!.value).toBe("dark");
    await expect(service.toggle(before)).rejects.toThrow();
    validateBackup(JSON.stringify(await exportBackup(db)));
  });
  it.each([
    "syntax",
    "version",
    "date",
    "id",
    "category",
    "group",
    "link",
    "type",
    "theme",
    "color",
  ])("%s 손상 백업을 거부하고 기존 데이터를 보존한다", async (kind) => {
    await service.save(fields, "daily");
    const raw = JSON.parse(JSON.stringify(await exportBackup(db)));
    if (kind === "syntax") {
      expect(() => validateBackup("{")).toThrow();
      return;
    }
    if (kind === "version") raw.formatVersion = 99;
    if (kind === "date") raw.tasks[0].due = "2026-02-30";
    if (kind === "id") raw.tasks.push(raw.tasks[0]);
    if (kind === "category") raw.tasks[0].categoryId = "missing";
    if (kind === "group") raw.tasks[0].groupId = "missing";
    if (kind === "link") raw.tasks[0].nextId = "missing";
    if (kind === "type") raw.tasks[0].version = "1";
    if (kind === "theme") raw.settings[0].value = "evil";
    if (kind === "color") raw.categories[0].color = "url(javascript:evil)";
    expect(() => validateBackup(JSON.stringify(raw))).toThrow();
    expect(await db.tasks.count()).toBe(1);
  });
  it("복원 중 DB 오류 발생 시 전체 기존 데이터를 유지한다", async () => {
    await service.save(fields, null);
    const backup = await exportBackup(db);
    const before = await first();
    vi.spyOn(db.categories, "bulkAdd").mockRejectedValueOnce(
      new Error("quota"),
    );
    await expect(restoreBackup(backup, db)).rejects.toThrow();
    expect(await first()).toEqual(before);
    expect(await db.categories.count()).toBe(3);
  });
});

describe("복원 후 오래된 편집 보호", () => {
  it("삭제 후 복원으로 version 숫자가 같아져도 예전 입력을 거부한다", async () => {
    await service.save(fields, null);
    const backup = await exportBackup(db);
    await service.save({ ...fields, title: "버전 2" }, null, await first());
    const oldEditor = await first();
    await service.remove(oldEditor);
    await restoreBackup(backup, db);
    expect((await first()).version).toBe(oldEditor.version);
    await expect(
      service.save({ ...fields, title: "오래된 입력" }, null, oldEditor),
    ).rejects.toThrow("다른 탭");
    expect((await first()).title).toBe(fields.title);
  });
  it.each(["priority", "frequency", "theme", "timestamp"])(
    "%s 타입 또는 날짜 손상을 거부한다",
    async (kind) => {
      await service.save(fields, "daily");
      const raw = JSON.parse(JSON.stringify(await exportBackup(db)));
      if (kind === "priority") raw.tasks[0].priority = ["high"];
      if (kind === "frequency") raw.groups[0].frequency = ["daily"];
      if (kind === "theme") raw.settings[0].value = ["dark"];
      if (kind === "timestamp")
        raw.tasks[0].updatedAt = "2026-02-30T12:00:00.000Z";
      expect(() => validateBackup(JSON.stringify(raw))).toThrow();
    },
  );
});
