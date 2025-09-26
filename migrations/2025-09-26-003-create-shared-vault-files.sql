CREATE TABLE IF NOT EXISTS shared_vault_files (
    id serial PRIMARY KEY,
    owner_client_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    advisor_id integer REFERENCES users(id) ON DELETE SET NULL,
    uploader_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    file_size bigint NOT NULL,
    checksum text,
    encryption_algorithm text NOT NULL DEFAULT 'aes-256-gcm',
    key_salt text NOT NULL,
    encryption_iv text NOT NULL,
    auth_tag text NOT NULL,
    encrypted_data text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_vault_files_owner_idx ON shared_vault_files(owner_client_id);
CREATE INDEX IF NOT EXISTS shared_vault_files_advisor_idx ON shared_vault_files(advisor_id);
CREATE INDEX IF NOT EXISTS shared_vault_files_uploader_idx ON shared_vault_files(uploader_id);
