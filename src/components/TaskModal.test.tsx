import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TaskModal } from "./TaskModal";
import { tasks } from "../services/tasks";
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
});
describe("할 일 모달", () => {
  it("공백 제목을 저장하지 않고 오류와 입력을 유지한다", async () => {
    const close = vi.fn();
    render(<TaskModal categories={[]} groups={[]} onClose={close} />);
    await userEvent.type(screen.getByLabelText("제목"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("제목");
    expect(close).not.toHaveBeenCalled();
  });
  it("변경된 입력을 닫기 전에 확인하고 취소 시 유지한다", async () => {
    const close = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TaskModal categories={[]} groups={[]} onClose={close} />);
    await userEvent.type(screen.getByLabelText("제목"), "수정 중");
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(confirm).toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
  it("Escape 경로에서도 변경 확인을 수행한다", async () => {
    const close = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TaskModal categories={[]} groups={[]} onClose={close} />);
    await userEvent.type(screen.getByLabelText("제목"), "변경");
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true }),
    );
    expect(close).toHaveBeenCalled();
    confirm.mockRestore();
  });
  it("DB 저장 실패 시 모달을 닫지 않고 입력을 보존한다", async () => {
    const save = vi
      .spyOn(tasks, "save")
      .mockRejectedValueOnce(new Error("저장 실패"));
    const close = vi.fn();
    render(<TaskModal categories={[]} groups={[]} onClose={close} />);
    await userEvent.type(screen.getByLabelText("제목"), "보존할 입력");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("저장 실패"),
    );
    expect(screen.getByLabelText("제목")).toHaveValue("보존할 입력");
    expect(close).not.toHaveBeenCalled();
    save.mockRestore();
  });
});
