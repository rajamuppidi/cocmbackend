-- Create safety_plan_history table
CREATE TABLE IF NOT EXISTS safety_plan_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  action ENUM('created', 'resolved') NOT NULL,
  action_date DATETIME NOT NULL,
  resolved_by INT NULL,
  minutes_spent INT DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add activity_type column to minute_tracking table if it doesn't exist
-- Check if the column exists first
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = 'caseload_tracker' 
               AND TABLE_NAME = 'minute_tracking' 
               AND COLUMN_NAME = 'activity_type');

SET @query := IF(@exist = 0, 
                'ALTER TABLE minute_tracking ADD COLUMN activity_type VARCHAR(50) DEFAULT "Patient Contact"', 
                'SELECT "Column already exists"');

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt; 