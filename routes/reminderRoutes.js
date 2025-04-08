// const express = require('express');
// const router = express.Router();
// const ReminderService = require('../services/reminder.service');

// // Get reminders for a care manager
// router.get('/care-manager/:careManagerId', async (req, res) => {
//   try {
//     const reminders = await ReminderService.getCareManagerReminders(req.params.careManagerId);
//     res.json(reminders);
//   } catch (error) {
//     console.error('Error fetching reminders:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // Complete a reminder
// router.put('/:id/complete', async (req, res) => {
//   try {
//     await ReminderService.updateReminderStatus(req.params.id, req.body.userId, 'completed');
//     res.json({ message: 'Reminder marked as completed' });
//   } catch (error) {
//     console.error('Error completing reminder:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// // Dismiss a reminder
// router.put('/:id/dismiss', async (req, res) => {
//   try {
//     await ReminderService.updateReminderStatus(req.params.id, req.body.userId, 'dismissed');
//     res.json({ message: 'Reminder dismissed' });
//   } catch (error) {
//     console.error('Error dismissing reminder:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// module.exports = router;

const express = require('express');
const router = express.Router();
const ReminderService = require('../services/reminder.service');

// Get reminders for a care manager
router.get('/care-manager/:careManagerId', async (req, res) => {
  try {
    const reminders = await ReminderService.getCareManagerReminders(req.params.careManagerId);
    res.json(reminders);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reminders for a specific patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const reminders = await ReminderService.getPatientReminders(req.params.patientId);
    res.json(reminders);
  } catch (error) {
    console.error('Error fetching patient reminders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get overdue reminders for a care manager
router.get('/overdue/:careManagerId', async (req, res) => {
  try {
    const reminders = await ReminderService.getOverdueReminders(req.params.careManagerId);
    res.json(reminders);
  } catch (error) {
    console.error('Error fetching overdue reminders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get today's reminders for a care manager
router.get('/today/:careManagerId', async (req, res) => {
  try {
    const reminders = await ReminderService.getTodaysReminders(req.params.careManagerId);
    res.json(reminders);
  } catch (error) {
    console.error('Error fetching today\'s reminders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reminder history for a patient
router.get('/history/:patientId', async (req, res) => {
  try {
    const history = await ReminderService.getPatientReminderHistory(req.params.patientId);
    res.json(history);
  } catch (error) {
    console.error('Error fetching reminder history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reminder statistics for a care manager
router.get('/stats/:careManagerId', async (req, res) => {
  try {
    const stats = await ReminderService.getReminderStats(req.params.careManagerId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching reminder statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new reminder
// router.post('/', async (req, res) => {
//   try {
//     const { patientId, careManagerId, assessmentType, assessmentDate } = req.body;
//     const reminderId = await ReminderService.createAssessmentReminder({
//       patientId,
//       careManagerId,
//       assessmentType,
//       assessmentDate
//     });
//     res.status(201).json({ id: reminderId, message: 'Reminder created successfully' });
//   } catch (error) {
//     console.error('Error creating reminder:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// Modify the POST / endpoint
router.post('/', async (req, res) => {
  try {
    const { patientId, careManagerId, assessmentType, contactDate } = req.body;
    
    // Validate required fields
    if (!contactDate) {
      return res.status(400).json({ error: 'Contact date is required' });
    }

    // Calculate reminder date (7 days after contact date)
    const reminderDate = new Date(contactDate);
    reminderDate.setDate(reminderDate.getDate() + 7);

    const reminderId = await ReminderService.createAssessmentReminder({
      patientId,
      careManagerId,
      assessmentType,
      reminderDate: reminderDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
      description: 'Follow-up Assessment due'
    });

    res.status(201).json({ id: reminderId, message: 'Reminder created successfully' });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete a reminder
router.put('/:id/complete', async (req, res) => {
  try {
    await ReminderService.updateReminderStatus(req.params.id, req.body.userId, 'completed');
    res.json({ message: 'Reminder marked as completed' });
  } catch (error) {
    console.error('Error completing reminder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dismiss a reminder
router.put('/:id/dismiss', async (req, res) => {
  try {
    await ReminderService.updateReminderStatus(req.params.id, req.body.userId, 'dismissed');
    res.json({ message: 'Reminder dismissed' });
  } catch (error) {
    console.error('Error dismissing reminder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a reminder
router.delete('/:id', async (req, res) => {
  try {
    await ReminderService.deleteReminder(req.params.id);
    res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;