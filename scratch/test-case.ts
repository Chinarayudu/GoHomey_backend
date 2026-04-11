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
    console.log('Testing quoted "User"...');
    try {
        await pool.query('SELECT count(*) FROM "User"');
        console.log('Quoted "User" works');
    } catch (e: any) {
        console.log('Quoted "User" fails:', e.message);
    }

    console.log('Testing unquoted User...');
    try {
        await pool.query('SELECT count(*) FROM User');
        console.log('Unquoted User works');
    } catch (e: any) {
        console.log('Unquoted User fails:', e.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
