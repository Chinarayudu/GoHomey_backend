import dns from 'dns';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Force use of Google DNS for this process
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectionString = process.env.DATABASE_URL;

async function main() {
  if (!connectionString) {
    console.error('DATABASE_URL is not defined');
    return;
  }

  console.log('Attempting to connect to database using custom DNS and PrismaPg adapter...');
  
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter: adapter as any });

  try {
    await prisma.$connect();
    console.log('Successfully connected to the database!');
    
    // Check if tables exist by querying something 
    // (This might fail if schema isn't pushed yet, but it confirms connection)
    try {
        const users = await prisma.user.findMany({ take: 1 });
        console.log('Query successful, found users count:', users.length);
    } catch (e: any) {
        if (e.code === 'P2021') {
            console.log('Connected, but tables do not exist yet (expected since we haven\'t pushed schema).');
        } else {
            console.error('Query failed:', e.message);
        }
    }
  } catch (error) {
    console.error('Failed to connect:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
