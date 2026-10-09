import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  getDaysInMonth,
  parseISO,
  setDate,
  startOfMonth,
} from "date-fns";
import type { Frequency } from "../types";
import { localDay, validDay } from "../utils/dates";
export function nextOccurrence(
  anchor: string,
  frequency: Frequency,
  completedDay: string,
  currentDue = anchor,
): string {
  if (!validDay(anchor) || !validDay(completedDay) || !validDay(currentDue))
    throw new Error("반복 날짜가 올바르지 않습니다.");
  const after = parseISO(completedDay > currentDue ? completedDay : currentDue);
  const base = parseISO(anchor);
  if (frequency !== "monthly") {
    const step = frequency === "daily" ? 1 : 7;
    return localDay(
      addDays(
        base,
        Math.max(
          1,
          Math.floor(differenceInCalendarDays(after, base) / step) + 1,
        ) * step,
      ),
    );
  }
  let offset = Math.max(1, differenceInCalendarMonths(after, base));
  for (;;) {
    const month = addMonths(startOfMonth(base), offset++);
    const candidate = setDate(
      month,
      Math.min(base.getDate(), getDaysInMonth(month)),
    );
    if (candidate > after) return localDay(candidate);
  }
}
