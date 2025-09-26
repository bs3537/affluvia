import { parseBulkInviteBuffer } from '../routes/advisor-bulk-invite';

describe('parseBulkInviteBuffer', () => {
  it('parses emails and names from header-based CSV files', () => {
    const csv = 'Email,First Name,Last Name\nfoo@example.com,Jane,Doe\nbar@example.com,Bob,\n';
    const buffer = Buffer.from(csv, 'utf-8');
    const { entries, issues } = parseBulkInviteBuffer(buffer);

    expect(issues).toHaveLength(0);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ email: 'foo@example.com', fullName: 'Jane Doe', row: 2 });
    expect(entries[1]).toMatchObject({ email: 'bar@example.com', fullName: 'Bob', row: 3 });
  });

  it('derives names and flags invalid rows when headers are absent', () => {
    const csv = 'jane@example.com,Jane Doe\nnot-an-email\nJeffrey Smith,jeff@example.com\n';
    const buffer = Buffer.from(csv, 'utf-8');
    const { entries, issues } = parseBulkInviteBuffer(buffer);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ email: 'jane@example.com', fullName: 'Jane Doe', row: 1 });
    expect(entries[1]).toMatchObject({ email: 'jeff@example.com', fullName: 'Jeffrey Smith', row: 3 });
    expect(issues).toEqual([
      expect.objectContaining({ row: 2, reason: 'missing_email' }),
    ]);
  });
});
