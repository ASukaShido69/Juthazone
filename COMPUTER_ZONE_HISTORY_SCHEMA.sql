-- Create computer_zone_history table to track individual computer zone customers
CREATE TABLE IF NOT EXISTS public.computer_zone_history (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_name VARCHAR(255) NOT NULL,
  hours DECIMAL(10, 2) NOT NULL,
  transfer_amount DECIMAL(10, 2) DEFAULT 0,
  cash_amount DECIMAL(10, 2) DEFAULT 0,
  total_cost DECIMAL(10, 2) NOT NULL,
  session_date DATE NOT NULL,
  shift VARCHAR(10) NOT NULL, -- '1', '2', '3', or 'all'
  start_time TIME,
  end_time TIME,
  description TEXT,
  added_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_computer_zone_history_date 
ON public.computer_zone_history(session_date);

CREATE INDEX IF NOT EXISTS idx_computer_zone_history_shift 
ON public.computer_zone_history(shift);

CREATE INDEX IF NOT EXISTS idx_computer_zone_history_user 
ON public.computer_zone_history(added_by);

-- Enable RLS (Row Level Security)
ALTER TABLE public.computer_zone_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all users to read computer_zone_history"
  ON public.computer_zone_history
  FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to insert computer_zone_history"
  ON public.computer_zone_history
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow users to delete their own computer_zone_history entries"
  ON public.computer_zone_history
  FOR DELETE
  USING (added_by = current_user);

-- Keep old computer_zone_summary table for daily summaries/reports
-- (If you want to drop it, uncomment the line below)
-- DROP TABLE IF EXISTS public.computer_zone_summary CASCADE;