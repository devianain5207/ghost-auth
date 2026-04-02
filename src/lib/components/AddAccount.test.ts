import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/svelte";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { scan } from "@tauri-apps/plugin-barcode-scanner";
import { decodeQrFromImageFile } from "$lib/utils/qrImage";
import AddAccount from "./AddAccount.svelte";

const mockInvoke = vi.mocked(invoke);
const mockScan = vi.mocked(scan);
const mockDecodeQrFromImageFile = vi.mocked(decodeQrFromImageFile);

vi.mock("$lib/utils/qrImage", () => ({
  decodeQrFromImageFile: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AddAccount", () => {
  it("renders choose mode with the expected options", () => {
    render(AddAccount, {
      props: { onclose: vi.fn(), onsuccess: vi.fn(), onmigration: vi.fn(), onimportexternal: vi.fn() },
    });
    expect(screen.getByRole("button", { name: /scan qr code/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /manual entry/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /paste uri/i })).toBeTruthy();
  });

  it("navigates to manual entry mode", async () => {
    render(AddAccount, {
      props: { onclose: vi.fn(), onsuccess: vi.fn(), onmigration: vi.fn(), onimportexternal: vi.fn() },
    });

    await fireEvent.click(screen.getByRole("button", { name: /manual entry/i }));

    expect(screen.getByLabelText(/service/i)).toBeTruthy();
    expect(screen.getByLabelText(/^account$/i)).toBeTruthy();
    expect(screen.getByLabelText(/secret key/i)).toBeTruthy();
  });

  it("rejects empty secret in manual entry", async () => {
    render(AddAccount, {
      props: { onclose: vi.fn(), onsuccess: vi.fn(), onmigration: vi.fn(), onimportexternal: vi.fn() },
    });

    await fireEvent.click(screen.getByRole("button", { name: /manual entry/i }));
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText(/secret key is required/i)).toBeTruthy();
    });
  });

  it("calls onsuccess on successful manual entry", async () => {
    const onsuccess = vi.fn();
    mockInvoke.mockResolvedValueOnce({
      id: "1",
      issuer: "GitHub",
      label: "user",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      icon: null,
    });

    render(AddAccount, {
      props: { onclose: vi.fn(), onsuccess, onmigration: vi.fn(), onimportexternal: vi.fn() },
    });

    await fireEvent.click(screen.getByRole("button", { name: /manual entry/i }));

    const secretInput = screen.getByLabelText(/secret key/i);
    await fireEvent.input(secretInput, {
      target: { value: "JBSWY3DPEHPK3PXP" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onsuccess).toHaveBeenCalled());
  });

  it("shows backend error on manual entry failure", async () => {
    mockInvoke.mockRejectedValueOnce("Invalid account secret");

    render(AddAccount, {
      props: { onclose: vi.fn(), onsuccess: vi.fn(), onmigration: vi.fn(), onimportexternal: vi.fn() },
    });

    await fireEvent.click(screen.getByRole("button", { name: /manual entry/i }));

    const secretInput = screen.getByLabelText(/secret key/i);
    await fireEvent.input(secretInput, { target: { value: "BADSECRET" } });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid account secret/)).toBeTruthy();
    });
  });

  it("navigates to URI mode and rejects empty URI", async () => {
    render(AddAccount, {
      props: { onclose: vi.fn(), onsuccess: vi.fn(), onmigration: vi.fn(), onimportexternal: vi.fn() },
    });

    await fireEvent.click(screen.getByRole("button", { name: /paste uri/i }));
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText(/uri is required/i)).toBeTruthy();
    });
  });

  it("submits URI successfully", async () => {
    const onsuccess = vi.fn();
    mockInvoke.mockResolvedValueOnce({
      id: "1",
      issuer: "GitHub",
      label: "user",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      icon: null,
    });

    render(AddAccount, {
      props: { onclose: vi.fn(), onsuccess, onmigration: vi.fn(), onimportexternal: vi.fn() },
    });

    await fireEvent.click(screen.getByRole("button", { name: /paste uri/i }));

    const textarea = screen.getByPlaceholderText(/otpauth:\/\//);
    await fireEvent.input(textarea, {
      target: { value: "otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onsuccess).toHaveBeenCalled());
  });

  it("shows web scanner fallback on desktop", async () => {
    mockScan.mockRejectedValueOnce(new Error("not implemented"));

    render(AddAccount, {
      props: { onclose: vi.fn(), onsuccess: vi.fn(), onmigration: vi.fn(), onimportexternal: vi.fn() },
    });

    await fireEvent.click(screen.getByRole("button", { name: /scan qr code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Close camera")).toBeTruthy();
    });
  });

  it("imports from uploaded QR screenshot", async () => {
    const onsuccess = vi.fn();
    mockScan.mockReturnValueOnce(new Promise(() => {}));
    mockDecodeQrFromImageFile.mockResolvedValueOnce("otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP");
    mockInvoke.mockResolvedValueOnce({
      id: "1",
      issuer: "GitHub",
      label: "user",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      icon: null,
    });

    const { container } = render(AddAccount, {
      props: { onclose: vi.fn(), onsuccess, onmigration: vi.fn(), onimportexternal: vi.fn() },
    });

    await fireEvent.click(screen.getByRole("button", { name: /scan qr code/i }));

    const input = container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(["qr"], "qr.png", { type: "image/png" });
    await fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockDecodeQrFromImageFile).toHaveBeenCalled();
      expect(onsuccess).toHaveBeenCalled();
    });
  });

  it("shows camera permission error", async () => {
    mockScan.mockRejectedValueOnce(new Error("camera permission denied"));

    render(AddAccount, {
      props: { onclose: vi.fn(), onsuccess: vi.fn(), onmigration: vi.fn(), onimportexternal: vi.fn() },
    });

    await fireEvent.click(screen.getByRole("button", { name: /scan qr code/i }));

    await waitFor(() => {
      expect(screen.getByText(/camera permission denied/i)).toBeTruthy();
    });
  });

  it("fires onclose on close button click", async () => {
    const onclose = vi.fn();
    render(AddAccount, {
      props: { onclose, onsuccess: vi.fn(), onmigration: vi.fn(), onimportexternal: vi.fn() },
    });

    const closeBtn = screen.getByLabelText("Close");
    await fireEvent.click(closeBtn);

    // Close uses setTimeout(onclose, 250)
    await waitFor(() => expect(onclose).toHaveBeenCalled(), { timeout: 500 });
  });

  it("back button in manual mode returns to choose mode", async () => {
    render(AddAccount, {
      props: { onclose: vi.fn(), onsuccess: vi.fn(), onmigration: vi.fn(), onimportexternal: vi.fn() },
    });

    await fireEvent.click(screen.getByRole("button", { name: /manual entry/i }));
    expect(screen.getByLabelText(/secret key/i)).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Back" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /scan qr code/i })).toBeTruthy();
    });
  });
});
