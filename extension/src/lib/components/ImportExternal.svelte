<script lang="ts">
  import { storage, loadAccounts } from "$lib/stores/accounts.svelte";
  import { parseOtpAuthUri } from "$lib/utils/otpauth";
  import { toast } from "$lib/stores/toast";
  import { getErrorMessage } from "$lib/utils/error";
  import { btnPrimary, btnSecondary } from "$lib/styles/styles";
  import type { Account } from "$core/types";
  import { _ } from 'svelte-i18n';
  import Modal from "./Modal.svelte";
  import iconFile from "$lib/assets/icons/file.svg";

  let { onclose, onsuccess }: { onclose: () => void; onsuccess: () => void } = $props();

  let error = $state("");
  let loading = $state(false);
  let fileName = $state("");
  let preview: Account[] | null = $state(null);
  let skipped = $state(0);
  let duplicates = $state(0);

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      error = "File too large (max 50 MB)";
      return;
    }
    fileName = file.name;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        await parseFile(text);
      } catch (err) {
        error = getErrorMessage(err, $_);
      }
    };
    reader.readAsText(file);
  }

  // --- Import parsing (mirrors Tauri backend logic) ---

  function normalizeSecret(s: string): string {
    return s.replace(/[\s=]/g, "").toUpperCase();
  }

  function normalizeAlgorithm(a: string): string {
    const u = a.toUpperCase();
    if (u === "SHA-1" || u === "HMACSHA1") return "SHA1";
    if (u === "SHA-256" || u === "HMACSHA256") return "SHA256";
    if (u === "SHA-512" || u === "HMACSHA512") return "SHA512";
    return u;
  }

  function isValidAccount(algorithm: string, digits: number, period: number): boolean {
    return ["SHA1", "SHA256", "SHA512"].includes(algorithm) && (digits === 6 || digits === 8) && period >= 15 && period <= 120;
  }

  function splitIssuerLabel(combined: string): [string, string] {
    const idx = combined.indexOf(":");
    if (idx >= 0) return [combined.slice(0, idx).trim(), combined.slice(idx + 1).trim()];
    return [combined.trim(), ""];
  }

  function makeAccount(issuer: string, label: string, secret: string, algorithm = "SHA1", digits = 6, period = 30): Account | null {
    const sec = normalizeSecret(secret);
    if (!sec) return null;
    const algo = normalizeAlgorithm(algorithm);
    if (!isValidAccount(algo, digits, period)) return null;
    return { id: crypto.randomUUID(), issuer, label, secret: sec, algorithm: algo, digits, period, icon: null, last_modified: Math.floor(Date.now() / 1000) };
  }

  function parseOtpAuthUris(text: string): { accounts: Account[]; skipped: number } {
    const accounts: Account[] = [];
    let skipped = 0;
    for (const line of text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean)) {
      if (line.startsWith("#") || !line.startsWith("otpauth://")) continue;
      if (!line.startsWith("otpauth://totp/")) { skipped++; continue; }
      try {
        const p = parseOtpAuthUri(line);
        const a = makeAccount(p.issuer, p.label, p.secret, p.algorithm, p.digits, p.period);
        if (a) accounts.push(a); else skipped++;
      } catch { skipped++; }
    }
    return { accounts, skipped };
  }

  function extractUrisFromText(text: string): string[] {
    const uris: string[] = [];
    let remaining = text;
    while (true) {
      const idx = remaining.indexOf("otpauth://");
      if (idx < 0) break;
      const sub = remaining.slice(idx);
      const end = sub.search(/[\s"'<>]/) ?? sub.length;
      const uri = sub.slice(0, end === -1 ? sub.length : end).replace(/,+$/, "");
      if (uri.length > "otpauth://".length) uris.push(uri);
      remaining = remaining.slice(idx + Math.max(end, 1));
    }
    return uris;
  }

  // --- Format-specific parsers ---

  function parseAegis(obj: any): { accounts: Account[]; skipped: number } | string {
    if (typeof obj.db === "string") return "This Aegis backup is encrypted. Please export an unencrypted backup from Aegis.";
    const entries = obj.db?.entries;
    if (!Array.isArray(entries)) return "Invalid Aegis format";
    const accounts: Account[] = [];
    let skipped = 0;
    for (const e of entries) {
      if ((e.type || "").toLowerCase() !== "totp") { skipped++; continue; }
      const a = makeAccount(e.issuer || "", e.name || "", e.info?.secret || "", e.info?.algo, e.info?.digits, e.info?.period);
      if (a) accounts.push(a); else skipped++;
    }
    return { accounts, skipped };
  }

  function parseTwoFAS(obj: any): { accounts: Account[]; skipped: number } {
    const accounts: Account[] = [];
    let skipped = 0;
    for (const svc of obj.services || []) {
      const otp = svc.otp;
      if (!otp) { skipped++; continue; }
      if (otp.tokenType && otp.tokenType.toUpperCase() !== "TOTP") { skipped++; continue; }
      const issuer = otp.issuer || svc.name || "";
      const a = makeAccount(issuer, otp.account || "", svc.secret || "", otp.algorithm, otp.digits, otp.period);
      if (a) accounts.push(a); else skipped++;
    }
    return { accounts, skipped };
  }

  function parseAndOTP(arr: any[]): { accounts: Account[]; skipped: number } | null {
    if (!arr.every(item => typeof item === "object" && item !== null && "secret" in item)) return null;
    const accounts: Account[] = [];
    let skipped = 0;
    for (const e of arr) {
      if (e.type && e.type.toUpperCase() !== "TOTP") { skipped++; continue; }
      let issuer = e.issuer || "";
      let label = e.label || "";
      if (!issuer && label) [issuer, label] = splitIssuerLabel(label);
      const a = makeAccount(issuer, label, e.secret || "", e.algorithm, e.digits, e.period);
      if (a) accounts.push(a); else skipped++;
    }
    return { accounts, skipped };
  }

  function parseFreeOTP(obj: any): { accounts: Account[]; skipped: number } {
    const accounts: Account[] = [];
    let skipped = 0;
    for (const t of obj.tokens || []) {
      if (t.type && t.type.toUpperCase() !== "TOTP") { skipped++; continue; }
      let secret = "";
      if (Array.isArray(t.secret)) {
        // Re-encode raw bytes as base32
        const bytes = new Uint8Array(t.secret);
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        let bits = 0, value = 0;
        secret = "";
        for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { bits -= 5; secret += alphabet[(value >>> bits) & 31]; } }
        if (bits > 0) secret += alphabet[(value << (5 - bits)) & 31];
      } else {
        secret = t.secret || "";
      }
      const issuer = t.issuerExt || t.issuerAlt || "";
      const a = makeAccount(issuer, t.label || "", secret, t.algo, t.digits, t.period);
      if (a) accounts.push(a); else skipped++;
    }
    return { accounts, skipped };
  }

  function collectOtpAuthUris(value: any, out: string[]): void {
    if (typeof value === "string") { if (value.trim().startsWith("otpauth://")) out.push(value.trim()); }
    else if (Array.isArray(value)) { for (const item of value) collectOtpAuthUris(item, out); }
    else if (value && typeof value === "object") { for (const v of Object.values(value)) collectOtpAuthUris(v, out); }
  }

  function tryGenericFields(value: any): { accounts: Account[]; skipped: number } | null {
    const candidates: any[] = [];
    function collect(v: any) {
      if (Array.isArray(v)) { for (const item of v) { if (item && typeof item === "object" && !Array.isArray(item)) candidates.push(item); collect(item); } }
      else if (v && typeof v === "object") { for (const val of Object.values(v)) collect(val); }
    }
    collect(value);

    const accounts: Account[] = [];
    let skipped = 0;
    const secretKeys = ["secret", "secretKey", "secret_key", "secretSeed"];
    const typeKeys = ["type", "kind", "tokenType", "otp_type"];
    const algoKeys = ["algorithm", "algo"];
    const issuerKeys = ["issuer", "issuerExt"];
    const labelKeys = ["label", "account", "name"];
    const periodKeys = ["period", "timer"];

    for (const obj of candidates) {
      const secretRaw = secretKeys.map(k => obj[k]).find(v => typeof v === "string");
      if (!secretRaw) continue;
      const typeVal = typeKeys.map(k => obj[k]).find(v => typeof v === "string") || "TOTP";
      if (!["TOTP", "T"].includes(typeVal.toUpperCase())) { skipped++; continue; }
      const algo = normalizeAlgorithm(algoKeys.map(k => obj[k]).find(v => typeof v === "string") || "SHA1");
      const digits = typeof obj.digits === "number" ? obj.digits : 6;
      const period = periodKeys.map(k => obj[k]).find(v => typeof v === "number") ?? 30;
      let issuer = issuerKeys.map(k => obj[k]).find(v => typeof v === "string") || "";
      let label = labelKeys.map(k => obj[k]).find(v => typeof v === "string") || "";
      if (!issuer && label) [issuer, label] = splitIssuerLabel(label);
      const a = makeAccount(issuer, label, secretRaw, algo, digits, period);
      if (a) accounts.push(a); else skipped++;
    }
    return accounts.length > 0 ? { accounts, skipped } : null;
  }

  async function parseFile(text: string) {
    error = "";
    loading = true;
    skipped = 0;
    duplicates = 0;

    try {
      const trimmed = text.trim();
      if (!trimmed) { error = $_('importExternal.noAccountsFound'); loading = false; return; }

      let result: { accounts: Account[]; skipped: number } | null = null;

      // 1. Plain otpauth:// URI list
      if (trimmed.startsWith("otpauth://")) {
        result = parseOtpAuthUris(trimmed);
      }

      // 2. JSON formats
      if (!result || result.accounts.length === 0) {
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            const json = JSON.parse(trimmed);
            if (json && typeof json === "object" && !Array.isArray(json)) {
              if ("db" in json) {
                const r = parseAegis(json);
                if (typeof r === "string") { error = r; loading = false; return; }
                result = r;
              } else if ("services" in json) {
                result = parseTwoFAS(json);
              } else if ("servicesEncrypted" in json) {
                error = "This 2FAS backup is encrypted. Please export an unencrypted backup from 2FAS.";
                loading = false; return;
              } else if ("tokens" in json) {
                result = parseFreeOTP(json);
              }
            }
            if ((!result || result.accounts.length === 0) && Array.isArray(json)) {
              const andOtpResult = parseAndOTP(json);
              if (andOtpResult && andOtpResult.accounts.length > 0) result = andOtpResult;
            }
            // Generic: scan JSON tree for otpauth:// URIs
            if (!result || result.accounts.length === 0) {
              const uris: string[] = [];
              collectOtpAuthUris(json, uris);
              if (uris.length > 0) result = parseOtpAuthUris(uris.join("\n"));
            }
            // Generic: look for TOTP-like fields
            if (!result || result.accounts.length === 0) {
              result = tryGenericFields(json);
            }
          } catch { /* not valid JSON, fall through */ }
        }
      }

      // 3. Fallback: scan raw text for embedded otpauth:// URIs (CSV, XML, etc.)
      if (!result || result.accounts.length === 0) {
        const uris = extractUrisFromText(trimmed);
        if (uris.length > 0) result = parseOtpAuthUris(uris.join("\n"));
      }

      if (!result || result.accounts.length === 0) {
        error = $_('importExternal.noAccountsFound');
        loading = false;
        return;
      }

      // Check duplicates against existing accounts
      const existing = await storage.getAccounts();
      const existingSet = new Set(existing.map((a) => `${a.issuer}|${a.label}|${a.secret}`));
      const unique: Account[] = [];
      for (const account of result.accounts) {
        const key = `${account.issuer}|${account.label}|${account.secret}`;
        if (existingSet.has(key)) duplicates++;
        else { unique.push(account); existingSet.add(key); }
      }

      skipped = result.skipped;
      preview = unique;
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }

  async function handleConfirm() {
    if (!preview || preview.length === 0) return;
    loading = true;
    error = "";
    try {
      const existing = await storage.getAccounts();
      const tombstones = await storage.getTombstones();
      const allAccounts = [...existing, ...preview];
      await storage.saveAccounts(allAccounts, tombstones);
      await loadAccounts();
      toast($_('backupImport.imported', { values: { count: preview.length } }));
      onsuccess();
    } catch (e) {
      error = getErrorMessage(e, $_);
    } finally {
      loading = false;
    }
  }
