import { test, expect, type Page } from "@playwright/test";
async function add(page: Page, title: string, due?: string, repeat?: string) {
  await page
    .getByRole("button", { name: "할 일 추가", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("제목", { exact: false }).fill(title);
  if (due) await dialog.getByLabel("마감일", { exact: true }).fill(due);
  if (repeat) await dialog.getByLabel("반복 주기").selectOption(repeat);
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function allTasks(page: Page) {
  await page.getByRole("link", { name: "전체 할 일", exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-09T03:00:00Z"));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "대시보드", exact: true }),
  ).toBeVisible();
});
test("6화면 라우팅, 할 일 CRUD, 완료 및 새로고침 저장", async ({ page }) => {
  await add(page, "영어 공부");
  await allTasks(page);
  await expect(
    page.getByRole("button", { name: "영어 공부 수정" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "영어 공부 수정" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("제목", { exact: false })
    .fill("영어 읽기");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "영어 읽기 완료" }).click();
  await expect(
    page.getByRole("checkbox", { name: "영어 읽기 완료" }),
  ).toBeChecked();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "전체 할 일", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "영어 읽기 완료" }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: "영어 읽기 완료" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "영어 읽기 삭제" }).click();
  await expect(
    page.getByRole("button", { name: "영어 읽기 수정" }),
  ).toHaveCount(0);
  for (const name of [
    "오늘의 할 일",
    "월간 캘린더",
    "통계",
    "설정",
    "대시보드",
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
});
test("공백 제목, 반복 날짜 필수, 변경된 모달 Escape 및 포커스", async ({
  page,
}) => {
  const opener = page
    .getByRole("button", { name: "할 일 추가", exact: true })
    .first();
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("제목", { exact: false })).toBeFocused();
  await dialog.getByLabel("제목", { exact: false }).fill("  ");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("제목");
  await dialog.getByLabel("제목", { exact: false }).fill("반복 테스트");
  await dialog.getByLabel("반복 주기").selectOption("daily");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("마감일");
  page.once("dialog", (d) => d.dismiss());
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});
test("카테고리 CRUD와 삭제 후 작업 보존", async ({ page }) => {
  await page.getByRole("link", { name: "설정", exact: true }).click();
  await page.getByLabel("카테고리 이름").fill("운동");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "운동 카테고리 수정" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "운동 카테고리 수정" }).click();
  await page.getByLabel("카테고리 이름").fill("건강");
  await page.getByRole("button", { name: "변경 저장" }).click();
  await expect(
    page.getByRole("button", { name: "건강 카테고리 수정" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "할 일 추가", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("제목", { exact: false }).fill("걷기");
  await dialog
    .getByRole("combobox", { name: "카테고리", exact: true })
    .selectOption({ label: "건강" });
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "건강 카테고리 삭제" }).click();
  await allTasks(page);
  await expect(page.getByRole("button", { name: "걷기 수정" })).toBeVisible();
  await expect(
    page.locator(".task-meta").getByText("미분류", { exact: true }).first(),
  ).toBeVisible();
});
test("검색·필터·날짜·우선순위 정렬", async ({ page }) => {
  await add(page, "A 학습", "2026-10-09");
  await add(page, "B 운동", "2026-10-10");
  await add(page, "C 자유");
  await allTasks(page);
  await page.getByLabel("할 일 검색").fill("학습");
  await expect(page.getByRole("button", { name: "A 학습 수정" })).toBeVisible();
  await expect(page.getByRole("button", { name: "B 운동 수정" })).toHaveCount(
    0,
  );
  await page.getByLabel("할 일 검색").fill("");
  await page.getByLabel("시작일", { exact: true }).fill("2026-10-10");
  await expect(page.getByRole("button", { name: "A 학습 수정" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: "B 운동 수정" })).toBeVisible();
  await page.getByRole("button", { name: "필터 초기화" }).click();
  await page.getByLabel("마감일 미지정").click();
  await expect(page.getByRole("button", { name: "C 자유 수정" })).toBeVisible();
  await expect(page.getByRole("button", { name: "B 운동 수정" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "필터 초기화" }).click();
  await page.getByLabel("정렬", { exact: true }).selectOption("due-desc");
  await expect(page.locator(".task-body strong")).toHaveText([
    "B 운동",
    "A 학습",
    "C 자유",
  ]);
});
test("사용자 순서 대체 조작과 드래그 저장, 필터 제한", async ({ page }) => {
  await add(page, "첫 번째");
  await add(page, "두 번째");
  await allTasks(page);
  await page.getByLabel("정렬", { exact: true }).selectOption("custom");
  await page.getByRole("button", { name: "두 번째 위로" }).click();
  await expect(page.locator(".task-body strong")).toHaveText([
    "두 번째",
    "첫 번째",
  ]);
  await page.reload();
  await page.getByLabel("정렬", { exact: true }).selectOption("custom");
  await expect(page.locator(".task-body strong")).toHaveText([
    "두 번째",
    "첫 번째",
  ]);
  const handle = page.getByRole("button", { name: "두 번째 순서 이동" });
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("status")).toContainText("2번째 위치");
  await page.keyboard.press("Space");
  await expect(page.locator(".task-body strong")).toHaveText([
    "첫 번째",
    "두 번째",
  ]);
  await page.reload();
  await page.getByLabel("정렬", { exact: true }).selectOption("custom");
  await expect(page.locator(".task-body strong")).toHaveText([
    "첫 번째",
    "두 번째",
  ]);
  await page.getByLabel("할 일 검색").fill("첫");
  await expect(
    page.getByRole("button", { name: "첫 번째 순서 이동" }),
  ).toHaveCount(0);
});
test("달력 날짜 선택과 기본 마감일, 클릭만으로 날짜 변경 없음", async ({
  page,
}) => {
  await add(page, "달력 계획", "2026-10-09");
  await page.getByRole("link", { name: "월간 캘린더", exact: true }).click();
  await page.getByRole("button", { name: "2026-10-15", exact: true }).click();
  await page.getByRole("button", { name: "이 날짜에 추가" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("마감일", { exact: true }),
  ).toHaveValue("2026-10-15");
  await page.getByRole("dialog").getByRole("button", { name: "닫기" }).click();
  await allTasks(page);
  await page.getByRole("button", { name: "달력 계획 수정" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("마감일", { exact: true }),
  ).toHaveValue("2026-10-09");
});
test("오늘과 기한 초과 구분, 완료 통계 갱신", async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await add(page, "오늘 계획", today);
  await add(page, "밀린 계획", "2020-01-01");
  await page.getByRole("link", { name: /^오늘의 할 일/ }).click();
  await expect(page.getByRole("heading", { name: /오늘 일정/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /기한이 지난/ }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "오늘 계획 완료" }).click();
  await page.getByRole("link", { name: "통계", exact: true }).click();
  await expect(page.locator(".stat-summary h3")).toContainText("1");
  await allTasks(page);
  await page.getByRole("checkbox", { name: "오늘 계획 완료" }).click();
  await page.getByRole("link", { name: "통계", exact: true }).click();
  await expect(page.locator(".stat-summary h3")).toContainText("0");
});
test("반복 완료 및 재완료 중복 방지", async ({ page }) => {
  await add(page, "매월 계획", "2026-01-31", "monthly");
  await allTasks(page);
  const check = page.getByRole("checkbox", { name: "매월 계획 완료" });
  await check.first().click();
  await expect(check).toHaveCount(2);

  const checked = page.locator("input[type=checkbox]:checked");
  await checked.click();
  await expect(check).toHaveCount(2);
  await check.first().click();
  await expect(check).toHaveCount(2);
});
test("같은 브라우저 여러 탭 동기화와 편집 충돌", async ({ page, context }) => {
  await add(page, "동시 수정");
  await allTasks(page);
  const other = await context.newPage();
  await other.goto("/#/tasks");
  await expect(
    other.getByRole("button", { name: "동시 수정 수정" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "동시 수정 수정" }).click();
  await other.getByRole("button", { name: "동시 수정 수정" }).click();
  await other
    .getByRole("dialog")
    .getByLabel("제목", { exact: false })
    .fill("최신 제목");
  await other
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("제목", { exact: false })
    .fill("오래된 제목");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "다른 탭",
  );
  await expect(
    page.getByRole("dialog").getByLabel("제목", { exact: false }),
  ).toHaveValue("오래된 제목");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("dialog").getByRole("button", { name: "닫기" }).click();
  await expect(
    page.getByRole("button", { name: "최신 제목 수정" }),
  ).toBeVisible();
});
test("백업 다운로드·복원과 손상 백업 거부", async ({ page }) => {
  await add(page, "보존할 계획", "2026-01-31", "monthly");
  await page.getByRole("link", { name: "설정", exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "JSON 백업" }).click(),
  ]);
  const path = (await download.path())!;
  await add(page, "복원으로 제거할 계획");
  page.once("dialog", (d) => d.accept());
  await page.getByLabel("백업 파일 선택").setInputFiles(path);
  await allTasks(page);
  await expect(
    page.getByRole("button", { name: "보존할 계획 수정" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "복원으로 제거할 계획 수정" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "설정", exact: true }).click();
  await page.getByLabel("백업 파일 선택").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.getByRole("alert")).toContainText("JSON");
  await allTasks(page);
  await expect(
    page.getByRole("button", { name: "보존할 계획 수정" }),
  ).toBeVisible();
});
test("테마 지속, 시스템 변경, 모바일 레이아웃 및 모달", async ({ page }) => {
  await page.getByRole("link", { name: "설정", exact: true }).click();
  await page.getByLabel("테마", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveClass("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.getByLabel("테마", { exact: true }).selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass("dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass("dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("link", { name: "전체 할 일", exact: true }).click();
  await add(page, "모바일 입력");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "모바일 입력 수정" }),
  ).toBeVisible();
});
test("외부 요청 없는 로컬 실행과 안전한 문자열 렌더링", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:5173")) external.push(r.url());
  });
  await page.route("**/*", (route) =>
    route.request().url().startsWith("http://127.0.0.1:5173")
      ? route.continue()
      : route.abort(),
  );
  await page.reload();
  await add(page, "<img src=x onerror=alert(1)>");
  await allTasks(page);
  await expect(
    page.getByRole("button", { name: "<img src=x onerror=alert(1)> 수정" }),
  ).toBeVisible();
  expect(await page.locator(".task-body img").count()).toBe(0);
  expect(external).toEqual([]);
});

