-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'staff')),
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create login logs table for tracking
CREATE TABLE IF NOT EXISTS login_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username VARCHAR(50) NOT NULL,
  login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  logout_time TIMESTAMP WITH TIME ZONE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  duration_minutes INT
);

-- Create activity logs table for all user actions
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  username VARCHAR(50) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  data_changed JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  customer_id INT,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Insert default users (update passwords with secure ones)
INSERT INTO users (username, password, role, display_name) VALUES
  ('Juthazone', '081499', 'owner', 'เจ้าของ - Juthazone'),
  ('Leo', '081499', 'staff', 'พนักงาน - Leo'),
  ('Drive', '081499', 'staff', 'พนักงาน - Drive')
ON CONFLICT (username) DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_login_logs_username ON login_logs(username);
CREATE INDEX IF NOT EXISTS idx_login_logs_login_time ON login_logs(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_username ON activity_logs(username);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);

-- Create view for login statistics
CREATE OR REPLACE VIEW login_statistics AS
SELECT 
  username,
  COUNT(*) as total_logins,
  COUNT(CASE WHEN is_success = TRUE THEN 1 END) as successful_logins,
  COUNT(CASE WHEN is_success = FALSE THEN 1 END) as failed_logins,
  MAX(login_time) as last_login,
  AVG(EXTRACT(EPOCH FROM (logout_time - login_time))/60) as avg_session_duration_minutes
FROM login_logs
GROUP BY username;

-- Create view for activity statistics
CREATE OR REPLACE VIEW activity_statistics AS
SELECT 
  username,
  action_type,
  COUNT(*) as count,
  MAX(created_at) as last_activity
FROM activity_logs
GROUP BY username, action_type;
