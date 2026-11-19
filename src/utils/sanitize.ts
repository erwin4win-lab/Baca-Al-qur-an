/**
 * Utility helper untuk sanitasi input dan boundary checking yang aman (defensive programming)
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Memastikan nama properti objek aman dari prototype pollution.
 */
export function isSafeObjectKey(key: string): boolean {
  return typeof key === 'string' && key.length > 0 && !FORBIDDEN_KEYS.has(key);
}

/**
 * Membersihkan secara menyeluruh sisa-sisa HTML entity encoding berlebih (&amp;amp;# dll)
 * dan memulihkan karakter asli seperti tanda petik (') dan ampersand (&).
 */
export function unescapeCompoundedEntities(str: string): string {
  if (typeof str !== 'string' || !str) return '';

  let decoded = str;

  // 1. Tangani langsung kasus khusus rangkaian "amp;" berulang dengan atau tanpa "&" dan "#"
  decoded = decoded.replace(/(?:&|&amp;|amp;)+(?:#39;?|#039;?|#;?)/gi, "'");
  decoded = decoded.replace(/(?:amp;)+#/gi, "'");

  // 2. Lakukan iterasi hingga tidak ada lagi entity bertingkat (misal: &amp;amp; -> &)
  let prev = '';
  for (let i = 0; i < 10; i++) {
    prev = decoded;
    decoded = decoded
      .replace(/&amp;/gi, '&')
      .replace(/&apos;/gi, "'")
      .replace(/&#39;/gi, "'")
      .replace(/&#039;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&#34;/gi, '"')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ');
    if (decoded === prev) break;
  }

  // 3. Bersihkan sisa-sisa pecahan "amp;" yang tertinggal tanpa ampersand
  decoded = decoded.replace(/\s+(?:amp;)+\s+/gi, ' & ');
  decoded = decoded.replace(/([a-zA-Z])(?:&|&amp;|amp;)+#(?:[0-9]*;?)?([a-zA-Z]?)/gi, "$1'$2");
  decoded = decoded.replace(/([a-zA-Z])(?:amp;)+([a-zA-Z])/gi, "$1'$2");
  decoded = decoded.replace(/([a-zA-Z])(?:&|#)+(?=[^a-zA-Z0-9]|$)/gi, "$1'");
  decoded = decoded.replace(/(?:amp;)+/gi, '&');

  return decoded;
}

/**
 * Menghapus tag HTML berbahaya & control characters tanpa merusak tanda baca normal (' dan &).
 */
export function sanitizeString(input: unknown, maxLength = 100): string {
  if (typeof input !== 'string') return '';

  const unescaped = unescapeCompoundedEntities(input);
  const clean = unescaped
    .replace(/[<>]/g, '')
    .replace(/[\0-\x1F\x7F]/g, '')
    .trim();

  return clean.slice(0, Math.max(0, maxLength));
}

/**
 * Menjamin angka selalu valid, bukan NaN/Infinity, dan dalam rentang aman [min, max].
 */
export function clampNumber(value: unknown, min: number, max: number, fallback = min): number {
  if (typeof value !== 'number' && typeof value !== 'string') return fallback;
  const parsed = typeof value === 'string' ? Number(value.trim()) : value;
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/**
 * Menghitung persentase aman dengan proteksi pembagian nol (division by zero).
 */
export function safePercentage(numerator: unknown, denominator: unknown, max = 100): number {
  const num = typeof numerator === 'number' && Number.isFinite(numerator) ? numerator : 0;
  const den = typeof denominator === 'number' && Number.isFinite(denominator) ? denominator : 0;
  if (den <= 0) return 0;
  const result = (num / den) * 100;
  if (!Number.isFinite(result) || Number.isNaN(result)) return 0;
  return Math.min(max, Math.max(0, Math.round(result)));
}

/**
 * Validasi format tanggal YYYY-MM-DD secara ketat (mencegah overflow kalender seperti 2026-02-31).
 */
export function isValidDateString(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}

/**
 * Menggeser tanggal YYYY-MM-DD secara lokal tanpa bug pergeseran zona waktu UTC.
 */
export function shiftLocalDateString(dateStr: string, deltaDays: number): string {
  if (!isValidDateString(dateStr)) {
    const now = new Date();
    now.setDate(now.getDate() + deltaDays);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const [yStr, mStr, dStr] = dateStr.split('-');
  const d = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10));
  d.setDate(d.getDate() + deltaDays);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
