const express = require('express');
const db = require('../lib/db');
const { body, validationResult } = require('express-validator');
const { format, parseISO } = require('date-fns');
const PDFDocument = require('pdfkit-table');

const router = express.Router();

// Helper function to format camelCase to Title Case
const formatLabel = (text) => {
  // Handle special abbreviations
  const specialAbbreviations = {
    'htn': 'HTN',
    'copdAsthma': 'COPD/Asthma',
  };
  
  if (specialAbbreviations[text]) {
    return specialAbbreviations[text];
  }
  
  // Normal camelCase to Title Case conversion
  return text
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

// Helper function to safely parse JSON from database
const safeParseJSON = (data) => {
  if (!data) return null;
  if (typeof data !== 'string') return data;
  
  try {
    return JSON.parse(data);
  } catch (e) {
    return data;
  }
};

// Format boolean values to Yes/No for PDF display
const formatBoolean = (value) => value ? 'Yes' : 'No';

// Format nested object fields for PDF display
const formatObjectForPDF = (obj) => {
  if (!obj) return 'N/A';
  if (typeof obj !== 'object') return String(obj) || 'N/A';
  
  const entries = Object.entries(obj);
  if (entries.length === 0) return 'N/A';
  
  return entries
    .map(([key, value]) => {
      const label = formatLabel(key);
      
      if (typeof value === 'boolean') {
        return `${label}: ${formatBoolean(value)}`;
      } else if (typeof value === 'object' && value !== null) {
        // Handle substance use object with current/past
        if (value.current !== undefined || value.past !== undefined) {
          const statuses = [];
          if (value.current) statuses.push('Current');
          if (value.past) statuses.push('Past');
          return `${label}: ${statuses.length ? statuses.join(', ') : 'None'}`;
        }
        return `${label}: ${formatObjectForPDF(value)}`;
      } else {
        return `${label}: ${value || 'No'}`;
      }
    })
    .join('\n');
};

// Export Patient Intake as PDF
router.get('/patients/:patientId/intake/:contactDate/export', async (req, res) => {
  const { patientId, contactDate } = req.params;
  try {
    let parsedDate;
    try {
      parsedDate = parseISO(contactDate);
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (dateError) {
      return res.status(400).json({ error: 'Invalid date format', details: dateError.message });
    }
    
    const normalizedDate = format(parsedDate, 'yyyy-MM-dd');

    const [intakeForm] = await db.query(
      `SELECT 
        pi.contact_date, pi.symptoms_json AS symptoms, pi.columbia_suicide_severity AS columbiaSuicideSeverity,
        pi.anxiety_panic_attacks AS anxietyPanicAttacks, pi.past_mental_health_json AS pastMentalHealth,
        pi.psychiatric_hospitalizations AS psychiatricHospitalizations, pi.substance_use_json AS substanceUse,
        pi.medical_history_json AS medicalHistory, pi.other_medical_history AS otherMedicalHistory,
        pi.family_mental_health_json AS familyMentalHealth, pi.social_situation_json AS socialSituation,
        pi.current_medications AS currentMedications, pi.past_medications AS pastMedications,
        pi.narrative, pi.minutes,
        u.name AS created_by_name, u.email AS created_by_email, u.phone_number AS created_by_phone, u.role AS created_by_role,
        c.name AS clinic_name,
        p.first_name AS patientFirstName, p.last_name AS patientLastName, p.mrn AS patientMRN, p.dob AS patientDOB,
        DATE_FORMAT(p.enrollment_date, '%Y-%m-%d') AS enrollmentDate
      FROM patient_intake pi
      JOIN patients p ON pi.patient_id = p.id
      LEFT JOIN users u ON pi.created_by = u.id
      LEFT JOIN clinics c ON p.clinic_id = c.id
      WHERE pi.patient_id = ? AND DATE(pi.contact_date) = ?`,
      [patientId, normalizedDate]
    );

    if (!intakeForm.length) {
      return res.status(404).json({ error: 'Patient intake form not found', details: { patientId, normalizedDate } });
    }

    const data = intakeForm[0];
    
    // Parse JSON fields
    const symptoms = safeParseJSON(data.symptoms);
    const pastMentalHealth = safeParseJSON(data.pastMentalHealth);
    const substanceUse = safeParseJSON(data.substanceUse);
    const medicalHistory = safeParseJSON(data.medicalHistory);
    const familyMentalHealth = safeParseJSON(data.familyMentalHealth);
    const socialSituation = safeParseJSON(data.socialSituation);

    // Set up response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Patient_Intake_${data.patientLastName}_${data.patientFirstName}_${normalizedDate}.pdf`);
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    try {
      // Create PDF document with improved layout
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: `Patient Intake - ${data.patientFirstName} ${data.patientLastName}`,
          Author: data.created_by_name || 'Care Manager',
          Subject: 'Patient Intake Assessment',
          Keywords: 'intake, mental health, assessment'
        }
      });
      
      // Pipe the PDF to the response object
      doc.pipe(res);
      
      // Define consistent styling variables
      const styles = {
        colors: {
          primary: '#1E3A8A',         // dark blue
          secondary: '#3B82F6',       // medium blue
          accent: '#F59E0B',          // amber
          text: '#1F2937',            // dark gray
          background: '#F3F4F6',      // light gray
          border: '#D1D5DB',          // border color
          lightBlue: '#E0F2FE',       // light blue
          lightGreen: '#ECFDF5',      // light green
          lightAmber: '#FEF3C7'       // light amber
        },
        fonts: {
          normal: 'Helvetica',
          bold: 'Helvetica-Bold'
        },
        fontSize: {
          title: 18,
          heading: 14,
          subheading: 12,
          normal: 10,
          small: 9,
          tiny: 8
        }
      };
      
      // Page dimensions
      const pageWidth = 595.28;       // A4 width in points
      const pageHeight = 841.89;      // A4 height in points
      const margins = {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      };
      const contentWidth = pageWidth - margins.left - margins.right;
      
      // ===== HELPER FUNCTIONS =====
      
      // Helper to add header to each page
      const addHeader = (doc) => {
        doc.fillColor(styles.colors.primary)
           .rect(margins.left, margins.top, contentWidth, 30)
           .fill();
        
        doc.fillColor('white')
           .font(styles.fonts.bold)
           .fontSize(styles.fontSize.subheading)
           .text('PATIENT INTAKE ASSESSMENT', margins.left + 10, margins.top + 10);
      };
      
      // Helper to add footer to each page
      const addFooter = (doc, pageNum, totalPages) => {
        const footerY = pageHeight - margins.bottom - 20;
        
        // Add footer line
        doc.moveTo(margins.left, footerY)
           .lineTo(pageWidth - margins.right, footerY)
           .lineWidth(0.5)
           .stroke(styles.colors.border);
        
        // Add confidential text
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.tiny)
           .fillColor(styles.colors.text)
           .text('CONFIDENTIAL: This intake assessment document contains protected health information.',
                margins.left, footerY + 5, { align: 'center', width: contentWidth });
        
        // Add page numbers
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.tiny)
           .fillColor(styles.colors.secondary)
           .text(`Page ${pageNum} of ${totalPages}`,
                margins.left, footerY + 15, { align: 'center', width: contentWidth });
      };
      
      // Helper to add section headers
      const addSectionHeader = (doc, title, startY) => {
        doc.fillColor(styles.colors.secondary)
           .rect(margins.left, startY, contentWidth, 25)
           .fill();
        
        doc.fillColor('white')
           .font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .text(title.toUpperCase(), margins.left + 10, startY + 7);
        
        return startY + 25;
      };
      
      // Helper to ensure enough space is available
      const ensureSpace = (doc, requiredSpace) => {
        if (doc.y + requiredSpace > pageHeight - margins.bottom) {
          doc.addPage();
          addHeader(doc);
          return margins.top + 50;
        }
        return doc.y;
      };
      
      // Helper to add a field with label and value
      const addField = (doc, label, value, x, y, width) => {
        doc.font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(`${label}:`, x, y);
        
        const valueY = y + doc.heightOfString(`${label}:`);
        
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(value || 'N/A', x, valueY, { width });
        
        return valueY + doc.heightOfString(value || 'N/A');
      };
      
      // Helper to add an info box
      const addInfoBox = (doc, title, content, x, y, width, height, bgColor) => {
        // Box background
        doc.fillColor(bgColor)
           .roundedRect(x, y, width, height, 5)
           .fill();
        
        // Title
        doc.font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(title, x + 10, y + 10, { width: width - 20 });
        
        // Content
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(content, x + 10, y + 30, { width: width - 20 });
      };

      // Generate PDF content
      addHeader(doc);
      
      // Page 1: Patient Information and Session Details
      let y = margins.top + 50;
      
      // Patient Information Banner
      doc.fillColor(styles.colors.lightBlue)
         .roundedRect(margins.left, y, contentWidth, 80, 5)
         .fill();
      
      // Patient Details
      doc.font(styles.fonts.bold)
         .fontSize(styles.fontSize.heading)
         .fillColor(styles.colors.primary)
         .text('PATIENT INTAKE ASSESSMENT', margins.left + 10, y + 10);
      
      doc.font(styles.fonts.bold)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(`${data.patientFirstName} ${data.patientLastName}`, margins.left + 10, y + 35);
      
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(`MRN: ${data.patientMRN || 'N/A'}`, margins.left + 10, y + 55);
      
      // Care Manager Details
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(`Clinic: ${data.clinic_name || 'N/A'}`, margins.left + 250, y + 35);
      
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(`Date: ${format(new Date(data.contact_date), 'MMMM d, yyyy')}`, margins.left + 250, y + 55);
      
      // Created By Information
      y += 100;
      doc.font(styles.fonts.bold)
         .fontSize(styles.fontSize.subheading)
         .fillColor(styles.colors.primary)
         .text('Created By:', margins.left, y);
      
      y += 20;
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(`Name: ${data.created_by_name || 'N/A'}`, margins.left, y);
      
      y += 15;
      doc.text(`Role: ${data.created_by_role || 'N/A'}`, margins.left, y);
      
      y += 15;
      doc.text(`Session Duration: ${data.minutes || 0} minutes`, margins.left, y);
      
      // Current Symptoms Section
      y = ensureSpace(doc, 80);
      y = addSectionHeader(doc, 'Current Symptoms', y);
      
      // Format symptoms for display
      let symptomsText = '';
      if (symptoms) {
        Object.entries(symptoms).forEach(([key, value]) => {
          if (value === true) {
            symptomsText += `• ${formatLabel(key)}\n`;
          }
        });
      }
      
      if (!symptomsText) {
        symptomsText = 'No symptoms reported';
      }
      
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(symptomsText, margins.left + 10, y + 10, { width: contentWidth - 20 });
      
      // Move to next content based on text height
      y += doc.heightOfString(symptomsText, { width: contentWidth - 20 }) + 30;
      
      // Additional Symptom Details
      if (data.columbiaSuicideSeverity) {
        y = ensureSpace(doc, 60);
        doc.font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text('Columbia Suicide Severity Rating Scale:', margins.left + 10, y);
        
        y += 20;
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(data.columbiaSuicideSeverity, margins.left + 10, y, { width: contentWidth - 20 });
        
        y += doc.heightOfString(data.columbiaSuicideSeverity, { width: contentWidth - 20 }) + 20;
      }
      
      if (data.anxietyPanicAttacks) {
        y = ensureSpace(doc, 60);
        doc.font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text('Anxiety or Panic Attacks:', margins.left + 10, y);
        
        y += 20;
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(data.anxietyPanicAttacks, margins.left + 10, y, { width: contentWidth - 20 });
        
        y += doc.heightOfString(data.anxietyPanicAttacks, { width: contentWidth - 20 }) + 20;
      }
      
      // Past Mental Health Section
      y = ensureSpace(doc, 80);
      y = addSectionHeader(doc, 'Past Mental Health History', y);
      
      // Format past mental health for display
      let pastMentalHealthText = '';
      if (pastMentalHealth) {
        Object.entries(pastMentalHealth).forEach(([key, value]) => {
          if (value === true) {
            pastMentalHealthText += `• ${formatLabel(key)}\n`;
          }
        });
      }
      
      if (!pastMentalHealthText) {
        pastMentalHealthText = 'No past mental health history reported';
      }
      
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(pastMentalHealthText, margins.left + 10, y + 10, { width: contentWidth - 20 });
      
      y += doc.heightOfString(pastMentalHealthText, { width: contentWidth - 20 }) + 30;
      
      if (data.psychiatricHospitalizations) {
        y = ensureSpace(doc, 60);
        doc.font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text('Psychiatric Hospitalizations:', margins.left + 10, y);
        
        y += 20;
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(data.psychiatricHospitalizations, margins.left + 10, y, { width: contentWidth - 20 });
        
        y += doc.heightOfString(data.psychiatricHospitalizations, { width: contentWidth - 20 }) + 20;
      }
      
      // Substance Use Section
      y = ensureSpace(doc, 80);
      y = addSectionHeader(doc, 'Substance Use', y);
      
      // Format substance use for display
      let substanceUseText = '';
      if (substanceUse) {
        Object.entries(substanceUse).forEach(([key, value]) => {
          if (typeof value === 'object' && (value.current || value.past)) {
            const status = [];
            if (value.current) status.push('Current');
            if (value.past) status.push('Past');
            substanceUseText += `• ${formatLabel(key)}: ${status.join(', ')}\n`;
          }
        });
      }
      
      if (!substanceUseText) {
        substanceUseText = 'No substance use reported';
      }
      
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(substanceUseText, margins.left + 10, y + 10, { width: contentWidth - 20 });
      
      y += doc.heightOfString(substanceUseText, { width: contentWidth - 20 }) + 30;
      
      // Medical History Section
      y = ensureSpace(doc, 80);
      y = addSectionHeader(doc, 'Medical History', y);
      
      // Format medical history for display
      let medicalHistoryText = '';
      if (medicalHistory) {
        Object.entries(medicalHistory).forEach(([key, value]) => {
          if (value === true) {
            medicalHistoryText += `• ${formatLabel(key)}\n`;
          }
        });
      }
      
      if (!medicalHistoryText) {
        medicalHistoryText = 'No medical history reported';
      }
      
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(medicalHistoryText, margins.left + 10, y + 10, { width: contentWidth - 20 });
      
      y += doc.heightOfString(medicalHistoryText, { width: contentWidth - 20 }) + 30;
      
      if (data.otherMedicalHistory) {
        y = ensureSpace(doc, 60);
        doc.font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text('Other Medical History:', margins.left + 10, y);
        
        y += 20;
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(data.otherMedicalHistory, margins.left + 10, y, { width: contentWidth - 20 });
        
        y += doc.heightOfString(data.otherMedicalHistory, { width: contentWidth - 20 }) + 20;
      }
      
      // Family Mental Health Section
      y = ensureSpace(doc, 80);
      y = addSectionHeader(doc, 'Family Mental Health History', y);
      
      // Format family mental health for display
      let familyMentalHealthText = '';
      if (familyMentalHealth) {
        Object.entries(familyMentalHealth).forEach(([key, value]) => {
          if (value === true) {
            familyMentalHealthText += `• ${formatLabel(key)}\n`;
          }
        });
      }
      
      if (!familyMentalHealthText) {
        familyMentalHealthText = 'No family mental health history reported';
      }
      
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(familyMentalHealthText, margins.left + 10, y + 10, { width: contentWidth - 20 });
      
      y += doc.heightOfString(familyMentalHealthText, { width: contentWidth - 20 }) + 30;
      
      // Social Situation Section
      y = ensureSpace(doc, 80);
      y = addSectionHeader(doc, 'Social Situation', y);
      
      // Format social situation for display
      let socialSituationText = '';
      if (socialSituation) {
        Object.entries(socialSituation).forEach(([key, value]) => {
          if (value) {
            socialSituationText += `• ${formatLabel(key)}: ${value}\n`;
          }
        });
      }
      
      if (!socialSituationText) {
        socialSituationText = 'No social situation details reported';
      }
      
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(socialSituationText, margins.left + 10, y + 10, { width: contentWidth - 20 });
      
      y += doc.heightOfString(socialSituationText, { width: contentWidth - 20 }) + 30;
      
      // Medications Section
      y = ensureSpace(doc, 80);
      y = addSectionHeader(doc, 'Medications', y);
      
      if (data.currentMedications) {
        y += 20;
        doc.font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text('Current Medications:', margins.left + 10, y);
        
        y += 20;
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(data.currentMedications, margins.left + 10, y, { width: contentWidth - 20 });
        
        y += doc.heightOfString(data.currentMedications, { width: contentWidth - 20 }) + 20;
      } else {
        y += 20;
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text('No current medications reported', margins.left + 10, y);
        
        y += 20;
      }
      
      if (data.pastMedications) {
        y = ensureSpace(doc, 60);
        doc.font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text('Past Medications Tried:', margins.left + 10, y);
        
        y += 20;
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(data.pastMedications, margins.left + 10, y, { width: contentWidth - 20 });
        
        y += doc.heightOfString(data.pastMedications, { width: contentWidth - 20 }) + 20;
      }
      
      // Narrative/Notes Section
      if (data.narrative) {
        y = ensureSpace(doc, 80);
        y = addSectionHeader(doc, 'Session Notes', y);
        
        y += 20;
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(data.narrative, margins.left + 10, y, { width: contentWidth - 20 });
      }
      
      // Add page numbers after finalizing the document
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        addFooter(doc, i + 1, totalPages);
      }
      
      // End the document
      doc.end();

    } catch (pdfError) {
      console.error('Error creating PDF document:', pdfError);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'PDF generation error', details: pdfError.message });
      } else {
        return res.end();
      }
    }
  } catch (error) {
    console.error('Error exporting patient intake PDF:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
});

