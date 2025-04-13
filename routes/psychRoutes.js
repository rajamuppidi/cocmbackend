const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { body, validationResult } = require('express-validator');
const { format } = require('date-fns');

// Get dashboard data for a psychiatric consultant
router.get('/dashboard/:userId', async (req, res) => {
  const { userId } = req.params;
  const { clinicId } = req.query;

  try {
    // Validate if the user is a psychiatric consultant
    const [userRows] = await db.query(
      'SELECT * FROM users WHERE id = ? AND role = "Psychiatric Consultant"',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Count assigned patients - using the provider_type in user_patients table instead
    const [assignedPatientsResult] = await db.query(
      `SELECT COUNT(DISTINCT p.id) as assignedPatients 
       FROM patients p
       JOIN user_patients up ON p.id = up.patient_id 
       WHERE up.user_id = ? AND up.provider_type = 'Psychiatric Consultant' ${clinicId ? 'AND p.clinic_id = ?' : ''}`,
      clinicId ? [userId, clinicId] : [userId]
    );

    // Get total minutes tracked
    const [minutesResult] = await db.query(
      `SELECT 
         (SELECT COALESCE(SUM(pc.minutes), 0) 
          FROM psych_consultations pc
          JOIN patients p ON pc.patient_id = p.id
          WHERE pc.consultant_id = ? ${clinicId ? 'AND p.clinic_id = ?' : ''}) +
         (SELECT COALESCE(SUM(mt.total_minutes), 0)
          FROM minute_tracking mt
          JOIN contact_attempts ca ON mt.contact_attempt_id = ca.id
          JOIN patients p ON ca.patient_id = p.id
          WHERE mt.user_id = ? ${clinicId ? 'AND p.clinic_id = ?' : ''}) as totalMinutes`,
      clinicId ? [userId, clinicId, userId, clinicId] : [userId, userId]
    );

    // Calculate average minutes per patient
    const totalMinutesTracked = minutesResult[0].totalMinutes || 0;
    const assignedPatients = assignedPatientsResult[0].assignedPatients || 0;
    const averageMinutesPerPatient = assignedPatients > 0 
      ? Math.round(totalMinutesTracked / assignedPatients) 
      : 0;

    // Count upcoming referrals - patients that have discussWithConsultant=true in assessments
    const [upcomingReferralsResult] = await db.query(
      `SELECT COUNT(DISTINCT p.id) as upcomingReferrals
       FROM patients p
       JOIN assessments a ON p.id = a.patient_id
       JOIN contacts c ON a.patient_id = c.patient_id AND DATE(a.date) = DATE(c.contact_date)
       WHERE c.discuss_with_consultant = 1 
       AND c.psychiatric_consultant_id = ?
       AND p.id NOT IN (
         SELECT patient_id FROM psych_consultations WHERE consultant_id = ?
       )
       ${clinicId ? 'AND p.clinic_id = ?' : ''}`,
      clinicId ? [userId, userId, clinicId] : [userId, userId]
    );

    res.json({
      assignedPatients,
      totalMinutesTracked,
      averageMinutesPerPatient,
      upcomingReferrals: upcomingReferralsResult[0].upcomingReferrals || 0
    });
  } catch (error) {
    console.error('Error fetching psychiatric consultant dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent patients for a psychiatric consultant
router.get('/recent-patients/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT DISTINCT p.id, p.first_name as firstName, p.last_name as lastName, p.mrn, 
              c.contact_date as referralDate, c.consultant_notes as referralReason,
              (SELECT MAX(a2.score) FROM assessments a2 WHERE a2.patient_id = p.id AND a2.type = 'PHQ-9') as phq9Score,
              (SELECT MAX(a3.score) FROM assessments a3 WHERE a3.patient_id = p.id AND a3.type = 'GAD-7') as gad7Score
       FROM patients p
       JOIN contacts c ON p.id = c.patient_id
       JOIN assessments a ON p.id = a.patient_id AND DATE(a.date) = DATE(c.contact_date)
       WHERE c.discuss_with_consultant = 1 AND c.psychiatric_consultant_id = ?
       ORDER BY c.contact_date DESC
       LIMIT 5`,
      [userId]
    );

    const formattedRows = rows.map(row => ({
      ...row,
      referralDate: format(new Date(row.referralDate), 'yyyy-MM-dd')
    }));

    res.json(formattedRows);
  } catch (error) {
    console.error('Error fetching recent patients for consultant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all assigned patients for a psychiatric consultant
router.get('/assigned-patients/:userId', async (req, res) => {
  const { userId } = req.params;
  const { clinicId } = req.query;

  try {
    const query = `
      SELECT DISTINCT p.id, p.first_name as firstName, p.last_name as lastName, p.mrn, p.dob,
             p.status, 
             (SELECT DATE_FORMAT(MAX(c.contact_date), '%Y-%m-%d') FROM contacts c WHERE c.patient_id = p.id) as referralDate, 
             (SELECT c.consultant_notes FROM contacts c WHERE c.patient_id = p.id ORDER BY c.contact_date DESC LIMIT 1) as referralReason,
             (SELECT MAX(a2.score) FROM assessments a2 WHERE a2.patient_id = p.id AND a2.type = 'PHQ-9') as phq9Score,
             (SELECT MAX(a3.score) FROM assessments a3 WHERE a3.patient_id = p.id AND a3.type = 'GAD-7') as gad7Score,
             (SELECT u2.name FROM user_patients up2 JOIN users u2 ON up2.user_id = u2.id 
              WHERE up2.patient_id = p.id AND up2.provider_type = 'BHCM' LIMIT 1) as careManagerName
      FROM patients p
      JOIN user_patients up ON p.id = up.patient_id 
      WHERE up.user_id = ? AND up.provider_type = 'Psychiatric Consultant'
      ${clinicId ? 'AND p.clinic_id = ?' : ''}
      ORDER BY p.last_name ASC
    `;

    const [rows] = await db.query(
      query,
      clinicId ? [userId, clinicId] : [userId]
    );

    const formattedRows = rows.map(row => ({
      ...row,
      dob: format(new Date(row.dob), 'yyyy-MM-dd'),
      referralDate: row.referralDate ? format(new Date(row.referralDate), 'yyyy-MM-dd') : null
    }));

    res.json(formattedRows);
  } catch (error) {
    console.error('Error fetching assigned patients for consultant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new psychiatric consultation
router.post('/consult', [
  body('patientId').isInt().withMessage('Patient ID must be an integer'),
  body('userId').notEmpty().withMessage('User ID is required'),
  body('consultDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Consultation date must be in YYYY-MM-DD format'),
  body('minutes').isInt({ min: 1 }).withMessage('Minutes must be a positive integer'),
  body('recommendations').notEmpty().withMessage('Recommendations are required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { 
    patientId, 
    userId, 
    consultDate, 
    minutes, 
    recommendations, 
    treatmentPlan, 
    medications, 
    followUpNeeded, 
    nextFollowUpDate 
  } = req.body;

  try {
    // Verify the user is a psychiatric consultant
    const [userRows] = await db.query(
      'SELECT * FROM users WHERE id = ? AND role = "Psychiatric Consultant"',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized: Only psychiatric consultants can create consultations' });
    }

    // Verify the patient is assigned to this consultant via assessment referrals
    const [assignmentRows] = await db.query(
      `SELECT 1 FROM contacts 
       WHERE patient_id = ? AND psychiatric_consultant_id = ? AND discuss_with_consultant = 1
       LIMIT 1`,
      [patientId, userId]
    );

    if (assignmentRows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized: Patient is not assigned to this consultant' });
    }

    await db.query('START TRANSACTION');

    // Insert the consultation record
    const [consultResult] = await db.query(
      `INSERT INTO psych_consultations (
        patient_id, consultant_id, consult_date, minutes, 
        recommendations, treatment_plan, medications,
        follow_up_needed, next_follow_up_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId, 
        userId, 
        consultDate, 
        minutes, 
        recommendations, 
        treatmentPlan, 
        medications, 
        followUpNeeded ? 1 : 0, 
        nextFollowUpDate
      ]
    );

    // Track minutes
    await db.query(
      `INSERT INTO minute_tracking (user_id, patient_id, total_minutes, tracking_date, psych_consult_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, patientId, minutes, consultDate, consultResult.insertId]
    );

    // Add user_patient relationship if not exists
    await db.query(
      `INSERT IGNORE INTO user_patients (user_id, patient_id, provider_type, service_begin_date) 
       VALUES (?, ?, 'Psychiatric Consultant', ?)`,
      [userId, patientId, consultDate]
    );

    await db.query('COMMIT');

    res.status(201).json({ 
      id: consultResult.insertId,
      message: 'Psychiatric consultation recorded successfully' 
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error recording psychiatric consultation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get consultation history for a patient
router.get('/consult-history/:patientId', async (req, res) => {
  const { patientId } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT pc.id, pc.consult_date as consultDate, u.name as consultBy, u.role as consultByRole,
              pc.minutes, pc.recommendations, pc.treatment_plan as treatmentPlan, 
              pc.medications, pc.follow_up_needed as followUpNeeded, pc.next_follow_up_date as nextFollowUpDate
       FROM psych_consultations pc
       JOIN users u ON pc.consultant_id = u.id
       WHERE pc.patient_id = ?
       ORDER BY pc.consult_date DESC`,
      [patientId]
    );

    const formattedRows = rows.map(row => ({
      ...row,
      consultDate: format(new Date(row.consultDate), 'yyyy-MM-dd'),
      followUpNeeded: !!row.followUpNeeded,
      nextFollowUpDate: row.nextFollowUpDate ? format(new Date(row.nextFollowUpDate), 'yyyy-MM-dd') : null
    }));

    res.json(formattedRows);
  } catch (error) {
    console.error('Error fetching psychiatric consultation history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get care manager notes for a patient referrals
router.get('/care-manager-notes/:patientId', async (req, res) => {
  const { patientId } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT c.id, c.contact_date as noteDate, a.answers_json as content, c.discuss_with_consultant as referralNeeded,
              c.consultant_notes as psychReferralNote, u.name as createdBy, u.role as userRole
       FROM contacts c
       JOIN assessments a ON c.patient_id = a.patient_id AND DATE(c.contact_date) = DATE(a.date)
       JOIN users u ON c.created_by = u.id
       WHERE c.patient_id = ? AND c.discuss_with_consultant = 1
       ORDER BY c.contact_date DESC`,
      [patientId]
    );

    const formattedRows = rows.map(row => ({
      ...row,
      noteDate: format(new Date(row.noteDate), 'yyyy-MM-dd'),
      referralNeeded: !!row.referralNeeded,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content || {}
    }));

    res.json(formattedRows);
  } catch (error) {
    console.error('Error fetching care manager assessment referrals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 