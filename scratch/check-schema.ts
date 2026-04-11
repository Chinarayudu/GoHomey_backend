import dns from 'dns';
import { Pool } from 'pg';
import 'dotenv/config';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectionString = process.env.DATABASE_URL;

async function main() {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Checking User table metadata...');
    const res = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name ILIKE 'user'
    `);
    console.log('Results:', JSON.stringify(res.rows, null, 2));

    const path = await pool.query('SHOW search_path');
    console.log('Search path:', path.rows[0].search_path);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
