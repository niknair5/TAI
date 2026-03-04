-- =====================================================
-- TA-I Analytics Columns
-- =====================================================
-- Adds columns to chat_messages needed for the teacher
-- analytics dashboard: sources, action, and topic.

-- Sources: which course files / chunks were retrieved
alter table chat_messages
  add column if not exists sources jsonb;

-- Action: hint-controller decision (answer | answer_with_integrity_refusal | refuse_out_of_scope)
alter table chat_messages
  add column if not exists action text
    check (action in ('answer', 'answer_with_integrity_refusal', 'refuse_out_of_scope'));

-- Topic: short LLM-extracted topic label (2-5 words)
alter table chat_messages
  add column if not exists topic text;

-- Index for analytics queries that filter on action
create index if not exists idx_chat_messages_action on chat_messages(action);

-- Index for analytics queries that group by topic
create index if not exists idx_chat_messages_topic on chat_messages(topic);
