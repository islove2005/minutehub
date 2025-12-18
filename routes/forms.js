const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database-sqlite');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get all forms (accessible by all authenticated users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [forms] = await pool.execute(`
      SELECT f.*, u.first_name, u.last_name 
      FROM forms f 
      JOIN users u ON f.created_by = u.id 
      WHERE f.is_active = TRUE 
      ORDER BY f.created_at DESC
    `);

    res.json(forms);
  } catch (error) {
    console.error('Get forms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get form by ID with fields
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const formId = req.params.id;

    // Get form details
    const [forms] = await pool.execute(
      'SELECT * FROM forms WHERE id = ? AND is_active = TRUE',
      [formId]
    );

    if (forms.length === 0) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Get form fields
    const [fields] = await pool.execute(
      'SELECT * FROM form_fields WHERE form_id = ? ORDER BY field_order',
      [formId]
    );

    res.json({
      ...forms[0],
      fields
    });
  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create form (Super Admin only)
router.post('/', authenticateToken, authorizeRoles('super_admin'), [
  body('title').trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('fields').isArray({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, fields } = req.body;
    const createdBy = req.user.id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Create form
      const [formResult] = await connection.execute(
        'INSERT INTO forms (title, description, created_by) VALUES (?, ?, ?)',
        [title, description, createdBy]
      );

      const formId = formResult.insertId;

      // Create form fields
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        await connection.execute(
          'INSERT INTO form_fields (form_id, field_name, field_type, field_label, field_options, is_required, field_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            formId,
            field.name,
            field.type,
            field.label,
            JSON.stringify(field.options || {}),
            field.required || false,
            i + 1
          ]
        );
      }

      await connection.commit();
      connection.release();

      res.status(201).json({
        message: 'Form created successfully',
        formId
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Create form error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update form (Super Admin only)
router.put('/:id', authenticateToken, authorizeRoles('super_admin'), [
  body('title').trim().isLength({ min: 1 }),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const formId = req.params.id;
    const { title, description } = req.body;

    const [result] = await pool.execute(
      'UPDATE forms SET title = ?, description = ? WHERE id = ?',
      [title, description, formId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json({ message: 'Form updated successfully' });
  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete form (Super Admin only)
router.delete('/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const formId = req.params.id;

    const [result] = await pool.execute(
      'UPDATE forms SET is_active = FALSE WHERE id = ?',
      [formId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Form not found' });
    }

    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;