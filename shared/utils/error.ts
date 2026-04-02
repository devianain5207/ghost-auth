type TranslateFn = (id: string, options?: { values?: Record<string, string | number> }) => string;

const LOCKOUT_RE = /^Too many attempts\. Try again in (\d+)\s*(?:seconds?|s)\.?$/;

const BACKEND_ERROR_MAP: Record<string, string> = {
  // Validation
  "Issuer name is too long (max 255 characters)": "errors.issuerTooLong",
  "Label is too long (max 255 characters)": "errors.labelTooLong",
  "Algorithm must be SHA1, SHA256, or SHA512": "errors.invalidAlgorithm",
  "Digits must be 6 or 8": "errors.invalidDigits",
  "Period must be between 15 and 120 seconds": "errors.invalidPeriod",
  // Storage / Auth
  "Storage unavailable — please restart the app": "errors.storageUnavailable",
  "Auth state unavailable - please restart the app": "errors.authUnavailable",
  "Vault is locked": "errors.vaultLocked",
  "Vault not initialized": "errors.storageUnavailable",
  // Account operations
  "This account already exists": "errors.accountExists",
  "Secret key is required": "errors.secretRequired",
  "Secret key is not valid Base32": "errors.secretInvalidBase32",
  // Backup
  "Failed to save backup": "errors.failedSaveBackup",
  "Failed to share backup file": "errors.failedShareBackup",
  // Export
  "Explicit secret export acknowledgment is required": "errors.exportAckRequired",
  // PIN
  "Incorrect current PIN": "errors.incorrectCurrentPin",
  "Incorrect PIN": "errors.incorrectPin",
  "Failed to set PIN": "errors.failedSetPin",
  "PIN verification unavailable — please restart the app": "errors.pinUnavailable",
  "PIN not configured": "errors.pinNotConfigured",
  "No PIN set": "errors.pinNotConfigured",
  "PIN data corrupted": "errors.pinCorrupted",
  "Failed to remove PIN": "errors.failedRemovePin",
  "Failed to save PIN": "errors.failedSavePin",
  "Failed to restrict file permissions": "errors.failedRestrictPermissions",
  // Biometric
  "Biometric unlock is unavailable on this platform": "errors.biometricUnavailable",
  // Sync
  "A sync session is already active — cancel it first": "errors.syncAlreadyActive",
  "A sync session is already active": "errors.syncAlreadyActive",
  // Recovery codes
  "Failed to generate recovery codes": "errors.failedGenerateRecovery",
  "Failed to save recovery codes": "errors.failedSaveRecovery",
  "Recovery code verification unavailable — please restart the app": "errors.recoveryUnavailable",
  "No recovery codes available": "errors.noRecoveryCodes",
  "Recovery codes data corrupted": "errors.recoveryCorrupted",
  "Failed to update recovery codes": "errors.failedUpdateRecovery",
  // Account lookup
  "Account not found": "errors.accountNotFound",
  // TOTP
  "Invalid account secret": "errors.invalidAccountSecret",
  "Unsupported TOTP parameters in QR code": "errors.unsupportedTotpParams",
  "Invalid QR code or URI format": "errors.invalidQrFormat",
  "System clock error": "errors.systemClockError",
};

/**
 * Translate a known backend error string using the i18n function.
 * Returns the original message if no translation is found.
 */
export function translateBackendError(msg: string, t: TranslateFn): string {
  // Parameterized: rate-limit lockout
  const lockout = LOCKOUT_RE.exec(msg);
  if (lockout) {
    const result = t("errors.tooManyAttempts", { values: { seconds: lockout[1] } });
    if (result !== "errors.tooManyAttempts") return result;
    return msg;
  }

  // Exact matches
  const key = BACKEND_ERROR_MAP[msg];
  if (key) {
    const result = t(key);
    if (result !== key) return result;
  }

  return msg;
}

export function getErrorMessage(err: unknown, t?: TranslateFn): string {
  let raw: string;

  if (err instanceof Error) {
    raw = typeof err.message === "string" && err.message.length > 0 ? err.message : String(err);
  } else if (typeof err === "string") {
    raw = err;
  } else if (err && typeof err === "object") {
    const maybe = err as { message?: unknown; msg?: unknown };
    if (typeof maybe.message === "string" && maybe.message.length > 0) {
      raw = maybe.message;
    } else if (typeof maybe.msg === "string" && maybe.msg.length > 0) {
      raw = maybe.msg;
    } else {
      try {
        const json = JSON.stringify(err);
        if (json && json !== "{}") {
          raw = json;
        } else {
          raw = String(err);
        }
      } catch {
        raw = String(err);
      }
    }
  } else {
    raw = String(err);
  }

  return t ? translateBackendError(raw, t) : raw;
}

export function isCancelLikeError(err: unknown): boolean {
  const msg = getErrorMessage(err).toLowerCase();
  return (
    msg.includes("cancel") ||
    msg.includes("aborted") ||
    msg.includes("abort") ||
    msg.includes("dismiss")
  );
}
