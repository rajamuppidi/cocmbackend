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
      await db.query(
        `INSERT INTO patient_flags (patient_id, flag) VALUES (?, "Safety Plan")`,
        [patientId]
      );
      res.status(201).json({ message: 'Safety Plan flag added successfully' });
    } else {
      res.status(200).json({ message: 'Safety Plan flag already exists' });
    }
  } catch (error) {
    console.error('Error adding safety plan flag:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router; 