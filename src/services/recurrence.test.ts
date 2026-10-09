import { describe, expect, it } from "vitest";
import { nextOccurrence } from "./recurrence";
describe("원래 기준일을 유지하는 반복 계산", () => {
  it.each([
    ["2026-10-01", "daily", "2026-10-05", "2026-10-06"],
    ["2026-10-01", "weekly", "2026-10-10", "2026-10-15"],
    ["2026-01-31", "monthly", "2026-01-31", "2026-02-28"],
    ["2026-01-31", "monthly", "2026-02-28", "2026-03-31"],
    ["2028-01-31", "monthly", "2028-01-31", "2028-02-29"],
    ["2026-01-30", "monthly", "2026-02-28", "2026-03-30"],
    ["2026-01-31", "monthly", "2026-05-01", "2026-05-31"],
    ["2026-10-10", "daily", "2026-10-01", "2026-10-11"],
    ["2026-12-31", "daily", "2026-12-31", "2027-01-01"],
  ] as const)("%s %s / 완료 %s → %s", (anchor, freq, completed, expected) =>
    expect(nextOccurrence(anchor, freq, completed)).toBe(expected),
  );
  it("미래 발생 건 조기 완료 시 같은 날짜를 중복 생성하지 않는다", () =>
    expect(
      nextOccurrence("2026-01-01", "weekly", "2026-01-02", "2026-01-15"),
    ).toBe("2026-01-22"));
  it("잘못된 날짜를 거부한다", () =>
    expect(() =>
      nextOccurrence("2026-02-30", "monthly", "2026-03-01"),
    ).toThrow());
});
