import { useState } from "react";
import { addMonths, addWeeks, format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { completionSeries } from "../../utils/views";
import type { Task } from "../../types";
export function Statistics({ tasks }: { tasks: Task[] }) {
  const [date, setDate] = useState(new Date());
  const [mode, setMode] = useState<"week" | "month">("week");
  const data = completionSeries(tasks, mode, date);
  const move = (n: number) =>
    setDate(mode === "week" ? addWeeks(date, n) : addMonths(date, n));
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>완료한 일의 기록</h2>
          <p className="hint">실제 완료 날짜를 기준으로 계산합니다.</p>
        </div>
        <div className="segmented">
          <button
            className={mode === "week" ? "active" : ""}
            onClick={() => setMode("week")}
          >
            주간
          </button>
          <button
            className={mode === "month" ? "active" : ""}
            onClick={() => setMode("month")}
          >
            월간
          </button>
        </div>
      </div>
      <div className="stat-summary">
        <div>
          <span className="hint">
            {format(parseISO(data[0].day), "yyyy년 M월 d일")} —{" "}
            {format(parseISO(data.at(-1)!.day), "M월 d일")}
          </span>
          <h3>
            <b>{data.reduce((n, d) => n + d.count, 0)}</b>개의 할 일을
            완료했어요
          </h3>
        </div>
        <div className="button-group">
          <button onClick={() => move(-1)}>이전</button>
          <button onClick={() => setDate(new Date())}>
            이번 {mode === "week" ? "주" : "달"}
          </button>
          <button onClick={() => move(1)}>다음</button>
        </div>
      </div>
      <div className="chart" role="img" aria-label="날짜별 완료 작업 개수">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 15, left: -20, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} />
            <YAxis allowDecimals={false} tickLine={false} />
            <Tooltip formatter={(value) => [`${value}개`, "완료"]} />
            <Bar
              dataKey="count"
              fill="#6366f1"
              radius={[5, 5, 0, 0]}
              maxBarSize={42}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary>날짜별 완료 건수 보기</summary>
        <div className="stats-table">
          {data.map((d) => (
            <div key={d.day}>
              <span>{d.day}</span>
              <strong>{d.count}개</strong>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
