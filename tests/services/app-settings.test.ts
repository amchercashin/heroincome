import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { getAppSettings, updateAppSetting } from '@/services/app-settings';

describe('app-settings', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('returns defaults when no settings exist', async () => {
    const settings = await getAppSettings();
    expect(settings.defaultPeriod).toBe('month');
    expect(settings.autoMoexSync).toBe(true);
  });

  it('persists and reads a setting', async () => {
    await updateAppSetting('defaultPeriod', 'year');
    const settings = await getAppSettings();
    expect(settings.defaultPeriod).toBe('year');
  });

  it('persists autoMoexSync as boolean-like string', async () => {
    await updateAppSetting('autoMoexSync', 'false');
    const settings = await getAppSettings();
    expect(settings.autoMoexSync).toBe(false);
  });
});
