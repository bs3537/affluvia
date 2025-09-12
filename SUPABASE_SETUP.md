Supabase Integration Quick Setup

1) Env vars (Server)

- DATABASE_URL=postgres://postgres:URL_ENCODED_PASSWORD@db.PROJECT_ID.supabase.co:6543/postgres
- SUPABASE_URL=https://PROJECT_ID.supabase.co
- SUPABASE_ANON_KEY=... (publishable)
- SUPABASE_SERVICE_ROLE_KEY=... (server-only; optional)

Notes:
- Encode special characters in the password (e.g., @ => %40)
- 6543 is Supabase Session Mode (pooled)
- SSL is enabled automatically in production

2) Env vars (Client)

- VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
- VITE_SUPABASE_ANON_KEY=...

3) Run migrations / indexes

- npx tsx server/apply-migrations.ts
- node create-indexes.js
- npx tsx server/run-sql-file.ts path/to.sql (as needed)

4) Verify connection

Use a simple pg script or run the app; look for successful DB reads/writes.

5) Using supabase-js (optional)

- Server: import { requireSupabase } from './server/supabase'
- Client: import { supabase } from '@/lib/supabase'

