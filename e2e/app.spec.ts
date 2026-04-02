import { test, expect, type Page } from "@playwright/test";
import { mockTauriInvoke } from "./helpers";

let firstNavigation = true;

async function gotoApp(page: Page) {
  const timeout = firstNavigation ? 300000 : 120000;
  firstNavigation = false;

  await page.goto("/", { waitUntil: "commit", timeout });
  await expect
    .poll(
      async () => {
        const addAccount = await page
          .getByRole("button", { name: "Add account" })
          .isVisible()
          .catch(() => false);
        const settings = await page
          .getByRole("button", { name: "Settings" })
          .isVisible()
          .catch(() => false);
        const unlockOk = await page
          .getByRole("button", { name: "OK" })
          .isVisible()
          .catch(() => false);
        return addAccount || settings || unlockOk;
      },
      { timeout },
    )
    .toBe(true);
}

async function enterPinWithNumpad(page: Page, pin: string) {
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
}

async function submitPinWithNumpad(page: Page, pin: string) {
  await enterPinWithNumpad(page, pin);
  await page.getByRole("button", { name: "OK", exact: true }).click();
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Settings", { exact: true })).toBeVisible();
}

test.describe("Ghost Auth E2E", () => {
  test("app loads without PIN and shows empty state", async ({ page }) => {
    test.slow();

    await mockTauriInvoke(page, {
      auth_status: { pin_enabled: false, unlocked: true, last_unlock_epoch: null },
      get_accounts: [],
      generate_all_codes: [],
    });

    await gotoApp(page);

    await expect(page.getByText("Ghost auth", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add account" })).toBeVisible();
    await expect(page.getByText("> No accounts found", { exact: true })).toBeVisible();
  });

  test("add account via manual entry", async ({ page }) => {
    await mockTauriInvoke(page, {
      auth_status: { pin_enabled: false, unlocked: true, last_unlock_epoch: null },
      get_accounts: [],
      generate_all_codes: [],
      add_account_manual: {
        id: "1",
        issuer: "GitHub",
        label: "user@test.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        icon: null,
      },
    });

    await gotoApp(page);
    await page.getByRole("button", { name: "Add account" }).click();
    await page.getByRole("button", { name: "Manual entry" }).click();

    await page.fill("#issuer", "GitHub");
    await page.fill("#label", "user@test.com");
    await page.fill("#secret", "JBSWY3DPEHPK3PXP");

    await page.evaluate(() => {
      const internals = (window as Record<string, unknown>).__TAURI_INTERNALS__ as Record<
        string,
        unknown
      >;
      const originalInvoke = internals.invoke as Function;
      internals.invoke = async (cmd: string, args?: unknown) => {
        if (cmd === "get_accounts") {
          return [
            {
              id: "1",
              issuer: "GitHub",
              label: "user@test.com",
              algorithm: "SHA1",
              digits: 6,
              period: 30,
              icon: null,
            },
          ];
        }
        if (cmd === "generate_all_codes") {
          return [{ id: "1", code: "123456", remaining: 15 }];
        }
        return originalInvoke(cmd, args);
      };
    });

    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("GitHub", { exact: true })).toBeVisible();
  });

  test("PIN lock screen blocks access", async ({ page }) => {
    await mockTauriInvoke(page, {
      auth_status: { pin_enabled: true, unlocked: false, last_unlock_epoch: null },
      unlock_with_pin: true,
      has_recovery_codes: false,
      get_accounts: [],
      generate_all_codes: [],
    });

    await gotoApp(page);
    await expect(page.getByRole("button", { name: "OK" })).toBeVisible();

    await submitPinWithNumpad(page, "1234");

    await expect(page.getByText("Ghost auth", { exact: true })).toBeVisible({
      timeout: 5000,
    });
  });

  test("settings panel opens and shows security actions", async ({ page }) => {
    await mockTauriInvoke(page, {
      auth_status: { pin_enabled: false, unlocked: true, last_unlock_epoch: null },
      get_accounts: [],
      generate_all_codes: [],
    });

    await gotoApp(page);
    await openSettings(page);

    await expect(page.getByText("PIN lock", { exact: true })).toBeVisible();
    await expect(page.getByText("Export backup", { exact: true })).toBeVisible();
    await expect(page.getByText("Import backup", { exact: true })).toBeVisible();
  });

  test("wrong PIN shows error message", async ({ page }) => {
    await mockTauriInvoke(page, {
      auth_status: { pin_enabled: true, unlocked: false, last_unlock_epoch: null },
      unlock_with_pin: false,
      has_recovery_codes: false,
      get_accounts: [],
      generate_all_codes: [],
    });

    await gotoApp(page);

    await submitPinWithNumpad(page, "1234");

    await expect(page.getByText("Incorrect PIN", { exact: true })).toBeVisible({
      timeout: 5000,
    });
  });

  test("rate limiting shows lockout message", async ({ page }) => {
    await mockTauriInvoke(page, {
      auth_status: { pin_enabled: true, unlocked: false, last_unlock_epoch: null },
      unlock_with_pin: { error: "Too many attempts. Try again in 30 seconds." },
      has_recovery_codes: false,
      get_accounts: [],
      generate_all_codes: [],
    });

    await gotoApp(page);

    await submitPinWithNumpad(page, "1234");

    await expect(page.getByText(/too many attempts/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("multiple accounts display with codes", async ({ page }) => {
    const accounts = [
      {
        id: "1",
        issuer: "GitHub",
        label: "user@github.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        icon: null,
      },
      {
        id: "2",
        issuer: "Google",
        label: "user@gmail.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        icon: null,
      },
      {
        id: "3",
        issuer: "AWS",
        label: "admin@aws.com",
        algorithm: "SHA256",
        digits: 8,
        period: 30,
        icon: null,
      },
    ];

    await mockTauriInvoke(page, {
      auth_status: { pin_enabled: false, unlocked: true, last_unlock_epoch: null },
      get_accounts: accounts,
      generate_all_codes: [
        { id: "1", code: "123456", remaining: 15 },
        { id: "2", code: "654321", remaining: 20 },
        { id: "3", code: "98765432", remaining: 10 },
      ],
    });

    await gotoApp(page);

    await expect(page.getByText("GitHub", { exact: true })).toBeVisible();
    await expect(page.getByText("Google", { exact: true })).toBeVisible();
    await expect(page.getByText("AWS", { exact: true })).toBeVisible();

    await expect(page.getByText("123456", { exact: true })).toBeVisible();
    await expect(page.getByText("654321", { exact: true })).toBeVisible();
    await expect(page.getByText("98765432", { exact: true })).toBeVisible();
  });

  test("search filters accounts by issuer", async ({ page }) => {
    const accounts = [
      {
        id: "1",
        issuer: "GitHub",
        label: "user@github.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        icon: null,
      },
      {
        id: "2",
        issuer: "Google",
        label: "user@gmail.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        icon: null,
      },
      {
        id: "3",
        issuer: "AWS",
        label: "admin@aws.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        icon: null,
      },
      {
        id: "4",
        issuer: "Dropbox",
        label: "user@dropbox.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        icon: null,
      },
    ];

    await mockTauriInvoke(page, {
      auth_status: { pin_enabled: false, unlocked: true, last_unlock_epoch: null },
      get_accounts: accounts,
      generate_all_codes: [
        { id: "1", code: "123456", remaining: 15 },
        { id: "2", code: "654321", remaining: 20 },
        { id: "3", code: "111111", remaining: 25 },
        { id: "4", code: "222222", remaining: 12 },
      ],
    });

    await gotoApp(page);

    await expect(page.getByText("GitHub", { exact: true })).toBeVisible();
    await expect(page.getByText("Google", { exact: true })).toBeVisible();

    await page.fill('input[placeholder="> Search..."]', "git");

    await expect(page.getByText("GitHub", { exact: true })).toBeVisible();
    await expect(page.getByText("Google", { exact: true })).toBeHidden();
  });

  test("search shows no matches message", async ({ page }) => {
    const accounts = [
      {
        id: "1",
        issuer: "GitHub",
        label: "user@github.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        icon: null,
      },
      {
        id: "2",
        issuer: "Google",
        label: "user@gmail.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        icon: null,
      },
      {
        id: "3",
        issuer: "AWS",
        label: "admin@aws.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        icon: null,
      },
      {
        id: "4",
        issuer: "Dropbox",
        label: "user@dropbox.com",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        icon: null,
      },
    ];

    await mockTauriInvoke(page, {
      auth_status: { pin_enabled: false, unlocked: true, last_unlock_epoch: null },
      get_accounts: accounts,
      generate_all_codes: [
        { id: "1", code: "123456", remaining: 15 },
        { id: "2", code: "654321", remaining: 20 },
        { id: "3", code: "111111", remaining: 25 },
        { id: "4", code: "222222", remaining: 12 },
      ],
    });

    await gotoApp(page);
    await page.fill('input[placeholder="> Search..."]', "zzzzz");

    await expect(page.getByText('> No matches for "zzzzz"', { exact: true })).toBeVisible();
  });

  test("PIN setup flow: enter, confirm, recovery, done", async ({ page }) => {
    await mockTauriInvoke(page, {
      auth_status: { pin_enabled: false, unlocked: true, last_unlock_epoch: null },
      get_accounts: [],
      generate_all_codes: [],
      set_pin: [
        "AAAA-BBBB",
        "CCCC-DDDD",
        "EEEE-FFFF",
        "GGGG-HHHH",
        "IIII-JJJJ",
        "KKKK-LLLL",
        "MMMM-NNNN",
        "OOOO-PPPP",
      ],
    });

    await gotoApp(page);

    await openSettings(page);
    await page.getByRole("switch", { name: "Toggle PIN lock" }).click();

    await expect(page.getByText("Choose a PIN", { exact: true })).toBeVisible();
    await submitPinWithNumpad(page, "1234");

    await expect(page.getByText("Confirm PIN", { exact: true })).toBeVisible();
    await submitPinWithNumpad(page, "1234");

    await expect(page.getByText("Recovery codes", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "I've saved these" }).click();

    await expect(page.getByText("Ghost auth", { exact: true })).toBeVisible({
      timeout: 5000,
    });
  });

  test("PIN setup rejects mismatched confirmation", async ({ page }) => {
    await mockTauriInvoke(page, {
      auth_status: { pin_enabled: false, unlocked: true, last_unlock_epoch: null },
      get_accounts: [],
      generate_all_codes: [],
      set_pin: [],
    });

    await gotoApp(page);

    await openSettings(page);
    await page.getByRole("switch", { name: "Toggle PIN lock" }).click();

    await submitPinWithNumpad(page, "1234");

    await submitPinWithNumpad(page, "5678");

    await expect(page.getByText("PINs don't match", { exact: true })).toBeVisible({
      timeout: 5000,
    });
  });
});
