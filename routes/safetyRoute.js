// const express = require('express');
// const db = require('../lib/db');
// const { body, validationResult } = require('express-validator');
// const { format, parseISO } = require('date-fns');
// const PDFDocument = require('pdfkit-table');

// const router = express.Router();

// // Helper function to format camelCase to Title Case
// const formatLabel = (text) => {
//   // Handle special abbreviations
//   const specialAbbreviations = {
//     'htn': 'HTN',
//     'copdAsthma': 'COPD/Asthma',
//   };
  
//   if (specialAbbreviations[text]) {
//     return specialAbbreviations[text];
//   }
  
//   // Normal camelCase to Title Case conversion
//   return text
//     .replace(/([A-Z])/g, ' $1')
//     .replace(/^./, (str) => str.toUpperCase())
//     .trim();
// };

// // Helper function to safely parse JSON from database
// const safeParseJSON = (data) => {
//   if (!data) return null;
//   if (typeof data !== 'string') return data;
  
//   try {
//     return JSON.parse(data);
//   } catch (e) {
//     return data;
//   }
// };

// // Format boolean values to Yes/No for PDF display
// const formatBoolean = (value) => value ? 'Yes' : 'No';

// // Format nested object fields for PDF display
// const formatObjectForPDF = (obj) => {
//   if (!obj) return 'N/A';
//   if (typeof obj !== 'object') return String(obj) || 'N/A';
  
//   const entries = Object.entries(obj);
//   if (entries.length === 0) return 'N/A';
  
//   return entries
//     .map(([key, value]) => {
//       const label = formatLabel(key);
      
//       if (typeof value === 'boolean') {
//         return `${label}: ${formatBoolean(value)}`;
//       } else if (typeof value === 'object' && value !== null) {
//         // Handle substance use object with current/past
//         if (value.current !== undefined || value.past !== undefined) {
//           const statuses = [];
//           if (value.current) statuses.push('Current');
//           if (value.past) statuses.push('Past');
//           return `${label}: ${statuses.length ? statuses.join(', ') : 'None'}`;
//         }
//         return `${label}: ${formatObjectForPDF(value)}`;
//       } else {
//         return `${label}: ${value || 'No'}`;
//       }
//     })
//     .join('\n');
// };

// // Export Safety Plan as PDF
// router.get('/patients/:patientId/safety-plans/:contactDate/export', async (req, res) => {
//   const { patientId, contactDate } = req.params;
//   try {
//     let parsedDate;
//     try {
//       parsedDate = parseISO(contactDate);
//       if (!parsedDate || isNaN(parsedDate.getTime())) {
//         throw new Error('Invalid date format');
//       }
//     } catch (dateError) {
//       return res.status(400).json({ error: 'Invalid date format', details: dateError.message });
//     }
    
//     const normalizedDate = format(parsedDate, 'yyyy-MM-dd');

//     const [safetyPlan] = await db.query(
//       `SELECT 
//         sp.contact_date, sp.symptoms_json AS symptoms, sp.columbia_suicide_severity AS columbiaSuicideSeverity,
//         sp.anxiety_panic_attacks AS anxietyPanicAttacks, sp.past_mental_health_json AS pastMentalHealth,
//         sp.psychiatric_hospitalizations AS psychiatricHospitalizations, sp.substance_use_json AS substanceUse,
//         sp.medical_history_json AS medicalHistory, sp.other_medical_history AS otherMedicalHistory,
//         sp.family_mental_health_json AS familyMentalHealth, sp.social_situation_json AS socialSituation,
//         sp.current_medications AS currentMedications, sp.past_medications AS pastMedications,
//         sp.narrative, sp.safety_plan_discussed AS safetyPlanDiscussed, sp.minutes,
//         u.name AS created_by_name, u.email AS created_by_email, u.phone_number AS created_by_phone, u.role AS created_by_role,
//         c.name AS clinic_name,
//         p.first_name AS patientFirstName, p.last_name AS patientLastName, p.mrn AS patientMRN, p.dob AS patientDOB,
//         DATE_FORMAT(p.enrollment_date, '%Y-%m-%d') AS enrollmentDate
//       FROM safety_plans sp
//       JOIN patients p ON sp.patient_id = p.id
//       LEFT JOIN users u ON sp.created_by = u.id
//       LEFT JOIN clinics c ON p.clinic_id = c.id
//       WHERE sp.patient_id = ? AND DATE(sp.contact_date) = ?`,
//       [patientId, normalizedDate]
//     );

//     if (!safetyPlan.length) {
//       return res.status(404).json({ error: 'Safety plan not found', details: { patientId, normalizedDate } });
//     }

//     const data = safetyPlan[0];
    
//     // Parse JSON fields
//     const symptoms = safeParseJSON(data.symptoms);
//     const pastMentalHealth = safeParseJSON(data.pastMentalHealth);
//     const substanceUse = safeParseJSON(data.substanceUse);
//     const medicalHistory = safeParseJSON(data.medicalHistory);
//     const familyMentalHealth = safeParseJSON(data.familyMentalHealth);
//     const socialSituation = safeParseJSON(data.socialSituation);

//     // Set up response headers
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', `attachment; filename=Safety_Plan_${data.patientLastName}_${data.patientFirstName}_${normalizedDate}.pdf`);
//     res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
//     res.setHeader('Access-Control-Allow-Credentials', 'true');
//     res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

//     try {
//       // Create PDF document with improved layout
//       const doc = new PDFDocument({
//         margins: { top: 50, bottom: 50, left: 50, right: 50 },
//         size: 'A4',
//         autoFirstPage: true,
//         bufferPages: true,
//         info: {
//           Title: `Safety Plan - ${data.patientFirstName} ${data.patientLastName}`,
//           Author: data.created_by_name || 'Care Manager',
//           Subject: 'Patient Safety Plan',
//           Keywords: 'safety plan, mental health, assessment'
//         }
//       });
      
//       // Pipe the PDF to the response object
//       doc.pipe(res);
      
//       // Define consistent styling variables
//       const styles = {
//         colors: {
//           primary: '#1E3A8A',         // dark blue
//           secondary: '#3B82F6',       // medium blue
//           accent: '#F59E0B',          // amber
//           text: '#1F2937',            // dark gray
//           background: '#F3F4F6',      // light gray
//           border: '#D1D5DB',          // border color
//           lightBlue: '#E0F2FE',       // light blue
//           lightGreen: '#ECFDF5',      // light green
//           lightAmber: '#FEF3C7'       // light amber
//         },
//         fonts: {
//           normal: 'Helvetica',
//           bold: 'Helvetica-Bold'
//         },
//         fontSize: {
//           title: 18,
//           heading: 14,
//           subheading: 12,
//           normal: 10,
//           small: 9,
//           tiny: 8
//         }
//       };
      
//       // Page dimensions
//       const pageWidth = 595.28;       // A4 width in points
//       const pageHeight = 841.89;      // A4 height in points
//       const margins = {
//         top: 50,
//         bottom: 50,
//         left: 50,
//         right: 50
//       };
//       const contentWidth = pageWidth - margins.left - margins.right;
      
//       // ===== HELPER FUNCTIONS =====
      
//       // Helper to add header to each page
//       const addHeader = (doc) => {
//         doc.fillColor(styles.colors.primary)
//            .rect(margins.left, margins.top, contentWidth, 30)
//            .fill();
        
//         doc.fillColor('white')
//            .font(styles.fonts.bold)
//            .fontSize(styles.fontSize.subheading)
//            .text('PATIENT SAFETY PLAN', margins.left + 10, margins.top + 10);
           
//         return margins.top + 40; // Return Y position after header
//       };
      
//       // Helper to add footer to each page
//       const addFooter = (doc, pageNum, totalPages) => {
//         const footerY = pageHeight - margins.bottom - 20;
        
//         doc.moveTo(margins.left, footerY)
//            .lineTo(pageWidth - margins.right, footerY)
//            .lineWidth(0.5)
//            .stroke(styles.colors.border);
        
//         doc.font(styles.fonts.normal)
//            .fontSize(styles.fontSize.tiny)
//            .fillColor(styles.colors.text)
//            .text('CONFIDENTIAL: This safety plan document contains protected health information.',
//                 margins.left, footerY + 5, { align: 'center', width: contentWidth });
                
