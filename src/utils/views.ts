import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Task } from "../types";
import { localDay } from "./dates";
export interface Filters {
  query: string;
  status: string;
  category: string;
  priority: string;
  from: string;
  to: string;
  undated: boolean;
  sort: string;
}
export const emptyFilters: Filters = {
  query: "",
  status: "all",
  category: "all",
  priority: "all",
  from: "",
  to: "",
  undated: false,
  sort: "due-asc",
};
export const coversDay = (task: Task, day: string) =>
  !!task.due && (task.startDate ?? task.due) <= day && day <= task.due;
export function selectTasks(tasks: Task[], f: Filters) {
  if (f.from && f.to && f.from > f.to) return [];
  const rank = { high: 0, normal: 1, low: 2 };
  return tasks
    .filter(
      (t) =>
        `${t.title} ${t.notes}`
          .toLocaleLowerCase()
          .includes(f.query.toLocaleLowerCase()) &&
        (f.status === "all" || !!t.completedAt === (f.status === "done")) &&
        (f.category === "all" ||
          t.categoryId === (f.category === "none" ? null : f.category)) &&
        (f.priority === "all" || t.priority === f.priority) &&
        (!f.undated || !t.due) &&
        (!f.from || (!!t.due && t.due >= f.from)) &&
        (!f.to || (!!t.due && (t.startDate ?? t.due) <= f.to)),
    )
    .sort((a, b) => {
      if (f.sort === "custom") return a.order - b.order;
      if (f.sort.startsWith("priority"))
        return (
          (rank[a.priority] - rank[b.priority]) *
            (f.sort.endsWith("desc") ? -1 : 1) || a.order - b.order
        );
      if (!a.due && !b.due) return a.order - b.order;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return (
        a.due.localeCompare(b.due) * (f.sort.endsWith("desc") ? -1 : 1) ||
        a.order - b.order
      );
    });
}
export function completionSeries(
  tasks: Task[],
  mode: "week" | "month",
  date: Date,
) {
  const start =
    mode === "week"
      ? startOfWeek(date, { weekStartsOn: 1 })
      : startOfMonth(date);
  const end =
    mode === "week" ? endOfWeek(date, { weekStartsOn: 1 }) : endOfMonth(date);
  return eachDayOfInterval({ start, end }).map((day) => ({
    day: localDay(day),
    label: localDay(day).slice(5),
    count: tasks.filter(
      (t) =>
        t.completedAt && localDay(parseISO(t.completedAt)) === localDay(day),
    ).length,
  }));
}
export const upcoming = (tasks: Task[], today: string) =>
  tasks
    .filter(
      (t) =>
        !t.completedAt &&
        t.due &&
        (t.startDate ?? t.due) > today &&
        (t.startDate ?? t.due) <= localDay(addDays(parseISO(today), 7)),
    )
    .sort((a, b) =>
      (a.startDate ?? a.due!).localeCompare(b.startDate ?? b.due!),
    );
