import { describe, expect, it } from "vitest";
import { completionSeries, emptyFilters, selectTasks } from "./views";
import { localDay } from "./dates";
import type { Task } from "../types";
const task = (id: string, changes: Partial<Task> = {}): Task => ({
  id,
  generation: crypto.randomUUID(),
  title: "학습 계획",
  notes: "영어 읽기",
  due: null,
  priority: "normal",
  categoryId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: null,
  order: 0,
  version: 1,
  groupId: null,
  sequence: 0,
  nextId: null,
  successorCreated: false,
  groupRevision: 0,
  ...changes,
});
describe("검색·정렬·통계", () => {
  it("메모 검색, 상태, 카테고리, 우선순위, 날짜 범위를 함께 적용한다", () => {
    const t = task("a", {
      categoryId: "study",
      priority: "high",
      due: "2026-10-09",
    });
    expect(
      selectTasks([t, task("b")], {
        ...emptyFilters,
        query: "영어",
        status: "open",
        category: "study",
        priority: "high",
        from: "2026-10-01",
        to: "2026-10-10",
      }),
    ).toEqual([t]);
  });
  it("마감일 미지정과 날짜 정렬에서 미지정은 마지막이다", () => {
    const t = task("a", { due: "2026-10-09" });
    const none = task("b");
    expect(
      selectTasks([none, t], { ...emptyFilters, sort: "due-desc" }).map(
        (t) => t.id,
      ),
    ).toEqual(["a", "b"]);
    expect(selectTasks([t, none], { ...emptyFilters, undated: true })).toEqual([
      none,
    ]);
  });
  it("주간 통계는 월요일부터 일요일이고 실제 완료 날짜를 사용한다", () => {
    const date = new Date(2026, 9, 9, 12);
    const completed = new Date(2026, 9, 5, 0, 1);
    const data = completionSeries(
      [task("a", { completedAt: completed.toISOString() }), task("b")],
      "week",
      date,
    );
    expect(data[0].day).toBe("2026-10-05");
    expect(data.at(-1)!.day).toBe("2026-10-11");
    expect(data[0].count).toBe(1);
    expect(data.reduce((n, d) => n + d.count, 0)).toBe(1);
  });
  it("월간 통계와 재완료 날짜, 로컬 자정 경계를 계산한다", () => {
    const done = new Date(2026, 9, 9, 0, 0, 1);
    const t = task("a", { completedAt: done.toISOString() });
    expect(localDay(done)).toBe("2026-10-09");
    expect(completionSeries([t], "month", done)).toHaveLength(31);
    expect(
      completionSeries([t], "month", done).find((d) => d.day === "2026-10-09")!
        .count,
    ).toBe(1);
    expect(
      completionSeries([{ ...t, completedAt: null }], "month", done).reduce(
        (n, d) => n + d.count,
        0,
      ),
    ).toBe(0);
  });
});
