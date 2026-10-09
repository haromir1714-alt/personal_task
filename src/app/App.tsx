import { CategoryManager } from "../features/categories/CategoryManager";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  LayoutDashboard,
  CheckCheck,
  ListTodo,
  CalendarDays,
  ChartColumn,
  Settings2,
  Plus,
  Menu,
  X,
  ArrowRight,
  Sparkles,
  CircleCheck,
  Clock,
  Layers,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { db } from "../db/database";
import { localDay } from "../utils/dates";
import {
  coversDay,
  emptyFilters,
  selectTasks,
  upcoming,
  type Filters as FilterValues,
} from "../utils/views";
import type { Task, Theme } from "../types";
import { TaskModal } from "../components/TaskModal";
import { TaskList } from "../components/TaskList";
import { Filters } from "../features/tasks/Filters";
import { Calendar } from "../features/calendar/Calendar";
const Statistics = lazy(() =>
  import("../features/statistics/Statistics").then((module) => ({
    default: module.Statistics,
  })),
);
import { Settings } from "../features/settings/Settings";
const pages = [
  { path: "/", name: "대시보드", icon: LayoutDashboard },
  { path: "/today", name: "오늘의 할 일", icon: CheckCheck },
  { path: "/tasks", name: "전체 할 일", icon: ListTodo },
  { path: "/calendar", name: "월간 캘린더", icon: CalendarDays },
  { path: "/statistics", name: "통계", icon: ChartColumn },
  { path: "/settings", name: "설정", icon: Settings2 },
];
export default function App() {
  const [dbError, setDbError] = useState("");
  const data = useLiveQuery(async () => {
    try {
      return {
        tasks: await db.tasks.toArray(),
        categories: await db.categories.toArray(),
        groups: await db.groups.toArray(),
        theme: (await db.settings.get("theme"))?.value ?? ("system" as Theme),
      };
    } catch (err) {
      setDbError((err as Error).message);
      return undefined;
    }
  }, []);
  const [filters, setFilters] = useState<FilterValues>(emptyFilters);
  const [modal, setModal] = useState<{ task?: Task; due?: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [mobile, setMobile] = useState(false);
  const [today, setToday] = useState(localDay());
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const update = () => setToday(localDay());
    const timer = setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        data?.theme === "dark" || (data?.theme === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [data?.theme]);
  const run = (op: () => Promise<void>) => {
    setError("");
    void op().catch((err) => setError((err as Error).message));
  };
  const add = (due?: string) => setModal({ due });
  const edit = (task: Task) => setModal({ task });
  if (!data)
    return (
      <main className="loading">
        <Layers size={35} />
        <h1>Personal Task</h1>
        <p role={dbError ? "alert" : undefined}>
          {dbError
            ? `데이터를 열지 못했습니다: ${dbError}`
            : "나의 작업 공간을 준비하고 있어요…"}
        </p>
        {dbError && (
          <button onClick={() => window.location.reload()}>다시 시도</button>
        )}
      </main>
    );
  const tasks = data.tasks;
  const pending = tasks.filter((t) => !t.completedAt);
  const dueToday = pending.filter((t) => coversDay(t, today));
  const late = pending.filter((t) => t.due && t.due < today);
  const next = upcoming(tasks, today);
  const list = (items: Task[], drag = false) => (
    <TaskList
      items={items}
      categories={data.categories}
      groups={data.groups}
      edit={edit}
      run={run}
      drag={drag}
      add={() => add()}
    />
  );
  const drag =
    filters.sort === "custom" &&
    !filters.query &&
    filters.status === "all" &&
    filters.category === "all" &&
    filters.priority === "all" &&
    !filters.from &&
    !filters.to &&
    !filters.undated;
  const title =
    location.pathname === "/categories"
      ? "카테고리 관리"
      : (pages.find((p) => p.path === location.pathname)?.name ?? "대시보드");
  const section = (name: string, items: Task[], extra?: React.ReactNode) => (
    <section className="panel">
      <div className="section-head">
        <h2>
          {name}
          <span className="count-badge">{items.length}</span>
        </h2>
        {extra}
      </div>
      {list(items)}
    </section>
  );
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        본문으로 이동
      </a>
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="메뉴 닫기"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand">
          <span>
            <CheckCheck size={23} />
          </span>
          <div>
            personal task<small>나의 하루를 차근차근</small>
          </div>
          <button
            className="mobile-only icon-button"
            aria-label="메뉴 닫기"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="주요 화면">
          {pages.map(({ path, name, icon: Icon }) => (
            <NavLink key={path} to={path} end onClick={() => setMobile(false)}>
              <Icon size={19} />
              {name}
              {path === "/today" && dueToday.length > 0 && (
                <b>{dueToday.length}</b>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-categories">
          <span className="nav-caption">카테고리</span>
          <button
            className="icon-button"
            aria-label="카테고리 관리"
            onClick={() => {
              navigate("/categories");
              setMobile(false);
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        {data.categories.map((c) => (
          <button
            key={c.id}
            className="category-link"
            onClick={() => {
              setFilters({ ...emptyFilters, category: c.id });
              navigate("/tasks");
              setMobile(false);
            }}
          >
            <i style={{ background: c.color }} />
            {c.name}
            <span>{pending.filter((t) => t.categoryId === c.id).length}</span>
          </button>
        ))}
        <div className="sidebar-bottom">
          <span className="local-dot" />
          로컬에 안전하게 저장<p>당신의 계획은 당신의 기기에만.</p>
        </div>
      </aside>
      <main id="main" className="main" tabIndex={-1}>
        <header>
          <div className="page-title">
            <button
              className="mobile-only icon-button"
              aria-label="메뉴 열기"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <div>
              <span className="eyebrow">MY PERSONAL WORKSPACE</span>
              <h1>{title}</h1>
            </div>
          </div>
          <button
            className="primary"
            onClick={() =>
              add(location.pathname === "/today" ? today : undefined)
            }
          >
            <Plus size={18} />
            <span>할 일 추가</span>
          </button>
        </header>
        {error && (
          <div role="alert" className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button aria-label="오류 안내 닫기" onClick={() => setError("")}>
              <X size={17} />
            </button>
          </div>
        )}
        <Routes>
          <Route
            path="/"
            element={
              <>
                <section className="welcome">
                  <div>
                    <span className="eyebrow">
                      {format(new Date(), "yyyy년 M월 d일 EEEE", {
                        locale: ko,
                      })}
                    </span>
                    <h2>
                      작은 계획이 만드는
                      <br />더 나은 하루<span className="welcome-dot">.</span>
                    </h2>
                    <p>오늘 해야 할 일에 집중하고, 하나씩 마무리해 보세요.</p>
                    <button onClick={() => navigate("/today")}>
                      오늘의 할 일 보기
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="welcome-art" aria-hidden="true">
                    <div className="art-orbit" />
                    <div className="art-card">
                      <span>
                        <Sparkles size={18} /> TODAY
                      </span>
                      <div>
                        <i />
                        나를 위한 시간
                      </div>
                      <div>
                        <i />한 걸음 더 가까이
                      </div>
                      <div>
                        <i />
                        차근차근, 꾸준히
                      </div>
                    </div>
                  </div>
                </section>
                <div className="metric-grid">
                  {[
                    {
                      label: "전체 할 일",
                      value: tasks.length,
                      icon: Layers,
                      color: "indigo",
                    },
                    {
                      label: "미완료",
                      value: pending.length,
                      icon: Clock,
                      color: "amber",
                    },
                    {
                      label: "완료한 할 일",
                      value: tasks.length - pending.length,
                      icon: CircleCheck,
                      color: "green",
                    },
                    {
                      label: "기한 초과",
                      value: late.length,
                      icon: AlertCircle,
                      color: "rose",
                    },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div className="metric" key={label}>
                      <span className={`metric-icon ${color}`}>
                        <Icon size={20} />
                      </span>
                      <span>
                        {label}
                        <strong>
                          {value}
                          <small>개</small>
                        </strong>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="dashboard-grid">
                  {section(
                    "오늘의 할 일",
                    dueToday,
                    <button
                      className="text-button"
                      onClick={() => navigate("/today")}
                    >
                      전체 보기
                      <ArrowRight size={15} />
                    </button>,
                  )}
                  {section("다가오는 7일", next)}
                </div>
                {late.length > 0 && section("기한이 지난 할 일", late)}
              </>
            }
          />
          <Route
            path="/today"
            element={
              <>
                <div className="intro">
                  <h2>오늘에 집중해 보세요.</h2>
                  <p>
                    {format(new Date(), "M월 d일 EEEE", { locale: ko })} · 오늘
                    마감 {dueToday.length}개
                  </p>
                </div>
                {section("오늘 일정", dueToday)}
                {section("기한이 지난 미완료", late)}
              </>
            }
          />
          <Route
            path="/tasks"
            element={
              <section className="panel">
                <div className="section-head">
                  <button onClick={() => navigate("/categories")}>
                    카테고리 관리
                  </button>
                  <h2>
                    나의 모든 계획
                    <span className="count-badge">{tasks.length}</span>
                  </h2>
                </div>
                <Filters
                  value={filters}
                  set={setFilters}
                  categories={data.categories}
                />
                {filters.sort === "custom" && (
                  <p className="hint">
                    {drag
                      ? "드래그하거나 위·아래 버튼으로 순서를 바꿀 수 있습니다."
                      : "검색과 필터를 해제한 전체 목록에서만 순서를 바꿀 수 있습니다."}
                  </p>
                )}
                {list(selectTasks(tasks, filters), drag)}
              </section>
            }
          />
          <Route
            path="/calendar"
            element={
              <Calendar
                tasks={tasks}
                renderList={list}
                add={(due) => add(due)}
              />
            }
          />
          <Route
            path="/statistics"
            element={
              <Suspense
                fallback={
                  <section className="panel">통계를 불러오는 중…</section>
                }
              >
                <Statistics tasks={tasks} />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Settings
                categories={data.categories}
                groups={data.groups}
                theme={data.theme}
                setTheme={(theme) =>
                  run(async () => {
                    await db.settings.put({ id: "theme", value: theme });
                  })
                }
                run={run}
              />
            }
          />
          <Route
            path="/categories"
            element={<CategoryManager categories={data.categories} run={run} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <footer>
          오늘의 작은 성취를 기록하세요.{" "}
          <span>Personal Task · Local workspace</span>
        </footer>
      </main>
      {modal && (
        <TaskModal
          key={modal.task?.id ?? "new"}
          original={modal.task}
          defaultDue={modal.due}
          categories={data.categories}
          groups={data.groups}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
