import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/svelte";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import AccountCard from "./AccountCard.svelte";

const mockWriteText = vi.mocked(writeText);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

const baseAccount = {
  id: "test-id",
  issuer: "GitHub",
  label: "user@example.com",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  icon: null,
};

describe("AccountCard", () => {
  it("displays issuer and label", () => {
    render(AccountCard, {
      props: {
        account: baseAccount,
        code: undefined,
        ondelete: vi.fn(),
        onedit: vi.fn(),
      },
    });

    expect(screen.getByText("GitHub")).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("displays formatted 6-digit code", () => {
    render(AccountCard, {
      props: {
        account: baseAccount,
        code: { id: "test-id", code: "123456", remaining: 15 },
        ondelete: vi.fn(),
        onedit: vi.fn(),
      },
    });

    // Digits are rendered as individual spans for cascade animation
    for (const digit of "123456") {
      expect(screen.getByText(digit)).toBeTruthy();
    }
  });

  it("displays formatted 8-digit code", () => {
    render(AccountCard, {
      props: {
        account: { ...baseAccount, digits: 8 },
        code: { id: "test-id", code: "12345678", remaining: 15 },
        ondelete: vi.fn(),
        onedit: vi.fn(),
      },
    });

    for (const digit of "12345678") {
      expect(screen.getByText(digit)).toBeTruthy();
    }
  });

  it("shows placeholder when no code", () => {
    render(AccountCard, {
      props: {
        account: baseAccount,
        code: undefined,
        ondelete: vi.fn(),
        onedit: vi.fn(),
      },
    });

    expect(screen.getByText("--- ---")).toBeTruthy();
  });

  it("copies code to clipboard on click", async () => {
    mockWriteText.mockResolvedValueOnce(undefined);

    render(AccountCard, {
      props: {
        account: baseAccount,
        code: { id: "test-id", code: "654321", remaining: 20 },
        ondelete: vi.fn(),
        onedit: vi.fn(),
      },
    });

    // Click the code area button (digits are rendered as individual spans)
    const digit = screen.getByText("6");
    await fireEvent.click(digit.closest("button")!);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith("654321");
    });
  });

  it("shows unknown when issuer is empty", () => {
    render(AccountCard, {
      props: {
        account: { ...baseAccount, issuer: "" },
        code: undefined,
        ondelete: vi.fn(),
        onedit: vi.fn(),
      },
    });

    expect(screen.getByText("Unknown")).toBeTruthy();
  });
});
