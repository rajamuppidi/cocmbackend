const express = require('express');
const db = require('../lib/db');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { format } = require('date-fns');

//Contact Attempt Route
router.post('/contact-attempts',
  [
    body('patientId').isInt().withMessage('Patient ID must be an integer'),
    body('userId').isInt().withMessage('User ID must be an integer'),
    body('attemptDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Attempt Date must be in YYYY-MM-DD format'),
    body('minutes').isInt({ min: 1 }).withMessage('Minutes must be a positive integer'),
    body('interactionMode').isIn(['by_phone', 'by_video', 'in_clinic']).withMessage('Invalid interaction mode'),
    body('notes').optional().isString().withMessage('Notes must be a string')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { patientId, userId, attemptDate, minutes, interactionMode, notes } = req.body;

    try {
      await db.query('START TRANSACTION');

      // Insert into contact_attempts table
      const [attemptResult] = await db.query(
        `INSERT INTO contact_attempts (patient_id, attempt_date, description) 
         VALUES (?, ?, ?)`,
        [patientId, attemptDate, notes || 'Contact attempt']
      );
      const contactAttemptId = attemptResult.insertId;

      // Track minutes in minute_tracking table with reference to contact_attempt_id
      const [minuteResult] = await db.query(
        `INSERT INTO minute_tracking (user_id, total_minutes, tracking_date, contact_attempt_id) 
         VALUES (?, ?, ?, ?)`,
        [userId, minutes, attemptDate, contactAttemptId]
      );

      // Get patient and user details for response
      const [patient] = await db.query(
        `SELECT first_name, last_name FROM patients WHERE id = ?`,
        [patientId]
      );

      const [user] = await db.query(
        `SELECT name, role FROM users WHERE id = ?`,
        [userId]
      );

      if (!patient.length || !user.length) {
        throw new Error('Patient or User not found');
      }

      await db.query('COMMIT');

      res.status(201).json({
        attemptId: contactAttemptId,
        patient: {
          id: patientId,
          name: `${patient[0].first_name} ${patient[0].last_name}`
        },
        user: {
          id: userId,
          name: user[0].name,
          role: user[0].role
        },
        attemptDate,
        minutes,
        interactionMode,
        notes,
        message: 'Contact attempt recorded successfully'
      });
    } catch (error) {
      await db.query('ROLLBACK');
      console.error('Error recording contact attempt:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
);

// Get Contact Attempt History for a Patient

router.get('/contact-attempts/:patientId', async (req, res) => {
  const { patientId } = req.params;

  try {
    const [attempts] = await db.query(
      `SELECT ca.id, ca.attempt_date AS attemptDate, ca.description AS notes,
              mt.total_minutes AS minutes, u.name AS attemptedBy, u.role AS userRole
       FROM contact_attempts ca
       LEFT JOIN minute_tracking mt ON ca.id = mt.contact_attempt_id
       LEFT JOIN users u ON mt.user_id = u.id
       WHERE ca.patient_id = ?
       ORDER BY ca.attempt_date DESC`,
      [patientId]
    );

    const formattedAttempts = attempts.map(attempt => ({
      ...attempt,
      attemptDate: format(new Date(attempt.attemptDate), 'yyyy-MM-dd')
    }));

    res.status(200).json(formattedAttempts);
  } catch (error) {
    console.error('Error fetching contact attempts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Total Attempt Minutes for a User
router.get('/contact-attempts/user/:userId/minutes', async (req, res) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;

  try {
    let query = `
      SELECT SUM(mt.total_minutes) AS totalMinutes
      FROM minute_tracking mt
      JOIN contact_attempts ca ON mt.tracking_date = ca.attempt_date
      WHERE mt.user_id = ?
    `;
    const params = [userId];

    if (startDate && endDate) {
      query += ` AND mt.tracking_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    const [result] = await db.query(query, params);
    
    res.status(200).json({
      userId,
      totalMinutes: result[0].totalMinutes || 0,
      period: startDate && endDate ? `${startDate} to ${endDate}` : 'All time'
    });
  } catch (error) {
    console.error('Error fetching total attempt minutes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;