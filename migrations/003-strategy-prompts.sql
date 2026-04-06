ALTER TABLE accounts ADD COLUMN card_strategy TEXT DEFAULT 'tutorial';
ALTER TABLE accounts ADD COLUMN reel_strategy TEXT DEFAULT 'news';
ALTER TABLE accounts ADD COLUMN card_strategy_prompt TEXT;
ALTER TABLE accounts ADD COLUMN reel_strategy_prompt TEXT;
