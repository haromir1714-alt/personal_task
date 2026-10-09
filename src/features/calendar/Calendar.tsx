import { useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { coversDay } from "../../utils/views";
import { localDay } from "../../utils/dates";
import type { Task } from "../../types";
export function Calendar({
  tasks,
  renderList,
  add,
}: {
  tasks: Task[];
  renderList: (items: Task[]) => React.ReactNode;
  add: (due: string) => void;
}) {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState(localDay());
  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  return (
    <>
      <section className="panel">
        <div className="section-head">
          <h2>{format(month, "yyyy년 M월", { locale: ko })}</h2>
          <div className="button-group">
            <button
              aria-label="이전 달"
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              onClick={() => {
                setMonth(startOfMonth(new Date()));
                setSelected(localDay());
              }}
            >
              이번 달
            </button>
            <button
              aria-label="다음 달"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <div className="calendar-grid">
          {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
            <div className="weekday" key={d}>
              {d}
            </div>
          ))}
          {days.map((day) => {
            const key = localDay(day);
            const items = tasks.filter((t) => coversDay(t, key));
            return (
              <button
                key={key}
                aria-label={key}
                aria-pressed={selected === key}
                className={`calendar-day ${!isSameMonth(day, month) ? "outside" : ""} ${key === localDay() ? "today" : ""} ${key === selected ? "selected" : ""}`}
                onClick={() => setSelected(key)}
              >
                <span className="day-number">{day.getDate()}</span>
                <span className="calendar-items">
                  {items.slice(0, 2).map((t) => (
                    <span className={t.completedAt ? "done" : ""} key={t.id}>
                      {t.title}
                    </span>
                  ))}
                  {items.length > 2 && <small>+{items.length - 2}개</small>}
                </span>
                <span className="calendar-dots">
                  {items.slice(0, 5).map((t) => (
                    <i key={t.id} className={t.completedAt ? "done" : ""} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <div className="section-head">
          <h2>
            {format(parseISO(selected), "M월 d일 EEEE", { locale: ko })}의 할 일
          </h2>
          <button onClick={() => add(localDay(addDays(parseISO(selected), 0)))}>
            <Plus size={16} />이 날짜에 추가
          </button>
        </div>
        {renderList(tasks.filter((t) => coversDay(t, selected)))}
      </section>
    </>
  );
}
