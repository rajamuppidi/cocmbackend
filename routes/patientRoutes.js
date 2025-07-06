// module.exports = router;

const express = require('express');
const db = require('../lib/db');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const ReminderService = require('../services/reminder.service');
const { format, parseISO } = require('date-fns');

// Create a new patient
router.post('/patients',
  [
    body('clinicId').isInt().withMessage('Clinic ID must be an integer'),
    body('mrn').isAlphanumeric().withMessage('MRN must be alphanumeric'),
    body('firstName').notEmpty().withMessage('First Name is required'),
    body('lastName').notEmpty().withMessage('Last Name is required'),
    body('enrollmentDate').matches(/^\d{2}\/\d{2}\/\d{4}$/).withMessage('Enrollment Date must be in MM/DD/YYYY format'),
    body('dob').matches(/^\d{2}\/\d{2}\/\d{4}$/).withMessage('Date of Birth must be in MM/DD/YYYY format')
  ],
  async (req, res) => {
    console.log('Received data:', JSON.stringify(req.body, null, 2));
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { clinicId, mrn, firstName, lastName, enrollmentDate, dob, careManagerId, psychiatricConsultantId, primaryCarePhysicianId } = req.body;

    try {
      const [result] = await db.query(
        `INSERT INTO patients (clinic_id, mrn, first_name, last_name, enrollment_date, dob, status) 
         VALUES (?, ?, ?, ?, STR_TO_DATE(?, '%m/%d/%Y'), STR_TO_DATE(?, '%m/%d/%Y'), 'E')`,
        [clinicId, mrn, firstName, lastName, enrollmentDate, dob]
      );

      const patientId = result.insertId;
      const today = new Date();
      const birthDate = new Date(dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;

      if (age >= 0 && age <= 21) {
        await db.query(`INSERT INTO patient_flags (patient_id, flag) VALUES (?, 'Pediatric Patient')`, [patientId]);
      }

      const providers = [
        { userId: careManagerId, providerType: 'BHCM' },
        { userId: psychiatricConsultantId, providerType: 'Psychiatric Consultant' },
        { userId: primaryCarePhysicianId, providerType: 'Primary Care Physician' }
      ];

      for (const provider of providers) {
        if (provider.userId) {
          await db.query(
            `INSERT INTO user_patients (user_id, patient_id, provider_type, service_begin_date) VALUES (?, ?, ?, CURDATE())`,
            [provider.userId, patientId, provider.providerType]
          );
        }
      }

      res.status(201).json({ id: patientId });
    } catch (error) {
      console.error('Error creating patient:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get patient flags
router.get('/patients/:id/flags', async (req, res) => {
  const { id } = req.params;
  try {
    const [flags] = await db.query(`SELECT flag FROM patient_flags WHERE patient_id = ?`, [id]);
    res.status(200).json({ flags });
  } catch (error) {
    console.error('Error fetching patient flags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch care managers
router.get('/patients/care-managers', async (req, res) => {
  const { clinicId } = req.query;
  console.log(`Fetching care managers for clinic ID: ${clinicId}`);
  try {
    const [rows] = await db.query(
      'SELECT u.id, u.name FROM users u JOIN user_clinics uc ON u.id = uc.user_id WHERE u.role = "BHCM" AND uc.clinic_id = ?',
      [clinicId]
    );
    console.log('Care managers fetched:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching care managers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch consultants
router.get('/patients/consultants', async (req, res) => {
  const { clinicId } = req.query;
  console.log(`Fetching consultants for clinic ID: ${clinicId}`);
  if (!clinicId || isNaN(Number(clinicId))) {
    console.error('Invalid clinic ID:', clinicId);
    return res.status(400).json({ error: 'Invalid clinic ID' });
  }
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name FROM users u JOIN user_clinics uc ON u.id = uc.user_id WHERE u.role = "Psychiatric Consultant" AND uc.clinic_id = ?`,
      [clinicId]
    );
    console.log('Consultants fetched:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching consultants:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Fetch primary care physicians
router.get('/patients/primary-care-physicians', async (req, res) => {
  const { clinicId } = req.query;
  console.log(`Fetching primary care physicians for clinic ID: ${clinicId}`);
  try {
    const [rows] = await db.query(
      'SELECT u.id, u.name FROM users u JOIN user_clinics uc ON u.id = uc.user_id WHERE u.role = "Primary Care Physician" AND uc.clinic_id = ?',
      [clinicId]
    );
    console.log('Primary care physicians fetched:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching primary care physicians:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch active patients
router.get('/patients/active', async (req, res) => {
  const { clinicId } = req.query;
  console.log(`Fetching active patients for clinic ID: ${clinicId}`);
  try {
    const query = `
      SELECT p.id, p.mrn, p.first_name AS firstName, p.last_name AS lastName, p.status,
             DATE_FORMAT(p.dob, '%Y-%m-%d') AS dob, 
             DATE_FORMAT(p.enrollment_date, '%Y-%m-%d') AS enrollmentDate,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'PHQ-9' ORDER BY created_at ASC LIMIT 1) AS phq9First,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'PHQ-9' ORDER BY created_at DESC LIMIT 1) AS phq9Last,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'GAD-7' ORDER BY created_at ASC LIMIT 1) AS gad7First,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'GAD-7' ORDER BY created_at DESC LIMIT 1) AS gad7Last
      FROM patients p
      WHERE p.clinic_id = ? AND p.status IN ('A', 'R', 'T')
    `;
    const [patients] = await db.query(query, [clinicId]);
    const patientsWithDefaultScores = patients.map(patient => ({
      ...patient,
      phq9First: patient.phq9First !== null ? patient.phq9First : 0,
      phq9Last: patient.phq9Last !== null ? patient.phq9Last : 0,
      gad7First: patient.gad7First !== null ? patient.gad7First : 0,
      gad7Last: patient.gad7Last !== null ? patient.gad7Last : 0
    }));
    res.json(patientsWithDefaultScores);
  } catch (error) {
    console.error('Error fetching active patients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch enrolled patients
router.get('/patients/enrolled', async (req, res) => {
  const { clinicId } = req.query;
  console.log(`Fetching enrolled patients for clinic ID: ${clinicId}`);
  try {
    const query = `
      SELECT p.id, p.mrn, p.first_name AS firstName, p.last_name AS lastName, p.status,
             DATE_FORMAT(p.dob, '%Y-%m-%d') AS dob, 
             DATE_FORMAT(p.enrollment_date, '%Y-%m-%d') AS enrollmentDate,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'PHQ-9' ORDER BY date ASC LIMIT 1) AS phq9First,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'PHQ-9' ORDER BY date DESC LIMIT 1) AS phq9Last,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'GAD-7' ORDER BY date ASC LIMIT 1) AS gad7First,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'GAD-7' ORDER BY date DESC LIMIT 1) AS gad7Last
      FROM patients p
      WHERE p.clinic_id = ? AND p.status IN ('E')
    `;
    const [patients] = await db.query(query, [clinicId]);
    const patientsWithDefaultScores = patients.map(patient => ({
      ...patient,
      phq9First: patient.phq9First !== null ? patient.phq9First : 0,
      phq9Last: patient.phq9Last !== null ? patient.phq9Last : 0,
      gad7First: patient.gad7First !== null ? patient.gad7First : 0,
      gad7Last: patient.gad7Last !== null ? patient.gad7Last : 0
    }));
    res.json(patientsWithDefaultScores);
  } catch (error) {
    console.error('Error fetching enrolled patients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch inactive patients
router.get('/patients/inactive', async (req, res) => {
  const { clinicId } = req.query;
  console.log(`Fetching inactive patients for clinic ID: ${clinicId}`);
  try {
    const query = `
      SELECT p.id, p.mrn, p.first_name AS firstName, p.last_name AS lastName, p.status,
             DATE_FORMAT(p.dob, '%Y-%m-%d') AS dob, 
             DATE_FORMAT(p.enrollment_date, '%Y-%m-%d') AS enrollmentDate,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'PHQ-9' ORDER BY created_at ASC LIMIT 1) AS phq9First,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'PHQ-9' ORDER BY created_at DESC LIMIT 1) AS phq9Last,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'GAD-7' ORDER BY created_at ASC LIMIT 1) AS gad7First,
             (SELECT score FROM assessments WHERE patient_id = p.id AND type = 'GAD-7' ORDER BY created_at DESC LIMIT 1) AS gad7Last,
             (SELECT DATE_FORMAT(deactivation_date, '%Y-%m-%d') FROM deactivations WHERE patient_id = p.id ORDER BY deactivation_date DESC LIMIT 1) AS deactivationDate,
             (SELECT reason FROM deactivations WHERE patient_id = p.id ORDER BY deactivation_date DESC LIMIT 1) AS deactivationReason
      FROM patients p
      WHERE p.clinic_id = ? AND p.status = 'D'
    `;
    const [patients] = await db.query(query, [clinicId]);
    const patientsWithDefaultScores = patients.map(patient => ({
      ...patient,
      phq9First: patient.phq9First !== null ? patient.phq9First : 0,
      phq9Last: patient.phq9Last !== null ? patient.phq9Last : 0,
      gad7First: patient.gad7First !== null ? patient.gad7First : 0,
      gad7Last: patient.gad7Last !== null ? patient.gad7Last : 0
    }));
    res.json(patientsWithDefaultScores);
  } catch (error) {
    console.error('Error fetching inactive patients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get patient info
router.get('/patients/:patientId', async (req, res) => {
  const { patientId } = req.params;
  console.log(`Fetching patient info for patient ID: ${patientId}`);
  try {
    const [patientInfo] = await db.query(
      `SELECT p.id AS patientId, p.mrn, p.first_name AS firstName, p.last_name AS lastName,
              DATE_FORMAT(p.dob, '%Y-%m-%d') AS dob, DATE_FORMAT(p.enrollment_date, '%Y-%m-%d') AS enrollmentDate,
              c.name AS clinicName, p.status, p.phq9_first AS phq9First, p.phq9_last AS phq9Last,
              p.gad7_first AS gad7First, p.gad7_last AS gad7Last
       FROM patients p JOIN clinics c ON p.clinic_id = c.id WHERE p.id = ?`,
      [patientId]
    );
    if (patientInfo.length === 0) return res.status(404).json({ error: 'Patient not found' });
    
    // Updated query to include user_id as id
    const [providers] = await db.query(
      `SELECT up.user_id AS id, up.provider_type AS providerType, u.name, u.phone_number AS phone, u.email,
              DATE_FORMAT(up.service_begin_date, '%Y-%m-%d') AS serviceBeginDate,
              DATE_FORMAT(up.service_end_date, '%Y-%m-%d') AS serviceEndDate
       FROM user_patients up JOIN users u ON up.user_id = u.id
       WHERE up.patient_id = ? AND up.service_end_date IS NULL`,
      [patientId]
    );
    
    const [clinics] = await db.query(
      `SELECT o.name AS organizationName, c.name AS clinicName, c.id AS clinicId, p.mrn,
              DATE_FORMAT(p.enrollment_date, '%Y-%m-%d') AS serviceBeginDate,
              CASE WHEN p.clinic_id = c.id THEN TRUE ELSE FALSE END AS isPrimary
       FROM patients p JOIN clinics c ON p.clinic_id = c.id JOIN organizations o ON c.organization_id = o.id
       WHERE p.id = ?`,
      [patientId]
    );
    
    const responseData = { ...patientInfo[0], providers, clinics };
    res.json(responseData);
  } catch (error) {
    console.error('Error fetching patient info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initial Assessment
router.post('/initial-assessment', async (req, res) => {
  const {
    patientId, clinicId, createdBy, contactDate, phq9Score, gad7Score,
    phq9Answers, gad7Answers, discussWithConsultant, consultantNotes, sessionType, sessionDuration, psychiatricConsultantId
  } = req.body;

  if (!patientId || !createdBy || !contactDate || !sessionType || !sessionDuration) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const numericPsychId = psychiatricConsultantId ? parseInt(psychiatricConsultantId, 10) : null;
  const contactType = 'Initial Assessment';

  try {
    await db.query('START TRANSACTION');

    // Check if patient is inactive
    const [patientStatus] = await db.query(
      'SELECT status FROM patients WHERE id = ?',
      [patientId]
    );
    
    if (!patientStatus.length) {
      throw new Error('Patient not found');
    }
    
    if (patientStatus[0].status === 'D') {
      throw new Error('Cannot perform assessments on inactive patients');
    }

    const parsedContactDate = new Date(contactDate);
    if (isNaN(parsedContactDate.getTime())) throw new Error('Invalid contact date format');
    const formattedContactDate = format(parsedContactDate, 'yyyy-MM-dd');

    // No longer changing patient status from A to T
    // Patient remains in 'A' status after initial assessment
    
    // Save PHQ-9 with answers
    console.log('Saving PHQ-9 - Answers:', phq9Answers);
    await db.query(
      `INSERT INTO assessments (patient_id, type, score, date, created_at, answers_json) 
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [patientId, 'PHQ-9', phq9Score, formattedContactDate, JSON.stringify(phq9Answers || [])]
    );

    // Save GAD-7 with answers
    console.log('Saving GAD-7 - Answers:', gad7Answers);
    await db.query(
      `INSERT INTO assessments (patient_id, type, score, date, created_at, answers_json) 
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [patientId, 'GAD-7', gad7Score, formattedContactDate, JSON.stringify(gad7Answers || [])]
    );

    await db.query(
      `INSERT INTO contacts (patient_id, contact_date, contact_type, interaction_mode, duration_minutes, 
                            flag_psychiatric_consult, notes, created_by, psychiatric_consultant_id, discuss_with_consultant) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patientId, formattedContactDate, contactType, sessionType, sessionDuration,
       discussWithConsultant ? 1 : 0, consultantNotes, createdBy, numericPsychId, discussWithConsultant ? 1 : 0]
    );

    await db.query(
      `UPDATE patients SET phq9_first = ?, phq9_last = ?, gad7_first = ?, gad7_last = ? WHERE id = ?`,
      [phq9Score, phq9Score, gad7Score, gad7Score, patientId]
    );

    // Check for Safety Plan Flag based on PHQ-9 Question 9
    const phq9Question9 = phq9Answers && phq9Answers[8]; // Question 9 is at index 8 (0-based)
    const needsSafetyPlan = phq9Question9 && parseInt(phq9Question9) >= 1; // 1 (Several days), 2 (More than half), or 3 (Nearly every day)

    if (needsSafetyPlan) {
      const [existingSafetyFlag] = await db.query(
        `SELECT * FROM patient_flags WHERE patient_id = ? AND flag = "Safety Plan"`,
        [patientId]
      );
      if (!existingSafetyFlag.length) {
        await db.query(
          `INSERT INTO patient_flags (patient_id, flag) VALUES (?, "Safety Plan")`,
          [patientId]
        );
      }
    }

    if (discussWithConsultant || numericPsychId) {
      const [existingFlag] = await db.query(
        `SELECT * FROM patient_flags WHERE patient_id = ? AND flag = "Psychiatric Consult"`,
        [patientId]
      );
      if (!existingFlag.length) {
        await db.query(
          `INSERT INTO patient_flags (patient_id, flag) VALUES (?, "Psychiatric Consult")`,
          [patientId]
        );
      }
    }

    if (numericPsychId) {
      const [existingConsultant] = await db.query(
        `SELECT id, user_id FROM user_patients WHERE patient_id = ? AND provider_type = "Psychiatric Consultant" AND service_end_date IS NULL`,
        [patientId]
      );
      if (existingConsultant.length > 0) {
        const currentConsultant = existingConsultant[0];
        const currentUserId = parseInt(currentConsultant.user_id, 10);
        if (currentUserId !== numericPsychId) {
          await db.query(
            `UPDATE user_patients SET service_end_date = ? WHERE id = ?`,
            [formattedContactDate, currentConsultant.id]
          );
          await db.query(
            `INSERT INTO user_patients (patient_id, user_id, provider_type, service_begin_date) 
             VALUES (?, ?, "Psychiatric Consultant", ?)`,
            [patientId, numericPsychId, formattedContactDate]
          );
        }
      } else {
        await db.query(
          `INSERT INTO user_patients (patient_id, user_id, provider_type, service_begin_date) 
           VALUES (?, ?, "Psychiatric Consultant", ?)`,
          [patientId, numericPsychId, formattedContactDate]
        );
      }
    }

    await db.query(
      `INSERT INTO minute_tracking (user_id, total_minutes, tracking_date) VALUES (?, ?, ?)`,
      [createdBy, sessionDuration, formattedContactDate]
    );

    await ReminderService.createAssessmentReminder({
      patientId, careManagerId: createdBy, assessmentType: 'Follow-up Assessment', contactDate: parsedContactDate.toISOString()
    });

    await db.query('COMMIT');
    res.status(200).json({ message: 'Initial assessment submitted successfully' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error submitting initial assessment:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Follow-up Assessment
router.post('/followup-assessment', async (req, res) => {
  const {
    patientId, clinicId, createdBy, contactDate, phq9Score, gad7Score,
    phq9Answers, gad7Answers, discussWithConsultant, consultantNotes, sessionType, sessionDuration, psychiatricConsultantId
  } = req.body;

  if (!patientId || !createdBy || !contactDate || !sessionType || !sessionDuration) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const numericPsychId = psychiatricConsultantId ? parseInt(psychiatricConsultantId, 10) : null;
  const contactType = 'Follow-up Assessment';

  try {
    await db.query('START TRANSACTION');

    // Check if patient is inactive
    const [patientStatus] = await db.query(
      'SELECT status FROM patients WHERE id = ?',
      [patientId]
    );
    
    if (!patientStatus.length) {
      throw new Error('Patient not found');
    }
    
    if (patientStatus[0].status === 'D') {
      throw new Error('Cannot perform assessments on inactive patients');
    }

    const parsedContactDate = new Date(contactDate);
    if (isNaN(parsedContactDate.getTime())) throw new Error('Invalid contact date format');
    const formattedContactDate = format(parsedContactDate, 'yyyy-MM-dd');

    // Save PHQ-9 with answers
    console.log('Saving PHQ-9 - Answers:', phq9Answers);
    await db.query(
      `INSERT INTO assessments (patient_id, type, score, date, created_at, answers_json) 
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [patientId, 'PHQ-9', phq9Score, formattedContactDate, JSON.stringify(phq9Answers || [])]
    );

    // Save GAD-7 with answers
    console.log('Saving GAD-7 - Answers:', gad7Answers);
    await db.query(
      `INSERT INTO assessments (patient_id, type, score, date, created_at, answers_json) 
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [patientId, 'GAD-7', gad7Score, formattedContactDate, JSON.stringify(gad7Answers || [])]
    );

    await db.query(
      `INSERT INTO contacts (patient_id, contact_date, contact_type, interaction_mode, duration_minutes, 
                            flag_psychiatric_consult, notes, created_by, psychiatric_consultant_id, discuss_with_consultant) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patientId, formattedContactDate, contactType, sessionType, sessionDuration,
       discussWithConsultant ? 1 : 0, consultantNotes, createdBy, numericPsychId, discussWithConsultant ? 1 : 0]
    );

    await db.query(`UPDATE patients SET phq9_last = ?, gad7_last = ? WHERE id = ?`, [phq9Score, gad7Score, patientId]);

    // Check for Safety Plan Flag based on PHQ-9 Question 9
    const phq9Question9 = phq9Answers && phq9Answers[8]; // Question 9 is at index 8 (0-based)
    const needsSafetyPlan = phq9Question9 && parseInt(phq9Question9) >= 1; // 1 (Several days), 2 (More than half), or 3 (Nearly every day)

    if (needsSafetyPlan) {
      const [existingSafetyFlag] = await db.query(
        `SELECT * FROM patient_flags WHERE patient_id = ? AND flag = "Safety Plan"`,
        [patientId]
      );
      if (!existingSafetyFlag.length) {
        await db.query(
          `INSERT INTO patient_flags (patient_id, flag) VALUES (?, "Safety Plan")`,
          [patientId]
        );
      }
    }

    if (discussWithConsultant || numericPsychId) {
      const [existingFlag] = await db.query(
        `SELECT * FROM patient_flags WHERE patient_id = ? AND flag = "Psychiatric Consult"`,
        [patientId]
      );
      if (!existingFlag.length) {
        await db.query(
          `INSERT INTO patient_flags (patient_id, flag) VALUES (?, "Psychiatric Consult")`,
          [patientId]
        );
      }
    }

    if (discussWithConsultant && numericPsychId) {
      const [existingConsultant] = await db.query(
        `SELECT id, user_id FROM user_patients WHERE patient_id = ? AND provider_type = "Psychiatric Consultant" AND service_end_date IS NULL`,
        [patientId]
      );
      if (existingConsultant.length > 0) {
        const currentConsultant = existingConsultant[0];
        const currentUserId = parseInt(currentConsultant.user_id, 10);
        if (currentUserId !== numericPsychId) {
          await db.query(`UPDATE user_patients SET service_end_date = ? WHERE id = ?`, [formattedContactDate, currentConsultant.id]);
          await db.query(
            `INSERT INTO user_patients (patient_id, user_id, provider_type, service_begin_date) 
             VALUES (?, ?, "Psychiatric Consultant", ?)`,
            [patientId, numericPsychId, formattedContactDate]
          );
        }
      } else {
        await db.query(
          `INSERT INTO user_patients (patient_id, user_id, provider_type, service_begin_date) 
           VALUES (?, ?, "Psychiatric Consultant", ?)`,
          [patientId, numericPsychId, formattedContactDate]
        );
      }
    }

    await db.query(
      `INSERT INTO minute_tracking (user_id, total_minutes, tracking_date) VALUES (?, ?, ?)`,
      [createdBy, sessionDuration, formattedContactDate]
    );

    await ReminderService.createAssessmentReminder({
      patientId, careManagerId: createdBy, assessmentType: 'Follow-up Assessment', contactDate: parsedContactDate.toISOString()
    });

    await db.query('COMMIT');
    res.status(200).json({ message: 'Follow-up assessment submitted successfully' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error submitting follow-up assessment:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Fetch the latest assessment data
router.get('/assessments/latest', async (req, res) => {
  const { patientId } = req.query;
  try {
    const [phq9Assessment] = await db.query(
      'SELECT * FROM assessments WHERE patient_id = ? AND type = "PHQ-9" ORDER BY created_at DESC LIMIT 1',
      [patientId]
    );
    const [gad7Assessment] = await db.query(
      'SELECT * FROM assessments WHERE patient_id = ? AND type = "GAD-7" ORDER BY created_at DESC LIMIT 1',
      [patientId]
    );
    const [consultantData] = await db.query(
      'SELECT * FROM user_patients WHERE patient_id = ? AND provider_type = "Psychiatric Consultant" LIMIT 1',
      [patientId]
    );
    const [patientFlag] = await db.query(
      'SELECT * FROM patient_flags WHERE patient_id = ? AND flag = "Psychiatric Consult" LIMIT 1',
      [patientId]
    );
    res.status(200).json({
      phq9Answers: phq9Assessment ? JSON.parse(phq9Assessment.answers_json || '[]') : [],
      gad7Answers: gad7Assessment ? JSON.parse(gad7Assessment.answers_json || '[]') : [],
      psychiatricConsultantId: consultantData?.user_id || null,
      discussWithConsultant: !!patientFlag,
      consultantNotes: consultantData?.notes || '',
    });
  } catch (error) {
    console.error('Error fetching latest assessment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch the most recent contact
router.get('/patients/:patientId/last-contact', async (req, res) => {
  const { patientId } = req.params;
  try {
    const query = `
      SELECT c.contact_date AS contactDate, c.contact_type AS contactType, u.name AS contactPerson, cl.name AS clinicName
      FROM contacts c JOIN users u ON c.created_by = u.id
      JOIN user_clinics uc ON u.id = uc.user_id JOIN clinics cl ON uc.clinic_id = cl.id
      WHERE c.patient_id = ? ORDER BY c.contact_date DESC LIMIT 1
    `;
    const [result] = await db.query(query, [patientId]);
    if (result.length === 0) return res.status(404).json({ message: 'No contact information found for this patient.' });
    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching last contact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assessment History Graph
router.get('/patients/:patientId/assessment-history', async (req, res) => {
  const { patientId } = req.params;
  const { type } = req.query;
  try {
    const query = `SELECT score, DATE_FORMAT(date, '%Y-%m-%d') as date FROM assessments WHERE patient_id = ? AND type = ? ORDER BY date ASC`;
    const [assessments] = await db.query(query, [patientId, type]);
    res.json(assessments);
  } catch (error) {
    console.error('Error fetching assessment history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Last Update Info
router.get('/patients/:patientId/last-update', async (req, res) => {
  const { patientId } = req.params;
  const { type } = req.query;
  try {
    const query = `
      SELECT a.score, DATE_FORMAT(a.date, '%Y-%m-%d') as date, u.name as updatedBy, 
             DATE_FORMAT(c.contact_date, '%m/%d/%Y') as updatedDate
      FROM assessments a INNER JOIN contacts c ON a.patient_id = c.patient_id AND DATE(a.date) = DATE(c.contact_date)
      INNER JOIN users u ON c.created_by = u.id
      WHERE a.patient_id = ? AND a.type = ? ORDER BY a.date DESC LIMIT 1
    `;
    const [assessment] = await db.query(query, [patientId, type]);
    if (assessment && assessment[0]) {
      return res.json({
        updatedBy: assessment[0].updatedBy,
        updatedDate: assessment[0].updatedDate,
        score: assessment[0].score
      });
    }
    res.json({ updatedBy: 'N/A', updatedDate: 'N/A', score: null });
  } catch (error) {
    console.error('Error fetching last update info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Treatment History
router.get('/patients/:patientId/treatment-history', async (req, res) => {
  const { patientId } = req.params;
  try {
    const query = `
      SELECT c.contact_date AS assessment_date, u.name AS assessment_by, u.role AS user_role,
             CASE WHEN c.contact_date = (SELECT MIN(contact_date) FROM contacts WHERE patient_id = c.patient_id) 
                  THEN 'Initial Assessment' ELSE 'Follow-Up Assessment' END AS assessment_type,
             (SELECT score FROM assessments a WHERE a.patient_id = c.patient_id AND a.date = c.contact_date AND a.type = 'PHQ-9' LIMIT 1) AS phq9_score,
             (SELECT score FROM assessments a WHERE a.patient_id = c.patient_id AND a.date = c.contact_date AND a.type = 'GAD-7' LIMIT 1) AS gad7_score,
             c.flag_psychiatric_consult AS psych_consultation_recommended,
             CASE WHEN c.interaction_mode = 'by_video' THEN 'Video' WHEN c.interaction_mode = 'by_phone' THEN 'Phone'
                  WHEN c.interaction_mode = 'in_clinic' THEN 'In-Clinic' WHEN c.interaction_mode = 'in_group' THEN 'Group'
                  ELSE 'Unknown' END AS interaction_mode, c.duration_minutes
      FROM contacts c JOIN users u ON c.created_by = u.id
      WHERE c.patient_id = ? ORDER BY c.contact_date DESC
    `;
    const [history] = await db.query(query, [patientId]);
    const formattedHistory = history.map(entry => ({
      ...entry,
      assessment_date: new Date(entry.assessment_date).toISOString().split('T')[0],
      psych_consultation_recommended: entry.psych_consultation_recommended ? "Yes" : "No"
    }));
    res.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching treatment history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get psychiatric consultants for a clinic
router.get('/consultants', async (req, res) => {
  const { clinicId } = req.query;
  
  if (!clinicId) {
    return res.status(400).json({ error: 'Clinic ID is required' });
  }

  try {
    const query = `
      SELECT u.id, u.name
      FROM users u 
      JOIN user_clinics uc ON u.id = uc.user_id
      WHERE uc.clinic_id = ? 
      AND u.role = 'Psychiatric Consultant'
      ORDER BY u.name
    `;
    
    const [consultants] = await db.query(query, [clinicId]);
    
    res.status(200).json(consultants);
  } catch (error) {
    console.error('Error fetching psychiatric consultants:', error);
    res.status(500).json({ error: 'Failed to fetch consultants' });
  }
});

// Deactivate patient
router.post('/patients/:patientId/deactivate', async (req, res) => {
  const { patientId } = req.params;
  const { reason } = req.body;
  
  if (!reason) {
    return res.status(400).json({ error: 'Deactivation reason is required' });
  }
  
  try {
    await db.query('START TRANSACTION');
    
    // Update patient status to 'D' (Deactivated)
    const [updateResult] = await db.query(
      'UPDATE patients SET status = "D" WHERE id = ?',
      [patientId]
    );
    
    if (updateResult.affectedRows === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Record deactivation reason in deactivations table
    await db.query(
      'INSERT INTO deactivations (patient_id, deactivation_date, reason) VALUES (?, CURDATE(), ?)',
      [patientId, reason]
    );
    
    await db.query('COMMIT');
    
    res.status(200).json({ message: 'Patient deactivated successfully' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error deactivating patient:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get deactivation details for a patient
router.get('/patients/:patientId/deactivation', async (req, res) => {
  const { patientId } = req.params;
  
  try {
    const [deactivation] = await db.query(
      `SELECT d.id, DATE_FORMAT(d.deactivation_date, '%Y-%m-%d') AS deactivation_date, d.reason
       FROM deactivations d
       WHERE d.patient_id = ?
       ORDER BY d.deactivation_date DESC
       LIMIT 1`,
      [patientId]
    );
    
    if (deactivation.length === 0) {
      return res.status(404).json({ error: 'No deactivation record found' });
    }
    
    res.status(200).json(deactivation[0]);
  } catch (error) {
    console.error('Error fetching deactivation details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;