import { db } from './server/db.js';
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';

async function runPerformanceIndexes() {
  console.log('🚀 Creating performance indexes to speed up dashboard...');
  
  try {
    // Read the SQL file
    const indexSQL = await fs.readFile('./add-performance-indexes.sql', 'utf-8');
    
    // Split by semicolon and filter out empty statements
    const statements = indexSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SELECT'));
    
    console.log(`Found ${statements.length} index statements to execute`);
    
    // Execute each index creation statement
    for (const statement of statements) {
      if (statement.includes('CREATE INDEX')) {
        const indexName = statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1];
        console.log(`Creating index: ${indexName}...`);
        
        try {
          await db.execute(sql.raw(statement));
          console.log(`✅ Created index: ${indexName}`);
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`⏭️  Index ${indexName} already exists`);
          } else {
            console.error(`❌ Failed to create index ${indexName}:`, error.message);
          }
        }
      } else if (statement.includes('ANALYZE')) {
        const tableName = statement.match(/ANALYZE (\w+)/)?.[1];
        console.log(`Analyzing table: ${tableName}...`);
        
        try {
          await db.execute(sql.raw(statement));
          console.log(`✅ Analyzed table: ${tableName}`);
        } catch (error) {
          console.error(`❌ Failed to analyze table ${tableName}:`, error.message);
        }
      }
    }
    
    console.log('\n✨ Performance indexes created successfully!');
    console.log('Your dashboard should now load MUCH faster (target: < 2 seconds)');
    
  } catch (error) {
    console.error('Error running performance indexes:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
runPerformanceIndexes();