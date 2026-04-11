import dns from 'dns';
import { Pool } from 'pg';
import fs from 'fs';
import 'dotenv/config';

// Force use of Google DNS
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectionString = process.env.DATABASE_URL;

async function main() {
  if (!connectionString) {
    console.error('DATABASE_URL is not defined');
    return;
  }

  console.log('Applying schema to database using custom DNS...');
  
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sql = fs.readFileSync('schema.sql', 'utf8');
    
    // Split the SQL into blocks by the comments Prisma adds
    // This is safer than executing the whole thing at once if there are many statements
    const statements = sql.split(/-- .*/).filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      console.log('Executing statement...');
      await pool.query(statement);
    }
    
    console.log('Schema applied successfully!');
  } catch (error) {
    console.error('Failed to apply schema:', error);
  } finally {
    await pool.end();
  }
}

main();
