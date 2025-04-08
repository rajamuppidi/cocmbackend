const express = require('express');
const router = express.Router();
const pool = require('../lib/db'); // Make sure this path is correct

router.get('/clinics', async (req, res) => {
    try {
        const [clinics] = await pool.query('SELECT * FROM clinics');
        res.json(clinics);
    } catch (error) {
        console.error('Error fetching clinics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/care-managers', async (req, res) => {
    const clinicId = req.query.clinicId;
    try {
        const [careManagers] = await pool.query('SELECT * FROM users WHERE clinic_id = ? AND role = "BHCM"', [clinicId]);
        res.json(careManagers);
    } catch (error) {
        console.error('Error fetching care managers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/consultants', async (req, res) => {
    const clinicId = req.query.clinicId;
    try {
        const [consultants] = await pool.query('SELECT * FROM users WHERE clinic_id = ? AND role = "Psychiatric Consultant"', [clinicId]);
        res.json(consultants);
    } catch (error) {
        console.error('Error fetching consultants:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/providers', async (req, res) => {
    const clinicId = req.query.clinicId;
    try {
        const [providers] = await pool.query('SELECT * FROM users WHERE clinic_id = ? AND role = "Primary Care Provider"', [clinicId]);
        res.json(providers);
    } catch (error) {
        console.error('Error fetching providers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
