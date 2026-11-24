const { pool } = require("./db");

async function initializeDatabase() {
    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                staff_id VARCHAR(50) UNIQUE NOT NULL,
                full_name VARCHAR(150) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                phone VARCHAR(30),
                username VARCHAR(80) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('Administrator', 'Doctor', 'Pharmacist', 'Nurse', 'Staff') NOT NULL DEFAULT 'Staff',
                status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Patients table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS patients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                patient_id VARCHAR(50) UNIQUE NOT NULL,
                full_name VARCHAR(150) NOT NULL,
                date_of_birth DATE NOT NULL,
                gender ENUM('Male', 'Female', 'Other') NOT NULL,
                phone VARCHAR(30) NOT NULL,
                email VARCHAR(150),
                residential_address TEXT NOT NULL,
                contact_person VARCHAR(150) NOT NULL,
                relationship VARCHAR(50) NOT NULL,
                emergency_phone VARCHAR(30) NOT NULL,
                blood_group VARCHAR(10),
                genotype VARCHAR(10),
                allergies TEXT,
                medical_history TEXT,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_patient_id (patient_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 3. Assessments table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS assessments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                assessment_code VARCHAR(50) UNIQUE NOT NULL,
                patient_id INT,
                patient_code VARCHAR(50),
                patient_name VARCHAR(150),
                clinician_id INT,
                clinician VARCHAR(150) NOT NULL,
                age_group VARCHAR(50) NOT NULL,
                symptoms TEXT NOT NULL,
                duration VARCHAR(50),
                severity VARCHAR(50) DEFAULT 'Moderate',
                temperature DECIMAL(4, 1),
                blood_pressure VARCHAR(30),
                pulse INT,
                respiratory_rate INT,
                oxygen INT,
                weight DECIMAL(5, 1),
                medical_history TEXT,
                medications TEXT,
                observations TEXT,
                recommendations TEXT,
                status VARCHAR(80) NOT NULL DEFAULT 'Clinical Review Required',
                assessment_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_assessment_code (assessment_code),
                INDEX idx_patient_id (patient_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. Notifications table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                recipient_id INT,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'system',
                priority ENUM('low', 'medium', 'high') DEFAULT 'low',
                is_read TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_recipient (recipient_id),
                INDEX idx_is_read (is_read)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 5. Activity logs table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                action VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 6. Hospital Settings table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS hospital_settings (
                id INT PRIMARY KEY,
                hospital_name VARCHAR(200) DEFAULT 'General Hospital, Ikot Ekpene',
                hospital_email VARCHAR(150) DEFAULT 'info@ghikotekpene.gov.ng',
                hospital_phone VARCHAR(50) DEFAULT '+234 803 000 1234',
                hospital_address TEXT,
                hospital_city VARCHAR(100) DEFAULT 'Ikot Ekpene',
                hospital_state VARCHAR(100) DEFAULT 'Akwa Ibom',
                system_name VARCHAR(200) DEFAULT 'AI-Based Hospital Decision Support System',
                date_format VARCHAR(50) DEFAULT 'DD/MM/YYYY',
                language VARCHAR(50) DEFAULT 'English',
                timezone VARCHAR(50) DEFAULT 'Africa/Lagos',
                history_enabled TINYINT(1) DEFAULT 1,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Insert default row in hospital_settings if missing
        await connection.query(`
            INSERT IGNORE INTO hospital_settings (id, hospital_name, hospital_email, hospital_phone, hospital_address, hospital_city, hospital_state)
            VALUES (1, 'General Hospital, Ikot Ekpene', 'info@ghikotekpene.gov.ng', '+234 803 000 1234', '14 Hospital Road', 'Ikot Ekpene', 'Akwa Ibom');
        `);

        console.log("Database tables initialized successfully.");
    } catch (error) {
        console.error("Database initialization notice:", error.message);
    } finally {
        if (connection) connection.release();
    }
}

module.exports = { initializeDatabase };
