import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/svelte";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import EditAccount from "./EditAccount.svelte";

const mockInvoke = vi.mocked(invoke);

const testAccount = {
  id: "acc-1",
  issuer: "GitHub",
  label: "user@example.com",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  icon: null as string | null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("EditAccount", () => {
  it("renders with account values pre-filled", () => {
    render(EditAccount, {
      props: { account: testAccount, onclose: vi.fn(), onsuccess: vi.fn() },
    });

    const issuerInput = screen.getByLabelText(/^service$/i) as HTMLInputElement;
    const labelInput = screen.getByLabelText(/^account$/i) as HTMLInputElement;

    expect(issuerInput.value).toBe("GitHub");
    expect(labelInput.value).toBe("user@example.com");
  });

  it("calls edit_account on save", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const onsuccess = vi.fn();
    render(EditAccount, {
      props: { account: testAccount, onclose: vi.fn(), onsuccess },
    });

    const issuerInput = screen.getByLabelText(/^service$/i);
    await fireEvent.input(issuerInput, { target: { value: "GitLab" } });
    await fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("edit_account", {
        id: "acc-1",
        issuer: "GitLab",
        label: "user@example.com",
      });
    });
  });

  it("calls onsuccess after successful save", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const onsuccess = vi.fn();
    render(EditAccount, {
      props: { account: testAccount, onclose: vi.fn(), onsuccess },
    });

    await fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(onsuccess).toHaveBeenCalled();
    });
  });

  it("shows error on save failure", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Update failed"));

    render(EditAccount, {
      props: { account: testAccount, onclose: vi.fn(), onsuccess: vi.fn() },
    });

    await fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText(/Update failed/)).toBeTruthy();
    });
  });

  it("trims whitespace from fields", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    render(EditAccount, {
      props: { account: testAccount, onclose: vi.fn(), onsuccess: vi.fn() },
    });

    const issuerInput = screen.getByLabelText(/^service$/i);
    const labelInput = screen.getByLabelText(/^account$/i);
    await fireEvent.input(issuerInput, { target: { value: "  Trimmed  " } });
    await fireEvent.input(labelInput, { target: { value: "  user  " } });
    await fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("edit_account", {
        id: "acc-1",
        issuer: "Trimmed",
        label: "user",
      });
    });
  });

  it("fires onclose on cancel", async () => {
    const onclose = vi.fn();
    render(EditAccount, {
      props: { account: testAccount, onclose, onsuccess: vi.fn() },
    });

    await fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => expect(onclose).toHaveBeenCalled(), { timeout: 500 });
  });
});