//         doc.font(styles.fonts.normal)
//            .fontSize(styles.fontSize.tiny)
//            .fillColor(styles.colors.secondary)
//            .text(`Page ${pageNum} of ${totalPages}`,
//                 margins.left, footerY + 15, { align: 'center', width: contentWidth });
//       };
      
//       // Helper to add section header
//       const addSectionHeader = (doc, title, startY) => {
//         const y = startY || doc.y;
        
//         // Add spacing before section header
//         const sectionY = y + 10;
        
//         doc.fillColor(styles.colors.primary)
//            .rect(margins.left, sectionY, contentWidth, 25)
//            .fill();
        
//         doc.fillColor('white')
//            .font(styles.fonts.bold)
//            .fontSize(styles.fontSize.normal)
//            .text(title, margins.left + 10, sectionY + 7);
        
//         doc.fillColor(styles.colors.text)
//            .font(styles.fonts.normal)
//            .fontSize(styles.fontSize.normal);
           
//         return sectionY + 30; // Return Y position after section header
//       };
      
//       // Helper to check available space and add new page if needed
//       const ensureSpace = (doc, requiredSpace) => {
//         if (doc.y + requiredSpace > pageHeight - margins.bottom) {
//           doc.addPage();
//           return addHeader(doc);
//         }
//         return doc.y;
//       };
      
//       // Helper to add label and value
//       const addField = (doc, label, value, x, y, width) => {
//         doc.font(styles.fonts.bold)
//            .fontSize(styles.fontSize.normal)
//            .fillColor(styles.colors.text)
//            .text(label, x, y, { continued: false });
           
//         doc.font(styles.fonts.normal)
//            .fontSize(styles.fontSize.normal)
//            .text(value || 'N/A', x, y + 15, { width: width });
           
//         return y + 30; // Return Y position for next field
//       };
      
//       // Helper to create box with title and content
//       const addInfoBox = (doc, title, content, x, y, width, height, bgColor) => {
//         doc.fillColor(bgColor || styles.colors.background)
//            .strokeColor(styles.colors.border)
//            .lineWidth(0.5)
//            .rect(x, y, width, height)
//            .fillAndStroke();
           
//         doc.fillColor(styles.colors.primary)
//            .font(styles.fonts.bold)
//            .fontSize(styles.fontSize.normal)
//            .text(title, x + 10, y + 10);
           
//         doc.fillColor(styles.colors.text)
//            .font(styles.fonts.normal)
//            .fontSize(styles.fontSize.normal)
//            .text(content || 'N/A', x + 10, y + 30, { width: width - 20 });
           
//         return y + height; // Return Y position after box
//       };
      
//       // ===== DOCUMENT GENERATION =====
      
//       // First page
//       let y = addHeader(doc);
      
//       // Document title
//       y += 20;
//       doc.font(styles.fonts.bold)
//          .fontSize(styles.fontSize.title)
//          .fillColor(styles.colors.primary)
//          .text(`Safety Plan for ${data.patientFirstName} ${data.patientLastName}`, margins.left, y, { align: 'center' });
      
//       y += 25;
//       doc.font(styles.fonts.normal)
//          .fontSize(styles.fontSize.normal)
//          .text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, margins.left, y, { align: 'center' });
      
//       y += 30;
      
//       // Two-column layout for Patient and Provider Information
//       const columnWidth = contentWidth / 2 - 10;
      
//       // Patient Information Box
//       doc.fillColor(styles.colors.background)
//          .strokeColor(styles.colors.border)
//          .lineWidth(0.5)
//          .rect(margins.left, y, columnWidth, 140)
//          .fillAndStroke();
      
//       let boxY = y + 10;
//       doc.fillColor(styles.colors.primary)
//          .font(styles.fonts.bold)
//          .fontSize(styles.fontSize.heading)
//          .text('PATIENT INFORMATION', margins.left + 10, boxY);
      
//       boxY += 25;
//       boxY = addField(doc, 'Name:', `${data.patientFirstName} ${data.patientLastName}`, margins.left + 10, boxY, columnWidth - 20);
//       boxY = addField(doc, 'DOB:', data.patientDOB ? format(new Date(data.patientDOB), 'MM/dd/yyyy') : 'N/A', margins.left + 10, boxY, columnWidth - 20);
//       boxY = addField(doc, 'MRN:', data.patientMRN || 'N/A', margins.left + 10, boxY, columnWidth - 20);
      
//       // Provider Information Box (Right Column)
//       const rightX = margins.left + columnWidth + 20;
//       doc.fillColor(styles.colors.background)
//          .rect(rightX, y, columnWidth, 140)
//          .fillAndStroke();
      
//       boxY = y + 10;
//       doc.fillColor(styles.colors.primary)
//          .font(styles.fonts.bold)
//          .fontSize(styles.fontSize.heading)
//          .text('PROVIDER INFORMATION', rightX + 10, boxY);
      
//       boxY += 25;
//       boxY = addField(doc, 'Care Manager:', data.created_by_name || 'N/A', rightX + 10, boxY, columnWidth - 20);
//       boxY = addField(doc, 'Role:', data.created_by_role || 'N/A', rightX + 10, boxY, columnWidth - 20);
//       boxY = addField(doc, 'Contact Date:', format(new Date(data.contact_date), 'MM/dd/yyyy'), rightX + 10, boxY, columnWidth - 20);
      
//       y += 160;
      
//       // Current Symptoms Section
//       y = addSectionHeader(doc, 'CURRENT SYMPTOMS', y);
      
//       // Symptoms grid
//       if (symptoms && typeof symptoms === 'object') {
//         const symptomEntries = Object.entries(symptoms);
//         if (symptomEntries.length > 0) {
//           // Calculate grid layout
//           const columns = 3;
//           const itemWidth = contentWidth / columns;
//           const itemHeight = 25;
//           const rows = Math.ceil(symptomEntries.length / columns);
          
//           // Ensure space for symptoms grid
//           y = ensureSpace(doc, rows * itemHeight + 20);
          
//           // Create grid background
//           doc.fillColor(styles.colors.background)
//              .strokeColor(styles.colors.border)
//              .lineWidth(0.5)
//              .rect(margins.left, y, contentWidth, rows * itemHeight)
//              .fillAndStroke();
          
//           // Fill grid with symptoms
//           symptomEntries.forEach((entry, index) => {
//             const [key, value] = entry;
//             const column = index % columns;
//             const row = Math.floor(index / columns);
//             const x = margins.left + (column * itemWidth) + 5;
//             const cellY = y + (row * itemHeight) + 7;
            
//             doc.font(styles.fonts.bold)
//                .fontSize(styles.fontSize.small)
//                .fillColor(styles.colors.text)
//                .text(formatLabel(key) + ":", x, cellY, { continued: true });
               
//             doc.font(styles.fonts.normal)
//                .text(` ${value ? 'Yes' : 'No'}`);
//           });
          
//           y += rows * itemHeight + 10;
//         } else {
//           doc.text('No symptoms recorded', margins.left, y);
//           y += 20;
//         }
//       } else {
//         doc.text('No symptoms recorded', margins.left, y);
//         y += 20;
//       }
      
//       // Check for Columbia Suicide Severity & Anxiety/Panic Attacks
//       if (data.columbiaSuicideSeverity || data.anxietyPanicAttacks) {
//         y = ensureSpace(doc, 100);
        
//         const boxWidth = contentWidth / 2 - 10;
//         const boxHeight = 80;
        
//         if (data.columbiaSuicideSeverity) {
//           addInfoBox(
//             doc,
//             'Columbia Suicide Severity Rating Scale',
//             data.columbiaSuicideSeverity,
//             margins.left,
//             y,
//             boxWidth,
//             boxHeight,
//             styles.colors.lightAmber
//           );
          
//           if (data.anxietyPanicAttacks) {
//             addInfoBox(
//               doc,
//               'Anxiety or Panic Attacks',
//               data.anxietyPanicAttacks,
//               margins.left + boxWidth + 20,
//               y,
//               boxWidth,
//               boxHeight,
//               styles.colors.lightBlue
//             );
//           }
          
//           y += boxHeight + 15;
//         } else if (data.anxietyPanicAttacks) {
//           addInfoBox(
//             doc,
//             'Anxiety or Panic Attacks',
//             data.anxietyPanicAttacks,
//             margins.left,
//             y,
//             contentWidth,
//             boxHeight,
//             styles.colors.lightBlue
//           );
          
//           y += boxHeight + 15;
//         }
//       }
      
