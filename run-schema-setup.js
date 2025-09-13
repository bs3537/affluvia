import pg from 'pg';
const { Pool } = pg;
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

async function runSchemaSetup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Setting up Supabase database schema...\n');
    
    const sqlContent = await fs.readFile('setup-supabase-schema.sql', 'utf-8');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      console.log('Running schema setup in transaction...');
      
      await client.query(sqlContent);
      
      await client.query('COMMIT');
      console.log('✅ Schema setup completed successfully!');
      
      // Verify tables were created
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      console.log('\n📊 Created tables:');
      result.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error during schema setup:', error.message);
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Failed to setup schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSchemaSetup();