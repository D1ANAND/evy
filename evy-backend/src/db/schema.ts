import type Database from 'better-sqlite3';

export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      customer_email TEXT,
      source TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'open',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ticket_analysis (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id),
      intent TEXT,
      priority TEXT,
      sentiment TEXT,
      escalation_risk TEXT,
      summary TEXT,
      suggested_category TEXT,
      analysis_model TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ticket_replies (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id),
      tone TEXT NOT NULL,
      content TEXT NOT NULL,
      model_used TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ticket_kb_answers (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      sources TEXT NOT NULL,
      model_used TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reply_scores (
      id TEXT PRIMARY KEY,
      reply_id TEXT NOT NULL REFERENCES ticket_replies(id),
      score INTEGER NOT NULL,
      feedback TEXT NOT NULL,
      improvements TEXT NOT NULL,
      model_used TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS handoff_notes (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      note TEXT NOT NULL,
      model_used TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oxlo_usage_log (
      id TEXT PRIMARY KEY,
      ticket_id TEXT,
      action TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL
    );
  `);
}
