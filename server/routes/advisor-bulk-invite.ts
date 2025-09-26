import * as XLSX from 'xlsx';

export const MAX_BULK_INVITES = 500;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export type BulkInviteSkipReason =
  | 'missing_email'
  | 'invalid_email'
  | 'duplicate_in_file'
  | 'already_client'
  | 'already_invited'
  | 'email_failed'
  | 'failed';

export interface ParsedBulkInviteRow {
  email: string;
  emailLower: string;
  fullName: string | null;
  row: number;
}

export interface BulkInviteParseIssue {
  row: number;
  reason: 'missing_email' | 'invalid_email';
  email?: string;
  fullName?: string | null;
}

function sanitizeCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim();
  return String(value).trim();
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function looksLikeEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim().toLowerCase());
}

export function parseBulkInviteBuffer(buffer: Buffer): { entries: ParsedBulkInviteRow[]; issues: BulkInviteParseIssue[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { entries: [], issues: [] };
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', blankrows: false }) as unknown as string[][];
  const rows = rawRows
    .map((row) => row.map(sanitizeCell))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (rows.length === 0) return { entries: [], issues: [] };

  const headerCandidate = rows[0];
  const normalizedHeader = headerCandidate.map(normalizeHeader);
  const headerHasDescriptor = normalizedHeader.some((h) => h.includes('email') || h.includes('name') || h.includes('client'));
  const headerLooksLikeData = headerCandidate.some((cell) => looksLikeEmail(cell));
  const useHeader = headerHasDescriptor || (!headerLooksLikeData && normalizedHeader.some((h) => h.length > 0));

  const dataRows = useHeader ? rows.slice(1) : rows;
  const headerInfo = useHeader ? normalizedHeader : null;

  const emailIdx = headerInfo ? headerInfo.findIndex((h) => h === 'email' || h === 'emails' || h === 'emailaddress') : -1;
  const nameIdx = headerInfo ? headerInfo.findIndex((h) => h === 'name' || h === 'fullname' || h === 'clientname') : -1;
  const firstNameIdx = headerInfo ? headerInfo.findIndex((h) => h === 'firstname' || h === 'first' || h === 'givenname') : -1;
  const lastNameIdx = headerInfo ? headerInfo.findIndex((h) => h === 'lastname' || h === 'last' || h === 'surname' || h === 'familyname') : -1;

  const entries: ParsedBulkInviteRow[] = [];
  const issues: BulkInviteParseIssue[] = [];

  dataRows.forEach((row, idx) => {
    const rowNumber = useHeader ? idx + 2 : idx + 1;
    const sanitizedRow = row.map(sanitizeCell);

    let emailValue = emailIdx >= 0 ? sanitizedRow[emailIdx] : '';
    if (!emailValue) {
      emailValue = sanitizedRow.find((cell) => looksLikeEmail(cell)) || '';
    }

    const trimmedEmail = emailValue.trim();
    if (!trimmedEmail) {
      issues.push({ row: rowNumber, reason: 'missing_email' });
      return;
    }

    const lower = trimmedEmail.toLowerCase();
    if (!EMAIL_REGEX.test(lower)) {
      issues.push({ row: rowNumber, reason: 'invalid_email', email: trimmedEmail });
      return;
    }

    let fullName: string | null = null;
    if (nameIdx >= 0 && sanitizedRow[nameIdx]) {
      fullName = sanitizedRow[nameIdx];
    }
    const first = firstNameIdx >= 0 ? sanitizedRow[firstNameIdx] : '';
    const last = lastNameIdx >= 0 ? sanitizedRow[lastNameIdx] : '';
    if ((!fullName || fullName.length === 0) && (first || last)) {
      fullName = `${first} ${last}`.trim();
    }
    if ((!fullName || fullName.length === 0) && !useHeader) {
      const fallbackNames = sanitizedRow
        .filter((value, columnIdx) => columnIdx !== emailIdx && value && !looksLikeEmail(value))
        .slice(0, 2);
      if (fallbackNames.length) {
        fullName = fallbackNames.join(' ').trim();
      }
    }
    if (fullName) {
      fullName = fullName.replace(/\s+/g, ' ').trim();
      if (fullName.length === 0) fullName = null;
    }

    entries.push({ email: trimmedEmail, emailLower: lower, fullName, row: rowNumber });
  });

  return { entries, issues };
}
