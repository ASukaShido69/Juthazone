-- Create computer_zone_summary table for daily manual entries with payment methods
CREATE TABLE IF NOT EXISTS public.computer_zone_summary (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  summary_date DATE NOT NULL,
  hours DECIMAL(10, 2) NOT NULL,
  transfer_amount DECIMAL(10, 2) DEFAULT 0,
  cash_amount DECIMAL(10, 2) DEFAULT 0,
  total_cost DECIMAL(10, 2) NOT NULL,
  description TEXT,
  added_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_computer_zone_summary_date 
ON public.computer_zone_summary(summary_date);

-- Create index for added_by for user activity tracking
CREATE INDEX IF NOT EXISTS idx_computer_zone_summary_user 
ON public.computer_zone_summary(added_by);

-- Enable RLS (Row Level Security)
ALTER TABLE public.computer_zone_summary ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read all records
CREATE POLICY "Allow all users to read computer_zone_summary"
  ON public.computer_zone_summary
  FOR SELECT
  USING (true);

-- Create policy to allow authenticated users to insert
CREATE POLICY "Allow authenticated users to insert computer_zone_summary"
  ON public.computer_zone_summary
  FOR INSERT
  WITH CHECK (true);

-- Create policy to allow users to delete their own entries
CREATE POLICY "Allow users to delete their own computer_zone_summary entries"
  ON public.computer_zone_summary
  FOR DELETE
  USING (added_by = current_user);

-- Add payment_method column to customers_history if not exists
ALTER TABLE IF EXISTS public.customers_history 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'transfer';
