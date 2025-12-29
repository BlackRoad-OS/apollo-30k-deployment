-- Apollo Agent Registry Schema
-- D1 Database for tracking 30,000 agents

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  core TEXT NOT NULL CHECK(core IN ('aria', 'lucidia', 'silas', 'cecilia', 'cadence', 'alice')),
  capability TEXT NOT NULL,
  zone TEXT NOT NULL CHECK(zone IN ('railway', 'cloudflare', 'digitalocean', 'pi')),
  status TEXT NOT NULL CHECK(status IN ('active', 'paused', 'error', 'offline')),
  health_score INTEGER DEFAULT 100 CHECK(health_score >= 0 AND health_score <= 100),
  last_heartbeat TIMESTAMP,
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT -- JSON
);

CREATE INDEX IF NOT EXISTS idx_agents_zone ON agents(zone);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_core ON agents(core);
CREATE INDEX IF NOT EXISTS idx_agents_health ON agents(health_score);
CREATE INDEX IF NOT EXISTS idx_agents_heartbeat ON agents(last_heartbeat);

-- Audit log for all agent actions
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT,
  metadata TEXT, -- JSON
  hash TEXT NOT NULL, -- PS-SHA-∞ chain
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- Job execution log
CREATE TABLE IF NOT EXISTS job_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  execution_time INTEGER, -- milliseconds
  error TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_job_agent ON job_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_job_status ON job_log(status);
CREATE INDEX IF NOT EXISTS idx_job_started ON job_log(started_at);

-- Healing actions log
CREATE TABLE IF NOT EXISTS healing_log (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('restart', 'replace', 'ignore')),
  reason TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  execution_time INTEGER NOT NULL, -- milliseconds
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE INDEX IF NOT EXISTS idx_healing_agent ON healing_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_healing_timestamp ON healing_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_healing_success ON healing_log(success);

-- Scaling events log
CREATE TABLE IF NOT EXISTS scaling_log (
  id TEXT PRIMARY KEY,
  zone TEXT NOT NULL CHECK(zone IN ('railway', 'cloudflare', 'digitalocean', 'pi')),
  action TEXT NOT NULL CHECK(action IN ('scale-up', 'scale-down')),
  from_count INTEGER NOT NULL,
  to_count INTEGER NOT NULL,
  reason TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scaling_zone ON scaling_log(zone);
CREATE INDEX IF NOT EXISTS idx_scaling_timestamp ON scaling_log(timestamp);
