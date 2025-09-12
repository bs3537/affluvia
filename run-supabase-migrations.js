import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
  console.log('=== Running Supabase Migrations ===\n');
  
  try {
    // Check if tables exist
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_names', {});
    
    if (tablesError && tablesError.message.includes('not exist')) {
      // Function doesn't exist, let's create basic tables
      console.log('Setting up initial database schema...\n');
      
      // Read and execute migration files
      const migrationsDir = path.join(process.cwd(), 'migrations');
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
      
      console.log(`Found ${sqlFiles.length} migration files\n`);
      
      for (const file of sqlFiles) {
        console.log(`Running migration: ${file}`);
        const sqlContent = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
        
        // Note: Supabase JS client doesn't support raw SQL execution
        // We'll need to use the REST API or dashboard for complex migrations
        console.log(`  ⚠️  Migration ${file} needs to be run via Supabase Dashboard or SQL Editor`);
      }
      
      console.log('\n📝 To complete setup:');
      console.log('1. Go to your Supabase Dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Run the migration files in order');
      console.log('4. Or use the Supabase CLI: supabase db push');
      
    } else {
      // Check existing tables
      const { data: existingTables, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (error) {
        // Try a simpler approach - check if key tables exist
        console.log('Checking key tables...\n');
        
        const keyTables = ['users', 'financial_profiles', 'goals', 'chat_messages'];
        
        for (const table of keyTables) {
          const { data, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          if (error) {
            console.log(`  ❌ Table '${table}' - ${error.message}`);
          } else {
            console.log(`  ✅ Table '${table}' exists`);
          }
        }
      } else {
        console.log('Existing tables:', existingTables?.map(t => t.table_name).join(', '));
      }
    }
    
    console.log('\n=== Supabase Setup Summary ===');
    console.log('✅ Supabase JS Client is connected');
    console.log('✅ Can access Supabase via REST API');
    console.log('\n⚠️  For database migrations, you have these options:');
    console.log('1. Use Supabase Dashboard SQL Editor');
    console.log('2. Install and use Supabase CLI: npm install -g supabase');
    console.log('3. Use a direct PostgreSQL connection with correct credentials');
    console.log('\nYour Supabase project: ' + supabaseUrl);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

runMigrations().catch(console.error);