//       // Past Mental Health History
//       y = ensureSpace(doc, 150);
//       y = addSectionHeader(doc, 'PAST MENTAL HEALTH HISTORY', y);
      
//       if (pastMentalHealth && typeof pastMentalHealth === 'object') {
//         const entries = Object.entries(pastMentalHealth);
//         if (entries.length > 0) {
//           // Create two-column layout for past mental health
//           const columns = 2;
//           const colWidth = contentWidth / columns;
//           const rowHeight = 25;
//           const rows = Math.ceil(entries.length / columns);
          
//           // Ensure space for mental health grid
//           y = ensureSpace(doc, rows * rowHeight + 20);
          
//           // Create background
//           doc.fillColor(styles.colors.background)
//              .strokeColor(styles.colors.border)
//              .lineWidth(0.5)
//              .rect(margins.left, y, contentWidth, rows * rowHeight)
//              .fillAndStroke();
          
//           // Fill with mental health history items
//           entries.forEach((entry, index) => {
//             const [key, value] = entry;
//             const column = index % columns;
//             const row = Math.floor(index / columns);
//             const x = margins.left + (column * colWidth) + 10;
//             const itemY = y + (row * rowHeight) + 7;
            
//             doc.font(styles.fonts.bold)
//                .fontSize(styles.fontSize.small)
//                .fillColor(styles.colors.text)
//                .text(formatLabel(key) + ":", x, itemY, { continued: true });
               
//             doc.font(styles.fonts.normal)
//                .text(` ${formatBoolean(value)}`);
//           });
          
//           y += rows * rowHeight + 10;
//         }
        
//         // Add psychiatric hospitalizations if present
//         if (data.psychiatricHospitalizations) {
//           y = ensureSpace(doc, 60);
          
//           addInfoBox(
//             doc,
//             'Psychiatric Hospitalizations',
//             data.psychiatricHospitalizations,
//             margins.left,
//             y,
//             contentWidth,
//             50,
//             styles.colors.lightBlue
//           );
          
//           y += 60;
//         }
//       } else {
//         doc.text('No past mental health history recorded', margins.left, y);
//         y += 20;
//       }
      
//       // Substance Use section with table
//       y = ensureSpace(doc, 150);
//       y = addSectionHeader(doc, 'SUBSTANCE USE', y);
      
//       if (substanceUse && typeof substanceUse === 'object') {
//         const entries = Object.entries(substanceUse);
//         if (entries.length > 0) {
//           // Create a table for substance use
//           const tableY = y;
//           const rowHeight = 25;
//           const headerHeight = 30;
//           const colWidths = [contentWidth * 0.6, contentWidth * 0.2, contentWidth * 0.2];
//           const tableWidth = contentWidth;
          
//           // Draw table header
//           doc.fillColor(styles.colors.primary)
//              .rect(margins.left, tableY, tableWidth, headerHeight)
//              .fill();
             
//           doc.fillColor('white')
//              .font(styles.fonts.bold)
//              .fontSize(styles.fontSize.normal);
             
//           // Draw header text with proper alignment
//           doc.text('Substance', margins.left + 5, tableY + 10, { width: colWidths[0], align: 'left' });
//           doc.text('Current Use', margins.left + colWidths[0] + 5, tableY + 10, { width: colWidths[1], align: 'center' });
//           doc.text('Past Use', margins.left + colWidths[0] + colWidths[1] + 5, tableY + 10, { width: colWidths[2], align: 'center' });
          
//           // Draw table rows
//           doc.fillColor(styles.colors.text)
//              .font(styles.fonts.normal)
//              .fontSize(styles.fontSize.small);
             
//           let rowY = tableY + headerHeight;
//           let needNewPage = false;
          
//           entries.forEach((entry, index) => {
//             const [key, value] = entry;
            
//             // Check if we need a new page for this row
//             if (rowY + rowHeight > pageHeight - margins.bottom) {
//               doc.addPage();
//               rowY = addHeader(doc);
              
//               // Redraw the table header on new page
//               doc.fillColor(styles.colors.primary)
//                  .rect(margins.left, rowY, tableWidth, headerHeight)
//                  .fill();
                 
//               doc.fillColor('white')
//                  .font(styles.fonts.bold)
//                  .fontSize(styles.fontSize.normal);
                 
//               // Redraw header text with proper alignment
//               doc.text('Substance', margins.left + 5, rowY + 10, { width: colWidths[0], align: 'left' });
//               doc.text('Current Use', margins.left + colWidths[0] + 5, rowY + 10, { width: colWidths[1], align: 'center' });
//               doc.text('Past Use', margins.left + colWidths[0] + colWidths[1] + 5, rowY + 10, { width: colWidths[2], align: 'center' });
              
//               rowY += headerHeight;
//               needNewPage = true;
              
//               doc.fillColor(styles.colors.text)
//                  .font(styles.fonts.normal)
//                  .fontSize(styles.fontSize.small);
//             }
            
//             // Draw row background (alternating)
//             if (index % 2 === 0) {
//               doc.fillColor(styles.colors.background)
//                  .rect(margins.left, rowY, tableWidth, rowHeight)
//                  .fill();
//             }
            
//             // Draw cell content
//             doc.fillColor(styles.colors.text);
            
//             // Substance name
//             doc.text(formatLabel(key), margins.left + 5, rowY + 7, { width: colWidths[0], align: 'left' });
            
//             // Current use - draw in its own column
//             const currentUseX = margins.left + colWidths[0];
//             doc.text(value.current ? '✓' : '—', currentUseX + 5, rowY + 7, { width: colWidths[1], align: 'center' });
            
//             // Past use - draw in its own column
//             const pastUseX = margins.left + colWidths[0] + colWidths[1];
//             doc.text(value.past ? '✓' : '—', pastUseX + 5, rowY + 7, { width: colWidths[2], align: 'center' });
            
//             // Draw row border
//             doc.strokeColor(styles.colors.border)
//                .lineWidth(0.5)
//                .rect(margins.left, rowY, tableWidth, rowHeight)
//                .stroke();
            
//             rowY += rowHeight;
//           });
          
//           // Draw vertical lines for columns
//           doc.strokeColor(styles.colors.border)
//              .lineWidth(0.5);
             
//           // Line between 1st and 2nd column
//           let lineX = margins.left + colWidths[0];
//           doc.moveTo(lineX, tableY)
//              .lineTo(lineX, rowY)
//              .stroke();
             
//           // Line between 2nd and 3rd column
//           lineX = margins.left + colWidths[0] + colWidths[1];
//           doc.moveTo(lineX, tableY)
//              .lineTo(lineX, rowY)
//              .stroke();
          
//           y = rowY + 20; // Add extra spacing after table
//         } else {
//           doc.text('No substance use recorded', margins.left, y);
//           y += 20;
//         }
//       } else {
//         doc.text('No substance use recorded', margins.left, y);
//         y += 20;
//       }
      
//       // Medical History section
//       y = ensureSpace(doc, 150);
//       y = addSectionHeader(doc, 'MEDICAL HISTORY', y);
      
//       if (medicalHistory && typeof medicalHistory === 'object') {
//         const entries = Object.entries(medicalHistory);
//         if (entries.length > 0) {
//           // Create a grid layout for medical history
//           const columns = 3;
//           const colWidth = contentWidth / columns;
//           const rowHeight = 25;
//           const rows = Math.ceil(entries.length / columns);
          
//           // Ensure space for medical history grid
//           y = ensureSpace(doc, rows * rowHeight + 20);
          
//           // Create background
//           doc.fillColor(styles.colors.background)
//              .strokeColor(styles.colors.border)
//              .lineWidth(0.5)
//              .rect(margins.left, y, contentWidth, rows * rowHeight)
//              .fillAndStroke();
          
//           // Fill with medical history items
//           entries.forEach((entry, index) => {
//             const [key, value] = entry;
//             const column = index % columns;
//             const row = Math.floor(index / columns);
//             const x = margins.left + (column * colWidth) + 5;
//             const itemY = y + (row * rowHeight) + 7;
            
//             doc.font(styles.fonts.bold)
//                .fontSize(styles.fontSize.small)
//                .fillColor(styles.colors.text)
//                .text(formatLabel(key) + ":", x, itemY, { continued: true });
               
//             doc.font(styles.fonts.normal)
//                .text(` ${formatBoolean(value)}`);
//           });
          
//           y += rows * rowHeight + 10;
//         }
        
//         // Add other medical history if present
//         if (data.otherMedicalHistory) {
//           y = ensureSpace(doc, 60);
          
