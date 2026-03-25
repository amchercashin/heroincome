import Dexie from 'dexie';

const OLD_DB_NAME = 'CashFlowDB';
const NEW_DB_NAME = 'HeroIncomeDB';

export async function migrateDbName(): Promise<void> {
  const dbNames = await Dexie.getDatabaseNames();
  if (!dbNames.includes(OLD_DB_NAME)) return;
  if (dbNames.includes(NEW_DB_NAME)) return;

  try {
    const oldDb = new Dexie(OLD_DB_NAME);
    await oldDb.open();
    const tableNames = oldDb.tables.map((t) => t.name);

    const allData: Record<string, unknown[]> = {};
    for (const name of tableNames) {
      allData[name] = await oldDb.table(name).toArray();
    }
    oldDb.close();

    const newDb = new Dexie(NEW_DB_NAME);
    const schema: Record<string, string> = {};
    const oldDb2 = new Dexie(OLD_DB_NAME);
    await oldDb2.open();
    const oldVersion = oldDb2.verno; // CRITICAL: preserve version number
    for (const table of oldDb2.tables) {
      schema[table.name] = table.schema.primKey.src +
        (table.schema.indexes.length ? ',' + table.schema.indexes.map((i) => i.src).join(',') : '');
    }
    oldDb2.close();

    // Create new DB at SAME version as old DB — prevents Dexie from
    // running upgrade functions (v5 does clear()!) on the migrated data
    newDb.version(oldVersion).stores(schema);
    await newDb.open();

    await newDb.transaction('rw', newDb.tables, async () => {
      for (const name of tableNames) {
        if (allData[name].length > 0) {
          await newDb.table(name).bulkAdd(allData[name]);
        }
      }
    });
    newDb.close();

    await Dexie.delete(OLD_DB_NAME);
  } catch (err) {
    console.error('DB migration failed, keeping old DB:', err);
  }
}
