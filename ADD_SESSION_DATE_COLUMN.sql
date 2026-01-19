-- Add session_date column to customers_history table
-- This ensures daily cutoff at 00:00 based on when customer started, not when they finished

-- Add column if not exists
ALTER TABLE public.customers_history 
ADD COLUMN IF NOT EXISTS session_date DATE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_customers_history_session_date 
ON public.customers_history(session_date);

-- Update existing records to populate session_date from start_time
UPDATE public.customers_history 
SET session_date = DATE(start_time)
WHERE session_date IS NULL;

-- Make it NOT NULL after populating existing data
ALTER TABLE public.customers_history 
ALTER COLUMN session_date SET NOT NULL;

COMMENT ON COLUMN public.customers_history.session_date IS 'วันที่เริ่มใช้บริการ (สำหรับตัดยอดรายวันที่ 00:00 น.)';
