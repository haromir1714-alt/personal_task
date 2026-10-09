import { CategoryManager } from "../categories/CategoryManager";
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { Category, Group, Theme } from "../../types";
import { tasks } from "../../services/tasks";
import {
  exportBackup,
  restoreBackup,
  validateBackup,
} from "../../services/backup";
import { localDay } from "../../utils/dates";
export function Settings({
  categories,
  groups,
  theme,
  setTheme,
  run,
}: {
  categories: Category[];
  groups: Group[];
  theme: Theme;
  setTheme: (theme: Theme) => void;
  run: (op: () => Promise<void>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <section className="panel">
        <div className="section-head">
          <h2>화면 설정</h2>
        </div>
        <p className="hint">
          편안한 화면으로 나만의 작업 공간을 만들어 보세요.
        </p>
        <label className="setting-line">
          테마
          <select
            aria-label="테마"
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            <option value="system">시스템 설정</option>
            <option value="light">라이트 모드</option>
            <option value="dark">다크 모드</option>
          </select>
        </label>
      </section>
      <CategoryManager categories={categories} run={run} />
      <section className="panel">
        <div className="section-head">
          <h2>반복 일정 관리</h2>
        </div>
        <p className="hint">
          발생 건을 삭제해도 반복 설정은 유지됩니다. 여기서 반복을 종료할 수
          있습니다.
        </p>
        <div className="category-list">
          {groups
            .filter((g) => g.active)
            .map((g) => (
              <div key={g.id}>
                <span>
                  {g.fields.title} ·{" "}
                  {
                    { daily: "매일", weekly: "매주", monthly: "매월" }[
                      g.frequency
                    ]
                  }
                </span>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "반복을 종료할까요? 기존 할 일과 완료 기록은 유지됩니다.",
                      )
                    )
                      run(() => tasks.stopGroup(g.id, g.revision));
                  }}
                >
                  반복 종료
                </button>
              </div>
            ))}
        </div>
        {!groups.some((g) => g.active) && (
          <p className="hint">진행 중인 반복 일정이 없습니다.</p>
        )}
      </section>
      <section className="panel">
        <div className="section-head">
          <h2>데이터 백업 및 복원</h2>
        </div>
        <p>
          데이터는 이 브라우저에만 저장됩니다. 브라우저 저장 데이터를 삭제하거나
          프로필을 바꾸면 복구할 수 없을 수 있습니다. 중요한 기록은 JSON 파일로
          직접 백업해 주세요.
        </p>
        <p className="hint">
          복원은 기존 데이터를 모두 교체합니다. 다른 탭의 저장되지 않은 입력을
          먼저 확인해 주세요.
        </p>
        <div className="button-group backup-buttons">
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              run(async () => {
                try {
                  const backup = await exportBackup();
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(backup, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `personal-task-${localDay()}.json`;
                  document.body.append(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } finally {
                  setBusy(false);
                }
              });
            }}
          >
            <Download size={17} />
            JSON 백업
          </button>
          <button disabled={busy} onClick={() => input.current?.click()}>
            <Upload size={17} />
            JSON 복원
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept=".json,application/json"
            aria-label="백업 파일 선택"
            className="file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              run(async () => {
                try {
                  if (file.size > 50 * 1024 * 1024)
                    throw new Error("50MB 이하의 백업 파일을 선택해 주세요.");
                  const backup = validateBackup(await file.text());
                  if (
                    window.confirm(
                      `${backup.tasks.length}개의 할 일로 기존 데이터를 모두 교체할까요?`,
                    )
                  )
                    await restoreBackup(backup);
                } finally {
                  setBusy(false);
                }
              });
            }}
          />
        </div>
      </section>
    </>
  );
}
