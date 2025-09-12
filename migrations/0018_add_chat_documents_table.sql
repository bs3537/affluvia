-- Add chat_documents table for file uploads in chat
CREATE TABLE IF NOT EXISTS "chat_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "message_id" integer,
  "file_name" text NOT NULL,
  "original_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size" integer NOT NULL,
  "file_path" text NOT NULL,
  "processing_status" text DEFAULT 'pending' NOT NULL,
  "extracted_text" text,
  "extracted_data" jsonb,
  "ai_summary" text,
  "ai_insights" jsonb,
  "document_type" text,
  "document_category" text,
  "uploaded_at" timestamp DEFAULT now(),
  "processed_at" timestamp,
  "updated_at" timestamp DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE "chat_documents" ADD CONSTRAINT "chat_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "chat_documents" ADD CONSTRAINT "chat_documents_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE cascade ON UPDATE no action;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_chat_documents_user_id" ON "chat_documents" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_chat_documents_message_id" ON "chat_documents" ("message_id");
CREATE INDEX IF NOT EXISTS "idx_chat_documents_document_type" ON "chat_documents" ("document_type");
CREATE INDEX IF NOT EXISTS "idx_chat_documents_uploaded_at" ON "chat_documents" ("uploaded_at");