-- Add custom prompt fields to accounts
ALTER TABLE accounts ADD COLUMN card_prompt TEXT;
ALTER TABLE accounts ADD COLUMN reel_prompt TEXT;
