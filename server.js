const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const clinicRoutes = require('./routes/clinicRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doccumentRoutes = require('./routes/doccumentsRoutes');
const contactAttemptsRoutes = require('./routes/contact-attempts');
const intakeRoute = require('./routes/intakeRoute'); // Patient intake form routes
const safetyRoute = require('./routes/safetyRoute'); // Safety plan flag functionality
const psychRoutes = require('./routes/psychRoutes'); // Psychiatric routes

dotenv.config();

const app = express();

// CORS configuration - allow your frontend origin and credentials
const allowedOrigins = ['http://localhost:3000']; // Adjust to match your frontend URL (e.g., production domain)

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies/credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allowed headers
}));

app.use(bodyParser.json());

// API routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api', patientRoutes); // Use /api prefix as per your working setup
app.use('/api', doccumentRoutes);
app.use('/api', contactAttemptsRoutes); // Existing route
app.use('/api', intakeRoute); // Changed from safetyRoute to intakeRoute
app.use('/api', safetyRoute); // Add simplified safety route
app.use('/api/psych', psychRoutes); // Add the psychiatric routes

// Test database connection route with logging
app.get('/api/test-db', async (req, res) => {
  try {
    console.log('Testing database connection...');
    const [rows] = await db.query('SELECT 1');
    console.log('Database connection successful:', rows);
    res.json({ message: 'Database connection successful', rows });
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(500).json({ error: 'Database connection failed', details: error.message });
  }
});

// Error handlers with logging
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.use((req, res) => {
  console.log('Route not found for:', req.url);
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4353;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});