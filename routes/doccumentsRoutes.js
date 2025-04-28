// module.exports = router;
const express = require('express');
const db = require('../lib/db');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { format, parseISO } = require('date-fns');
const PDFDocument = require('pdfkit-table');

// Fetch Patient Documents (Folder Structure)
router.get('/patients/:patientId/documents', async (req, res) => {
  const { patientId } = req.params;
  try {
    console.log('Fetching documents for patient ID:', patientId);

    // Fetch contacts (for assessments)
    const [contacts] = await db.query(
      `SELECT contact_date, contact_type FROM contacts WHERE patient_id = ? ORDER BY contact_date DESC`,
      [patientId]
    );
    console.log('Contacts fetched:', contacts);

    // Fetch contact attempts
    const [contactAttempts] = await db.query(
      `SELECT attempt_date, description FROM contact_attempts WHERE patient_id = ? ORDER BY attempt_date DESC`,
      [patientId]
    );
    console.log('Contact attempts fetched:', contactAttempts);

    // Fetch patient intake forms
    const [intakeForms] = await db.query(
      `SELECT contact_date FROM patient_intake WHERE patient_id = ? ORDER BY contact_date DESC`,
      [patientId]
    );
    console.log('Intake forms fetched:', intakeForms);

    const folders = [];

    // Process assessment folders
    if (contacts && contacts.length > 0) {
      const assessmentFolders = await Promise.all(
        contacts.map(async (contact) => {
          console.log('Processing contact:', contact);
          const [assessments] = await db.query(
            `SELECT type, score, answers_json FROM assessments 
             WHERE patient_id = ? AND date = ?`,
            [patientId, contact.contact_date]
          );
          console.log('Assessments for contact:', assessments);
          const files = assessments.map((assessment) => ({
            name: `${assessment.type}_${format(new Date(contact.contact_date), 'yyyy-MM-dd')}.pdf`,
            type: assessment.type,
            score: assessment.score,
            answers: assessment.answers_json ? JSON.parse(assessment.answers_json) : [],
          }));
          return {
            folderName: `Assessment_${format(new Date(contact.contact_date), 'yyyy-MM-dd')}`,
            date: format(new Date(contact.contact_date), 'yyyy-MM-dd'),
            files,
            isOpen: false,
          };
        })
      );
      folders.push(...assessmentFolders);
    }

    // Process intake form folders
    if (intakeForms && intakeForms.length > 0) {
      const intakeFolders = intakeForms.map((intake) => ({
        folderName: `Intake_Form_${format(new Date(intake.contact_date), 'yyyy-MM-dd')}`,
        date: format(new Date(intake.contact_date), 'yyyy-MM-dd'),
        files: [
          {
            name: `Intake_Form_${format(new Date(intake.contact_date), 'yyyy-MM-dd')}.pdf`,
            type: 'Intake_Form',
            contactDate: format(new Date(intake.contact_date), 'yyyy-MM-dd'),
          },
        ],
        isOpen: false,
      }));
      folders.push(...intakeFolders);
    }

    // Process contact attempt folders
    if (contactAttempts && contactAttempts.length > 0) {
      const attemptFolders = contactAttempts.map((attempt) => ({
        folderName: `Contact_Attempt_${format(new Date(attempt.attempt_date), 'yyyy-MM-dd')}`,
        date: format(new Date(attempt.attempt_date), 'yyyy-MM-dd'),
        files: [
          {
            name: `Contact_Attempt_${format(new Date(attempt.attempt_date), 'yyyy-MM-dd')}.pdf`,
            type: 'Contact_Attempt',
            notes: attempt.description || 'No notes provided',
            attemptDate: format(new Date(attempt.attempt_date), 'yyyy-MM-dd'),
          },
        ],
        isOpen: false,
      }));
      folders.push(...attemptFolders);
    }

    // Sort folders by date (newest first)
    folders.sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });

    if (folders.length === 0) {
      console.log('No documents found for patient ID:', patientId);
      return res.status(200).json({ patientId, folders: [] });
    }

    console.log('Documents Response:', { patientId, folders });
    res.json({ patientId, folders });
  } catch (error) {
    console.error('Error fetching patient documents:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Export Assessment as PDF (unchanged)
router.get('/patients/:patientId/assessments/:contactDate/:type/export', async (req, res) => {
  const { patientId, contactDate, type } = req.params;
  try {
    console.log('Export Assessment PDF Request:', { patientId, contactDate, type });

    const parsedDate = parseISO(contactDate);
    const normalizedDate = format(parsedDate, 'yyyy-MM-dd', { timeZone: 'UTC' });
    console.log('Normalized Date (UTC):', normalizedDate);

    if (type !== 'PHQ-9' && type !== 'GAD-7') {
      return res.status(400).json({ error: 'Invalid assessment type' });
    }

    const [assessment] = await db.query(
      `SELECT a.score, a.answers_json, c.contact_date, c.contact_type, u.name AS created_by, 
              p.first_name AS patientFirstName, p.last_name AS patientLastName, 
              c.interaction_mode AS sessionType, c.duration_minutes AS sessionDuration
        FROM assessments a
        JOIN contacts c ON a.patient_id = c.patient_id AND DATE(a.date) = DATE(c.contact_date)
        JOIN users u ON c.created_by = u.id
        JOIN patients p ON a.patient_id = p.id
        WHERE a.patient_id = ? AND DATE(a.date) = ? AND a.type = ?`,
      [patientId, normalizedDate, type]
    );

    if (!assessment.length) {
      return res.status(404).json({ error: 'Assessment not found', details: { patientId, normalizedDate, type } });
    }

    const data = assessment[0];
    const answers = data.answers_json ? JSON.parse(data.answers_json) : [];
    console.log('Parsed Answers:', answers);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_${normalizedDate}.pdf`);
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    const primaryColor = '#2C3E50';
    const accentColor = '#3498DB';
    const lightGray = '#ECF0F1';

    doc.rect(0, 0, 612, 80).fill(primaryColor);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text(`${type} Assessment Report`, 40, 30, { align: 'left' });
    doc.fontSize(10).text(`Generated on ${format(new Date(), 'MMMM d, yyyy')}`, { align: 'right' });

    doc.moveDown(3).fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
      .text(`Patient: ${data.patientFirstName} ${data.patientLastName}`, 40);
    doc.fillColor('black').fontSize(12).font('Helvetica')
      .text(`Date: ${format(data.contact_date, 'MMMM d, yyyy')}`)
      .text(`Care Manager: ${data.created_by || 'Unknown'}`);
    doc.moveDown(1);

    const questions = {
      'PHQ-9': [
        "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
        "Little interest or pleasure in doing things",
        "Feeling down, depressed, or hopeless",
        "Trouble falling or staying asleep, or sleeping too much",
        "Feeling tired or having little energy",
        "Poor appetite or overeating",
        "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
        "Trouble concentrating on things, such as reading the newspaper or watching television",
        "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
        "Thoughts that you would be better off dead, or of hurting yourself in some way"
      ],
      'GAD-7': [
        "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
        "Feeling nervous, anxious, or on edge",
        "Not being able to stop or control worrying",
        "Worrying too much about different things",
        "Trouble relaxing",
        "Being so restless that it is hard to sit still",
        "Becoming easily annoyed or irritable",
        "Feeling afraid as if something awful might happen"
      ]
    };
    const options = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];
    const answersArray = answers || [];
    const questionsList = questions[type].slice(1);

    doc.fillColor(accentColor).fontSize(12).font('Helvetica-Bold')
      .text(questions[type][0], { italic: true });
    doc.moveDown(0.5);

    const tableData = {
      headers: ['Question', ...options],
      rows: questionsList.map((question, i) => {
        const row = [question];
        options.forEach((_, optIndex) => {
          row.push(answersArray[i] === optIndex ? 'X' : '');
        });
        return row;
      })
    };
    console.log('Table Data:', JSON.stringify(tableData, null, 2));

    const startY = doc.y;
    const tableWidth = 532;
    const columnWidths = {
      0: 300,
      1: 58,
      2: 58,
      3: 58,
      4: 58
    };

    doc.rect(40, startY, tableWidth, 30).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor);
    let xPos = 40;
    tableData.headers.forEach((header, i) => {
      const colWidth = columnWidths[i];
      doc.text(header, xPos + 5, startY + 10, {
        width: colWidth - 10,
        align: i === 0 ? 'left' : 'center'
      });
      xPos += colWidth;
      if (i < tableData.headers.length - 1) {
        doc.moveTo(xPos, startY).lineTo(xPos, startY + 30).stroke();
      }
    });

    let yPos = startY + 30;
    tableData.rows.forEach((row, rowIndex) => {
      const rowHeight = 40;
      if (rowIndex % 2 === 0) {
        doc.rect(40, yPos, tableWidth, rowHeight).fill(lightGray);
      }
      xPos = 40;
      doc.font('Helvetica').fontSize(9).fillColor('black');
      row.forEach((cell, colIndex) => {
        const colWidth = columnWidths[colIndex];
        doc.text(cell, xPos + 5, yPos + 5, {
          width: colWidth - 10,
          height: rowHeight - 10,
          align: colIndex === 0 ? 'left' : 'center'
        });
        xPos += colWidth;
        if (colIndex < row.length - 1) {
          doc.moveTo(xPos, yPos).lineTo(xPos, yPos + rowHeight).stroke();
        }
      });
      doc.rect(40, yPos, tableWidth, rowHeight).stroke();
      yPos += rowHeight;
    });

    doc.y = yPos + 20;
    doc.x = 40;

    doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
      .text('Assessment Details', { underline: true });
    doc.moveDown(0.5).fillColor('black').fontSize(11)
      .text(`Contact Type: ${data.contact_type || 'Unknown'}`)
      .text(`Score: ${data.score || 'N/A'}`)
      .text(`Session Type: ${data.sessionType || 'Unknown'}`)
      .text(`Duration: ${data.sessionDuration || 0} minutes`);

    if (type === 'PHQ-9') {
      doc.moveDown(1).fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
        .text('PHQ-9 Score Interpretation', { underline: true });
      doc.fillColor('black').fontSize(10)
        .text('0-4: Minimal or no depression')
        .text('5-9: Mild depression')
        .text('10-14: Moderate depression')
        .text('15-19: Moderately severe depression')
        .text('20-27: Severe depression');
    } else if (type === 'GAD-7') {
      doc.moveDown(1).fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
        .text('GAD-7 Score Interpretation', { underline: true });
      doc.fillColor('black').fontSize(10)
        .text('0-4: Minimal anxiety')
        .text('5-9: Mild anxiety')
        .text('10-14: Moderate anxiety')
        .text('15-21: Severe anxiety');
    }

    const pageHeight = doc.page.height;
    const footerY = Math.max(doc.y + 20, pageHeight - 60);
    if (isNaN(footerY)) footerY = pageHeight - 60;
    doc.moveTo(40, footerY).lineTo(572, footerY).stroke(accentColor);
    doc.fillColor(primaryColor).fontSize(8).font('Helvetica')
      .text(`Confidential - ${type} Document | Page 1 of 1`, 40, footerY + 10, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error exporting assessment PDF:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Export Contact Attempt as PDF (unchanged)
router.get('/patients/:patientId/contact-attempts/:attemptDate/export', async (req, res) => {
  const { patientId, attemptDate } = req.params;
  try {
    console.log('Export Contact Attempt PDF Request:', { patientId, attemptDate });

    const parsedDate = parseISO(attemptDate);
    const normalizedDate = format(parsedDate, 'yyyy-MM-dd', { timeZone: 'UTC' });
    console.log('Normalized Date (UTC):', normalizedDate);

    const [attempt] = await db.query(
      `SELECT ca.attempt_date, ca.description AS notes, 
              u.name AS created_by_name, u.email AS created_by_email, u.phone_number AS created_by_phone, u.role AS created_by_role,
              p.first_name AS patientFirstName, p.last_name AS patientLastName, p.mrn AS patientMRN, p.dob AS patientDOB,
              COALESCE(mt.total_minutes, 0) AS minutes
        FROM contact_attempts ca
        JOIN patients p ON ca.patient_id = p.id
        LEFT JOIN minute_tracking mt ON DATE(ca.attempt_date) = DATE(mt.tracking_date)
        LEFT JOIN users u ON mt.user_id = u.id
        WHERE ca.patient_id = ? AND DATE(ca.attempt_date) = ?`,
      [patientId, normalizedDate]
    );

    if (!attempt.length) {
      return res.status(404).json({ error: 'Contact attempt not found', details: { patientId, normalizedDate } });
    }

    const data = attempt[0];
    console.log('Contact Attempt Data:', data);

    const minutes = Number.isNaN(Number(data.minutes)) ? 0 : Number(data.minutes);
    console.log('Validated Minutes:', minutes);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Contact_Attempt_${normalizedDate}.pdf`);
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    const primaryColor = '#2C3E50';
    const accentColor = '#3498DB';

    doc.rect(0, 0, 612, 80).fill(primaryColor);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text('Contact Attempt Report', 40, 30, { align: 'left' });
    doc.fontSize(10).text(`Generated on ${format(new Date(), 'MMMM d, yyyy')}`, { align: 'right' });

    const startY = 120;
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
      .text('Patient Information', 40, startY, { underline: true });
    doc.fillColor('black').fontSize(12).font('Helvetica')
      .text(`Name: ${data.patientFirstName} ${data.patientLastName}`, 40, startY + 25)
      .text(`MRN: ${data.patientMRN || 'N/A'}`, 40, startY + 45)
      .text(`Date of Birth: ${data.patientDOB ? format(new Date(data.patientDOB), 'MMMM d, yyyy') : 'N/A'}`, 40, startY + 65);

    const contactByY = startY + 95;
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
      .text('Contacted By', 40, contactByY, { underline: true });
    doc.fillColor('black').fontSize(12).font('Helvetica')
      .text(`Name: ${data.created_by_name || 'Unknown'}`, 40, contactByY + 25)
      .text(`Role: ${data.created_by_role || 'N/A'}`, 40, contactByY + 45)
      .text(`Email: ${data.created_by_email || 'N/A'}`, 40, contactByY + 65)
      .text(`Phone: ${data.created_by_phone || 'N/A'}`, 40, contactByY + 85);

    const detailsY = contactByY + 115;
    doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
      .text('Contact Attempt Details', 40, detailsY, { underline: true });
    doc.fillColor('black').fontSize(12).font('Helvetica')
      .text(`Attempt Date: ${format(data.attempt_date, 'MMMM d, yyyy')}`, 40, detailsY + 25)
      .text(`Duration: ${minutes} minutes`, 40, detailsY + 45);

    const notes = data.notes || 'No notes provided';
    doc.text(notes, 40, detailsY + 65, { width: 500, align: 'left' });

    const pageHeight = 842;
    const footerY = 780;
    doc.moveTo(40, footerY).lineTo(572, footerY).stroke(accentColor);
    doc.fillColor(primaryColor).fontSize(8).font('Helvetica')
      .text('Confidential - Contact Attempt Document | Page 1 of 1', 40, footerY + 10, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error exporting contact attempt PDF:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;