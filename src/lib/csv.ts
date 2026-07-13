import type { ExpenseRow } from './types';
import { writeOffCents } from './types';

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function expensesToCsv(expenses: ExpenseRow[]): string {
  const header = [
    'Date',
    'Time',
    'Vendor',
    'Category',
    'Account',
    'Amount (USD)',
    'Write-off',
    'Write-off %',
    'Write-off amount (USD)',
    'Groups',
    'Note',
    'Receipt file',
    'Evidence files',
  ];

  const lines = [header.join(',')];

  let totalCents = 0;
  let totalWriteOffCents = 0;

  for (const e of expenses) {
    const [date, time = ''] = e.occurred_at.split(' ');
    const woCents = writeOffCents(e);
    totalCents += e.amount_cents;
    totalWriteOffCents += woCents;

    lines.push(
      [
        date,
        time,
        csvEscape(e.vendor),
        csvEscape(e.category_name ?? ''),
        csvEscape(e.account_name ?? ''),
        dollars(e.amount_cents),
        e.is_write_off ? 'yes' : 'no',
        e.is_write_off ? String(e.write_off_pct) : '',
        e.is_write_off ? dollars(woCents) : '',
        csvEscape(e.group_names.join('; ')),
        csvEscape(e.note),
        csvEscape(e.receipt_path ?? ''),
        csvEscape(e.evidence_paths ?? ''),
      ].join(',')
    );
  }

  lines.push(
    ['TOTAL', '', '', '', '', dollars(totalCents), '', '', dollars(totalWriteOffCents), '', '', '', ''].join(',')
  );

  // BOM so Excel opens UTF-8 correctly.
  return '﻿' + lines.join('\r\n') + '\r\n';
}
