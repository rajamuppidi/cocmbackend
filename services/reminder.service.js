// // const db = require('../lib/db');

// // class ReminderService {

// //   static async createAssessmentReminder({
// //     patientId,
// //     careManagerId,
// //     assessmentType,
// //     assessmentDate
// //   }) {
// //     const dueDate = new Date(assessmentDate);
// //     dueDate.setDate(dueDate.getDate() + 7);

// //     try {
// //       const [result] = await db.query(
// //         `INSERT INTO reminders (
// //           patient_id,
// //           care_manager_id,
// //           reminder_type,
// //           reminder_date,
// //           description,
// //           status
// //         ) VALUES (?, ?, ?, ?, ?, 'pending')`,
// //         [
// //           patientId,
// //           careManagerId,
// //           assessmentType,
// //           dueDate,
// //           `${assessmentType} due for patient`
// //         ]
// //       );
// //       return result.insertId;
// //     } catch (error) {
// //       console.error('Error creating reminder:', error);
// //       throw error;
// //     }
// //   }

// //   static async getCareManagerReminders(careManagerId) {
// //     try {
// //       const query = `
// //         SELECT 
// //           r.id,
// //           r.patient_id,
// //           r.reminder_type,
// //           r.reminder_date,
// //           r.description,
// //           r.status,
// //           r.created_at,
// //           p.first_name,
// //           p.last_name,
// //           p.mrn,
// //           c.name as clinic_name
// //         FROM reminders r
// //         JOIN patients p ON r.patient_id = p.id
// //         JOIN clinics c ON p.clinic_id = c.id
// //         WHERE r.care_manager_id = ? 
// //         AND r.status = 'pending'
// //         ORDER BY r.reminder_date ASC`;

// //       const [reminders] = await db.query(query, [careManagerId]);
// //       return reminders;
// //     } catch (error) {
// //       console.error('Error fetching reminders:', error);
// //       throw error;
// //     }
// //   }

// //   static async updateReminderStatus(reminderId, userId, status) {
// //     try {
// //       await db.query(
// //         `UPDATE reminders 
// //          SET status = ?,
// //              completed_by = ?,
// //              completed_at = CURRENT_TIMESTAMP
// //          WHERE id = ?`,
// //         [status, userId, reminderId]
// //       );
// //     } catch (error) {
// //       console.error('Error updating reminder:', error);
// //       throw error;
// //     }
// //   }
// // }

// // module.exports = ReminderService;


// const db = require('../lib/db');

// class ReminderService {
//   // Create a reminder after assessment
//   static async createAssessmentReminder({
//     patientId,
//     careManagerId,
//     assessmentType,
//     assessmentDate
//   }) {
//     const dueDate = new Date(assessmentDate);
//     dueDate.setDate(dueDate.getDate() + 7); // Set due date to 7 days after assessment

//     try {
//       const [result] = await db.query(
//         `INSERT INTO reminders (
//           patient_id,
//           care_manager_id,
//           reminder_type,
//           reminder_date,
//           description,
//           status
//         ) VALUES (?, ?, ?, ?, ?, 'pending')`,
//         [
//           patientId,
//           careManagerId,
//           assessmentType,
//           dueDate,
//           `${assessmentType} due for patient`
//         ]
//       );
//       return result.insertId;
//     } catch (error) {
//       console.error('Error creating reminder:', error);
//       throw error;
//     }
//   }

//   // Get all reminders for a care manager
//   static async getCareManagerReminders(careManagerId) {
//     try {
//       const query = `
//         SELECT 
//           r.id,
//           r.patient_id,
//           r.reminder_type,
//           r.reminder_date,
//           r.description,
//           r.status,
//           r.created_at,
//           p.first_name,
//           p.last_name,
//           p.mrn,
//           c.name as clinic_name
//         FROM reminders r
//         JOIN patients p ON r.patient_id = p.id
//         JOIN clinics c ON p.clinic_id = c.id
//         WHERE r.care_manager_id = ? 
//         AND r.status = 'pending'
//         ORDER BY r.reminder_date ASC`;

