// routes/adminRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { db } = require('../config'); // Correctly import db config

const router = express.Router();

const pool = mysql.createPool({
  host: db.host,
  user: db.user,
  password: db.password,
  database: db.database,
});

router.post('/create-admin', async (req, res) => {
  const { name, email, password, secret } = req.body;

  // Check the secret token
  if (secret !== process.env.SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the admin user into the database
    await pool.query(
      'INSERT INTO users (name, email, password, role, clinic_id) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'Admin', null] // assuming admin is not linked to a specific clinic
    );

    res.json({ message: 'Admin user created successfully' });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND role = ?', [id, 'Admin']);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching admin data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; // Ensure this line is present
