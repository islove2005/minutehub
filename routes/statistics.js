const express = require('express');
const { pool } = require('../config/database-sqlite');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get statistics (Admin and Super Admin)
router.get('/', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    // Get total forms
    const [formsCount] = await pool.execute(
      'SELECT COUNT(*) as total FROM forms WHERE is_active = TRUE'
    );

    // Get total entries
    const [entriesCount] = await pool.execute(
      'SELECT COUNT(*) as total FROM form_entries'
    );

    // Get total users by role
    const [usersCount] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN role = 'super_admin' THEN 1 ELSE 0 END) as super_admins,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN role = 'secretary' THEN 1 ELSE 0 END) as secretaries,
        SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_users
      FROM users
    `);

    // Get entries per form
    const [entriesPerForm] = await pool.execute(`
      SELECT f.id, f.title, COUNT(fe.id) as entry_count
      FROM forms f
      LEFT JOIN form_entries fe ON f.id = fe.form_id
      WHERE f.is_active = TRUE
      GROUP BY f.id, f.title
      ORDER BY entry_count DESC
    `);

    // Get recent activity
    const [recentEntries] = await pool.execute(`
      SELECT fe.id, fe.minute_title, fe.submitted_at, f.title as form_title, 
             u.first_name, u.last_name
      FROM form_entries fe
      JOIN forms f ON fe.form_id = f.id
      JOIN users u ON fe.submitted_by = u.id
      ORDER BY fe.submitted_at DESC
      LIMIT 10
    `);

    res.json({
      totalForms: formsCount[0].total,
      totalEntries: entriesCount[0].total,
      totalUsers: usersCount[0].total,
      superAdmins: usersCount[0].super_admins,
      admins: usersCount[0].admins,
      secretaries: usersCount[0].secretaries,
      activeUsers: usersCount[0].active_users,
      entriesPerForm,
      recentActivity: recentEntries
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;