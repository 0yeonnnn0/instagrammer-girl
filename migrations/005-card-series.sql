ALTER TABLE accounts ADD COLUMN card_topic_mode TEXT DEFAULT 'backup';
ALTER TABLE accounts ADD COLUMN card_series_framework TEXT DEFAULT 'React';
ALTER TABLE accounts ADD COLUMN card_series_total_parts INTEGER DEFAULT 10;
ALTER TABLE accounts ADD COLUMN card_series_current_part INTEGER DEFAULT 1;
ALTER TABLE accounts ADD COLUMN card_series_loop INTEGER DEFAULT 1;
