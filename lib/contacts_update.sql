-- Add columns to contacts table for psychiatric consultation referrals
ALTER TABLE contacts ADD COLUMN discuss_with_consultant TINYINT(1) DEFAULT 0;
ALTER TABLE contacts ADD COLUMN psychiatric_consultant_id INT NULL;
ALTER TABLE contacts ADD COLUMN consultant_notes TEXT NULL;
 
-- Add foreign key constraint
ALTER TABLE contacts ADD CONSTRAINT fk_psych_consultant FOREIGN KEY (psychiatric_consultant_id) REFERENCES users(id) ON DELETE SET NULL; 