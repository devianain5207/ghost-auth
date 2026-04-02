import type { Page } from "@playwright/test";

/**
 * Mock the Tauri invoke API in the browser context.
 * Mocks are keyed by command name and return the specified value.
 */
export async function mockTauriInvoke(
  page: Page,
  mocks: Record<string, unknown>,
) {
  await page.addInitScript((mocksArg) => {
    localStorage.setItem("ghost-auth-locale", "en");
    localStorage.setItem("ghost-auth-theme", "light");
    let unlocked = false;

    (window as Record<string, unknown>).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: unknown) => {
        if (cmd in mocksArg) {
          const val = (mocksArg as Record<string, unknown>)[cmd];
          if (cmd === "unlock_with_pin" && val === true) {
            unlocked = true;
          }
          if (cmd === "unlock_with_recovery_code" && val === true) {
            unlocked = true;
          }

          if (
            cmd === "auth_status" &&
            val !== null &&
            typeof val === "object" &&
            "pin_enabled" in (val as Record<string, unknown>) &&
            "unlocked" in (val as Record<string, unknown>)
          ) {
            const status = val as Record<string, unknown>;
            return {
              pin_enabled: Boolean(status.pin_enabled),
              unlocked: Boolean(status.unlocked) || unlocked,
              last_unlock_epoch:
                (status.last_unlock_epoch as number | null | undefined) ?? null,
            };
          }

          if (
            val !== null &&
            typeof val === "object" &&
            "error" in (val as Record<string, unknown>)
          ) {
            throw (val as Record<string, unknown>).error;
          }
          return val;
        }

        // Keep test fixtures small: derive auth_status from has_pin when omitted.
        if (cmd === "auth_status") {
          const hasPin = Boolean((mocksArg as Record<string, unknown>).has_pin);
          return {
            pin_enabled: hasPin,
            unlocked: !hasPin || unlocked,
            last_unlock_epoch: null,
          };
        }
        if (cmd === "has_recovery_codes") return false;
        if (cmd === "save_theme") return null;
        if (cmd === "lock_vault") return null;

        console.warn(`Unmocked Tauri command: ${cmd}`, args);
        return null;
      },
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
    };
  }, mocks);
}
