// routes/safetyRoute.js
const express = require('express');
const db = require('../lib/db');
const router = express.Router();

// Add safety plan flag
router.post('/safety-plan-flag', async (req, res) => {
  const { patientId } = req.body;
  
  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    const [existingFlag] = await db.query(
      `SELECT * FROM patient_flags WHERE patient_id = ? AND flag = "Safety Plan"`,
      [patientId]
    );

    if (!existingFlag.length) {
      // Start transaction
      await db.query('START TRANSACTION');
      
      // Add safety plan flag
      await db.query(
        `INSERT INTO patient_flags (patient_id, flag) VALUES (?, "Safety Plan")`,
        [patientId]
      );
      
      // Log the safety plan creation in history
      await db.query(
        `INSERT INTO safety_plan_history (patient_id, action, action_date) VALUES (?, 'created', NOW())`,
        [patientId]
      );
      
      await db.query('COMMIT');
      
      res.status(201).json({ message: 'Safety Plan flag added successfully' });
    } else {
      res.status(200).json({ message: 'Safety Plan flag already exists' });
    }
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error adding safety plan flag:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get safety plan status for a patient
router.get('/safety-plan-status/:patientId', async (req, res) => {
  const { patientId } = req.params;
  
  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    const [safetyPlan] = await db.query(
      `SELECT * FROM patient_flags WHERE patient_id = ? AND flag = "Safety Plan"`,
      [patientId]
    );
    
    const hasSafetyPlan = safetyPlan.length > 0;
    
    res.status(200).json({ 
      hasSafetyPlan,
      patientId
    });
  } catch (error) {
    console.error('Error fetching safety plan status:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Complete safety plan
router.post('/complete-safety-plan', async (req, res) => {
  const { patientId, userId, minutes, notes } = req.body;
  
  if (!patientId || !userId) {
    return res.status(400).json({ error: 'Patient ID and User ID are required' });
  }

  try {
    // Start transaction
    await db.query('START TRANSACTION');
    
    // Check if safety plan flag exists
    const [existingFlag] = await db.query(
      `SELECT * FROM patient_flags WHERE patient_id = ? AND flag = "Safety Plan"`,
      [patientId]
    );

    if (!existingFlag.length) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'No active safety plan found for this patient' });
    }
    
    // Remove safety plan flag
    await db.query(
      `DELETE FROM patient_flags WHERE patient_id = ? AND flag = "Safety Plan"`,
      [patientId]
    );
    
    // Log the safety plan completion in history
    await db.query(
      `INSERT INTO safety_plan_history (patient_id, action, action_date, resolved_by, minutes_spent, notes) 
       VALUES (?, 'resolved', NOW(), ?, ?, ?)`,
      [patientId, userId, minutes || 0, notes || '']
    );
    
    // Track minutes spent on safety plan resolution
    if (minutes && minutes > 0) {
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      await db.query(
        `INSERT INTO minute_tracking (user_id, total_minutes, tracking_date, activity_type) 
         VALUES (?, ?, ?, 'Safety Plan')`,
        [userId, minutes, formattedDate]
      );
    }
    
    await db.query('COMMIT');
    
    res.status(200).json({ message: 'Safety plan completed successfully' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error completing safety plan:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get safety plan history for a patient
router.get('/safety-plan-history/:patientId', async (req, res) => {
  const { patientId } = req.params;
  
  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  try {
    // Get safety plan history
    const [history] = await db.query(
      `SELECT sph.id, sph.patient_id, sph.action, 
              DATE_FORMAT(sph.action_date, '%Y-%m-%d') as action_date,
              sph.resolved_by, sph.minutes_spent, sph.notes,
              u.name as resolved_by_name 
       FROM safety_plan_history sph
       LEFT JOIN users u ON sph.resolved_by = u.id
       WHERE sph.patient_id = ?
       ORDER BY sph.action_date DESC`,
      [patientId]
    );
    
    // Check for active safety plan
    const [activePlan] = await db.query(
      `SELECT * FROM patient_flags WHERE patient_id = ? AND flag = "Safety Plan"`,
      [patientId]
    );
    
    const hasActiveSafetyPlan = activePlan.length > 0;
    
    res.status(200).json({ 
      history,
      hasActiveSafetyPlan
    });
  } catch (error) {
    console.error('Error fetching safety plan history:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router; 