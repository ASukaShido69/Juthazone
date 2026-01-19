-- =====================================================
-- CLEANUP DUPLICATE HISTORY RECORDS
-- =====================================================
-- Purpose: Remove duplicate history records caused by INSERT instead of UPDATE
-- Safe to run: This script only marks duplicates, doesn't delete data immediately

-- Step 1: Check for duplicates (same customer_id with multiple 'completed' or 'in_progress' records)
SELECT 
  customer_id,
  name,
  end_reason,
  COUNT(*) as count,
  array_agg(id ORDER BY created_at DESC) as record_ids,
  array_agg(created_at ORDER BY created_at DESC) as created_times
FROM customers_history
WHERE end_reason IN ('completed', 'in_progress')
GROUP BY customer_id, name, end_reason
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- =====================================================
-- Step 2: Mark old duplicate 'completed' records as 'duplicate_completed'
-- (Keep the most recent one for each customer_id)
-- =====================================================
UPDATE customers_history
SET end_reason = 'duplicate_completed'
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      customer_id,
      ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) as rn
    FROM customers_history
    WHERE end_reason = 'completed'
  ) ranked
  WHERE rn > 1
);

-- =====================================================
-- Step 3: Mark old duplicate 'in_progress' records as 'duplicate_in_progress'
-- (Keep the most recent one for each customer_id)
-- =====================================================
UPDATE customers_history
SET end_reason = 'duplicate_in_progress'
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      customer_id,
      ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) as rn
    FROM customers_history
    WHERE end_reason = 'in_progress'
  ) ranked
  WHERE rn > 1
);

-- =====================================================
-- Step 4: Verify cleanup results
-- =====================================================
SELECT 
  end_reason,
  COUNT(*) as count
FROM customers_history
GROUP BY end_reason
ORDER BY count DESC;

-- =====================================================
-- Step 5 (OPTIONAL): Delete marked duplicates after verification
-- WARNING: This permanently deletes data! Only run after confirming Step 4 results
-- =====================================================
-- Uncomment the lines below to permanently delete duplicates:

-- DELETE FROM customers_history 
-- WHERE end_reason IN ('duplicate_completed', 'duplicate_in_progress');

-- SELECT 'Duplicates marked successfully. Review marked records before deleting.' AS status;

-- =====================================================
-- Step 6 (RECOMMENDED): Create unique constraint to prevent future duplicates
-- =====================================================
-- This ensures only ONE 'in_progress' record per customer_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_in_progress_per_customer
ON customers_history(customer_id)
WHERE end_reason = 'in_progress';

-- =====================================================
-- EXPLANATION:
-- =====================================================
-- Why duplicates happened:
-- 1. addCustomer() → INSERT (end_reason = 'in_progress')
-- 2. handleCompleteSession() → UPDATE should target specific record
-- 3. But if multiple 'in_progress' exist, ALL get updated to 'completed'
-- 4. Result: Multiple 'completed' records for same customer
--
-- Fix implemented in code:
-- 1. Store history_record_id in customer object when INSERT
-- 2. Use history_record_id (exact ID) for UPDATE instead of customer_id filter
-- 3. If history_record_id not available, fallback to customer_id + end_reason filter
--
-- This cleanup script:
-- 1. Marks old duplicates (keeps newest)
-- 2. Allows manual review before deletion
-- 3. Creates unique constraint to prevent future duplicates
-- =====================================================

SELECT 'Cleanup complete! Review results and uncomment DELETE statement if needed.' AS status;
