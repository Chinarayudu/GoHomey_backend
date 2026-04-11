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
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables found:');
    res.rows.forEach(row => console.log(`- ${row.table_name}`));
    
    const userTable = res.rows.find(r => r.table_name === 'User');
    if (userTable) {
        console.log('User table exists (case-sensitive "User")');
    } else {
        const lowerUser = res.rows.find(r => r.table_name === 'user');
        if (lowerUser) {
            console.log('found lowercase "user" table');
        } else {
            console.log('User table NOT found');
        }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
