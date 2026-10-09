import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Category, Fields, Frequency, Group, Task } from "../types";
import { tasks } from "../services/tasks";
const frequencyLabels = { daily: "매일", weekly: "매주", monthly: "매월" };
export function TaskModal({
  original,
  categories,
  groups,
  defaultDue,
  onClose,
}: {
  original?: Task;
  categories: Category[];
  groups: Group[];
  defaultDue?: string;
  onClose: () => void;
}) {
  const initial: Fields = {
    title: original?.title ?? "",
    due: original?.due ?? defaultDue ?? null,
    startDate: original?.startDate ?? defaultDue ?? null,
    priority: original?.priority ?? "normal",
    categoryId: original?.categoryId ?? null,
    notes: original?.notes ?? "",
  };
  const originalGroup = groups.find((g) => g.id === original?.groupId);
  const initialFrequency = originalGroup?.active ? originalGroup.frequency : "";
  const [form, setForm] = useState(initial);
  const [frequency, setFrequency] = useState<Frequency | "">(initialFrequency);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  const titleInput = useRef<HTMLInputElement>(null);
  const dirty =
    JSON.stringify(form) !== JSON.stringify(initial) ||
    frequency !== initialFrequency;
  const close = () => {
    if (
      !busy &&
      (!dirty || window.confirm("저장되지 않은 변경 사항을 버릴까요?"))
    )
      onClose();
  };
  useEffect(() => {
    const previous = previousFocus.current;
    dialog.current?.showModal();
    titleInput.current?.focus();
    return () => previous?.focus();
  }, []);
  const update = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <dialog
      ref={dialog}
      className="task-dialog"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
      aria-labelledby="task-dialog-title"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await tasks.save(form, frequency || null, original);
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">나의 계획</span>
            <h2 id="task-dialog-title">
              {original ? "할 일 수정" : "새 할 일"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="닫기"
            onClick={close}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </div>
        <label>
          제목 <span className="required">*</span>
          <input
            ref={titleInput}
            name="title"
            aria-label="제목"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="어떤 일을 계획하고 있나요?"
            maxLength={500}
          />
        </label>
        <div className="form-grid">
          <label>
            시작일
            <input
              type="date"
              aria-label="시작일"
              value={form.startDate ?? ""}
              onChange={(e) => update("startDate", e.target.value || null)}
            />
          </label>
          <label>
            종료일 (마감일)
            <input
              type="date"
              aria-label="마감일"
              value={form.due ?? ""}
              onChange={(e) => update("due", e.target.value || null)}
            />
          </label>
          <label>
            우선순위
            <select
              value={form.priority}
              onChange={(e) =>
                update("priority", e.target.value as Fields["priority"])
              }
            >
              <option value="high">높음</option>
              <option value="normal">보통</option>
              <option value="low">낮음</option>
            </select>
          </label>
          <label>
            카테고리
            <select
              value={form.categoryId ?? ""}
              onChange={(e) => update("categoryId", e.target.value || null)}
            >
              <option value="">미분류</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            반복 주기
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency | "")}
            >
              <option value="">반복 안 함</option>
              {Object.entries(frequencyLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="hint">
          시작일과 종료일을 입력하면 기간 일정으로 표시됩니다. 종료일만 입력하면
          하루 일정입니다. 반복 일정은 완료 시 다음 회차를 생성합니다.
        </p>
        <label>
          상세 메모
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={4}
            placeholder="기억해 둘 내용을 적어 주세요."
          />
        </label>
        {original?.groupId && (
          <p className="hint">
            수정 내용은 현재 및 이후 미완료 반복 작업에 반영됩니다. 반복 안 함을
            선택하면 추가 생성이 중단됩니다. 완료된 기록은 유지됩니다.
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={close} disabled={busy}>
            취소
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