//       const [reminders] = await db.query(query, [careManagerId]);
//       return reminders;
//     } catch (error) {
//       console.error('Error fetching care manager reminders:', error);
//       throw error;
//     }
//   }

//   // Get reminders for a specific patient
//   static async getPatientReminders(patientId) {
//     try {
//       const query = `
//         SELECT 
//           r.id,
//           r.patient_id,
//           r.reminder_type,
//           r.reminder_date,
//           r.description,
//           r.status,
//           r.created_at,
//           p.first_name,
//           p.last_name,
//           p.mrn,
//           c.name as clinic_name
//         FROM reminders r
//         JOIN patients p ON r.patient_id = p.id
//         JOIN clinics c ON p.clinic_id = c.id
//         WHERE r.patient_id = ? 
//         AND r.status = 'pending'
//         ORDER BY r.reminder_date ASC`;

//       const [reminders] = await db.query(query, [patientId]);
//       return reminders;
//     } catch (error) {
//       console.error('Error fetching patient reminders:', error);
//       throw error;
//     }
//   }

//   // Update reminder status (complete or dismiss)
//   static async updateReminderStatus(reminderId, userId, status) {
//     try {
//       await db.query(
//         `UPDATE reminders 
//          SET status = ?,
//              completed_by = ?,
//              completed_at = CURRENT_TIMESTAMP
//          WHERE id = ?`,
//         [status, userId, reminderId]
//       );
//     } catch (error) {
//       console.error('Error updating reminder status:', error);
//       throw error;
//     }
//   }

//   // Get overdue reminders for a care manager
//   static async getOverdueReminders(careManagerId) {
//     try {
//       const query = `
//         SELECT 
//           r.id,
//           r.patient_id,
//           r.reminder_type,
//           r.reminder_date,
//           r.description,
//           r.status,
//           r.created_at,
//           p.first_name,
//           p.last_name,
//           p.mrn,
//           c.name as clinic_name,
//           DATEDIFF(CURRENT_DATE, r.reminder_date) as days_overdue
//         FROM reminders r
//         JOIN patients p ON r.patient_id = p.id
//         JOIN clinics c ON p.clinic_id = c.id
//         WHERE r.care_manager_id = ? 
//         AND r.status = 'pending'
//         AND r.reminder_date < CURRENT_DATE
//         ORDER BY r.reminder_date ASC`;

//       const [reminders] = await db.query(query, [careManagerId]);
//       return reminders;
//     } catch (error) {
//       console.error('Error fetching overdue reminders:', error);
//       throw error;
//     }
//   }

//   // Get today's reminders for a care manager
//   static async getTodaysReminders(careManagerId) {
//     try {
//       const query = `
//         SELECT 
//           r.id,
//           r.patient_id,
//           r.reminder_type,
//           r.reminder_date,
//           r.description,
//           r.status,
//           r.created_at,
//           p.first_name,
//           p.last_name,
//           p.mrn,
//           c.name as clinic_name
//         FROM reminders r
//         JOIN patients p ON r.patient_id = p.id
//         JOIN clinics c ON p.clinic_id = c.id
//         WHERE r.care_manager_id = ? 
//         AND r.status = 'pending'
//         AND DATE(r.reminder_date) = CURRENT_DATE
//         ORDER BY r.reminder_date ASC`;

//       const [reminders] = await db.query(query, [careManagerId]);
//       return reminders;
//     } catch (error) {
//       console.error('Error fetching today\'s reminders:', error);
//       throw error;
//     }
//   }

//   // Get reminder history for a patient
//   static async getPatientReminderHistory(patientId) {
//     try {
//       const query = `
//         SELECT 
//           r.id,
//           r.patient_id,
//           r.reminder_type,
//           r.reminder_date,
//           r.description,
//           r.status,
//           r.created_at,
//           r.completed_at,
//           p.first_name,
//           p.last_name,
//           p.mrn,
//           c.name as clinic_name,
//           u.name as completed_by_name
//         FROM reminders r
//         JOIN patients p ON r.patient_id = p.id
//         JOIN clinics c ON p.clinic_id = c.id
//         LEFT JOIN users u ON r.completed_by = u.id
//         WHERE r.patient_id = ? 
//         AND r.status IN ('completed', 'dismissed')
//         ORDER BY r.reminder_date DESC`;

