const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../lib/db');
const { jwtSecret } = require('../config');

// Login Controller
exports.login = async (req, res) => {
  const { username, password } = req.body;
  

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [username]);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '1h' });
    res.status(200).json({ token });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Register Controller (Optional)
exports.register = async (req, res) => {
  const { name, email, password, role, clinic_id } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query('INSERT INTO users (name, email, password, role, clinic_id) VALUES (?, ?, ?, ?, ?)', [
      name, email, hashedPassword, role, clinic_id,
    ]);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
