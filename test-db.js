const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'Chef'
`, (err, res) => {
  if (err) {
    console.error('Error querying DB:', err);
  } else {
    console.log('Columns in Chef table:');
    res.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });
    if (res.rows.length === 0) {
      console.log('Table "Chef" not found or check case-sensitivity (try "chef").');
      pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'chef'
      `, (err2, res2) => {
        if (!err2) {
          console.log('Columns in chef table:');
          res2.rows.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));
        }
        pool.end();
      });
    } else {
      pool.end();
    }
  }
});
