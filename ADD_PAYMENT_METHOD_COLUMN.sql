-- Add payment_method column to customers_history table
-- Allows tracking whether payment was made via transfer or cash

ALTER TABLE public.customers_history 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'transfer';

-- Create index for faster queries by payment method
CREATE INDEX IF NOT EXISTS idx_customers_history_payment_method 
ON public.customers_history(payment_method);

-- Add comment for clarity
COMMENT ON COLUMN public.customers_history.payment_method IS 'วิธีการชำระเงิน: transfer (โอน) หรือ cash (เงินสด)';

-- Optional: Update existing records with default value if needed
UPDATE public.customers_history 
SET payment_method = 'transfer' 
WHERE payment_method IS NULL;
