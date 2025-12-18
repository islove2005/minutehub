-- MinuteHub Database Schema
-- Run this SQL script on your GoDaddy database

CREATE DATABASE IF NOT EXISTS minutehub_db;
USE minutehub_db;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('super_admin', 'admin', 'secretary') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Forms table
CREATE TABLE forms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Form fields table
CREATE TABLE form_fields (
    id INT PRIMARY KEY AUTO_INCREMENT,
    form_id INT NOT NULL,
    field_name VARCHAR(255) NOT NULL,
    field_type ENUM('text', 'textarea', 'rich_text', 'name', 'email', 'phone', 'datetime', 'signature', 'dropdown', 'section') NOT NULL,
    field_label VARCHAR(255) NOT NULL,
    field_options JSON,
    is_required BOOLEAN DEFAULT FALSE,
    field_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
);

-- Form entries table
CREATE TABLE form_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    form_id INT NOT NULL,
    submitted_by INT NOT NULL,
    minute_title VARCHAR(255),
    entry_data JSON NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES forms(id),
    FOREIGN KEY (submitted_by) REFERENCES users(id)
);

-- Insert default super admin user (password: 'password')
INSERT INTO users (email, password, first_name, last_name, role) 
VALUES ('admin@icgc.org', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Super', 'Admin', 'super_admin');

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_forms_created_by ON forms(created_by);
CREATE INDEX idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX idx_form_entries_form_id ON form_entries(form_id);
CREATE INDEX idx_form_entries_submitted_by ON form_entries(submitted_by);