//           addInfoBox(
//             doc,
//             'Other Medical History',
//             data.otherMedicalHistory,
//             margins.left,
//             y,
//             contentWidth,
//             50,
//             styles.colors.lightGreen
//           );
          
//           y += 60;
//         }
//       } else {
//         doc.text('No medical history recorded', margins.left, y);
//         y += 20;
//       }
      
//       // Family Mental Health section
//       y = ensureSpace(doc, 150);
//       y = addSectionHeader(doc, 'FAMILY MENTAL HEALTH HISTORY', y);
      
//       if (familyMentalHealth && typeof familyMentalHealth === 'object') {
//         const entries = Object.entries(familyMentalHealth);
//         if (entries.length > 0) {
//           // Create a grid layout
//           const columns = 2;
//           const colWidth = contentWidth / columns;
//           const rowHeight = 25;
//           const rows = Math.ceil(entries.length / columns);
          
//           // Ensure space for family mental health grid
//           y = ensureSpace(doc, rows * rowHeight + 20);
          
//           // Create background
//           doc.fillColor(styles.colors.background)
//              .strokeColor(styles.colors.border)
//              .lineWidth(0.5)
//              .rect(margins.left, y, contentWidth, rows * rowHeight)
//              .fillAndStroke();
          
//           // Fill with family mental health items
//           entries.forEach((entry, index) => {
//             const [key, value] = entry;
//             const column = index % columns;
//             const row = Math.floor(index / columns);
//             const x = margins.left + (column * colWidth) + 5;
//             const itemY = y + (row * rowHeight) + 7;
            
//             doc.font(styles.fonts.bold)
//                .fontSize(styles.fontSize.small)
//                .fillColor(styles.colors.text)
//                .text(formatLabel(key) + ":", x, itemY, { continued: true });
               
//             doc.font(styles.fonts.normal)
//                .text(` ${formatBoolean(value)}`);
//           });
          
//           y += rows * rowHeight + 10;
//         } else {
//           doc.text('No family mental health history recorded', margins.left, y);
//           y += 20;
//         }
//       } else {
//         doc.text('No family mental health history recorded', margins.left, y);
//         y += 20;
//       }
      
//       // Social Situation section
//       y = ensureSpace(doc, 150);
//       y = addSectionHeader(doc, 'SOCIAL SITUATION', y);
      
//       if (socialSituation && typeof socialSituation === 'object') {
//         const entries = Object.entries(socialSituation);
//         if (entries.length > 0) {
//           // Create cards for each social situation item
//           entries.forEach((entry, index) => {
//             const [key, value] = entry;
            
//             // Ensure space for each card
//             y = ensureSpace(doc, 60);
            
//             // Create card with alternating background colors
//             const bgColor = index % 2 === 0 ? styles.colors.background : '#F9FAFB';
            
//             addInfoBox(
//               doc,
//               formatLabel(key),
//               value || 'N/A',
//               margins.left,
//               y,
//               contentWidth,
//               50,
//               bgColor
//             );
            
//             y += 60;
//           });
//         } else {
//           doc.text('No social situation recorded', margins.left, y);
//           y += 20;
//         }
//       } else {
//         doc.text('No social situation recorded', margins.left, y);
//         y += 20;
//       }
      
//       // Medications section
//       y = ensureSpace(doc, 160);
//       y = addSectionHeader(doc, 'MEDICATIONS', y);
      
//       // Current Medications
//       y = ensureSpace(doc, 80);
//       addInfoBox(
//         doc,
//         'Current Medications',
//         data.currentMedications || 'None recorded',
//         margins.left,
//         y,
//         contentWidth,
//         70,
//         styles.colors.lightBlue
//       );
      
//       y += 80;
      
//       // Past Medications
//       y = ensureSpace(doc, 80);
//       addInfoBox(
//         doc,
//         'Past Medications Tried',
//         data.pastMedications || 'None recorded',
//         margins.left,
//         y,
//         contentWidth,
//         70,
//         styles.colors.lightGreen
//       );
      
//       y += 80;
      
//       // Narrative section - only add if there's content
//       if (data.narrative) {
//         y = ensureSpace(doc, 200);
//         y = addSectionHeader(doc, 'NARRATIVE', y);
        
//         // Create a container for narrative text
//         const narrativeHeight = Math.min(pageHeight - margins.bottom - y - 20, 300);
        
//         doc.fillColor('#FAFAFA')
//            .strokeColor(styles.colors.border)
//            .lineWidth(0.5)
//            .rect(margins.left, y, contentWidth, narrativeHeight)
//            .fillAndStroke();
        
//         doc.font(styles.fonts.normal)
//            .fontSize(styles.fontSize.normal)
//            .fillColor(styles.colors.text)
//            .text(data.narrative, margins.left + 10, y + 10, { width: contentWidth - 20 });
//       }
      
//       // First finish all content without finalizing
//       doc.end();
      
//       // Calculate the actual number of pages with content
//       const range = doc.bufferedPageRange();
//       const totalPages = range.count;
      
//       // Now add page numbers to each page
//       for (let i = 0; i < totalPages; i++) {
//         doc.switchToPage(i);
        
//         const footerY = pageHeight - margins.bottom - 20;
        
//         // Add footer line
//         doc.moveTo(margins.left, footerY)
//            .lineTo(pageWidth - margins.right, footerY)
//            .lineWidth(0.5)
//            .stroke(styles.colors.border);
        
//         // Add confidential text
//         doc.font(styles.fonts.normal)
//            .fontSize(styles.fontSize.tiny)
//            .fillColor(styles.colors.text)
//            .text('CONFIDENTIAL: This safety plan document contains protected health information.',
//                 margins.left, footerY + 5, { align: 'center', width: contentWidth });
        
//         // Add page numbers
//         doc.font(styles.fonts.normal)
//            .fontSize(styles.fontSize.tiny)
//            .fillColor(styles.colors.secondary)
//            .text(`Page ${i + 1} of ${totalPages}`,
//                 margins.left, footerY + 15, { align: 'center', width: contentWidth });
//       }
//     } catch (pdfError) {
//       console.error('Error creating PDF document:', pdfError);
//       if (!res.headersSent) {
//         return res.status(500).json({ error: 'PDF generation error', details: pdfError.message });
//       } else {
//         return res.end();
//       }
//     }
//   } catch (error) {
//     console.error('Error exporting safety plan PDF:', error);
//     res.status(500).json({ 
//       error: 'Internal server error', 
//       details: error.message,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
//     });
//   }
// });

// // Rest of your existing routes
// // Create a new safety plan
// router.post(
//   '/safety-plan',
//   [
//     body('patientId').isInt().withMessage('Patient ID must be an integer'),
//     body('createdBy').isInt().withMessage('Created By must be an integer'),
//     body('contactDate').isISO8601().withMessage('Contact Date must be in ISO8601 format'),
//     body('symptoms').isObject().withMessage('Symptoms must be an object'),
//     body('columbiaSuicideSeverity').optional().isString(),
//     body('anxietyPanicAttacks').optional().isString(),
//     body('pastMentalHealth').isObject(),
//     body('psychiatricHospitalizations').optional().isString(),
//     body('substanceUse').isObject(),
//     body('medicalHistory').isObject(),
//     body('otherMedicalHistory').optional().isString(),
//     body('familyMentalHealth').isObject(),
//     body('socialSituation').isObject(),
//     body('currentMedications').optional().isString(),
//     body('pastMedications').optional().isString(),
//     body('narrative').optional().isString(),
//     body('safetyPlanDiscussed').isBoolean(),
//     body('minutes').isInt({ min: 1 }),
//   ],
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

//     const {
//       patientId, createdBy, contactDate, symptoms, columbiaSuicideSeverity,
//       anxietyPanicAttacks, pastMentalHealth, psychiatricHospitalizations,
//       substanceUse, medicalHistory, otherMedicalHistory, familyMentalHealth,
//       socialSituation, currentMedications, pastMedications, narrative,
//       safetyPlanDiscussed, minutes,
//     } = req.body;

//     try {
//       await db.query('START TRANSACTION');

//       const formattedContactDate = format(new Date(contactDate), 'yyyy-MM-dd');

