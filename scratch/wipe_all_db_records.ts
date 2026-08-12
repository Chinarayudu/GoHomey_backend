import { prisma } from '../src/prisma/prisma.service';

const CONFIRM_FLAG = '--confirm-wipe-all-data';

async function listTables(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    AND table_name != '_prisma_migrations'
  `;

  return rows.map((r) => r.table_name);
}

async function countAllRows(tables: string[]) {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) AS count FROM "${table}"`,
    );
    counts[table] = Number(rows[0]?.count ?? 0);
  }
  return counts;
}

async function wipeAllDbRecords() {
  const confirmed =
    process.argv.includes(CONFIRM_FLAG) ||
    process.env.CONFIRM_WIPE_ALL_DATA === 'YES';

  const tables = await listTables();

  if (!confirmed) {
    console.log('Refusing to wipe the database without confirmation.');
    console.log('');
    console.log('Run one of these commands:');
    console.log('npm run db:wipe:confirm');
    console.log(`npx ts-node scratch/wipe_all_db_records.ts ${CONFIRM_FLAG}`);
    console.log('set CONFIRM_WIPE_ALL_DATA=YES && npm run db:wipe');
    console.log('');
    console.log(`This TRUNCATEs every row in all ${tables.length} tables (schema/migrations are kept):`);
    console.log(tables.join(', '));
    return;
  }

  console.log('Row counts before wipe:');
  console.table(await countAllRows(tables));

  const quotedTables = tables.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`,
  );

  console.log('Row counts after wipe:');
  console.table(await countAllRows(tables));
  console.log('Done. All tables truncated; schema and migration history were kept.');
}

wipeAllDbRecords()
  .catch((error) => {
    console.error('Failed to wipe database:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
