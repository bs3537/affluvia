import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config({ override: true });

async function testSupabaseConnection() {
  console.log('Testing Supabase Connection...\n');
  
  // Test 1: Supabase JS Client
  console.log('1. Testing Supabase JS Client:');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  console.log('   Supabase URL:', supabaseUrl);
  console.log('   Has Anon Key:', !!supabaseKey);
  
  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Try to fetch a simple count from users table
      const { data, error, count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log('   ❌ Supabase Client Error:', error.message);
      } else {
        console.log('   ✅ Supabase Client Connected Successfully');
      }
    } catch (e) {
      console.log('   ❌ Supabase Client Exception:', e.message);
    }
  } else {
    console.log('   ⚠️  Missing Supabase URL or Anon Key');
  }
  
  // Test 2: Direct PostgreSQL Connection
  console.log('\n2. Testing Direct PostgreSQL Connection:');
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    console.log('   Database URL pattern:', databaseUrl.replace(/:[^:@]+@/, ':***@'));
    
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      console.log('   ✅ PostgreSQL Connected:', result.rows[0].now);
      
      // Check if tables exist
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
        LIMIT 10
      `);
      
      console.log('\n   Available tables (first 10):');
      tablesResult.rows.forEach(row => {
        console.log('     -', row.table_name);
      });
      
      client.release();
      await pool.end();
    } catch (e) {
      console.log('   ❌ PostgreSQL Error:', e.message);
      if (e.message.includes('password')) {
        console.log('   💡 Hint: Check if password is properly URL-encoded (@ should be %40)');
      }
      if (e.message.includes('Tenant')) {
        console.log('   💡 Hint: Check if the database URL format is correct for Supabase');
      }
    }
  } else {
    console.log('   ⚠️  DATABASE_URL not found in environment');
  }
  
  // Provide connection string format help
  console.log('\n📝 Correct Supabase DATABASE_URL format:');
  console.log('   postgres://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres');
  console.log('   - Password special chars must be URL-encoded (@ = %40, ! = %21, etc.)');
  console.log('   - Port 6543 for session pooling, 5432 for direct connection');
}

testSupabaseConnection().catch(console.error);
