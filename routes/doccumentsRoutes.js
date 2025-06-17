const express = require('express');
const db = require('../lib/db');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { format, parseISO } = require('date-fns');
const PDFDocument = require('pdfkit-table');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Helper function to safely parse JSON with fallback to empty object
const safeParseJSON = (jsonString) => {
  // If it's already an object, return it directly
  if (typeof jsonString === 'object' && jsonString !== null) {
    return jsonString;
  }
  
  try {
    return jsonString ? JSON.parse(jsonString) : {};
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return {};
  }
};

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

// Generate Master Treatment History Document
router.get('/patients/:patientId/master-document', async (req, res) => {
  const { patientId } = req.params;
  try {
    console.log('Generating master document for patient ID:', patientId);
    
    // Fetch patient information
    const [patientInfo] = await db.query(
      `SELECT p.id, p.first_name, p.last_name, p.mrn, p.dob, p.enrollment_date, 
              c.name AS clinic_name, c.phone_number AS clinic_phone, c.address AS clinic_address, c.email AS clinic_email,
              p.status
       FROM patients p
       LEFT JOIN clinics c ON p.clinic_id = c.id
       WHERE p.id = ?`,
      [patientId]
    );
    
    if (!patientInfo.length) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    const patient = patientInfo[0];
    
    // Fetch patient flags (current active flags only)
    const [flagsHistory] = await db.query(
      `SELECT pf.flag
       FROM patient_flags pf
       WHERE pf.patient_id = ?`,
      [patientId]
    );
    
    // Fetch care manager information
    const [careManagers] = await db.query(
      `SELECT u.name, u.email, u.phone_number, u.role
       FROM user_patients up
       JOIN users u ON up.user_id = u.id
       WHERE up.patient_id = ? AND up.provider_type = 'BHCM'`,
      [patientId]
    );
    
    // Fetch all document types with detailed data
    
    // 1. Fetch assessments with full details
    const [assessments] = await db.query(
      `SELECT a.id, a.type, a.date, a.score, a.answers_json, 
              u.name AS created_by, u.email AS created_by_email, u.phone_number AS created_by_phone,
              c.contact_type, c.interaction_mode AS sessionType, c.duration_minutes AS sessionDuration
       FROM assessments a
       JOIN contacts c ON a.patient_id = c.patient_id AND DATE(a.date) = DATE(c.contact_date)
       JOIN users u ON c.created_by = u.id
       WHERE a.patient_id = ?
       ORDER BY a.date ASC`,
      [patientId]
    );
    
    // 2. Fetch contact attempts with full details
    const [contactAttempts] = await db.query(
      `SELECT ca.id, ca.attempt_date, ca.description, u.name AS created_by_name, u.email AS created_by_email, u.phone_number AS created_by_phone, u.role AS created_by_role,
              COALESCE(mt.total_minutes, 0) AS minutes
       FROM contact_attempts ca
       LEFT JOIN minute_tracking mt ON ca.patient_id = ? AND DATE(ca.attempt_date) = DATE(mt.tracking_date)
       LEFT JOIN users u ON mt.user_id = u.id
       WHERE ca.patient_id = ?
       ORDER BY ca.attempt_date ASC`,
      [patientId, patientId]
    );
    
    // 3. Fetch intake forms with full details
    const [intakeForms] = await db.query(
      `SELECT pi.id, pi.contact_date, pi.symptoms_json AS symptoms, pi.columbia_suicide_severity AS columbiaSuicideSeverity, 
              pi.anxiety_panic_attacks AS anxietyPanicAttacks, pi.past_mental_health_json AS pastMentalHealth, pi.psychiatric_hospitalizations AS psychiatricHospitalizations,
              pi.substance_use_json AS substanceUse, pi.medical_history_json AS medicalHistory, pi.other_medical_history AS otherMedicalHistory,
              pi.family_mental_health_json AS familyMentalHealth, pi.social_situation_json AS socialSituation, pi.current_medications AS currentMedications,
              pi.past_medications AS pastMedications, pi.narrative, pi.minutes,
              u.name AS created_by_name, u.email AS created_by_email, u.phone_number AS created_by_phone, u.role AS created_by_role
       FROM patient_intake pi
       JOIN users u ON pi.created_by = u.id
       WHERE pi.patient_id = ?
       ORDER BY pi.contact_date ASC`,
      [patientId]
    );
    
    // 4. Fetch safety plan history with full details
    const [safetyPlans] = await db.query(
      `SELECT sph.id, sph.action, sph.action_date, sph.minutes_spent, sph.notes,
              u.name AS resolved_by_name
       FROM safety_plan_history sph
       LEFT JOIN users u ON sph.resolved_by = u.id
       WHERE sph.patient_id = ?
       ORDER BY sph.action_date ASC`,
      [patientId]
    );

    // Combine all documents and sort by date
    const allDocuments = [
      ...assessments.map(a => ({
        type: 'assessment',
        subType: a.type,
        date: a.date,
        data: a
      })),
      ...contactAttempts.map(ca => ({
        type: 'contactAttempt',
        subType: 'Contact Attempt',
        date: ca.attempt_date,
        data: ca
      })),
      ...intakeForms.map(intake => ({
        type: 'intake',
        subType: 'Patient Intake',
        date: intake.contact_date,
        data: intake
      })),
      ...safetyPlans.map(sp => ({
        type: 'safetyPlan',
        subType: sp.action === 'created' ? 'Safety Plan Created' : 'Safety Plan Resolved',
        date: sp.action_date,
        data: sp
      }))]
    ;
    
    // Sort all documents chronologically
    allDocuments.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Create the PDF document
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Patient_Master_Document_${patientId}.pdf`);
    
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    doc.pipe(res);
    
    // Define styles
    const primaryColor = '#2C3E50';
    const accentColor = '#3498DB';
    const lightGray = '#ECF0F1';
    
    // Helper functions for document generation
    let hasAddedContentToCurrentPage = false;
    
    const ensureSpace = (requiredSpace) => {
      // Only create a new page if we actually have content to add AND there's not enough space
      if (doc.y + requiredSpace > doc.page.height - 100 && hasAddedContentToCurrentPage) {
        doc.addPage();
        hasAddedContentToCurrentPage = false; // Reset for new page
        // Add header to new page
        doc.rect(0, 0, doc.page.width, 40).fill(primaryColor);
        doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
          .text('Chronological Treatment History', 50, 15);
        doc.y = 60; // Reset y position after header
        return true;
      }
      return false;
    };
    
    const markContentAdded = () => {
      hasAddedContentToCurrentPage = true;
    };
    
    // Add cover page
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(primaryColor);
    doc.fillColor('white').fontSize(28).font('Helvetica-Bold')
      .text('Master Treatment History Document', 50, 180, { align: 'center', width: doc.page.width - 100 });
    
    doc.y = 250;
    doc.fontSize(18).font('Helvetica')
      .text(`Patient: ${patient.first_name} ${patient.last_name}`, 50, doc.y, { align: 'center', width: doc.page.width - 100 });
    
    doc.y = 290;
    doc.fontSize(14)
      .text(`MRN: ${patient.mrn || 'N/A'}`, 50, doc.y, { align: 'center', width: doc.page.width - 100 });
    
    doc.y = 320;
    doc.fontSize(14)
      .text(`Generated on ${format(new Date(), 'MMMM d, yyyy')}`, 50, doc.y, { align: 'center', width: doc.page.width - 100 });
    
    // Add clinic info at bottom
    doc.y = 400;
    if (patient.clinic_name) {
      doc.fontSize(16).font('Helvetica-Bold')
        .text(patient.clinic_name, 50, doc.y, { align: 'center', width: doc.page.width - 100 });
    }
    
    doc.addPage();
    hasAddedContentToCurrentPage = false; // Reset for new page
    
    // Add patient and contact information page with beautiful design
    doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
      .text('Patient Information Summary', 50, 30);
    
    doc.y = 120;
    markContentAdded(); // Mark header as content
    
    // Patient info in a beautiful table
    const patientData = [
      ['Name', `${patient.first_name} ${patient.last_name}`],
      ['MRN', patient.mrn || 'N/A'],
      ['Date of Birth', patient.dob ? format(new Date(patient.dob), 'MMMM d, yyyy') : 'N/A'],
      ['Enrollment Date', patient.enrollment_date ? format(new Date(patient.enrollment_date), 'MMMM d, yyyy') : 'N/A'],
      ['Current Status', patient.status || 'N/A'],
      ['Clinic', patient.clinic_name || 'N/A']
    ];
    
    doc.y = createBeautifulTable(doc, ['Detail', 'Information'], patientData, doc.y, primaryColor, lightGray) + 20;
    
    // Care manager info in compact format
    if (careManagers && careManagers.length > 0) {
      const careManagerData = careManagers.map(cm => [
        cm.name || 'Unknown',
        cm.role || 'N/A',
        cm.email || 'N/A'
      ]);
      
      ensureSpace(careManagerData.length * 25 + 50);
      doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
        .text('Care Team', 50, doc.y);
      doc.y += 10;
      
      doc.y = createBeautifulTable(doc, ['Name', 'Role', 'Email'], careManagerData, doc.y, accentColor, lightGray) + 20;
    }
    
    // Flags in compact format
    if (flagsHistory.length > 0) {
      ensureSpace(60);
      doc.fillColor('#E74C3C').fontSize(12).font('Helvetica-Bold')
        .text('Patient Flags: ', 50, doc.y, { continued: true });
      doc.fillColor('black').fontSize(12).font('Helvetica')
        .text(flagsHistory.map(f => f.flag).join(', '));
      doc.y += 30;
    }
    
    // Summary section (replacing table of contents)
    if (allDocuments.length > 0) {
      const documentCounts = {
        'Assessment': 0,
        'Contact Attempt': 0,
        'Patient Intake': 0,
        'Safety Plan': 0
      };
      
      allDocuments.forEach(doc_item => {
        if (hasValidContent(doc_item)) {
          if (doc_item.type === 'assessment') documentCounts['Assessment']++;
          else if (doc_item.type === 'contactAttempt') documentCounts['Contact Attempt']++;
          else if (doc_item.type === 'intake') documentCounts['Patient Intake']++;
          else if (doc_item.type === 'safetyPlan') documentCounts['Safety Plan']++;
        }
      });
      
      // Add summary to patient info page
      ensureSpace(100);
      doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
        .text('Document Summary', 50, doc.y);
      doc.y += 20;
      
      const summaryData = Object.entries(documentCounts)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => [type, `${count} document${count > 1 ? 's' : ''}`]);
      
      if (summaryData.length > 0) {
        doc.y = createBeautifulTable(doc, ['Document Type', 'Count'], summaryData, doc.y, accentColor, lightGray) + 20;
        
        const validDocuments = allDocuments.filter(doc => doc.date && hasValidContent(doc));
        const dateRange = validDocuments.length > 0 ? 
          `${format(new Date(validDocuments[0].date), 'MMM d, yyyy')} - ${format(new Date(validDocuments[validDocuments.length - 1].date), 'MMM d, yyyy')}` :
          'No dates available';
        doc.fillColor('#7F8C8D').fontSize(11).font('Helvetica')
          .text(`Date Range: ${dateRange}`, 50, doc.y);
        doc.y += 30;
      }
    }
    
    // Add chronological treatment history in a single continuous document
    if (allDocuments.length > 0) {
        doc.addPage();
        hasAddedContentToCurrentPage = false; // Reset for new page
        
      // Add header
        doc.rect(0, 0, doc.page.width, 40).fill(primaryColor);
      doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
        .text('Chronological Treatment History', 50, 15);
        doc.y = 60;
        markContentAdded(); // Mark header as content
      
      // Process each document
      allDocuments.forEach((doc_item, index) => {
        // Check if document has meaningful content
        if (!hasValidContent(doc_item)) {
          return; // Skip empty documents
        }
        
        // Mark that we're about to add content
        markContentAdded();
        
        // Ensure adequate space for new section
        ensureSpace(120);
        
        // Ensure date is properly parsed and formatted
        const itemDate = doc_item.date ? format(new Date(doc_item.date), 'MMMM d, yyyy') : 'Date not available';
        
        // Document section header with divider
        if (index > 0) {
          doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#CCCCCC');
          doc.y += 15;
        }
        
        // Create prominent section header with assessment type info
        ensureSpace(80);
        const headerStartY = doc.y;
        doc.rect(50, headerStartY, 500, 50).fill('#34495E'); // Made taller to fit date
        doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
          .text(`${doc_item.subType}`, 60, headerStartY + 8);
        doc.fontSize(12).font('Helvetica')
          .text(`Date: ${itemDate}`, 60, headerStartY + 28);
        
        // Add assessment type for assessments
        if (doc_item.type === 'assessment' && doc_item.data.type) {
          doc.fontSize(12).font('Helvetica-Bold')
            .text(`Type: ${doc_item.data.type}`, 350, headerStartY + 8);
        }
        
        doc.y = headerStartY + 60; // Move past the header
        
        // Add document content based on type
        switch (doc_item.type) {
          case 'assessment':
            renderAssessmentContentConcise(doc, doc_item.data, patient, itemDate, primaryColor, accentColor, lightGray, ensureSpace, markContentAdded);
            break;
            
          case 'contactAttempt':
            renderContactAttemptContentConcise(doc, doc_item.data, patient, itemDate, primaryColor, accentColor, lightGray, ensureSpace, markContentAdded);
            break;
            
          case 'intake':
            renderIntakeFormContentConcise(doc, doc_item.data, patient, itemDate, primaryColor, accentColor, lightGray, ensureSpace, markContentAdded);
            break;
            
          case 'safetyPlan':
            renderSafetyPlanContentConcise(doc, doc_item.data, patient, itemDate, primaryColor, accentColor, lightGray, ensureSpace, markContentAdded);
            break;
        }
        
        doc.y += 20; // Space between sections
      });
    } else {
      // No documents found
      doc.addPage();
      doc.rect(0, 0, doc.page.width, 40).fill(primaryColor);
      doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
        .text('Treatment History', 50, 15);
      doc.y = 80;
      
      doc.fillColor('black').fontSize(14).font('Helvetica')
        .text('No treatment history documents found for this patient.', 50, doc.y);
    }
    
    // Finalize document and add footers only to pages with meaningful content
    // First, let's make sure we're on the last page that has content
    const currentPageY = doc.y;
    const currentPageIndex = doc._pageIndex;
    
    // Get page range after content is done
    const pageRange = doc.bufferedPageRange();
    let actualPageCount = 0;
    
    // Count pages with content - only count up to the current page with content
    for (let i = 0; i <= currentPageIndex; i++) {
      actualPageCount++;
    }
    
    // Add footers only to pages up to the current content page
    for (let i = 0; i < actualPageCount; i++) {
      const pageIndex = pageRange.start + i;
      doc.switchToPage(pageIndex);
      
      // Skip footer on cover page (first page)
      if (i === 0) continue;
      
      // Draw footer line
      const footerY = doc.page.height - 50;
      doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY).stroke(accentColor);
      
      // Add page number and confidentiality statement
      doc.fillColor(primaryColor).fontSize(8).font('Helvetica')
        .text(`Confidential - Master Treatment Document | Page ${i + 1} of ${actualPageCount}`, 
              50, footerY + 10, { align: 'center', width: doc.page.width - 100 });
    }
    
    doc.end();
  } catch (error) {
    console.error('Error generating master document:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Helper function to check if document has valid content
function hasValidContent(doc_item) {
  if (!doc_item || !doc_item.data) return false;
  
  switch (doc_item.type) {
    case 'assessment':
      return doc_item.data.type && doc_item.data.score !== null && doc_item.data.score !== undefined;
    case 'contactAttempt':
      return doc_item.data.attempt_date || doc_item.data.description;
    case 'intake':
      return doc_item.data.contact_date || doc_item.data.narrative || doc_item.data.symptoms;
    case 'safetyPlan':
      return doc_item.data.action_date || doc_item.data.action;
    default:
      return false;
  }
}

// Helper function to create a beautiful table
function createBeautifulTable(doc, headers, rows, startY, primaryColor, lightGray) {
  const tableWidth = 500;
  const baseRowHeight = 25;
  const colWidth = tableWidth / headers.length;
  
  // Header with shadow effect
  doc.rect(52, startY + 2, tableWidth, baseRowHeight).fill('#95A5A6'); // Shadow
  doc.rect(50, startY, tableWidth, baseRowHeight).fill(primaryColor);
  doc.fillColor('white').fontSize(11).font('Helvetica-Bold');
  
  headers.forEach((header, i) => {
    doc.text(header, 60 + (i * colWidth), startY + 7, {
      width: colWidth - 20,
      align: 'left'
    });
  });
  
  let currentY = startY + baseRowHeight;
  
  // Data rows with better text handling
  rows.forEach((row, rowIndex) => {
    // Calculate row height based on content
    const maxLines = Math.max(...row.map(cell => {
      const cellText = String(cell || '');
      return Math.ceil(cellText.length / 50); // Rough estimate
    }));
    const rowHeight = Math.max(baseRowHeight, maxLines * 15 + 10);
    
    // Alternate row colors with subtle styling
    if (rowIndex % 2 === 0) {
      doc.rect(50, currentY, tableWidth, rowHeight).fill(lightGray);
    } else {
      doc.rect(50, currentY, tableWidth, rowHeight).fill('white');
    }
    
    // Add subtle border
    doc.rect(50, currentY, tableWidth, rowHeight).stroke('#BDC3C7');
    
    doc.fillColor('#2C3E50').fontSize(10).font('Helvetica');
    row.forEach((cell, colIndex) => {
      const cellText = String(cell || '');
      doc.text(cellText, 60 + (colIndex * colWidth), currentY + 8, {
        width: colWidth - 20,
        height: rowHeight - 16,
        align: 'left',
        ellipsis: true
      });
    });
    
    currentY += rowHeight;
  });
  
  return currentY;
}

// Helper functions for rendering each document type

// Function to render Assessment content (PHQ-9 or GAD-7) - Concise version
function renderAssessmentContentConcise(doc, assessmentData, patient, itemDate, primaryColor, accentColor, lightGray, ensureSpace, markContentAdded) {
  markContentAdded();
  ensureSpace(200);
  
  // Assessment details header (smaller, since main header is already shown)
  const headerY = doc.y;
  doc.rect(50, headerY, 500, 20).fill(accentColor);
  doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
    .text(`${assessmentData.type} Assessment Details`, 60, headerY + 5);
  doc.y = headerY + 25;
  
  // Create summary table
  const score = parseInt(assessmentData.score) || 0;
  let interpretation = 'Unknown';
  let interpretationColor = '#95A5A6';
  
  if (assessmentData.type === 'PHQ-9') {
    if (score <= 4) { interpretation = 'Minimal depression'; interpretationColor = '#27AE60'; }
    else if (score <= 9) { interpretation = 'Mild depression'; interpretationColor = '#F39C12'; }
    else if (score <= 14) { interpretation = 'Moderate depression'; interpretationColor = '#E67E22'; }
    else if (score <= 19) { interpretation = 'Moderately severe depression'; interpretationColor = '#E74C3C'; }
    else { interpretation = 'Severe depression'; interpretationColor = '#8E44AD'; }
  } else if (assessmentData.type === 'GAD-7') {
    if (score <= 4) { interpretation = 'Minimal anxiety'; interpretationColor = '#27AE60'; }
    else if (score <= 9) { interpretation = 'Mild anxiety'; interpretationColor = '#F39C12'; }
    else if (score <= 14) { interpretation = 'Moderate anxiety'; interpretationColor = '#E67E22'; }
    else { interpretation = 'Severe anxiety'; interpretationColor = '#E74C3C'; }
  }
  
  const summaryData = [
    ['Assessment Type', assessmentData.type || 'N/A'],
    ['Score', assessmentData.score || 'N/A'],
    ['Interpretation', interpretation],
    ['Conducted by', assessmentData.created_by || 'Unknown'],
    ['Contact Type', assessmentData.contact_type || 'Unknown'],
    ['Session Type', assessmentData.sessionType || 'Unknown'],
    ['Duration', `${assessmentData.sessionDuration || 0} minutes`]
  ];
  
  doc.y = createBeautifulTable(doc, ['Detail', 'Value'], summaryData, doc.y, primaryColor, lightGray) + 15;
  
  // Add detailed answers table
  const questions = {
    'PHQ-9': [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
      "Trouble falling or staying asleep, or sleeping too much",
      "Feeling tired or having little energy",
      "Poor appetite or overeating",
      "Feeling bad about yourself — or that you are a failure",
      "Trouble concentrating on things",
      "Moving or speaking slowly OR being restless/fidgety",
      "Thoughts that you would be better off dead"
    ],
    'GAD-7': [
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

  if (assessmentData.type === 'PHQ-9' || assessmentData.type === 'GAD-7') {
    const answers = assessmentData.answers_json ? safeParseJSON(assessmentData.answers_json) : [];
    const questionsList = questions[assessmentData.type];
    
        if (questionsList && answers.length > 0) {
      markContentAdded();
      ensureSpace(questionsList.length * 25 + 50);
      
      // Answers header
      doc.rect(50, doc.y, 500, 20).fill('#F8F9FA');
      doc.fillColor('#34495E').fontSize(11).font('Helvetica-Bold')
        .text('Question Responses', 60, doc.y + 6);
  doc.y += 25;
      
      // Create answers table
      const answersData = questionsList.map((question, index) => {
        const answerIndex = answers[index] || 0;
        const answerText = options[answerIndex] || 'Not answered';
        return [
          question.length > 50 ? question.substring(0, 47) + '...' : question,
          answerText
        ];
      });
      
      doc.y = createBeautifulTable(doc, ['Question', 'Response'], answersData, doc.y, accentColor, lightGray) + 15;
    }
  }
}

// Function to render Contact Attempt content - Concise version
function renderContactAttemptContentConcise(doc, contactData, patient, itemDate, primaryColor, accentColor, lightGray, ensureSpace, markContentAdded) {
  markContentAdded();
  ensureSpace(120);
  
  // Create header with colored background
  const headerY = doc.y;
  doc.rect(50, headerY, 500, 25).fill('#E67E22');
  doc.fillColor('white').fontSize(12).font('Helvetica-Bold')
    .text('Contact Attempt', 60, headerY + 7);
  doc.y = headerY + 35;
  
  const minutes = Number.isNaN(Number(contactData.minutes)) ? 0 : Number(contactData.minutes);
  
  // Create summary table
  const summaryData = [
    ['Duration', `${minutes} minutes`],
    ['Contacted by', contactData.created_by_name || 'Unknown'],
    ['Role', contactData.created_by_role || 'N/A'],
    ['Contact Type', 'Contact Attempt']
  ];
  
  doc.y = createBeautifulTable(doc, ['Detail', 'Value'], summaryData, doc.y, primaryColor, lightGray) + 10;
  
  // Notes section with better formatting
  if (contactData.description && contactData.description.trim()) {
    markContentAdded();
    ensureSpace(60);
    
    // Notes header
    doc.rect(50, doc.y, 500, 20).fill('#F8F9FA');
    doc.fillColor('#34495E').fontSize(11).font('Helvetica-Bold')
      .text('Notes', 60, doc.y + 6);
    doc.y += 25;
    
    // Notes content with border
    const notesHeight = Math.max(30, Math.ceil(contactData.description.length / 80) * 12 + 10);
    doc.rect(50, doc.y, 500, notesHeight).stroke('#BDC3C7');
    doc.fillColor('#2C3E50').fontSize(10).font('Helvetica')
      .text(contactData.description, 60, doc.y + 8, { width: 480, height: notesHeight - 16 });
    doc.y += notesHeight + 10;
  }
}

// Function to render Intake Form content - Concise version
function renderIntakeFormContentConcise(doc, intakeData, patient, itemDate, primaryColor, accentColor, lightGray, ensureSpace, markContentAdded) {
  markContentAdded();
  ensureSpace(150);
  
  // Create header with colored background
  const headerY = doc.y;
  doc.rect(50, headerY, 500, 25).fill('#8E44AD');
  doc.fillColor('white').fontSize(12).font('Helvetica-Bold')
    .text('Patient Intake Assessment', 60, headerY + 7);
  doc.y = headerY + 35;
  
  // Create summary table
  const summaryData = [
    ['Duration', `${intakeData.minutes || 'N/A'} minutes`],
    ['Created by', intakeData.created_by_name || 'Unknown'],
    ['Intake Completed', intakeData.safetyPlanDiscussed ? 'Yes' : 'No'],
    ['Columbia Suicide Severity', intakeData.columbiaSuicideSeverity || 'N/A'],
    ['Anxiety/Panic Attacks', intakeData.anxietyPanicAttacks || 'N/A'],
    ['Psychiatric Hospitalizations', intakeData.psychiatricHospitalizations || 'N/A']
  ];
  
  doc.y = createBeautifulTable(doc, ['Detail', 'Value'], summaryData, doc.y, primaryColor, lightGray) + 15;
  
  // Helper function to format field names into readable text
  const formatFieldName = (fieldName) => {
    return fieldName
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  };
  
  // Parse and display key sections compactly
  const symptoms = safeParseJSON(intakeData.symptoms);
  const pastMentalHealth = safeParseJSON(intakeData.pastMentalHealth);
  const substanceUse = safeParseJSON(intakeData.substanceUse);
  const medicalHistory = safeParseJSON(intakeData.medicalHistory);
  const familyMentalHealth = safeParseJSON(intakeData.familyMentalHealth);
  const socialSituation = safeParseJSON(intakeData.socialSituation);
  
  // Key findings section with better categorization
  const keyFindings = [];
  
  // Current Symptoms
  if (symptoms && Object.keys(symptoms).length > 0) {
    const activeSymptoms = Object.entries(symptoms)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => formatFieldName(key));
    if (activeSymptoms.length > 0) {
      keyFindings.push(['Current Symptoms', activeSymptoms.join(', ')]);
    }
  }
  
  // Past Mental Health
  if (pastMentalHealth && Object.keys(pastMentalHealth).length > 0) {
    const mentalHealthHistory = Object.entries(pastMentalHealth)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => formatFieldName(key));
    if (mentalHealthHistory.length > 0) {
      keyFindings.push(['Past Mental Health', mentalHealthHistory.join(', ')]);
    }
  }
  
  // Substance Use (with current/past status like in dashboard)
  if (substanceUse && Object.keys(substanceUse).length > 0) {
    const substanceEntries = Object.entries(substanceUse)
      .map(([key, value]) => {
        const formattedKey = formatFieldName(key);
        if (typeof value === 'object' && value !== null) {
          const statuses = [];
          if (value.current) statuses.push('Current');
          if (value.past) statuses.push('Past');
          if (statuses.length > 0) {
            return `${formattedKey}: ${statuses.join(', ')}`;
          }
        }
        return null;
      })
      .filter(entry => entry !== null);
    if (substanceEntries.length > 0) {
      keyFindings.push(['Substance Use', substanceEntries.join('; ')]);
    }
  }
  
  // Medical History
  if (medicalHistory && Object.keys(medicalHistory).length > 0) {
    const medicalConditions = Object.entries(medicalHistory)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => formatFieldName(key));
    if (medicalConditions.length > 0) {
      keyFindings.push(['Medical History', medicalConditions.join(', ')]);
    }
  }
  
  // Family Mental Health
  if (familyMentalHealth && Object.keys(familyMentalHealth).length > 0) {
    const familyHistory = Object.entries(familyMentalHealth)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => formatFieldName(key));
    if (familyHistory.length > 0) {
      keyFindings.push(['Family Mental Health', familyHistory.join(', ')]);
    }
  }
  
  // Social Situation
  if (socialSituation && Object.keys(socialSituation).length > 0) {
    const socialEntries = Object.entries(socialSituation)
      .map(([key, value]) => `${formatFieldName(key)}: ${value}`)
      .filter(entry => !entry.endsWith(': ') && !entry.endsWith(': undefined'));
    if (socialEntries.length > 0) {
      keyFindings.push(['Social Situation', socialEntries.join(', ')]);
    }
  }
  
  // Additional Information
  const additionalInfo = [];
  if (intakeData.otherMedicalHistory && intakeData.otherMedicalHistory.trim()) {
    additionalInfo.push(['Other Medical History', intakeData.otherMedicalHistory]);
  }
  if (intakeData.currentMedications && intakeData.currentMedications.trim()) {
    additionalInfo.push(['Current Medications', intakeData.currentMedications]);
  }
  if (intakeData.pastMedications && intakeData.pastMedications.trim()) {
    additionalInfo.push(['Past Medications', intakeData.pastMedications]);
  }
  
  // Combine key findings and additional info
  const allFindings = [...keyFindings, ...additionalInfo];
  
  if (allFindings.length > 0) {
    markContentAdded();
    ensureSpace(allFindings.length * 30 + 40);
    doc.y = createBeautifulTable(doc, ['Category', 'Details'], allFindings, doc.y, '#8E44AD', lightGray) + 15;
  }
  
  // Narrative section (shortened and better formatted)
  if (intakeData.narrative && intakeData.narrative.trim()) {
    markContentAdded();
    ensureSpace(80);
    
    // Narrative header
    doc.rect(50, doc.y, 500, 20).fill('#F8F9FA');
    doc.fillColor('#34495E').fontSize(11).font('Helvetica-Bold')
      .text('Clinical Narrative', 60, doc.y + 6);
  doc.y += 25;
  
    // Truncate narrative if too long
    const narrative = intakeData.narrative.length > 500 ? 
      intakeData.narrative.substring(0, 500) + '...' : 
      intakeData.narrative;
    
    // Narrative content with border
    const narrativeHeight = Math.max(40, Math.ceil(narrative.length / 80) * 12 + 16);
    doc.rect(50, doc.y, 500, narrativeHeight).stroke('#BDC3C7');
    doc.fillColor('#2C3E50').fontSize(10).font('Helvetica')
      .text(narrative, 60, doc.y + 8, { width: 480, height: narrativeHeight - 16 });
    doc.y += narrativeHeight + 10;
  }
}

// Function to render Intake Form content - Original verbose version (keeping for individual exports)
function renderIntakeFormContent(doc, intakeData, patient, itemDate, primaryColor, accentColor) {
  // Function to format JSON data into readable sections
  const formatSection = (data, title) => {
    // Skip empty sections entirely to avoid unnecessary space
    if (!data || 
        (typeof data === 'object' && Object.keys(data).length === 0) ||
        (typeof data === 'string' && !data.trim())) {
      return;
    }
    
    // Check if we need to add a new page
    if (doc.y + 100 > doc.page.height - 70) {
      doc.addPage();
      // Add header to new page
      doc.rect(0, 0, doc.page.width, 40).fill(primaryColor);
      doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
        .text('Master Treatment History Document', 50, 15);
      doc.y = 60;
    }
    
    doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
      .text(title, 50, doc.y, { underline: true });
    doc.y += 20;
    
    if (typeof data === 'string') {
      doc.fillColor('black').fontSize(12).font('Helvetica')
        .text(data || 'N/A', 50, doc.y, { width: 500 });
      const lines = Math.ceil(data.length / 80) + 1;
      doc.y += Math.max(20, lines * 15);
      return;
    }
    
    // Format object data
    const items = [];
    Object.entries(data).forEach(([key, value]) => {
      let label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      
      if (typeof value === 'boolean') {
        items.push(`${label}: ${value ? 'Yes' : 'No'}`);
      } 
      else if (value === null || value === undefined) {
        items.push(`${label}: No`);
      }
      else if (typeof value === 'object') {
        if (value.current !== undefined || value.past !== undefined) {
          const statuses = [];
          if (value.current) statuses.push('Current');
          if (value.past) statuses.push('Past');
          items.push(`${label}: ${statuses.length ? statuses.join(', ') : 'None'}`);
        } else {
          items.push(`${label}: ${JSON.stringify(value)}`);
        }
      } 
      else {
        items.push(`${label}: ${value || 'No'}`);
      }
    });
    
    // Skip if no items after processing
    if (items.length === 0) {
      return;
    }
    
    // Display items in a more readable format - two columns if possible
    if (items.length <= 6) {
      // Single column for few items
      items.forEach(item => {
        doc.fillColor('black').fontSize(12).font('Helvetica')
          .text(item, 50, doc.y);
        doc.y += 20;
      });
    } else {
      // Two columns for many items
      const leftItems = items.slice(0, Math.ceil(items.length / 2));
      const rightItems = items.slice(Math.ceil(items.length / 2));
      const startY = doc.y;
      let maxY = startY;
      
      // Left column
      doc.y = startY;
      leftItems.forEach(item => {
        doc.fillColor('black').fontSize(12).font('Helvetica')
          .text(item, 50, doc.y, { width: 240 });
        doc.y += 20;
      });
      maxY = Math.max(maxY, doc.y);
      
      // Right column
      doc.y = startY;
      rightItems.forEach(item => {
        doc.fillColor('black').fontSize(12).font('Helvetica')
          .text(item, 300, doc.y, { width: 240 });
        doc.y += 20;
      });
      maxY = Math.max(maxY, doc.y);
      
      doc.y = maxY;
    }
  };
  
  // Parse all JSON fields
  const symptoms = safeParseJSON(intakeData.symptoms);
  const pastMentalHealth = safeParseJSON(intakeData.pastMentalHealth);
  const substanceUse = safeParseJSON(intakeData.substanceUse);
  const medicalHistory = safeParseJSON(intakeData.medicalHistory);
  const familyMentalHealth = safeParseJSON(intakeData.familyMentalHealth);
  const socialSituation = safeParseJSON(intakeData.socialSituation);
  
  // Header info
  doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
    .text('Patient Information', 50, doc.y, { underline: true });
  doc.y += 25;
  
  doc.fillColor('black').fontSize(12).font('Helvetica')
    .text(`Name: ${patient.first_name} ${patient.last_name}`, 50, doc.y);
  doc.y += 20;
  
  doc.text(`MRN: ${patient.mrn || 'N/A'}`, 50, doc.y);
  doc.y += 20;
  
  doc.text(`Date of Birth: ${patient.dob ? format(new Date(patient.dob), 'MMMM d, yyyy') : 'N/A'}`, 50, doc.y);
  doc.y += 30;
  
  doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
    .text('Intake Form Details', 50, doc.y, { underline: true });
  doc.y += 25;
  
  doc.fillColor('black').fontSize(12).font('Helvetica')
    .text(`Contact Date: ${itemDate}`, 50, doc.y);
  doc.y += 20;
  
  doc.text(`Minutes: ${intakeData.minutes || 'N/A'}`, 50, doc.y);
  doc.y += 20;
  
  doc.text(`Created By: ${intakeData.created_by_name || 'Unknown'}`, 50, doc.y);
  doc.y += 30;
  
  // Format and display each section
  formatSection(symptoms, 'Symptoms');
  formatSection(pastMentalHealth, 'Past Mental Health');
  formatSection(intakeData.columbiaSuicideSeverity, 'Columbia Suicide Severity');
  formatSection(intakeData.anxietyPanicAttacks, 'Anxiety/Panic Attacks');
  formatSection(intakeData.psychiatricHospitalizations, 'Psychiatric Hospitalizations');
  formatSection(substanceUse, 'Substance Use');
  formatSection(medicalHistory, 'Medical History');
  formatSection(intakeData.otherMedicalHistory, 'Other Medical History');
  formatSection(familyMentalHealth, 'Family Mental Health');
  formatSection(socialSituation, 'Social Situation');
  formatSection(intakeData.currentMedications, 'Current Medications');
  formatSection(intakeData.pastMedications, 'Past Medications');
  
  if (intakeData.narrative) {
    if (doc.y + Math.min(100, 40 + (intakeData.narrative.length / 100) * 15) > doc.page.height - 70) {
      doc.addPage();
      // Add header to new page
      doc.rect(0, 0, doc.page.width, 40).fill(primaryColor);
      doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
        .text('Master Treatment History Document', 50, 15);
      doc.y = 60;
    }
    
    doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
      .text('Narrative', 50, doc.y, { underline: true });
    doc.y += 20;
    
    doc.fillColor('black').fontSize(12).font('Helvetica')
      .text(intakeData.narrative, 50, doc.y, { width: 500 });
    
    const narrativeLines = Math.ceil(intakeData.narrative.length / 80) + 1;
    doc.y += Math.max(30, narrativeLines * 15);
  }
}

// Function to render Safety Plan content - Concise version
function renderSafetyPlanContentConcise(doc, safetyPlanData, patient, itemDate, primaryColor, accentColor, lightGray, ensureSpace, markContentAdded) {
  markContentAdded();
  ensureSpace(100);
  
  // Create header with colored background
  const headerY = doc.y;
  const headerColor = safetyPlanData.action === 'created' ? '#E74C3C' : '#27AE60';
  doc.rect(50, headerY, 500, 25).fill(headerColor);
  doc.fillColor('white').fontSize(12).font('Helvetica-Bold')
    .text(`Safety Plan ${safetyPlanData.action === 'created' ? 'Created' : 'Resolved'}`, 60, headerY + 7);
  doc.y = headerY + 35;
  
  // Create summary table
  const summaryData = [
    ['Action', safetyPlanData.action === 'created' ? 'Created' : 'Resolved'],
    ['Time spent', `${safetyPlanData.minutes_spent || 0} minutes`],
    ['Staff member', safetyPlanData.resolved_by_name || 'N/A']
  ];
  
  doc.y = createBeautifulTable(doc, ['Detail', 'Value'], summaryData, doc.y, primaryColor, lightGray) + 10;
  
  // Notes section with better formatting
  if (safetyPlanData.notes && safetyPlanData.notes.trim()) {
    markContentAdded();
    ensureSpace(60);
    
    // Notes header
    doc.rect(50, doc.y, 500, 20).fill('#F8F9FA');
    doc.fillColor('#34495E').fontSize(11).font('Helvetica-Bold')
      .text('Safety Plan Details', 60, doc.y + 6);
    doc.y += 25;
    
    // Notes content with border
    const notesHeight = Math.max(30, Math.ceil(safetyPlanData.notes.length / 80) * 12 + 10);
    doc.rect(50, doc.y, 500, notesHeight).stroke('#BDC3C7');
    doc.fillColor('#2C3E50').fontSize(10).font('Helvetica')
      .text(safetyPlanData.notes, 60, doc.y + 8, { width: 480, height: notesHeight - 16 });
    doc.y += notesHeight + 10;
  }
}


// Function to render Safety Plan content - Original verbose version (keeping for individual exports)
function renderSafetyPlanContent(doc, safetyPlanData, patient, itemDate, primaryColor, accentColor) {
  // Patient information
  doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold')
    .text('Patient Information', 50, doc.y, { underline: true });
  doc.y += 25;
  
  doc.fillColor('black').fontSize(12).font('Helvetica')
    .text(`Name: ${patient.first_name} ${patient.last_name}`, 50, doc.y);
  doc.y += 20;
  
  doc.text(`MRN: ${patient.mrn || 'N/A'}`, 50, doc.y);
  doc.y += 20;
  
  doc.text(`Date of Birth: ${patient.dob ? format(new Date(patient.dob), 'MMMM d, yyyy') : 'N/A'}`, 50, doc.y);
  doc.y += 30;
  
  // Safety plan details
  doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
    .text('Safety Plan Details', 50, doc.y, { underline: true });
  doc.y += 25;
  
  doc.fillColor('black').fontSize(12).font('Helvetica')
    .text(`Action: ${safetyPlanData.action === 'created' ? 'Created' : 'Resolved'}`, 50, doc.y);
  doc.y += 20;
  
  doc.text(`Action Date: ${itemDate}`, 50, doc.y);
  doc.y += 20;
  
  doc.text(`Minutes Spent: ${safetyPlanData.minutes_spent || 0}`, 50, doc.y);
  doc.y += 20;
  
  if (safetyPlanData.action !== 'created' && safetyPlanData.resolved_by_name) {
    doc.text(`Resolved By: ${safetyPlanData.resolved_by_name || 'Unknown'}`, 50, doc.y);
    doc.y += 20;
  }
  
  // Check if we need a new page for notes
  if (doc.y + 100 > doc.page.height - 70) {
    doc.addPage();
    // Add header to new page
    doc.rect(0, 0, doc.page.width, 40).fill(primaryColor);
    doc.fillColor('white').fontSize(14).font('Helvetica-Bold')
      .text('Master Treatment History Document', 50, 15);
    doc.y = 60;
  }
  
  // Notes
  doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
    .text('Notes', 50, doc.y, { underline: true });
  doc.y += 25;
  
  const notes = safetyPlanData.notes || 'None';
  doc.fillColor('black').fontSize(12).font('Helvetica')
    .text(notes, 50, doc.y, { width: 500 });
  
  const spNotesLines = Math.ceil((safetyPlanData.notes?.length || 0) / 80) + 1;
  doc.y += Math.max(30, spNotesLines * 15);
}

module.exports = router;