//       const [result] = await db.query(
//         `INSERT INTO safety_plans (
//           patient_id, created_by, contact_date, symptoms_json, columbia_suicide_severity,
//           anxiety_panic_attacks, past_mental_health_json, psychiatric_hospitalizations,
//           substance_use_json, medical_history_json, other_medical_history,
//           family_mental_health_json, social_situation_json, current_medications,
//           past_medications, narrative, safety_plan_discussed, minutes
//         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//         [
//           patientId, createdBy, formattedContactDate, JSON.stringify(symptoms),
//           columbiaSuicideSeverity || null, anxietyPanicAttacks || null,
//           JSON.stringify(pastMentalHealth), psychiatricHospitalizations || null,
//           JSON.stringify(substanceUse), JSON.stringify(medicalHistory),
//           otherMedicalHistory || null, JSON.stringify(familyMentalHealth),
//           JSON.stringify(socialSituation), currentMedications || null,
//           pastMedications || null, narrative || null, safetyPlanDiscussed ? 1 : 0, minutes
//         ]
//       );

//       const safetyPlanId = result.insertId;

//       await db.query(
//         `INSERT INTO minute_tracking (user_id, total_minutes, tracking_date) VALUES (?, ?, ?)`,
//         [createdBy, minutes, formattedContactDate]
//       );

//       const [existingFlag] = await db.query(
//         `SELECT * FROM patient_flags WHERE patient_id = ? AND flag = "Safety Plan"`,
//         [patientId]
//       );

//       if (safetyPlanDiscussed && existingFlag.length) {
//         await db.query(`DELETE FROM patient_flags WHERE patient_id = ? AND flag = "Safety Plan"`, [patientId]);
//       } else if (!safetyPlanDiscussed && !existingFlag.length) {
//         await db.query(`INSERT INTO patient_flags (patient_id, flag) VALUES (?, "Safety Plan")`, [patientId]);
//       }

//       await db.query('COMMIT');
//       res.status(201).json({ id: safetyPlanId, message: 'Safety Plan created successfully' });
//     } catch (error) {
//       await db.query('ROLLBACK');
//       console.error('Error creating safety plan:', error);
//       res.status(500).json({ error: 'Internal server error', details: error.message });
//     }
//   }
// );

// // Fetch latest safety plan
// router.get('/safety-plan/:patientId/latest', async (req, res) => {
//   const { patientId } = req.params;
//   try {
//     const [rows] = await db.query(
//       `SELECT 
//         id, contact_date AS contactDate, symptoms_json AS symptoms, 
//         columbia_suicide_severity AS columbiaSuicideSeverity, 
//         anxiety_panic_attacks AS anxietyPanicAttacks,
//         past_mental_health_json AS pastMentalHealth,
//         psychiatric_hospitalizations AS psychiatricHospitalizations,
//         substance_use_json AS substanceUse,
//         medical_history_json AS medicalHistory,
//         other_medical_history AS otherMedicalHistory,
//         family_mental_health_json AS familyMentalHealth,
//         social_situation_json AS socialSituation,
//         current_medications AS currentMedications,
//         past_medications AS pastMedications,
//         narrative, safety_plan_discussed AS safetyPlanDiscussed,
//         minutes, created_by AS createdBy, 
//         DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
//       FROM safety_plans 
//       WHERE patient_id = ? 
//       ORDER BY contact_date DESC 
//       LIMIT 1`,
//       [patientId]
//     );

//     if (!rows.length) {
//       return res.status(404).json({ message: 'No safety plan found for this patient' });
//     }

//     const plan = rows[0];
//     const safeJSON = (data) => {
//       if (typeof data === 'string') {
//         try {
//           return JSON.parse(data);
//         } catch (e) {
//           return {};
//         }
//       }
//       return data || {};
//     };

//     plan.symptoms = safeJSON(plan.symptoms);
//     plan.pastMentalHealth = safeJSON(plan.pastMentalHealth);
//     plan.substanceUse = safeJSON(plan.substanceUse);
//     plan.medicalHistory = safeJSON(plan.medicalHistory);
//     plan.familyMentalHealth = safeJSON(plan.familyMentalHealth);
//     plan.socialSituation = safeJSON(plan.socialSituation);

//     res.status(200).json(plan);
//   } catch (error) {
//     console.error('Error fetching safety plan:', error);
//     res.status(500).json({ error: 'Internal server error', details: error.message });
//   }
// });

// module.exports = router;

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

