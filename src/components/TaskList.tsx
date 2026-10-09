import { useState } from "react";
import {
  CalendarDays,
  GripVertical,
  Pencil,
  Repeat2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, Category } from "../types";
import { tasks as service } from "../services/tasks";
import { localDay } from "../utils/dates";
const priorities = { high: "높음", normal: "보통", low: "낮음" };
function Row({
  task,
  categories,
  edit,
  run,
  drag,
  onMove,
  index,
  total,
}: {
  task: Task;
  categories: Category[];
  edit: (t: Task) => void;
  run: (op: () => Promise<void>) => void;
  drag: boolean;
  onMove: (from: number, to: number) => void;
  index: number;
  total: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id, disabled: !drag });
  const category = categories.find((c) => c.id === task.categoryId);
  const late = !task.completedAt && !!task.due && task.due < localDay();
  const [busy, setBusy] = useState(false);
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`task-row ${task.completedAt ? "completed" : ""} ${late ? "overdue" : ""}`}
    >
      {drag && (
        <button
          ref={setActivatorNodeRef}
          className="drag-handle"
          aria-label={`${task.title} 순서 이동`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={17} />
        </button>
      )}
      <input
        type="checkbox"
        aria-label={`${task.title} 완료`}
        checked={!!task.completedAt}
        disabled={busy}
        onChange={() => {
          if (busy) return;
          setBusy(true);
          run(async () => {
            try {
              await service.toggle(task);
            } finally {
              setBusy(false);
            }
          });
        }}
      />
      <button className="task-body" onClick={() => edit(task)}>
        <strong>{task.title}</strong>
        <span className="task-meta">
          {category && (
            <span className="category-badge">
              <i style={{ background: category.color }} />
              {category.name}
            </span>
          )}
          {!category && <span>미분류</span>}
          {task.due && (
            <span className={late ? "late" : ""}>
              <CalendarDays size={13} />
              {task.due}
              {late ? " · 기한 초과" : ""}
            </span>
          )}
          {task.groupId && (
            <span>
              <Repeat2 size={13} />
              반복
            </span>
          )}
          {task.notes && <span className="notes-preview">{task.notes}</span>}
        </span>
      </button>
      <span className={`priority ${task.priority}`}>
        {priorities[task.priority]}
      </span>
      <div className="row-actions">
        {drag && (
          <>
            <button
              className="icon-button"
              aria-label={`${task.title} 위로`}
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
            >
              <ArrowUp size={15} />
            </button>
            <button
              className="icon-button"
              aria-label={`${task.title} 아래로`}
              disabled={index === total - 1}
              onClick={() => onMove(index, index + 1)}
            >
              <ArrowDown size={15} />
            </button>
          </>
        )}
        <button
          className="icon-button"
          aria-label={`${task.title} 수정`}
          onClick={() => edit(task)}
        >
          <Pencil size={16} />
        </button>
        <button
          className="icon-button danger"
          aria-label={`${task.title} 삭제`}
          onClick={() => {
            if (
              window.confirm(
                "이 할 일을 영구 삭제할까요? 반복 작업 삭제는 반복 종료와 별개입니다.",
              )
            )
              run(() => service.remove(task));
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
export function TaskList({
  items,
  categories,
  edit,
  run,
  drag = false,
  add,
}: {
  items: Task[];
  categories: Category[];
  edit: (t: Task) => void;
  run: (op: () => Promise<void>) => void;
  drag?: boolean;
  add: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const move = (from: number, to: number) => {
    const reordered = arrayMove(items, from, to);
    run(() =>
      service.reorder(
        reordered.map((t) => t.id),
        reordered.map((t) => t.version),
        reordered.map((t) => t.generation),
      ),
    );
  };
  const end = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id)
      move(
        items.findIndex((t) => t.id === e.active.id),
        items.findIndex((t) => t.id === e.over!.id),
      );
  };
  if (!items.length)
    return (
      <div className="empty">
        <div className="empty-symbol">✓</div>
        <h3>아직 할 일이 없어요</h3>
        <p>작은 계획부터 하나씩 시작해 보세요.</p>
        <button onClick={add}>
          <Plus size={16} />할 일 추가
        </button>
      </div>
    );
  return (
    <DndContext
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Space 키로 순서 이동을 시작하고, 위·아래 방향키로 이동한 뒤 Space 키로 확정합니다. Escape 키로 취소합니다.",
        },
        announcements: {
          onDragStart: ({ active }) =>
            `${items.find((t) => t.id === active.id)?.title ?? "할 일"} 순서 이동을 시작했습니다.`,
          onDragOver: ({ over }) =>
            over
              ? `${items.findIndex((t) => t.id === over.id) + 1}번째 위치로 이동했습니다.`
              : "이동할 위치를 선택해 주세요.",
          onDragEnd: ({ over }) =>
            over
              ? `${items.findIndex((t) => t.id === over.id) + 1}번째 위치에 놓았습니다.`
              : "이동을 종료했습니다.",
          onDragCancel: () => "순서 이동을 취소했습니다.",
        },
      }}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={end}
    >
      <SortableContext
        items={items.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="task-list">
          {items.map((t, i) => (
            <Row
              key={t.id}
              task={t}
              categories={categories}
              edit={edit}
              run={run}
              drag={drag}
              onMove={move}
              index={i}
              total={items.length}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
