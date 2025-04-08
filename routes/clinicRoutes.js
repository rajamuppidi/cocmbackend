// // routes/clinicRoutes.js
// const express = require('express');
// const db = require('../lib/db'); // Adjust the path if necessary

// const router = express.Router();

// // Create a new clinic
// router.post('/', async (req, res) => {
//   const { name, organization_id, address, phone_number, email } = req.body;

//   try {
//     const [result] = await db.query(
//       'INSERT INTO clinics (name, organization_id, address, phone_number, email) VALUES (?, ?, ?, ?, ?)',
//       [name, organization_id, address, phone_number, email]
//     );
//     res.status(201).json({ id: result.insertId });
//   } catch (error) {
//     console.error('Error creating clinic:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // Fetch all clinics
// router.get('/', async (req, res) => {
//   try {
//     const [rows] = await db.query('SELECT id, name, address, phone_number, email FROM clinics'); // Include all necessary fields
//     res.json(rows);
//   } catch (error) {
//     console.error('Error fetching clinics:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });


// // Get a single clinic
// router.get('/:id', async (req, res) => {
//   const { id } = req.params;

//   try {
//     const [rows] = await db.query('SELECT * FROM clinics WHERE id = ?', [id]);
//     if (rows.length === 0) {
//       return res.status(404).json({ error: 'Clinic not found' });
//     }
//     res.json(rows[0]);
//   } catch (error) {
//     console.error('Error fetching clinic:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // Update a clinic
// router.put('/:id', async (req, res) => {
//   const { id } = req.params;
//   const { name, organization_id, address, phone_number, email } = req.body;

//   try {
//     const [result] = await db.query(
//       'UPDATE clinics SET name = ?, organization_id = ?, address = ?, phone_number = ?, email = ? WHERE id = ?',
//       [name, organization_id, address, phone_number, email, id]
//     );
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ error: 'Clinic not found' });
//     }
//     res.json({ message: 'Clinic updated successfully' });
//   } catch (error) {
//     console.error('Error updating clinic:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // Delete a clinic
// router.delete('/:id', async (req, res) => {
//   const { id } = req.params;

//   try {
//     const [users] = await db.query('SELECT * FROM users WHERE clinic_id = ?', [id]);
//     if (users.length > 0) {
//       return res.status(400).json({ error: 'Cannot delete clinic with associated users' });
//     }
//     const [result] = await db.query('DELETE FROM clinics WHERE id = ?', [id]);
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ error: 'Clinic not found' });
//     }
//     res.json({ message: 'Clinic deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting clinic:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // Fetch clinic data by ID
// router.get('/:id/data', async (req, res) => {
//   const { id } = req.params;
//   try {
//     // Fetching data from various tables
//     const [[{ totalPatients }]] = await db.query('SELECT COUNT(*) AS totalPatients FROM patients WHERE clinic_id = ?', [id]);
//     const [[{ activePatients }]] = await db.query('SELECT COUNT(*) AS activePatients FROM patients WHERE clinic_id = ? AND status = "Active"', [id]);
//     const [[{ totalMinutesTracked }]] = await db.query('SELECT SUM(total_minutes) AS totalMinutesTracked FROM minute_tracking WHERE user_id IN (SELECT id FROM users WHERE clinic_id = ?)', [id]);
//     const [[{ averageMinutesPerPatient }]] = await db.query('SELECT AVG(total_minutes) AS averageMinutesPerPatient FROM minute_tracking WHERE user_id IN (SELECT id FROM users WHERE clinic_id = ?)', [id]);

//     const clinicData = {
//       totalPatients,
//       activePatients,
//       totalMinutesTracked: totalMinutesTracked || 0,
//       averageMinutesPerPatient: averageMinutesPerPatient || 0
//     };

//     res.json(clinicData);
//   } catch (error) {
//     console.error('Error fetching clinic data:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// module.exports = router;


// routes/clinicRoutes.js
const express = require('express');
const db = require('../lib/db');

const router = express.Router();

// Create a new clinic
router.post('/', async (req, res) => {
  const { name, organization_id, address, phone_number, email } = req.body;

  try {
    const [result] = await db.query(
      'INSERT INTO clinics (name, organization_id, address, phone_number, email) VALUES (?, ?, ?, ?, ?)',
      [name, organization_id, address, phone_number, email]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('Error creating clinic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch all clinics
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, address, phone_number, email FROM clinics');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching clinics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single clinic
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM clinics WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching clinic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a clinic
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, organization_id, address, phone_number, email } = req.body;

  try {
    const [result] = await db.query(
      'UPDATE clinics SET name = ?, organization_id = ?, address = ?, phone_number = ?, email = ? WHERE id = ?',
      [name, organization_id, address, phone_number, email, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    res.json({ message: 'Clinic updated successfully' });
  } catch (error) {
    console.error('Error updating clinic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a clinic
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [users] = await db.query('SELECT * FROM users WHERE clinic_id = ?', [id]);
    if (users.length > 0) {
      return res.status(400).json({ error: 'Cannot delete clinic with associated users' });
    }
    const [result] = await db.query('DELETE FROM clinics WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }
    res.json({ message: 'Clinic deleted successfully' });
  } catch (error) {
    console.error('Error deleting clinic:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch clinic data by ID
router.get('/:id/data', async (req, res) => {
  const { id } = req.params;

  try {
    // Get total patients
    const [totalPatientsResult] = await db.query(
      'SELECT COUNT(*) as total FROM patients WHERE clinic_id = ?',
      [id]
    );
    const totalPatients = totalPatientsResult[0].total;

    // Get active patients (using status codes from your patient routes)
    const [activePatientsResult] = await db.query(
      'SELECT COUNT(*) as active FROM patients WHERE clinic_id = ? AND status IN ("A", "R", "T")',
      [id]
    );
    const activePatients = activePatientsResult[0].active;

    // Get total minutes tracked
    const [minutesResult] = await db.query(
      `SELECT SUM(mt.total_minutes) as totalMinutes 
       FROM minute_tracking mt
       JOIN user_patients up ON mt.user_id = up.user_id
       JOIN patients p ON up.patient_id = p.id
       WHERE p.clinic_id = ?`,
      [id]
    );
    const totalMinutesTracked = minutesResult[0].totalMinutes || 0;

    // Calculate average minutes per patient based on active patients
    const averageMinutesPerPatient = activePatients > 0 
      ? Math.round(totalMinutesTracked / activePatients) 
      : 0;

    // Get new patients this month
    const [newPatientsResult] = await db.query(
      `SELECT COUNT(*) as newPatients 
       FROM patients 
       WHERE clinic_id = ? 
       AND enrollment_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`,
      [id]
    );
    const newPatients = newPatientsResult[0].newPatients;

    const clinicData = {
      totalPatients,
      activePatients,
      totalMinutesTracked,
      averageMinutesPerPatient,
      newPatients
    };

    res.json(clinicData);
  } catch (error) {
    console.error('Error fetching clinic data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;