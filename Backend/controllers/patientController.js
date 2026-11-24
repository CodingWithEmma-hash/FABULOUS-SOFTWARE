const { pool } = require("../config/db");
const crypto = require("crypto");

// Generate a unique patient ID
function generatePatientId() {
    const year = new Date().getFullYear();
    const randomCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    return `PAT-${year}-${randomCode}`;
}

// Format patient response object
function formatPatient(p) {
    let formattedDob = "";
    if (p.date_of_birth) {
        if (typeof p.date_of_birth === "string") {
            formattedDob = p.date_of_birth.split("T")[0];
        } else if (p.date_of_birth instanceof Date) {
            formattedDob = p.date_of_birth.toISOString().split("T")[0];
        }
    }

    return {
        id: p.id,
        patientId: p.patient_id,
        fullName: p.full_name,
        name: p.full_name,
        dob: formattedDob,
        dateOfBirth: formattedDob,
        gender: p.gender,
        phone: p.phone,
        email: p.email || "",
        address: p.residential_address,
        residentialAddress: p.residential_address,
        emergencyName: p.contact_person,
        contactPerson: p.contact_person,
        relationship: p.relationship,
        emergencyPhone: p.emergency_phone,
        bloodGroup: p.blood_group || "Unknown",
        genotype: p.genotype || "Unknown",
        allergies: p.allergies || "None",
        medicalHistory: p.medical_history || "None",
        createdAt: p.created_at
    };
}

