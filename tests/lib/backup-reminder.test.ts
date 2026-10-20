import { describe, expect, it } from 'vitest';
import {
  FIRST_REMINDER_DAYS,
  REPEAT_REMINDER_DAYS,
  SNOOZE_DAYS,
  formatBackupAge,
  shouldRemindBackup,
} from '@/lib/backup-reminder';

const now = new Date('2026-10-20T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

describe('shouldRemindBackup', () => {
  it('stays quiet without own accounts (empty app or demo only)', () => {
    expect(shouldRemindBackup({ oldestOwnAccountAt: null, lastBackupAt: null, snoozedAt: null, now })).toBe(false);
  });

  it('waits a few days after the first account before the first nudge', () => {
    const base = { lastBackupAt: null, snoozedAt: null, now };
    expect(shouldRemindBackup({ ...base, oldestOwnAccountAt: daysAgo(FIRST_REMINDER_DAYS - 1) })).toBe(false);
    expect(shouldRemindBackup({ ...base, oldestOwnAccountAt: daysAgo(FIRST_REMINDER_DAYS) })).toBe(true);
  });

  it('after a backup, nudges again only once it is old', () => {
    const base = { oldestOwnAccountAt: daysAgo(400), snoozedAt: null, now };
    expect(shouldRemindBackup({ ...base, lastBackupAt: daysAgo(REPEAT_REMINDER_DAYS - 1) })).toBe(false);
    expect(shouldRemindBackup({ ...base, lastBackupAt: daysAgo(REPEAT_REMINDER_DAYS) })).toBe(true);
  });

  it('"later" hides the nudge for the snooze period', () => {
    const base = { oldestOwnAccountAt: daysAgo(100), lastBackupAt: null, now };
    expect(shouldRemindBackup({ ...base, snoozedAt: daysAgo(SNOOZE_DAYS - 1) })).toBe(false);
    expect(shouldRemindBackup({ ...base, snoozedAt: daysAgo(SNOOZE_DAYS) })).toBe(true);
  });
});

describe('formatBackupAge', () => {
  it('reads naturally in Russian', () => {
    expect(formatBackupAge(null, now)).toBe('ещё ни разу');
    expect(formatBackupAge(now, now)).toBe('сегодня');
    expect(formatBackupAge(daysAgo(1), now)).toBe('вчера');
    expect(formatBackupAge(daysAgo(2), now)).toBe('2 дня назад');
    expect(formatBackupAge(daysAgo(5), now)).toBe('5 дней назад');
    expect(formatBackupAge(daysAgo(21), now)).toBe('21 день назад');
  });
});
