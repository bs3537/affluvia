const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSessions() {
  try {
    // Check if sessions table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sessions'
      );
    `);
    console.log('Sessions table exists:', tableCheck.rows[0].exists);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating sessions table...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR NOT NULL COLLATE "default",
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL,
          PRIMARY KEY (sid)
        );
        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions ("expire");
      `);
      console.log('Sessions table created!');
    }
    
    // Check session count
    const countResult = await pool.query('SELECT COUNT(*) FROM sessions');
    console.log('Number of sessions:', countResult.rows[0].count);
    
    // Check users
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log('Number of users:', userCount.rows[0].count);
    
    // List first few users (without passwords)
    const users = await pool.query('SELECT id, email, username FROM users LIMIT 5');
    console.log('Sample users:', users.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSessions();