const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database-sqlite');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Submit form entry (Secretary only)
router.post('/', authenticateToken, authorizeRoles('secretary'), [
  body('formId').isInt(),
  body('minuteTitle').trim().isLength({ min: 1 }),
  body('entryData').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { formId, minuteTitle, entryData } = req.body;
    const submittedBy = req.user.id;

    // Verify form exists and is active
    const [forms] = await pool.execute(
      'SELECT id FROM forms WHERE id = ? AND is_active = TRUE',
      [formId]
    );

    if (forms.length === 0) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Insert entry
    const [result] = await pool.execute(
      'INSERT INTO form_entries (form_id, submitted_by, minute_title, entry_data) VALUES (?, ?, ?, ?)',
      [formId, submittedBy, minuteTitle, JSON.stringify(entryData)]
    );

    res.status(201).json({
      message: 'Entry submitted successfully',
      entryId: result.insertId
    });
  } catch (error) {
    console.error('Submit entry error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get entries for current user (Secretary)
router.get('/my-entries', authenticateToken, authorizeRoles('secretary'), async (req, res) => {
  try {
    const userId = req.user.id;

    const [entries] = await pool.execute(`
      SELECT fe.*, f.title as form_title 
      FROM form_entries fe 
      JOIN forms f ON fe.form_id = f.id 
      WHERE fe.submitted_by = ? 
      ORDER BY fe.submitted_at DESC
    `, [userId]);

    res.json(entries);
  } catch (error) {
    console.error('Get my entries error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all entries (Admin and Super Admin)
router.get('/', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const { formId } = req.query;
    
    let query = `
      SELECT fe.*, f.title as form_title, u.first_name, u.last_name 
      FROM form_entries fe 
      JOIN forms f ON fe.form_id = f.id 
      JOIN users u ON fe.submitted_by = u.id
    `;
    
    const params = [];
    
    if (formId) {
      query += ' WHERE fe.form_id = ?';
      params.push(formId);
    }
    
    query += ' ORDER BY fe.submitted_at DESC';

    const [entries] = await pool.execute(query, params);
    res.json(entries);
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single entry
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const entryId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = `
      SELECT fe.*, f.title as form_title, u.first_name, u.last_name 
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

    res.json(entries[0]);
  } catch (error) {
    console.error('Get entry error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete entry (Super Admin only)
router.delete('/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const entryId = req.params.id;

    const [result] = await pool.execute(
      'DELETE FROM form_entries WHERE id = ?',
      [entryId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;