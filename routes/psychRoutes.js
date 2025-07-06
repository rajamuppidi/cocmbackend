const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { body, validationResult } = require('express-validator');
const { format, parseISO } = require('date-fns');
const PDFDocument = require('pdfkit');

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
              c.contact_date as referralDate, c.notes as notes,
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
             (SELECT c.notes FROM contacts c WHERE c.patient_id = p.id ORDER BY c.contact_date DESC LIMIT 1) as notes,
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

    // Check if patient is inactive
    const [patientStatus] = await db.query(
      'SELECT status FROM patients WHERE id = ?',
      [patientId]
    );
    
    if (!patientStatus.length) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    if (patientStatus[0].status === 'D') {
      return res.status(400).json({ error: 'Cannot create psychiatric consultations for inactive patients' });
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

    // Remove the "Psychiatric Consult" flag since consultation is completed
    await db.query(
      `DELETE FROM patient_flags WHERE patient_id = ? AND flag = 'Psychiatric Consult'`,
      [patientId]
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

// Create a new psychiatric consultation note
router.post('/consultations',
  [
    body('patientId').isInt().withMessage('Patient ID must be an integer'),
    body('consultantId').isInt().withMessage('Consultant ID must be an integer'),
    body('companyName').notEmpty().withMessage('Company name is required'),
    body('consultDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Consult Date must be in YYYY-MM-DD format'),
    body('assessmentType').isIn(['Initial', 'Follow-up']).withMessage('Assessment type must be Initial or Follow-up'),
    body('minutes').isInt({ min: 1 }).withMessage('Minutes must be a positive integer'),
    body('summary').notEmpty().withMessage('Summary is required'),
    body('recommendations').notEmpty().withMessage('Recommendations are required'),
    body('treatmentPlan').optional().isString(),
    body('medications').optional().isString(),
    body('followUpNeeded').optional().isBoolean(),
    body('nextFollowUpDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Next follow-up date must be in YYYY-MM-DD format')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      patientId,
      consultantId,
      companyName,
      consultDate,
      assessmentType,
      minutes,
      summary,
      recommendations,
      treatmentPlan,
      medications,
      followUpNeeded,
      nextFollowUpDate
    } = req.body;

    try {
      // Check if patient is inactive
      const [patientStatus] = await db.query(
        'SELECT status FROM patients WHERE id = ?',
        [patientId]
      );
      
      if (!patientStatus.length) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      
      if (patientStatus[0].status === 'D') {
        return res.status(400).json({ error: 'Cannot create psychiatric consultations for inactive patients' });
      }

      await db.query('START TRANSACTION');

      // Insert the psychiatric consultation
      const [result] = await db.query(
        `INSERT INTO psych_consultations (
          patient_id, 
          consultant_id, 
          company_name,
          consult_date, 
          assessment_type,
          minutes, 
          summary,
          recommendations, 
          treatment_plan, 
          medications,
          follow_up_needed,
          next_follow_up_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patientId, 
          consultantId, 
          companyName,
          consultDate, 
          assessmentType,
          minutes, 
          summary,
          recommendations, 
          treatmentPlan, 
          medications,
          followUpNeeded || false,
          nextFollowUpDate || null
        ]
      );

      const consultationId = result.insertId;

      // Track minutes in minute_tracking table
      await db.query(
        `INSERT INTO minute_tracking (user_id, total_minutes, tracking_date) 
         VALUES (?, ?, ?)`,
        [consultantId, minutes, consultDate]
      );

      // Remove the "Psychiatric Consult" flag since consultation is completed
      await db.query(
        `DELETE FROM patient_flags WHERE patient_id = ? AND flag = 'Psychiatric Consult'`,
        [patientId]
      );

      await db.query('COMMIT');

      res.status(201).json({ 
        id: consultationId,
        message: 'Psychiatric consultation note created successfully' 
      });
    } catch (error) {
      await db.query('ROLLBACK');
      console.error('Error creating psychiatric consultation:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
);

// Get all psychiatric consultations for a patient
router.get('/consultations/:patientId', async (req, res) => {
  const { patientId } = req.params;

  try {
    const [consultations] = await db.query(
      `SELECT 
        pc.id,
        pc.consult_date AS consultDate,
        pc.assessment_type AS assessmentType,
        pc.company_name AS companyName,
        pc.minutes,
        pc.summary,
        pc.recommendations,
        pc.treatment_plan AS treatmentPlan,
        pc.medications,
        pc.follow_up_needed AS followUpNeeded,
        pc.next_follow_up_date AS nextFollowUpDate,
        u.name AS consultantName,
        u.phone_number AS consultantPhone,
        u.email AS consultantEmail,
        c.name AS clinicName
      FROM psych_consultations pc
      JOIN users u ON pc.consultant_id = u.id
      JOIN patients p ON pc.patient_id = p.id
      JOIN clinics c ON p.clinic_id = c.id
      WHERE pc.patient_id = ?
      ORDER BY pc.consult_date DESC`,
      [patientId]
    );

    const formattedConsultations = consultations.map(consultation => ({
      ...consultation,
      consultDate: format(new Date(consultation.consultDate), 'yyyy-MM-dd'),
      nextFollowUpDate: consultation.nextFollowUpDate ? 
        format(new Date(consultation.nextFollowUpDate), 'yyyy-MM-dd') : null
    }));

    res.json(formattedConsultations);
  } catch (error) {
    console.error('Error fetching psychiatric consultations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific psychiatric consultation by ID
router.get('/consultations/:patientId/:consultationId', async (req, res) => {
  const { patientId, consultationId } = req.params;

  try {
    const [consultation] = await db.query(
      `SELECT 
        pc.*,
        u.name AS consultantName,
        u.phone_number AS consultantPhone,
        u.email AS consultantEmail,
        p.first_name AS patientFirstName,
        p.last_name AS patientLastName,
        p.dob AS patientDob,
        p.mrn AS patientMrn,
        c.name AS clinicName
      FROM psych_consultations pc
      JOIN users u ON pc.consultant_id = u.id
      JOIN patients p ON pc.patient_id = p.id
      JOIN clinics c ON p.clinic_id = c.id
      WHERE pc.id = ? AND pc.patient_id = ?`,
      [consultationId, patientId]
    );

    if (!consultation.length) {
      return res.status(404).json({ error: 'Psychiatric consultation not found' });
    }

    const formattedConsultation = {
      ...consultation[0],
      consult_date: format(new Date(consultation[0].consult_date), 'yyyy-MM-dd'),
      next_follow_up_date: consultation[0].next_follow_up_date ? 
        format(new Date(consultation[0].next_follow_up_date), 'yyyy-MM-dd') : null,
      patientDob: format(new Date(consultation[0].patientDob), 'yyyy-MM-dd')
    };

    res.json(formattedConsultation);
  } catch (error) {
    console.error('Error fetching psychiatric consultation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a psychiatric consultation
router.put('/consultations/:consultationId',
  [
    body('companyName').notEmpty().withMessage('Company name is required'),
    body('consultDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Consult Date must be in YYYY-MM-DD format'),
    body('assessmentType').isIn(['Initial', 'Follow-up']).withMessage('Assessment type must be Initial or Follow-up'),
    body('minutes').isInt({ min: 1 }).withMessage('Minutes must be a positive integer'),
    body('summary').notEmpty().withMessage('Summary is required'),
    body('recommendations').notEmpty().withMessage('Recommendations are required'),
    body('treatmentPlan').optional().isString(),
    body('medications').optional().isString(),
    body('followUpNeeded').optional().isBoolean(),
    body('nextFollowUpDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Next follow-up date must be in YYYY-MM-DD format')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { consultationId } = req.params;
    const {
      companyName,
      consultDate,
      assessmentType,
      minutes,
      summary,
      recommendations,
      treatmentPlan,
      medications,
      followUpNeeded,
      nextFollowUpDate
    } = req.body;

    try {
      const [result] = await db.query(
        `UPDATE psych_consultations SET 
          company_name = ?,
          consult_date = ?, 
          assessment_type = ?,
          minutes = ?, 
          summary = ?,
          recommendations = ?, 
          treatment_plan = ?, 
          medications = ?,
          follow_up_needed = ?,
          next_follow_up_date = ?
        WHERE id = ?`,
        [
          companyName,
          consultDate, 
          assessmentType,
          minutes, 
          summary,
          recommendations, 
          treatmentPlan, 
          medications,
          followUpNeeded || false,
          nextFollowUpDate || null,
          consultationId
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Psychiatric consultation not found' });
      }

      res.json({ message: 'Psychiatric consultation updated successfully' });
    } catch (error) {
      console.error('Error updating psychiatric consultation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete a psychiatric consultation
router.delete('/consultations/:consultationId', async (req, res) => {
  const { consultationId } = req.params;

  try {
    const [result] = await db.query(
      'DELETE FROM psych_consultations WHERE id = ?',
      [consultationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Psychiatric consultation not found' });
    }

    res.json({ message: 'Psychiatric consultation deleted successfully' });
  } catch (error) {
    console.error('Error deleting psychiatric consultation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export psychiatric consultation as PDF
router.get('/consultations/:patientId/:consultationId/export', async (req, res) => {
  const { patientId, consultationId } = req.params;
  
  try {
    console.log('Export Psych Consultation PDF Request:', { patientId, consultationId });

    const [consultation] = await db.query(
      `SELECT 
        pc.*,
        u.name AS consultantName,
        u.phone_number AS consultantPhone,
        u.email AS consultantEmail,
        p.first_name AS patientFirstName,
        p.last_name AS patientLastName,
        p.dob AS patientDob,
        p.mrn AS patientMrn,
        c.name AS clinicName
      FROM psych_consultations pc
      JOIN users u ON pc.consultant_id = u.id
      JOIN patients p ON pc.patient_id = p.id
      JOIN clinics c ON p.clinic_id = c.id
      WHERE pc.id = ? AND pc.patient_id = ?`,
      [consultationId, patientId]
    );

    if (!consultation.length) {
      return res.status(404).json({ error: 'Psychiatric consultation not found' });
    }

    const data = consultation[0];
    console.log('Consultation Data:', data);

    const consultDate = format(new Date(data.consult_date), 'yyyy-MM-dd');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Psych_Consultation_${consultDate}.pdf`);
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    const primaryColor = '#2C3E50';
    const accentColor = '#3498DB';
    const lightGray = '#F8F9FA';

    // Header with colored background
    doc.rect(0, 0, doc.page.width, 120).fill(primaryColor);
    
    // Main title
    doc.fillColor('white').fontSize(24).font('Helvetica-Bold')
      .text('PSYCHIATRIC CONSULTING NOTE', 50, 30, { align: 'center' });
    
    // Company name and practitioner info
    doc.fontSize(16).font('Helvetica-Bold')
      .text(data.company_name || 'Private Practice', 50, 65, { align: 'center' });
    
    doc.fontSize(12).font('Helvetica')
      .text(data.consultantName, 50, 85, { align: 'center' })
      .text(`Phone: ${data.consultantPhone || 'N/A'}`, 50, 100, { align: 'center' });

    doc.y = 140;

    // Clinic and Date Information
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
      .text('Clinic:', 50, doc.y);
    doc.fillColor('black').fontSize(12).font('Helvetica')
      .text(data.clinicName, 110, doc.y);
    
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
      .text('Date:', 350, doc.y);
    doc.fillColor('black').fontSize(12).font('Helvetica')
      .text(format(new Date(data.consult_date), 'MMMM d, yyyy'), 390, doc.y);

    doc.y += 30;

    // Patient Information
    doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold')
      .text('Patient Information', 50, doc.y, { underline: true });
    doc.y += 25;

    doc.fillColor('black').fontSize(12).font('Helvetica')
      .text(`Name: ${data.patientFirstName} ${data.patientLastName}`, 50, doc.y);
    doc.y += 20;
    
    doc.text(`Date of Birth: ${format(new Date(data.patientDob), 'MMMM d, yyyy')}`, 50, doc.y);
    doc.y += 20;
    
    doc.text(`MRN: ${data.patientMrn}`, 50, doc.y);
    doc.y += 30;

    // Assessment Type
    doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
      .text(`Referred from: ${data.assessment_type} Assessment`, 50, doc.y);
    doc.y += 30;

    // Summary Section
    doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold')
      .text('Summary:', 50, doc.y, { underline: true });
    doc.y += 25;

    // Summary box with border
    const summaryHeight = Math.max(80, Math.ceil(data.summary.length / 80) * 12 + 20);
    doc.rect(50, doc.y, 500, summaryHeight).stroke('#CCCCCC');
    doc.fillColor('black').fontSize(11).font('Helvetica')
      .text(data.summary, 60, doc.y + 10, { 
        width: 480, 
        height: summaryHeight - 20,
        align: 'left'
      });
    doc.y += summaryHeight + 20;

    // Check if we need a new page for recommendations
    if (doc.y + 150 > doc.page.height - 100) {
      doc.addPage();
      doc.y = 50;
    }

    // Recommendations Section
    doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold')
      .text('Recommendations:', 50, doc.y, { underline: true });
    doc.y += 25;

    // Recommendations box with border
    const recommendationsHeight = Math.max(80, Math.ceil(data.recommendations.length / 80) * 12 + 20);
    doc.rect(50, doc.y, 500, recommendationsHeight).stroke('#CCCCCC');
    doc.fillColor('black').fontSize(11).font('Helvetica')
      .text(data.recommendations, 60, doc.y + 10, { 
        width: 480, 
        height: recommendationsHeight - 20,
        align: 'left'
      });
    doc.y += recommendationsHeight + 30;

    // Additional sections if they exist
    if (data.treatment_plan && data.treatment_plan.trim()) {
      if (doc.y + 100 > doc.page.height - 100) {
        doc.addPage();
        doc.y = 50;
      }
      
      doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
        .text('Treatment Plan:', 50, doc.y);
      doc.y += 20;
      doc.fillColor('black').fontSize(11).font('Helvetica')
        .text(data.treatment_plan, 50, doc.y, { width: 500 });
      doc.y += Math.ceil(data.treatment_plan.length / 80) * 12 + 20;
    }

    if (data.medications && data.medications.trim()) {
      if (doc.y + 100 > doc.page.height - 100) {
        doc.addPage();
        doc.y = 50;
      }
      
      doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
        .text('Medications:', 50, doc.y);
      doc.y += 20;
      doc.fillColor('black').fontSize(11).font('Helvetica')
        .text(data.medications, 50, doc.y, { width: 500 });
      doc.y += Math.ceil(data.medications.length / 80) * 12 + 20;
    }

    // Footer area - ensure we're at the bottom
    const footerY = doc.page.height - 120;
    doc.y = Math.max(doc.y + 40, footerY);
    
    // Footer text from the image
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#CCCCCC');
    doc.y += 15;
    
    doc.fillColor('#666666').fontSize(9).font('Helvetica')
      .text('Recommendations are based on chart review and discussion with the care coordinator. The intention is for these', 50, doc.y)
      .text('recommendations to be seen as consultation by the provider and collaborative care team. The application of these or', 50, doc.y + 12)
      .text('other clinical recommendations are subject to PCP discretion and clinical discussions with the patient.', 50, doc.y + 24);
    
    doc.y += 50;
    
    // Signature section
    doc.fillColor('black').fontSize(12).font('Helvetica-Bold')
      .text(data.consultantName, 50, doc.y);
    doc.y += 15;
    doc.fontSize(10).font('Helvetica')
      .text('Diplomate American Board of Psychiatry and Neurology', 50, doc.y);

    doc.end();
  } catch (error) {
    console.error('Error exporting psychiatric consultation PDF:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router; 