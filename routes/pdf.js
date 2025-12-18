const express = require('express');
const { pool } = require('../config/database-sqlite');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Generate PDF for entry
router.get('/entries/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const entryId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = `
      SELECT fe.*, f.title as form_title, f.description as form_description,
             u.first_name, u.last_name 
      FROM form_entries fe 
      JOIN forms f ON fe.form_id = f.id 
      JOIN users u ON fe.submitted_by = u.id 
      WHERE fe.id = ?
    `;
    
    const params = [entryId];

    // Secretaries can only view their own entries
    if (userRole === 'secretary') {
      query += ' AND fe.submitted_by = ?';
      params.push(userId);
    }

    const [entries] = await pool.execute(query, params);

    if (entries.length === 0) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    const entry = entries[0];

    // Get form fields for better formatting
    const [fields] = await pool.execute(
      'SELECT * FROM form_fields WHERE form_id = ? ORDER BY field_order',
      [entry.form_id]
    );

    // Generate HTML content for PDF
    const htmlContent = generatePDFHTML(entry, fields);

    // Try to use Puppeteer if available, otherwise return HTML
    try {
      const puppeteer = require('puppeteer');
      
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent);
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      await browser.close();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="entry-${entryId}.pdf"`);
      res.send(pdf);
      
    } catch (error) {
      console.log('Puppeteer not available, serving HTML preview');
      // Fallback to HTML if Puppeteer is not installed
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
    }

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
});

function generatePDFHTML(entry, fields) {
  const entryData = JSON.parse(entry.entry_data);
  
  let fieldsHTML = '';
  fields.forEach(field => {
    if (field.field_type === 'section') {
      fieldsHTML += `
        <div class="section-header">
          <h3>${field.field_label}</h3>
        </div>
      `;
    } else {
      const value = entryData[field.field_name] || 'N/A';
      fieldsHTML += `
        <div class="field-row">
          <strong>${field.field_label}:</strong>
          <span>${value}</span>
        </div>
      `;
    }
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Meeting Minutes - ${entry.minute_title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .subtitle { font-size: 18px; color: #666; }
        .meta-info { margin: 20px 0; padding: 15px; background-color: #f5f5f5; }
        .field-row { margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
        .field-row strong { display: inline-block; width: 200px; }
        .section-header { margin: 25px 0 15px 0; }
        .section-header h3 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
        .print-button { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #007cba; color: white; border: none; border-radius: 5px; cursor: pointer; }
        @media print {
          .print-button { display: none; }
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <button class="print-button" onclick="window.print()">🖨️ Print PDF</button>
      <div class="header">
        <div class="title">International Central Gospel Church</div>
        <div class="subtitle">Meeting Minutes</div>
      </div>
      
      <div class="meta-info">
        <div class="field-row">
          <strong>Minute Title:</strong>
          <span>${entry.minute_title}</span>
        </div>
        <div class="field-row">
          <strong>Form:</strong>
          <span>${entry.form_title}</span>
        </div>
        <div class="field-row">
          <strong>Submitted By:</strong>
          <span>${entry.first_name} ${entry.last_name}</span>
        </div>
        <div class="field-row">
          <strong>Date Submitted:</strong>
          <span>${new Date(entry.submitted_at).toLocaleString()}</span>
        </div>
      </div>

      <div class="content">
        ${fieldsHTML}
      </div>

      <div class="footer">
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>© ${new Date().getFullYear()} International Central Gospel Church</p>
      </div>
    </body>
    </html>
  `;
}

module.exports = router;