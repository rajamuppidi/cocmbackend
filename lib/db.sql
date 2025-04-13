-- Create table for assigning patients to psychiatric consultants
CREATE TABLE IF NOT EXISTS patient_consultants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  consultant_id INT NOT NULL,
  referral_date DATE NOT NULL,
  referral_reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (consultant_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_patient_consultant (patient_id, consultant_id)
);

-- Create table for psychiatric consultations
CREATE TABLE IF NOT EXISTS psych_consultations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  consultant_id INT NOT NULL,
  consult_date DATE NOT NULL,
  minutes INT NOT NULL,
  recommendations TEXT NOT NULL,
  treatment_plan TEXT,
  medications TEXT,
  follow_up_needed TINYINT(1) DEFAULT 0,
  next_follow_up_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (consultant_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add column to minute_tracking table to track psychiatric consultation time
ALTER TABLE minute_tracking ADD COLUMN psych_consult_id INT NULL;
ALTER TABLE minute_tracking ADD CONSTRAINT fk_psych_consult FOREIGN KEY (psych_consult_id) REFERENCES psych_consultations(id) ON DELETE SET NULL;

-- Create care_manager_notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS care_manager_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  user_id INT NOT NULL,
  note_date DATE NOT NULL,
  content TEXT NOT NULL,
  referral_needed TINYINT(1) DEFAULT 0,
  psych_referral_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
); 