import { Search } from "lucide-react";
import type { Category } from "../../types";
import type { Filters as FilterValues } from "../../utils/views";
export function Filters({
  value,
  set,
  categories,
}: {
  value: FilterValues;
  set: (v: FilterValues) => void;
  categories: Category[];
}) {
  const update = <K extends keyof FilterValues>(key: K, v: FilterValues[K]) =>
    set({ ...value, [key]: v });
  return (
    <div className="filters">
      <label className="search">
        <Search size={17} />
        <input
          aria-label="할 일 검색"
          placeholder="제목 또는 메모 검색"
          value={value.query}
          onChange={(e) => update("query", e.target.value)}
        />
      </label>
      <select
        aria-label="상태 필터"
        value={value.status}
        onChange={(e) => update("status", e.target.value)}
      >
        <option value="all">모든 상태</option>
        <option value="open">미완료</option>
        <option value="done">완료</option>
      </select>
      <select
        aria-label="카테고리 필터"
        value={value.category}
        onChange={(e) => update("category", e.target.value)}
      >
        <option value="all">모든 카테고리</option>
        <option value="none">미분류</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label="우선순위 필터"
        value={value.priority}
        onChange={(e) => update("priority", e.target.value)}
      >
        <option value="all">모든 우선순위</option>
        <option value="high">높음</option>
        <option value="normal">보통</option>
        <option value="low">낮음</option>
      </select>
      <select
        aria-label="정렬"
        value={value.sort}
        onChange={(e) => update("sort", e.target.value)}
      >
        <option value="due-asc">마감일 빠른 순</option>
        <option value="due-desc">마감일 늦은 순</option>
        <option value="priority-asc">우선순위 높은 순</option>
        <option value="priority-desc">우선순위 낮은 순</option>
        <option value="custom">사용자 지정 순서</option>
      </select>
      <div className="date-filters">
        <label>
          시작일
          <input
            type="date"
            value={value.from}
            onChange={(e) => update("from", e.target.value)}
          />
        </label>
        <label>
          종료일
          <input
            type="date"
            value={value.to}
            onChange={(e) => update("to", e.target.value)}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={value.undated}
            onChange={(e) => update("undated", e.target.checked)}
          />
          마감일 미지정
        </label>
        <button
          onClick={() =>
            set({
              ...value,
              query: "",
              status: "all",
              category: "all",
              priority: "all",
              from: "",
              to: "",
              undated: false,
            })
          }
        >
          필터 초기화
        </button>
      </div>
      {value.from && value.to && value.from > value.to && (
        <p className="error">시작일은 종료일보다 늦을 수 없습니다.</p>
      )}
    </div>
  );
}
