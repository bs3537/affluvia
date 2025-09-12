import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const sql = async (strings: TemplateStringsArray, ...values: any[]) => {
  const query = strings.join('');
  return client.query(query, values);
};

async function fixRetirementColumns() {
  console.log('Fixing retirement-related JSONB columns...');
  
  try {
    // Fix retirement_expense_budget column
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'financial_profiles'
            AND column_name = 'retirement_expense_budget'
            AND data_type <> 'jsonb'
        ) THEN
          ALTER TABLE financial_profiles
            ALTER COLUMN retirement_expense_budget
            TYPE jsonb
            USING CASE
              WHEN retirement_expense_budget IS NULL THEN NULL
              ELSE jsonb_build_object('essential', COALESCE(retirement_expense_budget::numeric, 0), 'discretionary', 0)
            END;
          RAISE NOTICE 'Fixed retirement_expense_budget column type to JSONB';
        END IF;
      END $$;
    `;
    console.log('✓ Fixed retirement_expense_budget column');

    // Fix retirement_contributions column
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'financial_profiles'
            AND column_name = 'retirement_contributions'
            AND data_type <> 'jsonb'
        ) THEN
          ALTER TABLE financial_profiles
            ALTER COLUMN retirement_contributions
            TYPE jsonb
            USING CASE
              WHEN retirement_contributions IS NULL THEN NULL
              ELSE jsonb_build_object('employee', COALESCE(retirement_contributions::numeric, 0), 'employer', 0)
            END;
          RAISE NOTICE 'Fixed retirement_contributions column type to JSONB';
        END IF;
      END $$;
    `;
    console.log('✓ Fixed retirement_contributions column');

    // Fix spouse_retirement_contributions column
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'financial_profiles'
            AND column_name = 'spouse_retirement_contributions'
            AND data_type <> 'jsonb'
        ) THEN
          ALTER TABLE financial_profiles
            ALTER COLUMN spouse_retirement_contributions
            TYPE jsonb
            USING CASE
              WHEN spouse_retirement_contributions IS NULL THEN NULL
              ELSE jsonb_build_object('employee', COALESCE(spouse_retirement_contributions::numeric, 0), 'employer', 0)
            END;
          RAISE NOTICE 'Fixed spouse_retirement_contributions column type to JSONB';
        END IF;
      END $$;
    `;
    console.log('✓ Fixed spouse_retirement_contributions column');

    // Verify the changes
    const verification = await sql`
      SELECT 
        column_name, 
        data_type,
        CASE 
          WHEN data_type = 'jsonb' THEN '✓ Fixed'
          ELSE '✗ Still needs fixing'
        END as status
      FROM information_schema.columns
      WHERE table_name = 'financial_profiles'
        AND column_name IN (
          'retirement_expense_budget',
          'retirement_contributions', 
          'spouse_retirement_contributions'
        )
      ORDER BY column_name;
    `;
    
    console.log('\nVerification Results:');
    console.table(verification.rows);
    
    console.log('\n✅ Database fix completed successfully!');
    console.log('You can now submit the intake form without errors.');
    
    await client.end();
    
  } catch (error) {
    console.error('Error fixing columns:', error);
    await client.end();
    process.exit(1);
  }
}

async function main() {
  await client.connect();
  await fixRetirementColumns();
}

main();