</script>

<Modal onclose={onclose} title={$_('importExternal.title')} titleId="import-external-title">
  {#snippet children()}
    {#if error}
      <div class="border border-dotted border-error/30 text-error px-3 py-2 mb-4 text-sm">
        <span class="text-error/60">{$_('common.errorPrefix')}</span> {error}
      </div>
    {/if}

    {#if !preview}
      <p class="text-sm text-muted mb-4 leading-relaxed">
        {$_('importExternal.description')}
      </p>

      <div>
        <label for="import-ext-file" class="flex items-center gap-1.5 text-sm text-dim tracking-wide mb-1.5">
          <img src={iconFile} alt="" class="w-3.5 h-3.5 icon-adapt opacity-50" />
          {$_('importExternal.fileLabel')}
        </label>
        <label class="block border border-dotted border-border px-3 py-2.5 text-sm text-dim hover:border-fg/30 transition-colors cursor-pointer">
          {fileName || $_('importExternal.filePlaceholder')}
          <input
            id="import-ext-file"
            type="file"
            accept=".json,.txt,.2fas,.csv"
            class="hidden"
            onchange={handleFileSelect}
          />
        </label>
      </div>

      {#if loading}
        <p class="text-sm text-dim mt-4">{$_('common.loading')}</p>
      {/if}
    {:else}
      <div class="mb-4">
        <p class="text-sm text-muted mb-3">
          {$_('importExternal.previewSummary', { values: { count: preview.length } })}
        </p>
        {#if skipped > 0}
          <p class="text-xs text-dim mb-2">{$_('importExternal.skipped', { values: { count: skipped } })}</p>
        {/if}
        {#if duplicates > 0}
          <p class="text-xs text-dim mb-2">{$_('importExternal.duplicates', { values: { count: duplicates } })}</p>
        {/if}

        <div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {#each preview as account}
            <div class="border border-dotted border-border px-4 py-2.5">
              <div class="text-sm text-fg">{account.issuer || account.label}</div>
              {#if account.issuer && account.label}
                <div class="text-xs text-dim">{account.label}</div>
              {/if}
            </div>
          {/each}
        </div>

        {#if preview.length === 0}
          <p class="text-sm text-dim py-4 text-center">{$_('importExternal.allDuplicates')}</p>
        {/if}
      </div>

      <div class="flex gap-2">
        <button type="button" class={btnSecondary} onclick={() => { preview = null; error = ""; fileName = ""; }}>
          {$_('common.back')}
        </button>
        {#if preview.length > 0}
          <button type="button" disabled={loading} class="{btnPrimary} disabled:opacity-30" onclick={handleConfirm}>
            {loading ? $_('common.loading') : $_('common.import')}
          </button>
        {/if}
      </div>
    {/if}
  {/snippet}
</Modal>
