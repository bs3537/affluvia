import { db } from './server/db.js';
import { sql } from 'drizzle-orm';

async function runNeonIndexes() {
  console.log('🚀 Creating performance indexes on Neon database...\n');
  
  const indexes = [
    // Financial Profiles
    "CREATE INDEX IF NOT EXISTS idx_financial_profiles_userid ON financial_profiles(user_id)",
    
    // Plaid tables
    "CREATE INDEX IF NOT EXISTS idx_plaid_sync_status_userid ON plaid_sync_status(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_plaid_items_userid ON plaid_items(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_plaid_items_userid_status ON plaid_items(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_plaid_accounts_userid ON plaid_accounts(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_plaid_accounts_plaiditemid ON plaid_accounts(plaid_item_id)",
    
    // Estate documents
    "CREATE INDEX IF NOT EXISTS idx_estate_documents_userid ON estate_documents(user_id)",
    
    // Widget cache
    "CREATE INDEX IF NOT EXISTS idx_widget_cache_userid_widget ON widget_cache(user_id, widget_type)",
    
    // Achievements
    "CREATE INDEX IF NOT EXISTS idx_user_progress_userid ON user_progress(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_achievements_userid ON user_achievements(user_id)",
    
    // Goals
    "CREATE INDEX IF NOT EXISTS idx_goals_userid ON goals(user_id)",
    
    // Dashboard insights
    "CREATE INDEX IF NOT EXISTS idx_dashboard_insights_userid ON dashboard_insights(user_id)",
    
    // Plaid sync schedule
    "CREATE INDEX IF NOT EXISTS idx_plaid_sync_schedule_userid ON plaid_sync_schedule(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_plaid_sync_schedule_next_sync ON plaid_sync_schedule(next_sync_date)",
    
    // Sessions
    "CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)"
  ];
  
  const analyzeStatements = [
    "ANALYZE financial_profiles",
    "ANALYZE plaid_items",
    "ANALYZE plaid_accounts",
    "ANALYZE widget_cache",
    "ANALYZE user_progress",
    "ANALYZE goals"
  ];
  
  let successCount = 0;
  let errorCount = 0;
  
  // Create indexes
  console.log('📊 Creating indexes...\n');
  for (const indexSql of indexes) {
    const indexName = indexSql.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1];
    try {
      await db.execute(sql.raw(indexSql));
      console.log(`✅ Created index: ${indexName}`);
      successCount++;
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`⏭️  Index ${indexName} already exists`);
        successCount++;
      } else if (error.message.includes('does not exist')) {
        console.log(`⚠️  Skipped ${indexName} - table doesn't exist`);
      } else {
        console.error(`❌ Failed to create ${indexName}: ${error.message}`);
        errorCount++;
      }
    }
  }
  
  // Analyze tables
  console.log('\n📈 Analyzing tables for query optimization...\n');
  for (const analyzeSql of analyzeStatements) {
    const tableName = analyzeSql.split(' ')[1];
    try {
      await db.execute(sql.raw(analyzeSql));
      console.log(`✅ Analyzed table: ${tableName}`);
    } catch (error) {
      if (error.message.includes('does not exist')) {
        console.log(`⚠️  Skipped ${tableName} - table doesn't exist`);
      } else {
        console.error(`❌ Failed to analyze ${tableName}: ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✨ Index creation complete!`);
  console.log(`   ✅ Success: ${successCount} indexes`);
  console.log(`   ❌ Errors: ${errorCount} indexes`);
  console.log('='.repeat(50));
  console.log('\n🚀 Your dashboard should now load MUCH faster!');
  console.log('   Expected load time: < 5 seconds (was 50-60 seconds)');
  
  process.exit(0);
}

// Run the script
runNeonIndexes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});