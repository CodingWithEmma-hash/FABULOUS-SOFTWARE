const { pool } = require("../config/db");

// GET SETTINGS
exports.getSettings = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM hospital_settings WHERE id = 1 LIMIT 1`
        );

        let settings = rows[0] || {};

        const account = req.user ? {
            fullName: req.user.full_name,
            email: req.user.email,
            username: req.user.username,
            staffId: req.user.staff_id,
            role: req.user.role
        } : null;

        return res.status(200).json({
            success: true,
            hospital: {
                name: settings.hospital_name || "General Hospital, Ikot Ekpene",
                email: settings.hospital_email || "info@ghikotekpene.gov.ng",
                phone: settings.hospital_phone || "+234 803 000 1234",
                address: settings.hospital_address || "14 Hospital Road",
                city: settings.hospital_city || "Ikot Ekpene",
                state: settings.hospital_state || "Akwa Ibom"
            },
            system: {
                systemName: settings.system_name || "AI-Based Hospital Decision Support System",
                dateFormat: settings.date_format || "DD/MM/YYYY",
                language: settings.language || "English",
                timezone: settings.timezone || "Africa/Lagos",
                historyEnabled: settings.history_enabled !== 0
            },
            account
        });

    } catch (error) {
        console.error("Get settings error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve settings."
        });
    }
};

// SAVE HOSPITAL SETTINGS
exports.saveHospitalSettings = async (req, res) => {
    try {
        const { name, email, phone, address, city, state } = req.body;

        await pool.execute(
            `INSERT INTO hospital_settings (id, hospital_name, hospital_email, hospital_phone, hospital_address, hospital_city, hospital_state)
             VALUES (1, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                hospital_name = VALUES(hospital_name),
                hospital_email = VALUES(hospital_email),
                hospital_phone = VALUES(hospital_phone),
                hospital_address = VALUES(hospital_address),
                hospital_city = VALUES(hospital_city),
                hospital_state = VALUES(hospital_state)`,
            [
                name || "General Hospital, Ikot Ekpene",
                email || "info@ghikotekpene.gov.ng",
                phone || "+234 803 000 1234",
                address || "",
                city || "Ikot Ekpene",
                state || "Akwa Ibom"
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Hospital information saved successfully."
        });

    } catch (error) {
        console.error("Save hospital settings error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to save hospital information."
        });
    }
};

// SAVE SYSTEM PREFERENCES
exports.saveSystemSettings = async (req, res) => {
    try {
        const { systemName, dateFormat, language, timezone, historyEnabled } = req.body;

        await pool.execute(
            `INSERT INTO hospital_settings (id, system_name, date_format, language, timezone, history_enabled)
             VALUES (1, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                system_name = VALUES(system_name),
                date_format = VALUES(date_format),
                language = VALUES(language),
                timezone = VALUES(timezone),
                history_enabled = VALUES(history_enabled)`,
            [
                systemName || "AI-Based Hospital Decision Support System",
                dateFormat || "DD/MM/YYYY",
                language || "English",
                timezone || "Africa/Lagos",
                historyEnabled ? 1 : 0
            ]
        );

        return res.status(200).json({
            success: true,
            message: "System preferences saved successfully."
        });

    } catch (error) {
        console.error("Save system settings error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to save system preferences."
        });
    }
};
