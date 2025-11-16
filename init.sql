CREATE TABLE IF NOT EXISTS users (
    phone_number VARCHAR(20) PRIMARY KEY,
    first_interaction TIMESTAMP DEFAULT NOW(),
    last_interaction TIMESTAMP DEFAULT NOW(),
    total_messages INTEGER DEFAULT 0,
    risk_level VARCHAR(20) DEFAULT 'none',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) REFERENCES users(phone_number),
    message TEXT NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    risk_level VARCHAR(20) DEFAULT 'none',
    risk_categories TEXT[],
    timestamp TIMESTAMP DEFAULT NOW(),
    session_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb
);


CREATE TABLE IF NOT EXISTS crisis_events (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) REFERENCES users(phone_number),
    risk_level VARCHAR(20) NOT NULL,
    risk_categories TEXT[] NOT NULL,
    message_preview TEXT,
    escalated BOOLEAN DEFAULT false,
    resolved BOOLEAN DEFAULT false,
    timestamp TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS check_ins (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) REFERENCES users(phone_number),
    sent_at TIMESTAMP DEFAULT NOW(),
    responded BOOLEAN DEFAULT false,
    response_text TEXT,
    response_time TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_risk_level ON conversations(risk_level);
CREATE INDEX IF NOT EXISTS idx_crisis_events_phone ON crisis_events(phone_number);
CREATE INDEX IF NOT EXISTS idx_crisis_events_timestamp ON crisis_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_crisis_events_resolved ON crisis_events(resolved);
CREATE INDEX IF NOT EXISTS idx_users_risk_level ON users(risk_level);
CREATE INDEX IF NOT EXISTS idx_users_last_interaction ON users(last_interaction DESC);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_check_ins_phone ON check_ins(phone_number);
CREATE INDEX IF NOT EXISTS idx_check_ins_sent_at ON check_ins(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_responded ON check_ins(responded);


GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
