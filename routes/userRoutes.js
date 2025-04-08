const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../lib/db'); // Ensure importing the db pool correctly

const router = express.Router();

const validatePassword = (password) => {
  const minLength = 8;
  const maxLength = 12;
  const uppercaseRegex = /[A-Z]/;
  const lowercaseRegex = /[a-z]/;
  const numberRegex = /[0-9]/;
  const specialCharRegex = /[!@#^&*]/;

  return (
    password.length >= minLength &&
    password.length <= maxLength &&
    uppercaseRegex.test(password) &&
    lowercaseRegex.test(password) &&
    numberRegex.test(password) &&
    specialCharRegex.test(password)
  );
};

// Fetch all users with clinic names
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT users.*, GROUP_CONCAT(clinics.name SEPARATOR ', ') as clinic_names 
      FROM users 
      LEFT JOIN user_clinics ON users.id = user_clinics.user_id 
      LEFT JOIN clinics ON user_clinics.clinic_id = clinics.id 
      GROUP BY users.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch user roles
router.get('/roles', async (req, res) => {
  try {
    const [rows] = await db.query('SHOW COLUMNS FROM users LIKE "role"');
    const roles = rows[0].Type.match(/enum\(([^)]+)\)/)[1].replace(/'/g, "").split(",");
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch all clinics
router.get('/clinics', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name FROM clinics');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching clinics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new user
router.post('/', async (req, res) => {
  const { name, email, password, phone_number, role, clinic_ids } = req.body;

  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'Password does not meet requirements' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, phone_number, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, phone_number, role]
    );

    const userId = result.insertId;
    for (const clinicId of clinic_ids) {
      await db.query('INSERT INTO user_clinics (user_id, clinic_id) VALUES (?, ?)', [userId, clinicId]);
    }

    res.status(201).json({ id: userId });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM user_clinics WHERE user_id = ?', [id]);
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a user
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, password, phone_number, role, clinic_ids } = req.body;

  try {
    let updates = { name, email, phone_number, role };
    
    if (password) {
      if (!validatePassword(password)) {
        return res.status(400).json({ error: 'Password does not meet requirements' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.password = hashedPassword;
    }

    const [result] = await db.query(
      'UPDATE users SET ? WHERE id = ?',
      [updates, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query('DELETE FROM user_clinics WHERE user_id = ?', [id]);
    for (const clinicId of clinic_ids) {
      await db.query('INSERT INTO user_clinics (user_id, clinic_id) VALUES (?, ?)', [id, clinicId]);
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch a single user by ID with clinics
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userRows[0];

    const [clinicRows] = await db.query(`
      SELECT c.id, c.name
      FROM clinics c
      JOIN user_clinics uc ON c.id = uc.clinic_id
      WHERE uc.user_id = ?
    `, [id]);

    user.clinics = clinicRows;

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;