// Export Safety Plan as PDF
router.get('/patients/:patientId/safety-plans/:contactDate/export', async (req, res) => {
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

    const [safetyPlan] = await db.query(
      `SELECT 
        sp.contact_date, sp.symptoms_json AS symptoms, sp.columbia_suicide_severity AS columbiaSuicideSeverity,
        sp.anxiety_panic_attacks AS anxietyPanicAttacks, sp.past_mental_health_json AS pastMentalHealth,
        sp.psychiatric_hospitalizations AS psychiatricHospitalizations, sp.substance_use_json AS substanceUse,
        sp.medical_history_json AS medicalHistory, sp.other_medical_history AS otherMedicalHistory,
        sp.family_mental_health_json AS familyMentalHealth, sp.social_situation_json AS socialSituation,
        sp.current_medications AS currentMedications, sp.past_medications AS pastMedications,
        sp.narrative, sp.safety_plan_discussed AS safetyPlanDiscussed, sp.minutes,
        u.name AS created_by_name, u.email AS created_by_email, u.phone_number AS created_by_phone, u.role AS created_by_role,
        c.name AS clinic_name,
        p.first_name AS patientFirstName, p.last_name AS patientLastName, p.mrn AS patientMRN, p.dob AS patientDOB,
        DATE_FORMAT(p.enrollment_date, '%Y-%m-%d') AS enrollmentDate
      FROM safety_plans sp
      JOIN patients p ON sp.patient_id = p.id
      LEFT JOIN users u ON sp.created_by = u.id
      LEFT JOIN clinics c ON p.clinic_id = c.id
      WHERE sp.patient_id = ? AND DATE(sp.contact_date) = ?`,
      [patientId, normalizedDate]
    );

    if (!safetyPlan.length) {
      return res.status(404).json({ error: 'Safety plan not found', details: { patientId, normalizedDate } });
    }

    const data = safetyPlan[0];
    
    // Parse JSON fields
    const symptoms = safeParseJSON(data.symptoms);
    const pastMentalHealth = safeParseJSON(data.pastMentalHealth);
    const substanceUse = safeParseJSON(data.substanceUse);
    const medicalHistory = safeParseJSON(data.medicalHistory);
    const familyMentalHealth = safeParseJSON(data.familyMentalHealth);
    const socialSituation = safeParseJSON(data.socialSituation);

    // Set up response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Safety_Plan_${data.patientLastName}_${data.patientFirstName}_${normalizedDate}.pdf`);
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
          Title: `Safety Plan - ${data.patientFirstName} ${data.patientLastName}`,
          Author: data.created_by_name || 'Care Manager',
          Subject: 'Patient Safety Plan',
          Keywords: 'safety plan, mental health, assessment'
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
           .text('PATIENT SAFETY PLAN', margins.left + 10, margins.top + 10);
           
        return margins.top + 40; // Return Y position after header
      };
      
      // Helper to add footer to each page
      const addFooter = (doc, pageNum, totalPages) => {
        const footerY = pageHeight - margins.bottom - 20;
        
        doc.moveTo(margins.left, footerY)
           .lineTo(pageWidth - margins.right, footerY)
           .lineWidth(0.5)
           .stroke(styles.colors.border);
        
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.tiny)
           .fillColor(styles.colors.text)
           .text('CONFIDENTIAL: This safety plan document contains protected health information.',
                margins.left, footerY + 5, { align: 'center', width: contentWidth });
                
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.tiny)
           .fillColor(styles.colors.secondary)
           .text(`Page ${pageNum} of ${totalPages}`,
                margins.left, footerY + 15, { align: 'center', width: contentWidth });
      };
      
      // Helper to add section header
      const addSectionHeader = (doc, title, startY) => {
        const y = startY || doc.y;
        
        // Add spacing before section header
        const sectionY = y + 10;
        
        doc.fillColor(styles.colors.primary)
           .rect(margins.left, sectionY, contentWidth, 25)
           .fill();
        
        doc.fillColor('white')
           .font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .text(title, margins.left + 10, sectionY + 7);
        
        doc.fillColor(styles.colors.text)
           .font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal);
           
        return sectionY + 30; // Return Y position after section header
      };
      
      // Helper to check available space and add new page if needed
      const ensureSpace = (doc, requiredSpace) => {
        if (doc.y + requiredSpace > pageHeight - margins.bottom) {
          doc.addPage();
          return addHeader(doc);
        }
        return doc.y;
      };
      
      // Helper to add label and value
      const addField = (doc, label, value, x, y, width) => {
        doc.font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .fillColor(styles.colors.text)
           .text(label, x, y, { continued: false });
           
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .text(value || 'N/A', x, y + 15, { width: width });
           
        return y + 30; // Return Y position for next field
      };
      
      // Helper to create box with title and content
      const addInfoBox = (doc, title, content, x, y, width, height, bgColor) => {
        doc.fillColor(bgColor || styles.colors.background)
           .strokeColor(styles.colors.border)
           .lineWidth(0.5)
           .rect(x, y, width, height)
           .fillAndStroke();
           
        doc.fillColor(styles.colors.primary)
           .font(styles.fonts.bold)
           .fontSize(styles.fontSize.normal)
           .text(title, x + 10, y + 10);
           
        doc.fillColor(styles.colors.text)
           .font(styles.fonts.normal)
           .fontSize(styles.fontSize.normal)
           .text(content || 'N/A', x + 10, y + 30, { width: width - 20 });
           
        return y + height; // Return Y position after box
      };
      
      // ===== DOCUMENT GENERATION =====
      
      // First page
      let y = addHeader(doc);
      
      // Document title
      y += 20;
      doc.font(styles.fonts.bold)
         .fontSize(styles.fontSize.title)
         .fillColor(styles.colors.primary)
         .text(`Safety Plan for ${data.patientFirstName} ${data.patientLastName}`, margins.left, y, { align: 'center' });
      
      y += 25;
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, margins.left, y, { align: 'center' });
      
      y += 30;
      
      // Two-column layout for Patient and Provider Information
      const columnWidth = contentWidth / 2 - 10;
      
      // Patient Information Box
      doc.fillColor(styles.colors.background)
         .strokeColor(styles.colors.border)
         .lineWidth(0.5)
         .rect(margins.left, y, columnWidth, 180)
         .fillAndStroke();
      
      let boxY = y + 10;
      doc.fillColor(styles.colors.primary)
         .font(styles.fonts.bold)
         .fontSize(styles.fontSize.heading)
         .text('PATIENT INFORMATION', margins.left + 10, boxY);
      
      boxY += 25;
      boxY = addField(doc, 'Name:', `${data.patientFirstName} ${data.patientLastName}`, margins.left + 10, boxY, columnWidth - 20);
      boxY = addField(doc, 'DOB:', data.patientDOB ? format(new Date(data.patientDOB), 'MM/dd/yyyy') : 'N/A', margins.left + 10, boxY, columnWidth - 20);
      boxY = addField(doc, 'MRN:', data.patientMRN || 'N/A', margins.left + 10, boxY, columnWidth - 20);
      
      // Provider Information Box (Right Column)
      const rightX = margins.left + columnWidth + 20;
      doc.fillColor(styles.colors.background)
         .rect(rightX, y, columnWidth, 180)
         .fillAndStroke();
      
      boxY = y + 10;
      doc.fillColor(styles.colors.primary)
         .font(styles.fonts.bold)
         .fontSize(styles.fontSize.heading)
         .text('PROVIDER INFORMATION', rightX + 10, boxY);
      
      boxY += 25;
      boxY = addField(doc, 'Care Manager:', data.created_by_name || 'N/A', rightX + 10, boxY, columnWidth - 20);
      boxY = addField(doc, 'Role:', data.created_by_role || 'N/A', rightX + 10, boxY, columnWidth - 20);
      boxY = addField(doc, 'Contact Date:', format(new Date(data.contact_date), 'MM/dd/yyyy'), rightX + 10, boxY, columnWidth - 20);
      boxY = addField(doc, 'Minutes Spent:', data.minutes ? `${data.minutes} minutes` : 'N/A', rightX + 10, boxY, columnWidth - 20);
      boxY = addField(doc, 'Safety Plan Discussed:', data.safetyPlanDiscussed ? 'Yes' : 'No', rightX + 10, boxY, columnWidth - 20);
      
      y += 200;
      
      // Current Symptoms Section
      y = addSectionHeader(doc, 'CURRENT SYMPTOMS', y);
      
      // Symptoms grid
      if (symptoms && typeof symptoms === 'object') {
        const symptomEntries = Object.entries(symptoms);
        if (symptomEntries.length > 0) {
          // Calculate grid layout
          const columns = 3;
          const itemWidth = contentWidth / columns;
          const itemHeight = 25;
          const rows = Math.ceil(symptomEntries.length / columns);
          
          // Ensure space for symptoms grid
          y = ensureSpace(doc, rows * itemHeight + 20);
          
          // Create grid background
          doc.fillColor(styles.colors.background)
             .strokeColor(styles.colors.border)
             .lineWidth(0.5)
             .rect(margins.left, y, contentWidth, rows * itemHeight)
             .fillAndStroke();
          
          // Fill grid with symptoms
          symptomEntries.forEach((entry, index) => {
            const [key, value] = entry;
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = margins.left + (column * itemWidth) + 5;
            const cellY = y + (row * itemHeight) + 7;
            
            // Create text width measurement to align indicator
            const labelText = formatLabel(key) + ":";
            
            // Display key with bold formatting
            doc.font(styles.fonts.bold)
               .fontSize(styles.fontSize.small)
               .fillColor(styles.colors.text)
               .text(labelText, x, cellY, { continued: true });
            
            // Get approximate width of the label (for indicator positioning)
            const labelWidth = doc.widthOfString(labelText);
            
            // If symptom is present (Yes), highlight it
            if (value) {
              // Add highlighted Yes text
              doc.font(styles.fonts.bold)
                 .fillColor(styles.colors.primary)
                 .text(' Yes', { continued: false });
                
                // Add indicator dot at consistent position
                doc.fillColor(styles.colors.accent)
                   .circle(x + labelWidth + 25, cellY + 4, 3)
                   .fill();
            } else {
              // Normal formatting for No values
              doc.font(styles.fonts.normal)
                 .fillColor(styles.colors.text)
                 .text(' No');
            }
          });
          
          y += rows * itemHeight + 10;
        } else {
          doc.text('No symptoms recorded', margins.left, y);
          y += 20;
        }
      } else {
        doc.text('No symptoms recorded', margins.left, y);
        y += 20;
      }
      
      // Check for Columbia Suicide Severity & Anxiety/Panic Attacks
      if (data.columbiaSuicideSeverity || data.anxietyPanicAttacks) {
        // Ensure sufficient space for both boxes (or start a new page)
        y = ensureSpace(doc, 120);
        
        const boxWidth = contentWidth / 2 - 10;
        const boxHeight = 100; // Increased height
        
        if (data.columbiaSuicideSeverity) {
          // Measure text to determine needed box height
          doc.font(styles.fonts.normal).fontSize(styles.fontSize.normal);
          const textHeight = doc.heightOfString(data.columbiaSuicideSeverity, { width: boxWidth - 20 });
          const dynamicHeight = Math.max(boxHeight, textHeight + 40); // Add padding
          
          addInfoBox(
            doc,
            'Columbia Suicide Severity Rating Scale',
            data.columbiaSuicideSeverity,
            margins.left,
            y,
            boxWidth,
            dynamicHeight,
            styles.colors.lightAmber
          );
          
          if (data.anxietyPanicAttacks) {
            // Ensure both boxes have the same height
            addInfoBox(
              doc,
              'Anxiety or Panic Attacks',
              data.anxietyPanicAttacks,
              margins.left + boxWidth + 20,
              y,
              boxWidth,
              dynamicHeight,
              styles.colors.lightBlue
            );
          }
          
          y += dynamicHeight + 30; // More spacing after the boxes
        } else if (data.anxietyPanicAttacks) {
          // Full width box just for anxiety
          doc.font(styles.fonts.normal).fontSize(styles.fontSize.normal);
          const textHeight = doc.heightOfString(data.anxietyPanicAttacks, { width: contentWidth - 20 });
          const dynamicHeight = Math.max(boxHeight, textHeight + 40);
          
          addInfoBox(
            doc,
            'Anxiety or Panic Attacks',
            data.anxietyPanicAttacks,
            margins.left,
            y,
            contentWidth,
            dynamicHeight,
            styles.colors.lightBlue
          );
          
          y += dynamicHeight + 30;
        }
      }
      
      // Past Mental Health History
      y = ensureSpace(doc, 150);
      y = addSectionHeader(doc, 'PAST MENTAL HEALTH HISTORY', y);
      
      if (pastMentalHealth && typeof pastMentalHealth === 'object') {
        const entries = Object.entries(pastMentalHealth);
        if (entries.length > 0) {
          // Create two-column layout for past mental health
          const columns = 2;
          const colWidth = contentWidth / columns;
          const rowHeight = 25;
          const rows = Math.ceil(entries.length / columns);
          
          // Ensure space for mental health grid
          y = ensureSpace(doc, rows * rowHeight + 20);
          
          // Create background
          doc.fillColor(styles.colors.background)
             .strokeColor(styles.colors.border)
             .lineWidth(0.5)
             .rect(margins.left, y, contentWidth, rows * rowHeight)
             .fillAndStroke();
          
          // Fill with mental health history items
          entries.forEach((entry, index) => {
            const [key, value] = entry;
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = margins.left + (column * colWidth) + 10;
            const itemY = y + (row * rowHeight) + 7;
            
            doc.font(styles.fonts.bold)
               .fontSize(styles.fontSize.small)
               .fillColor(styles.colors.text)
               .text(formatLabel(key) + ":", x, itemY, { continued: true });
               
            doc.font(styles.fonts.normal)
               .text(` ${formatBoolean(value)}`);
          });
          
          y += rows * rowHeight + 10;
        }
        
        // Add psychiatric hospitalizations if present
        if (data.psychiatricHospitalizations) {
          y = ensureSpace(doc, 60);
          
          addInfoBox(
            doc,
            'Psychiatric Hospitalizations',
            data.psychiatricHospitalizations,
            margins.left,
            y,
            contentWidth,
            50,
            styles.colors.lightBlue
          );
          
          y += 60;
        }
      } else {
        doc.text('No past mental health history recorded', margins.left, y);
        y += 20;
      }
      
      // Substance Use section with table
      y = ensureSpace(doc, 150);
      y = addSectionHeader(doc, 'SUBSTANCE USE', y);
      
      if (substanceUse && typeof substanceUse === 'object') {
        const entries = Object.entries(substanceUse);
        if (entries.length > 0) {
          // Create a table for substance use
          const tableY = y;
          const rowHeight = 25;
          const headerHeight = 30;
          const colWidths = [contentWidth * 0.6, contentWidth * 0.2, contentWidth * 0.2];
          const tableWidth = contentWidth;
          
          // Draw table header
          doc.fillColor(styles.colors.primary)
             .rect(margins.left, tableY, tableWidth, headerHeight)
             .fill();
             
          doc.fillColor('white')
             .font(styles.fonts.bold)
             .fontSize(styles.fontSize.normal);
             
          // Draw header text with proper alignment
          doc.text('Substance', margins.left + 5, tableY + 10, { width: colWidths[0], align: 'left' });
          doc.text('Current Use', margins.left + colWidths[0] + 5, tableY + 10, { width: colWidths[1], align: 'center' });
          doc.text('Past Use', margins.left + colWidths[0] + colWidths[1] + 5, tableY + 10, { width: colWidths[2], align: 'center' });
          
          // Draw table rows
          doc.fillColor(styles.colors.text)
             .font(styles.fonts.normal)
             .fontSize(styles.fontSize.small);
             
          let rowY = tableY + headerHeight;
          let needNewPage = false;
          
          entries.forEach((entry, index) => {
            const [key, value] = entry;
            
            // Check if we need a new page for this row
            if (rowY + rowHeight > pageHeight - margins.bottom) {
              doc.addPage();
              rowY = addHeader(doc);
              
              // Redraw the table header on new page
              doc.fillColor(styles.colors.primary)
                 .rect(margins.left, rowY, tableWidth, headerHeight)
                 .fill();
                 
              doc.fillColor('white')
                 .font(styles.fonts.bold)
                 .fontSize(styles.fontSize.normal);
                 
              // Redraw header text with proper alignment
              doc.text('Substance', margins.left + 5, rowY + 10, { width: colWidths[0], align: 'left' });
              doc.text('Current Use', margins.left + colWidths[0] + 5, rowY + 10, { width: colWidths[1], align: 'center' });
              doc.text('Past Use', margins.left + colWidths[0] + colWidths[1] + 5, rowY + 10, { width: colWidths[2], align: 'center' });
              
              rowY += headerHeight;
              needNewPage = true;
              
              doc.fillColor(styles.colors.text)
                 .font(styles.fonts.normal)
                 .fontSize(styles.fontSize.small);
            }
            
            // Draw row background (alternating)
            if (index % 2 === 0) {
              doc.fillColor(styles.colors.background)
                 .rect(margins.left, rowY, tableWidth, rowHeight)
                 .fill();
            }
            
            // Draw cell content
            doc.fillColor(styles.colors.text);
            
            // Substance name
            doc.text(formatLabel(key), margins.left + 5, rowY + 7, { width: colWidths[0], align: 'left' });
            
            // Current use - draw in its own column
            const currentUseX = margins.left + colWidths[0];
            doc.text(value.current ? 'X' : '—', currentUseX + 5, rowY + 7, { width: colWidths[1], align: 'center' });
            
            // Past use - draw in its own column
            const pastUseX = margins.left + colWidths[0] + colWidths[1];
            doc.text(value.past ? 'X' : '—', pastUseX + 5, rowY + 7, { width: colWidths[2], align: 'center' });
            
            // Draw row border
            doc.strokeColor(styles.colors.border)
               .lineWidth(0.5)
               .rect(margins.left, rowY, tableWidth, rowHeight)
               .stroke();
            
            rowY += rowHeight;
          });
          
          // Draw vertical lines for columns
          doc.strokeColor(styles.colors.border)
             .lineWidth(0.5);
             
          // Line between 1st and 2nd column
          let lineX = margins.left + colWidths[0];
          doc.moveTo(lineX, tableY)
             .lineTo(lineX, rowY)
             .stroke();
             
          // Line between 2nd and 3rd column
          lineX = margins.left + colWidths[0] + colWidths[1];
          doc.moveTo(lineX, tableY)
             .lineTo(lineX, rowY)
             .stroke();
          
          y = rowY + 20; // Add extra spacing after table
        } else {
          doc.text('No substance use recorded', margins.left, y);
          y += 20;
        }
      } else {
        doc.text('No substance use recorded', margins.left, y);
        y += 20;
      }
      
      // Medical History section
      y = ensureSpace(doc, 150);
      y = addSectionHeader(doc, 'MEDICAL HISTORY', y);
      
      if (medicalHistory && typeof medicalHistory === 'object') {
        const entries = Object.entries(medicalHistory);
        if (entries.length > 0) {
          // Create a grid layout for medical history
          const columns = 3;
          const colWidth = contentWidth / columns;
          const rowHeight = 25;
          const rows = Math.ceil(entries.length / columns);
          
          // Ensure space for medical history grid
          y = ensureSpace(doc, rows * rowHeight + 20);
          
          // Create background
          doc.fillColor(styles.colors.background)
             .strokeColor(styles.colors.border)
             .lineWidth(0.5)
             .rect(margins.left, y, contentWidth, rows * rowHeight)
             .fillAndStroke();
          
          // Fill with medical history items
          entries.forEach((entry, index) => {
            const [key, value] = entry;
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = margins.left + (column * colWidth) + 5;
            const itemY = y + (row * rowHeight) + 7;
            
            doc.font(styles.fonts.bold)
               .fontSize(styles.fontSize.small)
               .fillColor(styles.colors.text)
               .text(formatLabel(key) + ":", x, itemY, { continued: true });
               
            doc.font(styles.fonts.normal)
               .text(` ${formatBoolean(value)}`);
          });
          
          y += rows * rowHeight + 10;
        }
        
        // Add other medical history if present
        if (data.otherMedicalHistory) {
          y = ensureSpace(doc, 60);
          
          addInfoBox(
            doc,
            'Other Medical History',
            data.otherMedicalHistory,
            margins.left,
            y,
            contentWidth,
            50,
            styles.colors.lightGreen
          );
          
          y += 60;
        }
      } else {
        doc.text('No medical history recorded', margins.left, y);
        y += 20;
      }
      
      // Family Mental Health section
      y = ensureSpace(doc, 150);
      y = addSectionHeader(doc, 'FAMILY MENTAL HEALTH HISTORY', y);
      
      if (familyMentalHealth && typeof familyMentalHealth === 'object') {
        const entries = Object.entries(familyMentalHealth);
        if (entries.length > 0) {
          // Create a grid layout
          const columns = 2;
          const colWidth = contentWidth / columns;
          const rowHeight = 25;
          const rows = Math.ceil(entries.length / columns);
          
          // Ensure space for family mental health grid
          y = ensureSpace(doc, rows * rowHeight + 20);
          
          // Create background
          doc.fillColor(styles.colors.background)
             .strokeColor(styles.colors.border)
             .lineWidth(0.5)
             .rect(margins.left, y, contentWidth, rows * rowHeight)
             .fillAndStroke();
          
          // Fill with family mental health items
          entries.forEach((entry, index) => {
            const [key, value] = entry;
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = margins.left + (column * colWidth) + 5;
            const itemY = y + (row * rowHeight) + 7;
            
            doc.font(styles.fonts.bold)
               .fontSize(styles.fontSize.small)
               .fillColor(styles.colors.text)
               .text(formatLabel(key) + ":", x, itemY, { continued: true });
               
            doc.font(styles.fonts.normal)
               .text(` ${formatBoolean(value)}`);
          });
          
          y += rows * rowHeight + 10;
        } else {
          doc.text('No family mental health history recorded', margins.left, y);
          y += 20;
        }
      } else {
        doc.text('No family mental health history recorded', margins.left, y);
        y += 20;
      }
      
      // Social Situation section
      y = ensureSpace(doc, 150);
      y = addSectionHeader(doc, 'SOCIAL SITUATION', y);
      
      if (socialSituation && typeof socialSituation === 'object') {
        const entries = Object.entries(socialSituation);
        if (entries.length > 0) {
          // Create cards for each social situation item
          entries.forEach((entry, index) => {
            const [key, value] = entry;
            
            // Ensure space for each card
            y = ensureSpace(doc, 60);
            
            // Create card with alternating background colors
            const bgColor = index % 2 === 0 ? styles.colors.background : '#F9FAFB';
            
            addInfoBox(
              doc,
              formatLabel(key),
              value || 'N/A',
              margins.left,
              y,
              contentWidth,
              50,
              bgColor
            );
            
            y += 60;
          });
        } else {
          doc.text('No social situation recorded', margins.left, y);
          y += 20;
        }
      } else {
        doc.text('No social situation recorded', margins.left, y);
        y += 20;
      }
      
      // Medications section
      y = ensureSpace(doc, 160);
      y = addSectionHeader(doc, 'MEDICATIONS', y);
      
      // Current Medications
      y = ensureSpace(doc, 80);
      addInfoBox(
        doc,
        'Current Medications',
        data.currentMedications || 'None recorded',
        margins.left,
        y,
        contentWidth,
        70,
        styles.colors.lightBlue
      );
      
      y += 80;
      
      // Past Medications
      y = ensureSpace(doc, 80);
      addInfoBox(
        doc,
        'Past Medications Tried',
        data.pastMedications || 'None recorded',
        margins.left,
        y,
        contentWidth,
        70,
        styles.colors.lightGreen
      );
      
      y += 80;
      
      // Narrative section - always add it
      y = ensureSpace(doc, 200);
      y = addSectionHeader(doc, 'NARRATIVE', y);
      
      // Set reasonable height based on content
      const narrativeContent = data.narrative || 'No narrative provided.';
      doc.font(styles.fonts.normal).fontSize(styles.fontSize.normal);
      const narrativeTextHeight = doc.heightOfString(narrativeContent, { width: contentWidth - 20 });
      const narrativeHeight = Math.min(Math.max(100, narrativeTextHeight + 30), pageHeight - margins.bottom - y - 20);
      
      // Create a container for the narrative text
      doc.fillColor('#FAFAFA')
         .strokeColor(styles.colors.border)
         .lineWidth(0.5)
         .rect(margins.left, y, contentWidth, narrativeHeight)
         .fillAndStroke();
      
      doc.font(styles.fonts.normal)
         .fontSize(styles.fontSize.normal)
         .fillColor(styles.colors.text)
         .text(narrativeContent, margins.left + 10, y + 10, { width: contentWidth - 20 });
      
      y += narrativeHeight + 20;
      
      // First finish all content without finalizing
      doc.end();
      
      // Calculate the actual number of pages with content
      const range = doc.bufferedPageRange();
      const totalPages = range.count;
      
      // Now add page numbers to each page
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        
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
           .text('CONFIDENTIAL: This safety plan document contains protected health information.',
                margins.left, footerY + 5, { align: 'center', width: contentWidth });
        
        // Add page numbers
        doc.font(styles.fonts.normal)
           .fontSize(styles.fontSize.tiny)
           .fillColor(styles.colors.secondary)
           .text(`Page ${i + 1} of ${totalPages}`,
                margins.left, footerY + 15, { align: 'center', width: contentWidth });
      }
    } catch (pdfError) {
      console.error('Error creating PDF document:', pdfError);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'PDF generation error', details: pdfError.message });
      } else {
        return res.end();
      }
    }
  } catch (error) {
    console.error('Error exporting safety plan PDF:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
});