//       const [reminders] = await db.query(query, [patientId]);
//       return reminders;
//     } catch (error) {
//       console.error('Error fetching reminder history:', error);
//       throw error;
//     }
//   }

//   // Delete a reminder
//   static async deleteReminder(reminderId) {
//     try {
//       await db.query('DELETE FROM reminders WHERE id = ?', [reminderId]);
//     } catch (error) {
//       console.error('Error deleting reminder:', error);
//       throw error;
//     }
//   }

//   // Get reminder statistics for a care manager
//   static async getReminderStats(careManagerId) {
//     try {
//       const query = `
//         SELECT 
//           COUNT(*) as total_reminders,
//           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_reminders,
//           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_reminders,
//           SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed_reminders,
//           SUM(CASE WHEN reminder_date < CURRENT_DATE AND status = 'pending' THEN 1 ELSE 0 END) as overdue_reminders
//         FROM reminders
//         WHERE care_manager_id = ?`;

//       const [stats] = await db.query(query, [careManagerId]);
//       return stats[0];
//     } catch (error) {
//       console.error('Error fetching reminder statistics:', error);
//       throw error;
//     }
//   }
// }

// module.exports = ReminderService;

const db = require('../lib/db');
const { format, addDays, isValid } = require('date-fns');

class ReminderService {
  // Create reminder with proper date handling
  static async createAssessmentReminder({
    patientId,
    careManagerId,
    assessmentType,
    contactDate
  }) {
    try {
      // Validate required fields
      if (!patientId || !careManagerId || !assessmentType || !contactDate) {
        throw new Error('Missing required fields for reminder creation');
      }

      // Validate and parse contact date
      const parsedContactDate = new Date(contactDate);
      if (!isValid(parsedContactDate)) {
        throw new Error('Invalid contact date format');
      }

      // Calculate due date 7 days after contact date
      const dueDate = addDays(parsedContactDate, 7);
      const formattedDueDate = format(dueDate, 'yyyy-MM-dd');

      // Insert reminder
      const [result] = await db.query(
        `INSERT INTO reminders (
          patient_id,
          care_manager_id,
          reminder_type,
          reminder_date,
          description,
          status
        ) VALUES (?, ?, ?, ?, ?, 'pending')`,
        [
          patientId,
          careManagerId,
          assessmentType,
          formattedDueDate,
          `${assessmentType} due for patient`
        ]
      );

      return result.insertId;
    } catch (error) {
      console.error('Error creating reminder:', error);
      throw error;
    }
  }

  // Get care manager reminders
  static async getCareManagerReminders(careManagerId) {
    try {
      const [reminders] = await db.query(
        `SELECT 
          r.id,
          r.patient_id,
          r.reminder_type,
          r.reminder_date,
          r.description,
          r.status,
          r.created_at,
          p.first_name,
          p.last_name,
          p.mrn,
          c.name as clinic_name
        FROM reminders r
        JOIN patients p ON r.patient_id = p.id
        JOIN clinics c ON p.clinic_id = c.id
        WHERE r.care_manager_id = ? 
        AND r.status = 'pending'
        ORDER BY r.reminder_date ASC`,
        [careManagerId]
      );
      return reminders;
    } catch (error) {
      console.error('Error fetching care manager reminders:', error);
      throw error;
    }
  }

