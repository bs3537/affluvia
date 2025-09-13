-- Security & Compliance Tables for Plaid Integration
-- Audit Logs, User Consent, and Security Tracking

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for efficient querying
  INDEX idx_audit_user_id (user_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created_at (created_at),
  INDEX idx_audit_resource (resource_type, resource_id)
);

-- User Consent Tracking
CREATE TABLE IF NOT EXISTS user_consents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  consent_type VARCHAR(50) NOT NULL, -- 'plaid_data_sharing', 'marketing', 'analytics', etc
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMP,
  revoked_at TIMESTAMP,
  ip_address INET,
  consent_version VARCHAR(20), -- Track consent version/terms
  details JSONB, -- Additional consent details
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one active consent per type per user
  UNIQUE(user_id, consent_type),
  INDEX idx_consent_user (user_id),
  INDEX idx_consent_type (consent_type)
);

-- Plaid Webhook Events
CREATE TABLE IF NOT EXISTS plaid_webhook_events (
  id SERIAL PRIMARY KEY,
  plaid_item_id INTEGER REFERENCES plaid_items(id) ON DELETE CASCADE,
  webhook_type VARCHAR(50) NOT NULL,
  webhook_code VARCHAR(50) NOT NULL,
  item_id VARCHAR(255) NOT NULL,
  error JSON,
  new_transactions INTEGER,
  removed_transactions JSON,
  webhook_id VARCHAR(255) UNIQUE,
  environment VARCHAR(20),
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  retry_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  
  INDEX idx_webhook_item (plaid_item_id),
  INDEX idx_webhook_status (status),
  INDEX idx_webhook_received (received_at)
);

-- Security Events Log
CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL, -- 'login_attempt', 'token_rotation', 'access_denied', etc
  severity VARCHAR(20) NOT NULL, -- 'info', 'warning', 'error', 'critical'
  description TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_security_user (user_id),
  INDEX idx_security_type (event_type),
  INDEX idx_security_severity (severity),
  INDEX idx_security_created (created_at)
);

-- Token Rotation Tracking
CREATE TABLE IF NOT EXISTS token_rotations (
  id SERIAL PRIMARY KEY,
  plaid_item_id INTEGER REFERENCES plaid_items(id) ON DELETE CASCADE NOT NULL,
  old_token_hash VARCHAR(64), -- Store hash of old token for audit
  new_token_hash VARCHAR(64), -- Store hash of new token for audit
  rotation_reason VARCHAR(50), -- 'scheduled', 'webhook', 'manual', 'security'
  rotated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rotated_by INTEGER REFERENCES users(id),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  INDEX idx_rotation_item (plaid_item_id),
  INDEX idx_rotation_date (rotated_at)
);

-- Data Access Log for GDPR/CCPA compliance
CREATE TABLE IF NOT EXISTS data_access_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  accessed_by INTEGER REFERENCES users(id), -- Who accessed the data
  data_type VARCHAR(50) NOT NULL, -- 'financial_profile', 'transactions', 'accounts', etc
  purpose VARCHAR(100) NOT NULL, -- 'user_request', 'support', 'analytics', etc
  fields_accessed TEXT[], -- Specific fields that were accessed
  export_format VARCHAR(20), -- 'json', 'csv', 'pdf', null for view-only
  ip_address INET,
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_access_user (user_id),
  INDEX idx_access_by (accessed_by),
  INDEX idx_access_date (accessed_at)
);

-- Add encryption metadata columns to sensitive tables
ALTER TABLE plaid_items 
  ADD COLUMN IF NOT EXISTS encryption_version VARCHAR(10) DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS last_security_check TIMESTAMP,
  ADD COLUMN IF NOT EXISTS requires_reauth BOOLEAN DEFAULT false;

ALTER TABLE plaid_accounts
  ADD COLUMN IF NOT EXISTS data_encrypted BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS encryption_timestamp TIMESTAMP;

ALTER TABLE plaid_transactions
  ADD COLUMN IF NOT EXISTS pii_removed BOOLEAN DEFAULT false;

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply auto-update trigger to user_consents
CREATE TRIGGER update_user_consents_updated_at 
  BEFORE UPDATE ON user_consents 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system operations';
COMMENT ON TABLE user_consents IS 'Track user consent for data processing and sharing';
COMMENT ON TABLE plaid_webhook_events IS 'Plaid webhook events for real-time updates';
COMMENT ON TABLE security_events IS 'Security-related events and incidents';
COMMENT ON TABLE token_rotations IS 'Track access token rotations for security compliance';
COMMENT ON TABLE data_access_logs IS 'GDPR/CCPA compliance - track who accesses user data';