// REGISTER NEW PATIENT
exports.registerPatient = async (req, res) => {
    let connection;

    try {
        const {
            fullName,
            dob,
            gender,
            phone,
            email,
            address,
            emergencyName,
            relationship,
            emergencyPhone,
            bloodGroup,
            genotype,
            allergies,
            medicalHistory
        } = req.body;

        if (
            !fullName?.trim() ||
            !dob ||
            !gender ||
            !phone?.trim() ||
            !address?.trim() ||
            !emergencyName?.trim() ||
            !relationship ||
            !emergencyPhone?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required patient information."
            });
        }

        if (!["Male", "Female", "Other"].includes(gender)) {
            return res.status(400).json({
                success: false,
                message: "Invalid gender selection."
            });
        }

        const birthDate = new Date(`${dob}T00:00:00`);
        if (
            Number.isNaN(birthDate.getTime()) ||
            dob > new Date().toISOString().split("T")[0]
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid date of birth."
            });
        }

        const phonePattern = /^[0-9+\-\s()]{7,20}$/;
        if (!phonePattern.test(phone) || !phonePattern.test(emergencyPhone)) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid phone numbers."
            });
        }

        const normalizedEmail = email?.trim().toLowerCase() || null;
        if (
            normalizedEmail &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        const patientId = generatePatientId();

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `INSERT INTO patients (
                patient_id,
                full_name,
                date_of_birth,
                gender,
                phone,
                email,
                residential_address,
                contact_person,
                relationship,
                emergency_phone,
                blood_group,
                genotype,
                allergies,
                medical_history,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                patientId,
                fullName.trim(),
                dob,
                gender,
                phone.trim(),
                normalizedEmail,
                address.trim(),
                emergencyName.trim(),
                relationship,
                emergencyPhone.trim(),
                bloodGroup || null,
                genotype || null,
                allergies?.trim() || null,
                medicalHistory?.trim() || null,
                req.user ? req.user.id : null
            ]
        );

        // Record patient registration activity
        if (req.user) {
            await connection.execute(
                `INSERT INTO activity_logs (user_id, action, description)
                 VALUES (?, ?, ?)`,
                [
                    req.user.id,
                    "PATIENT_REGISTRATION",
                    `Registered patient ${patientId} - ${fullName.trim()}.`
                ]
            );
        }

        // Create a notification for the system
        await connection.execute(
            `INSERT INTO notifications (recipient_id, title, message, type, priority)
             VALUES (?, ?, ?, 'patient', 'medium')`,
            [
                req.user ? req.user.id : null,
                "New Patient Registered",
                `Patient ${fullName.trim()} (${patientId}) has been registered.`
            ]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Patient registered successfully.",
            patient: {
                id: result.insertId,
                patientId,
                fullName: fullName.trim(),
                gender,
                phone: phone.trim()
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error("Patient registration error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to register patient. Please try again."
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// GET ALL PATIENTS
exports.getPatients = async (req, res) => {
    try {
        const { search, gender } = req.query;

        let query = `
            SELECT id, patient_id, full_name, date_of_birth, gender, phone, email,
                   residential_address, contact_person, relationship, emergency_phone,
                   blood_group, genotype, allergies, medical_history, created_at
            FROM patients
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (full_name LIKE ? OR patient_id LIKE ? OR phone LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        if (gender && gender !== "all" && gender !== "All") {
            query += ` AND gender = ?`;
            params.push(gender);
        }

        query += ` ORDER BY created_at DESC`;

        const [rows] = await pool.query(query, params);

        const patients = rows.map(formatPatient);

        // Overall stats
        const [[statsRow]] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) AS male,
                SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) AS female,
                SUM(CASE WHEN gender NOT IN ('Male', 'Female') THEN 1 ELSE 0 END) AS other
            FROM patients
        `);

        return res.status(200).json({
            success: true,
            patients,
            stats: {
                total: Number(statsRow.total || 0),
                male: Number(statsRow.male || 0),
                female: Number(statsRow.female || 0),
                other: Number(statsRow.other || 0)
            }
        });

    } catch (error) {
        console.error("Get patients error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve patient records."
        });
    }
};

// GET SINGLE PATIENT BY ID
exports.getPatientById = async (req, res) => {
    try {
        const id = req.params.id;

        const [rows] = await pool.execute(
            `SELECT * FROM patients WHERE id = ? OR patient_id = ? LIMIT 1`,
            [id, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient record not found."
            });
        }

        return res.status(200).json({
            success: true,
            patient: formatPatient(rows[0])
        });

    } catch (error) {
        console.error("Get patient error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve patient information."
        });
    }
};

// UPDATE PATIENT
exports.updatePatient = async (req, res) => {
    try {
        const id = req.params.id;
        const {
            name,
            fullName,
            gender,
            phone,
            dob,
            dateOfBirth,
            email,
            address,
            residentialAddress
        } = req.body;

        const patientName = (fullName || name || "").trim();
        const patientPhone = (phone || "").trim();
        const patientDob = dob || dateOfBirth;
        const patientAddress = (address || residentialAddress || "").trim();

        if (!patientName || !gender || !patientPhone || !patientDob) {
            return res.status(400).json({
                success: false,
                message: "Name, gender, phone, and date of birth are required."
            });
        }

        const [result] = await pool.execute(
            `UPDATE patients
             SET full_name = ?,
                 gender = ?,
                 phone = ?,
                 date_of_birth = ?,
                 email = ?,
                 residential_address = ?
             WHERE id = ? OR patient_id = ?`,
            [
                patientName,
                gender,
                patientPhone,
                patientDob,
                email?.trim() || null,
                patientAddress || null,
                id,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient not found or no changes made."
            });
        }

        if (req.user) {
            await pool.execute(
                `INSERT INTO activity_logs (user_id, action, description)
                 VALUES (?, ?, ?)`,
                [
                    req.user.id,
                    "PATIENT_UPDATED",
                    `Updated record for patient ${patientName}.`
                ]
            );
        }

        return res.status(200).json({
            success: true,
            message: "Patient record updated successfully."
        });

    } catch (error) {
        console.error("Update patient error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update patient record."
        });
    }
};

// DELETE PATIENT
exports.deletePatient = async (req, res) => {
    try {
        const id = req.params.id;

        const [existing] = await pool.execute(
            `SELECT patient_id, full_name FROM patients WHERE id = ? OR patient_id = ? LIMIT 1`,
            [id, id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Patient record not found."
            });
        }

        await pool.execute(
            `DELETE FROM patients WHERE id = ? OR patient_id = ?`,
            [id, id]
        );

        if (req.user) {
            await pool.execute(
                `INSERT INTO activity_logs (user_id, action, description)
                 VALUES (?, ?, ?)`,
                [
                    req.user.id,
                    "PATIENT_DELETED",
                    `Deleted patient record ${existing[0].patient_id} (${existing[0].full_name}).`
                ]
            );
        }

        return res.status(200).json({
            success: true,
            message: "Patient record deleted successfully."
        });

    } catch (error) {
        console.error("Delete patient error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to delete patient record."
        });
    }
};
