'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Account, Category, ExpenseDetail, Group, OcrResult, VendorSuggestion } from '@/lib/types';
import { nowTime, todayISO } from '@/lib/format';
import VendorAutocomplete from './VendorAutocomplete';

interface Props {
  expense?: ExpenseDetail; // present = edit mode
}

export default function ExpenseForm({ expense }: Props) {
  const router = useRouter();
  const isEdit = Boolean(expense);

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [amount, setAmount] = useState(expense ? (expense.amount_cents / 100).toFixed(2) : '');
  const [date, setDate] = useState(expense ? expense.occurred_at.split(' ')[0] : todayISO());
  const [time, setTime] = useState(expense ? expense.occurred_at.split(' ')[1] ?? '00:00' : nowTime());
  const [vendor, setVendor] = useState(expense?.vendor ?? '');
  const [note, setNote] = useState(expense?.note ?? '');
  const [categoryId, setCategoryId] = useState<string>(expense?.category_id?.toString() ?? '');
  const [accountId, setAccountId] = useState<string>(expense?.account_id?.toString() ?? '');
  const [isWriteOff, setIsWriteOff] = useState(expense ? expense.is_write_off === 1 : true);
  const [writeOffPct, setWriteOffPct] = useState(expense?.is_write_off ? String(expense.write_off_pct) : '100');
  const [groupIds, setGroupIds] = useState<number[]>(expense?.group_ids ?? []);
  const [ocrText, setOcrText] = useState(expense?.ocr_text ?? '');

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  // Two inputs: a plain one (gallery / file browser) and one with
  // capture="environment" that jumps straight into the camera on phones.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Supporting evidence: extra photos/PDFs stored alongside the receipt.
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]); // '' for non-images
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<number[]>([]);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pdfPreviewFailed, setPdfPreviewFailed] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/groups').then((r) => r.json()),
    ])
      .then(([c, a, g]) => {
        setCategories(c.categories);
        setAccounts(a.accounts);
        setGroups(g.groups);
      })
      .catch(() => setError('Failed to load reference data.'));
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      for (const url of evidenceUrls) if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === categoryId) ?? null,
    [categories, categoryId]
  );

  function applyCategoryPolicy(cat: Category | null) {
    if (!cat) return;
    if (cat.write_off === 'none') {
      setIsWriteOff(false);
    } else {
      setIsWriteOff(true);
      setWriteOffPct(String(cat.default_write_off_pct));
    }
  }

  function onCategoryChange(value: string) {
    setCategoryId(value);
    applyCategoryPolicy(categories.find((c) => String(c.id) === value) ?? null);
  }

  function pickVendor(s: VendorSuggestion) {
    setVendor(s.vendor);
    if (s.category_id) onCategoryChange(String(s.category_id));
    if (s.account_id && !accountId) setAccountId(String(s.account_id));
  }

  /** If the vendor is already known, prefill category/account from its history. */
  async function prefillFromVendorHistory(vendorName: string, overrideCategory: boolean) {
    try {
      const res = await fetch(`/api/vendors?q=${encodeURIComponent(vendorName)}`);
      const data: { suggestions: VendorSuggestion[] } = await res.json();
      const match = data.suggestions.find((s) => s.vendor.toLowerCase() === vendorName.toLowerCase());
      if (!match) return;
      if (match.category_id && (overrideCategory || !categoryId)) onCategoryChange(String(match.category_id));
      if (match.account_id && !accountId) setAccountId(String(match.account_id));
    } catch {
      // suggestions are best-effort
    }
  }

  function addEvidence(list: FileList | null) {
    if (!list) return;
    const files = [...list];
    setEvidenceFiles((prev) => [...prev, ...files]);
    setEvidenceUrls((prev) => [
      ...prev,
      ...files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : '')),
    ]);
  }

  function removePendingEvidence(index: number) {
    if (evidenceUrls[index]) URL.revokeObjectURL(evidenceUrls[index]);
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
    setEvidenceUrls((prev) => prev.filter((_, i) => i !== index));
  }

  function onPickFile(f: File | null) {
    setFile(f);
    setRemoveReceipt(false);
    setScanMsg(null);
    setPdfPreviewFailed(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  }

  async function scanReceipt() {
    if (!file) return;
    setScanning(true);
    setScanMsg(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/ocr', { method: 'POST', body: fd });
      const data: OcrResult & { error?: string } = await res.json();
      if (!res.ok) {
        setScanMsg(data.error ?? 'OCR failed.');
        return;
      }
      const found: string[] = [];
      if (data.amount) {
        setAmount(data.amount);
        found.push(`amount $${data.amount}`);
      }
      if (data.date) {
        setDate(data.date);
        found.push(`date ${data.date}`);
      }
      if (data.time) {
        setTime(data.time);
        found.push(`time ${data.time}`);
      }
      if (data.vendor) {
        setVendor(data.vendor);
        found.push(`vendor "${data.vendor}"`);
        // Known vendor → pull its usual category/account from history.
        void prefillFromVendorHistory(data.vendor, false);
      }
      setOcrText(data.text);
      setScanMsg(found.length ? `Detected: ${found.join(', ')}. Review before saving.` : 'Text extracted, but no fields recognized — fill in manually.');
    } catch {
      setScanMsg('OCR request failed.');
    } finally {
      setScanning(false);
    }
  }

  function toggleGroup(id: number) {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('amount', amount);
      fd.append('date', date);
      fd.append('time', time || '00:00');
      fd.append('vendor', vendor);
      fd.append('note', note);
      fd.append('category_id', categoryId);
      fd.append('account_id', accountId);
      fd.append('is_write_off', isWriteOff ? '1' : '0');
      fd.append('write_off_pct', writeOffPct);
      fd.append('group_ids', groupIds.join(','));
      fd.append('ocr_text', ocrText);
      if (file) fd.append('receipt', file);
      if (removeReceipt) fd.append('remove_receipt', '1');
      for (const f of evidenceFiles) fd.append('evidence', f);
      if (removedAttachmentIds.length) fd.append('remove_attachment_ids', removedAttachmentIds.join(','));

      const res = await fetch(isEdit ? `/api/expenses/${expense!.id}` : '/api/expenses', {
        method: isEdit ? 'PUT' : 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Save failed.');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Save failed — network error.');
    } finally {
      setSaving(false);
    }
  }

  const policyHint =
    selectedCategory?.write_off === 'none'
      ? 'This category is non-deductible.'
      : selectedCategory?.write_off === 'partial'
        ? `This category allows partial write-off only (default ${selectedCategory.default_write_off_pct}%).`
        : null;

  const pickedIsPdf =
    !!file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

  const existingReceiptUrl =
    isEdit && expense!.receipt_path && !removeReceipt && !file
      ? `/api/receipts/${expense!.receipt_path}`
      : null;
  const existingIsPdf = !!existingReceiptUrl && expense!.receipt_path!.toLowerCase().endsWith('.pdf');

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* Receipt panel */}
      <div className="card flex flex-col gap-3 p-4">
        <span className="label">Receipt photo</span>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onPickFile(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            dragOver
              ? 'border-emerald-500 bg-emerald-500/5'
              : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600'
          }`}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Receipt preview" className="max-h-96 rounded-md object-contain" />
          ) : pickedIsPdf ? (
            <PdfPlaceholder label={file!.name} hint="First page will be scanned and stored" />
          ) : existingReceiptUrl && existingIsPdf ? (
            pdfPreviewFailed ? (
              <PdfPlaceholder label={expense!.receipt_path!.split('/').pop() ?? 'receipt.pdf'} hint="Preview unavailable" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${existingReceiptUrl}?preview=1`}
                alt="Current receipt (PDF)"
                className="max-h-96 rounded-md object-contain"
                onError={() => setPdfPreviewFailed(true)}
              />
            )
          ) : existingReceiptUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={existingReceiptUrl} alt="Current receipt" className="max-h-96 rounded-md object-contain" />
          ) : (
            <>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400">
                <path d="M12 16V4m0 0 4 4m-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" />
              </svg>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Tap to choose a photo or drop an image here
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">JPG, PNG, WebP, HEIC or PDF · max 25 MB</p>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => cameraInputRef.current?.click()}>
            📷 Camera
          </button>
          <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
            🖼 Gallery
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!file || scanning}
            onClick={scanReceipt}
          >
            {scanning ? 'Scanning…' : 'Scan receipt (OCR)'}
          </button>
          {existingIsPdf && (
            <a href={existingReceiptUrl!} target="_blank" rel="noreferrer" className="btn-secondary">
              Open PDF
            </a>
          )}
          {(file || existingReceiptUrl) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                onPickFile(null);
                if (isEdit && expense!.receipt_path) setRemoveReceipt(true);
                if (fileInputRef.current) fileInputRef.current.value = '';
                if (cameraInputRef.current) cameraInputRef.current.value = '';
              }}
            >
              Remove photo
            </button>
          )}
        </div>

        {scanMsg && (
          <p className="rounded-lg bg-emerald-600/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
            {scanMsg}
          </p>
        )}

        {/* Supporting evidence */}
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <span className="label mb-0">Supporting evidence</span>
          <div className="flex flex-wrap gap-2">
            {(expense?.attachments ?? [])
              .filter((att) => !removedAttachmentIds.includes(att.id))
              .map((att) => (
                <EvidenceThumb
                  key={`saved-${att.id}`}
                  src={
                    att.path.toLowerCase().endsWith('.pdf')
                      ? `/api/receipts/${att.path}?preview=1`
                      : `/api/receipts/${att.path}`
                  }
                  href={`/api/receipts/${att.path}`}
                  title={att.original_name || att.path}
                  onRemove={() => setRemovedAttachmentIds((prev) => [...prev, att.id])}
                />
              ))}
            {evidenceFiles.map((f, i) => (
              <EvidenceThumb
                key={`pending-${i}-${f.name}`}
                src={evidenceUrls[i] || null}
                title={f.name}
                onRemove={() => removePendingEvidence(i)}
              />
            ))}
            <button
              type="button"
              onClick={() => evidenceInputRef.current?.click()}
              title="Add supporting photos or PDFs"
              className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-xl text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
            >
              +
            </button>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Extra photos or PDFs stored with this expense: invoices, serial numbers, before/after shots.
          </p>
          <input
            ref={evidenceInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              addEvidence(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {ocrText && (
          <details className="text-xs">
            <summary className="cursor-pointer text-zinc-500 select-none dark:text-zinc-400">
              Recognized text
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-zinc-100 p-2 whitespace-pre-wrap text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
              {ocrText}
            </pre>
          </details>
        )}
      </div>

      {/* Fields panel */}
      <div className="card flex flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="amount">Amount (USD)</label>
            <input
              id="amount"
              className="input text-lg font-semibold"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="date">Date</label>
            <input id="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="time">Time</label>
            <input id="time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="vendor">Vendor / merchant</label>
          <VendorAutocomplete value={vendor} onChange={setVendor} onPick={pickVendor} />
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            Picking a known vendor fills in its usual category automatically.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" className="input" value={categoryId} onChange={(e) => onCategoryChange(e.target.value)} required>
              <option value="" disabled>Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="account">Account</label>
            <select id="account" className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
              <option value="" disabled>Select account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-600"
                checked={isWriteOff}
                disabled={selectedCategory?.write_off === 'none'}
                onChange={(e) => setIsWriteOff(e.target.checked)}
              />
              Business write-off
            </label>
            {isWriteOff && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  className="input w-20 text-center"
                  inputMode="numeric"
                  value={writeOffPct}
                  disabled={selectedCategory?.write_off === 'full'}
                  onChange={(e) => setWriteOffPct(e.target.value)}
                />
                % of amount
              </label>
            )}
          </div>
          {policyHint && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{policyHint}</p>}
        </div>

        <div>
          <span className="label">Groups</span>
          {groups.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No groups yet — create them on the Groups page to organize expenses by project, client, etc.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    groupIds.includes(g.id)
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="note">Note</label>
          <textarea
            id="note"
            className="input min-h-20 resize-y"
            placeholder="Optional details…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1 sm:flex-none" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add expense'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function EvidenceThumb({
  src,
  href,
  title,
  onRemove,
}: {
  src: string | null;
  href?: string;
  title: string;
  onRemove: () => void;
}) {
  const [failed, setFailed] = useState(false);

  const inner =
    src && !failed ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={title} className="h-16 w-16 rounded-lg border border-zinc-200 object-cover dark:border-zinc-700" onError={() => setFailed(true)} />
    ) : (
      <span
        title={title}
        className="flex h-16 w-16 items-center justify-center rounded-lg border border-zinc-200 text-[10px] font-semibold text-red-400 dark:border-zinc-700"
      >
        PDF
      </span>
    );

  return (
    <span className="relative inline-block" title={title}>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {inner}
        </a>
      ) : (
        inner
      )}
      <button
        type="button"
        aria-label={`Remove ${title}`}
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-zinc-300 bg-white text-[10px] text-zinc-500 shadow hover:text-red-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      >
        ✕
      </button>
    </span>
  );
}

function PdfPlaceholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="max-w-full truncate px-4 text-sm font-medium">{label}</p>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">PDF · {hint}</p>
    </div>
  );
}
