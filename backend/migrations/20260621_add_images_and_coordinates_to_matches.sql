-- Add columns to tenant_matches to support images, source link conditional visibility, and coordinates
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS include_source_link BOOLEAN DEFAULT FALSE;
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE tenant_matches ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
