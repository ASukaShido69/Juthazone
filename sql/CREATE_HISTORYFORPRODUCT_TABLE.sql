-- SQL script to create historyforproduct table for product sales logging
-- Run this against your Supabase/PostgreSQL database before using product features.

CREATE TABLE IF NOT EXISTS historyforproduct (
    id bigserial PRIMARY KEY,
    product_name text NOT NULL,
    product_price numeric(10,2) NOT NULL,
    quantity integer NOT NULL,
    total_price numeric(10,2) NOT NULL,
    added_by text,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- index to speed up queries by creation time
CREATE INDEX IF NOT EXISTS idx_historyforproduct_created_at ON historyforproduct(created_at);

-- หากตารางมีอยู่แล้ว ให้รันคำสั่งนี้เพื่อเพิ่ม column:
-- ALTER TABLE historyforproduct ADD COLUMN IF NOT EXISTS added_by text;
-- ALTER TABLE historyforproduct ADD COLUMN IF NOT EXISTS note text;