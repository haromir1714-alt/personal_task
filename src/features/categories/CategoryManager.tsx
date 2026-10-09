import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { Category } from "../../types";
import { tasks } from "../../services/tasks";
export function CategoryManager({
  categories,
  run,
}: {
  categories: Category[];
  run: (op: () => Promise<void>) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [editing, setEditing] = useState<Category>();
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel" id="categories">
      <div className="section-head">
        <h2>카테고리 관리</h2>
        <span className="hint">{categories.length}개</span>
      </div>
      <p className="hint">
        원하는 카테고리를 자유롭게 추가하거나 이름·색상을 변경하세요. 삭제한
        카테고리의 할 일은 미분류로 남습니다.
      </p>
      <div className="category-list">
        {categories.map((c) => (
          <div key={c.id}>
            <span>
              <i style={{ background: c.color }} />
              {c.name}
            </span>
            <div className="button-group">
              <button
                aria-label={`${c.name} 카테고리 수정`}
                onClick={() => {
                  setEditing(c);
                  setName(c.name);
                  setColor(c.color);
                }}
              >
                <Pencil size={15} /> 수정
              </button>
              <button
                className="danger"
                aria-label={`${c.name} 카테고리 삭제`}
                onClick={() => {
                  if (
                    window.confirm(
                      "카테고리를 삭제할까요? 할 일은 미분류로 보존됩니다.",
                    )
                  )
                    run(() => tasks.removeCategory(c));
                }}
              >
                <Trash2 size={15} /> 삭제
              </button>
            </div>
          </div>
        ))}
      </div>
      <h3 className="category-editor-heading">
        {editing ? `${editing.name} 수정` : "새 카테고리 추가"}
      </h3>
      <form
        className="category-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          run(async () => {
            try {
              await tasks.saveCategory(name, color, editing);
              setName("");
              setEditing(undefined);
            } finally {
              setBusy(false);
            }
          });
        }}
      >
        <label>
          카테고리 이름
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </label>
        <label>
          색상
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          <Plus size={16} />
          {editing ? "변경 저장" : "추가"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setName("");
            }}
          >
            취소
          </button>
        )}
      </form>
    </section>
  );
}
