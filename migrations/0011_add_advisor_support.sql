-- Add role and full_name to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'individual';

-- Advisor clients linking table
CREATE TABLE IF NOT EXISTS advisor_clients (
  id serial PRIMARY KEY,
  advisor_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT advisor_clients_unique UNIQUE (advisor_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_advisor_clients_advisor ON advisor_clients(advisor_id);
CREATE INDEX IF NOT EXISTS idx_advisor_clients_client ON advisor_clients(client_id);

-- Advisor invites table
CREATE TABLE IF NOT EXISTS advisor_invites (
  id serial PRIMARY KEY,
  advisor_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  expires_at timestamp with time zone NOT NULL,
  client_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisor_invites_email ON advisor_invites(email);
CREATE INDEX IF NOT EXISTS idx_advisor_invites_token_hash ON advisor_invites(token_hash);

-- Advisor audit logs
CREATE TABLE IF NOT EXISTS advisor_audit_logs (
  id serial PRIMARY KEY,
  actor_advisor_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity text NOT NULL,
  entity_id integer,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advisor_audit_client_created ON advisor_audit_logs(client_id, created_at);