// Rest of your existing routes
// Create a new safety plan
router.post(
  '/safety-plan',
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
    body('safetyPlanDiscussed').isBoolean(),
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
      safetyPlanDiscussed, minutes,
    } = req.body;

    try {
      await db.query('START TRANSACTION');

      const formattedContactDate = format(new Date(contactDate), 'yyyy-MM-dd');

      const [result] = await db.query(
        `INSERT INTO safety_plans (
          patient_id, created_by, contact_date, symptoms_json, columbia_suicide_severity,
          anxiety_panic_attacks, past_mental_health_json, psychiatric_hospitalizations,
          substance_use_json, medical_history_json, other_medical_history,
          family_mental_health_json, social_situation_json, current_medications,
          past_medications, narrative, safety_plan_discussed, minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          patientId, createdBy, formattedContactDate, JSON.stringify(symptoms),
          columbiaSuicideSeverity || null, anxietyPanicAttacks || null,
          JSON.stringify(pastMentalHealth), psychiatricHospitalizations || null,
          JSON.stringify(substanceUse), JSON.stringify(medicalHistory),
          otherMedicalHistory || null, JSON.stringify(familyMentalHealth),
          JSON.stringify(socialSituation), currentMedications || null,
          pastMedications || null, narrative || null, safetyPlanDiscussed ? 1 : 0, minutes
        ]
      );

      const safetyPlanId = result.insertId;

      await db.query(
        `INSERT INTO minute_tracking (user_id, total_minutes, tracking_date) VALUES (?, ?, ?)`,
        [createdBy, minutes, formattedContactDate]
      );

      const [existingFlag] = await db.query(
        `SELECT * FROM patient_flags WHERE patient_id = ? AND flag = "Safety Plan"`,
        [patientId]
      );

      if (safetyPlanDiscussed && existingFlag.length) {
        await db.query(`DELETE FROM patient_flags WHERE patient_id = ? AND flag = "Safety Plan"`, [patientId]);
      } else if (!safetyPlanDiscussed && !existingFlag.length) {
        await db.query(`INSERT INTO patient_flags (patient_id, flag) VALUES (?, "Safety Plan")`, [patientId]);
      }

      await db.query('COMMIT');
      res.status(201).json({ id: safetyPlanId, message: 'Safety Plan created successfully' });
    } catch (error) {
      await db.query('ROLLBACK');
      console.error('Error creating safety plan:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
);

// Fetch latest safety plan
router.get('/safety-plan/:patientId/latest', async (req, res) => {
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
        narrative, safety_plan_discussed AS safetyPlanDiscussed,
        minutes, created_by AS createdBy, 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM safety_plans 
      WHERE patient_id = ? 
      ORDER BY contact_date DESC 
      LIMIT 1`,
      [patientId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'No safety plan found for this patient' });
    }

    const plan = rows[0];
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

    plan.symptoms = safeJSON(plan.symptoms);
    plan.pastMentalHealth = safeJSON(plan.pastMentalHealth);
    plan.substanceUse = safeJSON(plan.substanceUse);
    plan.medicalHistory = safeJSON(plan.medicalHistory);
    plan.familyMentalHealth = safeJSON(plan.familyMentalHealth);
    plan.socialSituation = safeJSON(plan.socialSituation);

    res.status(200).json(plan);
  } catch (error) {
    console.error('Error fetching safety plan:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;