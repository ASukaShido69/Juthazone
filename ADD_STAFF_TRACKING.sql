-- Add staff member tracking to existing customers_history table
-- เพิ่มคอลัมน์ added_by เพื่อบันทึกพนักงานที่เพิ่มลูกค้า

-- Step 1: Add the added_by column
ALTER TABLE customers_history
ADD COLUMN IF NOT EXISTS added_by VARCHAR(50);

-- Step 2: Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_history_added_by ON customers_history(added_by);

-- Step 3: Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers_history' AND column_name = 'added_by';

-- Optional: Set default value for existing records (if needed)
-- UPDATE customers_history 
-- SET added_by = 'Juthazone' 
-- WHERE added_by IS NULL;