  // Update reminder status
  static async updateReminderStatus(reminderId, userId, status) {
    try {
      if (!['completed', 'dismissed'].includes(status)) {
        throw new Error('Invalid status value');
      }

      const [result] = await db.query(
        `UPDATE reminders 
         SET status = ?,
             completed_by = ?,
             completed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, userId, reminderId]
      );

      return result.affectedRows;
    } catch (error) {
      console.error('Error updating reminder status:', error);
      throw error;
    }
  }

  // Get patient reminders
  static async getPatientReminders(patientId) {
    try {
      const [reminders] = await db.query(
        `SELECT 
          r.id,
          r.reminder_type,
          r.reminder_date,
          r.description,
          r.status,
          r.created_at
        FROM reminders r
        WHERE r.patient_id = ? 
        AND r.status = 'pending'
        ORDER BY r.reminder_date ASC`,
        [patientId]
      );
      return reminders;
    } catch (error) {
      console.error('Error fetching patient reminders:', error);
      throw error;
    }
  }

  // Get overdue reminders
  static async getOverdueReminders(careManagerId) {
    try {
      const [reminders] = await db.query(
        `SELECT 
          r.id,
          r.patient_id,
          r.reminder_type,
          r.reminder_date,
          r.description,
          r.status,
          r.created_at,
          p.first_name,
          p.last_name,
          p.mrn,
          c.name as clinic_name,
          DATEDIFF(CURRENT_DATE, r.reminder_date) as days_overdue
        FROM reminders r
        JOIN patients p ON r.patient_id = p.id
        JOIN clinics c ON p.clinic_id = c.id
        WHERE r.care_manager_id = ? 
        AND r.status = 'pending'
        AND r.reminder_date < CURRENT_DATE
        ORDER BY r.reminder_date ASC`,
        [careManagerId]
      );
      return reminders;
    } catch (error) {
      console.error('Error fetching overdue reminders:', error);
      throw error;
    }
  }

  // Get today's reminders
  static async getTodaysReminders(careManagerId) {
    try {
      const [reminders] = await db.query(
        `SELECT 
          r.id,
          r.patient_id,
          r.reminder_type,
          r.reminder_date,
          r.description,
          r.status,
          r.created_at,
          p.first_name,
          p.last_name,
          p.mrn,
          c.name as clinic_name
        FROM reminders r
        JOIN patients p ON r.patient_id = p.id
        JOIN clinics c ON p.clinic_id = c.id
        WHERE r.care_manager_id = ? 
        AND r.status = 'pending'
        AND DATE(r.reminder_date) = CURRENT_DATE
        ORDER BY r.reminder_date ASC`,
        [careManagerId]
      );
      return reminders;
    } catch (error) {
      console.error('Error fetching today\'s reminders:', error);
      throw error;
    }
  }

  // Get reminder history
  static async getPatientReminderHistory(patientId) {
    try {
      const [history] = await db.query(
        `SELECT 
          r.id,
          r.reminder_type,
          r.reminder_date,
          r.description,
          r.status,
          r.created_at,
          r.completed_at,
          u.name as completed_by_name
        FROM reminders r
        LEFT JOIN users u ON r.completed_by = u.id
        WHERE r.patient_id = ? 
        AND r.status IN ('completed', 'dismissed')
        ORDER BY r.reminder_date DESC`,
        [patientId]
      );
      return history;
    } catch (error) {
      console.error('Error fetching reminder history:', error);
      throw error;
    }
  }

  // Delete reminder
  static async deleteReminder(reminderId) {
    try {
      const [result] = await db.query(
        'DELETE FROM reminders WHERE id = ?',
        [reminderId]
      );
      return result.affectedRows;
    } catch (error) {
      console.error('Error deleting reminder:', error);
      throw error;
    }
  }

  // Get reminder statistics
  static async getReminderStats(careManagerId) {
    try {
      const [stats] = await db.query(
        `SELECT 
          COUNT(*) as total_reminders,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_reminders,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_reminders,
          SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed_reminders,
          SUM(CASE WHEN reminder_date < CURRENT_DATE AND status = 'pending' THEN 1 ELSE 0 END) as overdue_reminders
        FROM reminders
        WHERE care_manager_id = ?`,
        [careManagerId]
      );
      return stats[0];
    } catch (error) {
      console.error('Error fetching reminder statistics:', error);
      throw error;
    }
  }
}

module.exports = ReminderService;