// Create a new patient intake
router.post(
  '/patient-intake',
  [
    body('patientId').isInt().withMessage('Patient ID must be an integer'),
    body('createdBy').isInt().withMessage('Created By must be an integer'),
    body('contactDate').isISO8601().withMessage('Contact Date must be in ISO8601 format'),
    body('symptoms').isObject().withMessage('Symptoms must be an object'),
    body('columbiaSuicideSeverity').optional().isString(),
    body('anxietyPanicAttacks').optional().isString(),
    body('pastMentalHealth').isObject(),
    body('psychiatricHospitalizations').optional().isString(),
    body('substanceUse').isObject(),
    body('medicalHistory').isObject(),
    body('otherMedicalHistory').optional().isString(),
    body('familyMentalHealth').isObject(),
    body('socialSituation').isObject(),
    body('currentMedications').optional().isString(),
    body('pastMedications').optional().isString(),
    body('narrative').optional().isString(),
    body('minutes').isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      patientId, createdBy, contactDate, symptoms, columbiaSuicideSeverity,
      anxietyPanicAttacks, pastMentalHealth, psychiatricHospitalizations,
      substanceUse, medicalHistory, otherMedicalHistory, familyMentalHealth,
      socialSituation, currentMedications, pastMedications, narrative,
      minutes,
    } = req.body;

    try {
      await db.query('START TRANSACTION');

      // Check if this is the first intake form for this patient
      const [existingIntakes] = await db.query(
        'SELECT COUNT(*) as count FROM patient_intake WHERE patient_id = ?',
        [patientId]
      );
      
      const isFirstIntake = existingIntakes[0].count === 0;
      
      // If this is the first intake form, update patient status to 'A' (Active)
      if (isFirstIntake) {
        await db.query(
          'UPDATE patients SET status = "A" WHERE id = ? AND status = "E"',
          [patientId]
        );
      }

      const formattedContactDate = format(new Date(contactDate), 'yyyy-MM-dd');

      const [result] = await db.query(
        `INSERT INTO patient_intake (
          patient_id, created_by, contact_date, symptoms_json, columbia_suicide_severity,
          anxiety_panic_attacks, past_mental_health_json, psychiatric_hospitalizations,
          substance_use_json, medical_history_json, other_medical_history,
          family_mental_health_json, social_situation_json, current_medications,
          past_medications, narrative, minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patientId, createdBy, formattedContactDate, JSON.stringify(symptoms),
          columbiaSuicideSeverity || null, anxietyPanicAttacks || null,
          JSON.stringify(pastMentalHealth), psychiatricHospitalizations || null,
          JSON.stringify(substanceUse), JSON.stringify(medicalHistory),
          otherMedicalHistory || null, JSON.stringify(familyMentalHealth),
          JSON.stringify(socialSituation), currentMedications || null,
          pastMedications || null, narrative || null, minutes
        ]
      );

      const intakeId = result.insertId;

      await db.query(
        `INSERT INTO minute_tracking (user_id, total_minutes, tracking_date) VALUES (?, ?, ?)`,
        [createdBy, minutes, formattedContactDate]
      );

      await db.query('COMMIT');
      
      // Include status update information in the response
      res.status(201).json({ 
        id: intakeId, 
        message: 'Patient intake created successfully',
        statusUpdated: isFirstIntake
      });
    } catch (error) {
      await db.query('ROLLBACK');
      console.error('Error creating patient intake:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
);

// Fetch latest patient intake
router.get('/patient-intake/:patientId/latest', async (req, res) => {
  const { patientId } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
        id, contact_date AS contactDate, symptoms_json AS symptoms, 
        columbia_suicide_severity AS columbiaSuicideSeverity, 
        anxiety_panic_attacks AS anxietyPanicAttacks,
        past_mental_health_json AS pastMentalHealth,
        psychiatric_hospitalizations AS psychiatricHospitalizations,
        substance_use_json AS substanceUse,
        medical_history_json AS medicalHistory,
        other_medical_history AS otherMedicalHistory,
        family_mental_health_json AS familyMentalHealth,
        social_situation_json AS socialSituation,
        current_medications AS currentMedications,
        past_medications AS pastMedications,
        narrative, 
        minutes, created_by AS createdBy, 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM patient_intake 
      WHERE patient_id = ? 
      ORDER BY contact_date DESC 
      LIMIT 1`,
      [patientId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'No patient intake found for this patient' });
    }

    const intake = rows[0];
    const safeJSON = (data) => {
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch (e) {
          return {};
        }
      }
      return data || {};
    };

    intake.symptoms = safeJSON(intake.symptoms);
    intake.pastMentalHealth = safeJSON(intake.pastMentalHealth);
    intake.substanceUse = safeJSON(intake.substanceUse);
    intake.medicalHistory = safeJSON(intake.medicalHistory);
    intake.familyMentalHealth = safeJSON(intake.familyMentalHealth);
    intake.socialSituation = safeJSON(intake.socialSituation);

    res.status(200).json(intake);
  } catch (error) {
    console.error('Error fetching patient intake:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router; 