test("브라우저 프로세스 종료 및 재실행 후 데이터 보존", async () => {
  const { chromium } = await import("@playwright/test");
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const profile = await mkdtemp(join(tmpdir(), "personal-task-e2e-"));
  let context = await chromium.launchPersistentContext(profile);
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:5173");
    await add(page, "브라우저 재시작 기록");
    await context.close();
    context = await chromium.launchPersistentContext(profile);
    const restored = await context.newPage();
    await restored.goto("http://127.0.0.1:5173/#/tasks");
    await expect(
      restored.getByRole("button", { name: "브라우저 재시작 기록 수정" }),
    ).toBeVisible();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("마우스 드래그 순서 변경과 저장", async ({ page }) => {
  await add(page, "드래그 첫 번째");
  await add(page, "드래그 두 번째");
  await allTasks(page);
  await page.getByLabel("정렬", { exact: true }).selectOption("custom");
  const handle = page.getByRole("button", { name: "드래그 첫 번째 순서 이동" });
  const first = await handle.boundingBox();
  const second = await page
    .getByRole("button", { name: "드래그 두 번째 순서 이동" })
    .boundingBox();
  if (!first || !second) throw new Error("드래그 핸들이 없습니다.");
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    first.x + first.width / 2,
    first.y + first.height / 2 + 12,
  );
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(
    second.x + second.width / 2,
    second.y + second.height / 2,
    { steps: 10 },
  );
  await expect(page.getByRole("status")).toContainText("2번째 위치");
  await page.mouse.up();
  await expect(page.locator(".task-body strong")).toHaveText([
    "드래그 두 번째",
    "드래그 첫 번째",
  ]);
  await page.reload();
  await page.getByLabel("정렬", { exact: true }).selectOption("custom");
  await expect(page.locator(".task-body strong")).toHaveText([
    "드래그 두 번째",
    "드래그 첫 번째",
  ]);
});

test("일반 할 일은 반복 체크해도 복사되지 않고 반복만 다음 회차를 표시한다", async ({
  page,
}) => {
  await add(page, "일반 체크 검사");
  await allTasks(page);
  const check = page.getByRole("checkbox", { name: "일반 체크 검사 완료" });
  await check.click();
  await expect(check).toBeChecked();
  await expect(page.locator(".task-row")).toHaveCount(1);
  await expect(page.getByText("완료됨", { exact: true })).toBeVisible();
  await check.click();
  await expect(check).not.toBeChecked();
  await check.click();
  await expect(check).toBeChecked();
  await expect(page.locator(".task-row")).toHaveCount(1);
  await add(page, "반복 체크 검사", "2026-10-09", "monthly");
  await page
    .getByRole("checkbox", { name: "반복 체크 검사 완료" })
    .first()
    .click();
  await expect(page.locator(".task-row")).toHaveCount(3);
  await expect(page.getByText("매월 · 2회차", { exact: true })).toBeVisible();
  await expect(page.getByText(/완료했습니다. 다음 반복 일정은/)).toBeVisible();
});

test("일정 범위를 저장하고 캘린더·오늘·검색에 반영한다", async ({ page }) => {
  await page
    .getByRole("button", { name: "할 일 추가", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("제목", { exact: true }).fill("기간 프로젝트");
  await dialog.getByLabel("시작일", { exact: true }).fill("2026-10-07");
  await dialog.getByLabel("마감일", { exact: true }).fill("2026-10-12");
  await dialog.getByRole("button", { name: "저장", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("link", { name: "월간 캘린더", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "2026-10-08", exact: true }),
  ).toContainText("기간 프로젝트");
  await page.getByRole("button", { name: "2026-10-08", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "기간 프로젝트 수정" }),
  ).toBeVisible();
  await allTasks(page);
  await page.getByLabel("시작일", { exact: true }).fill("2026-10-08");
  await page.getByLabel("종료일", { exact: true }).fill("2026-10-09");
  await expect(
    page.getByRole("button", { name: "기간 프로젝트 수정" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "기간 프로젝트 수정" }).click();
  await expect(
    page.getByRole("dialog").getByLabel("시작일", { exact: true }),
  ).toHaveValue("2026-10-07");
  await page
    .getByRole("dialog")
    .getByLabel("시작일", { exact: true })
    .fill("2026-10-13");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "시작일",
  );
});

test("전체 목록에서 카테고리 관리로 이동해 이름·색상 변경과 삭제를 한다", async ({
  page,
}) => {
  await allTasks(page);
  await page
    .getByRole("main")
    .getByRole("button", { name: "카테고리 관리", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "카테고리 관리", level: 1 }),
  ).toBeVisible();
  await page.getByLabel("카테고리 이름").fill("자유 분류");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "자유 분류 카테고리 수정" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "자유 분류 카테고리 수정" }).click();
  await page.getByLabel("카테고리 이름").fill("내 분류");
  await page.getByLabel("색상", { exact: true }).fill("#ff0000");
  await page.getByRole("button", { name: "변경 저장" }).click();
  await expect(
    page.locator(".category-list").getByText("내 분류", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".category-list > div")
      .filter({ hasText: "내 분류" })
      .locator("i"),
  ).toHaveCSS("background-color", "rgb(255, 0, 0)");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "내 분류 카테고리 삭제" }).click();
  await expect(
    page.getByRole("button", { name: "내 분류 카테고리 수정" }),
  ).toHaveCount(0);
});
