
const crypto = require("crypto");
const { pool } = require("../config/db");
const {
    generateClinicalAssessment
} = require("../services/geminiService");

// Generate a unique assessment reference.
function generateAssessmentCode() {
    return `ASM-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

// Convert optional numeric fields safely.
function numberOrNull(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

// Convert stored JSON text back into arrays.
function parseArray(value) {
    if (!value) return [];

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [value];
    }
}

// Format an assessment for the frontend.
function formatAssessment(a) {
    return {
        id: a.id,
        dbId: a.id,
        assessmentCode: a.assessment_code,
        patientId: a.patient_code || a.patient_id,
        patientCode: a.patient_code,
        patientName: a.patient_name,
        gender: a.gender || null,
        dateOfBirth: a.date_of_birth || null,
        phone: a.patient_phone || a.phone || null,
        bloodGroup: a.blood_group || null,
        genotype: a.genotype || null,
        date: a.assessment_date,
        assessmentDate: a.assessment_date,
        clinician: a.clinician_name || "",
        ageGroup: a.age_group,
        symptoms: a.symptoms,
        duration: a.symptom_duration,
        severity: a.severity,
        temperature: a.temperature,
        bloodPressure: a.blood_pressure,
        pulse: a.pulse_rate,
        respiratoryRate: a.respiratory_rate,
        oxygen: a.oxygen_saturation,
        weight: a.weight,
        medicalHistory: a.medical_history,
        medications: a.medications,
        observations: parseArray(a.observations),
        aiSummary: a.ai_summary,
        recommendations: parseArray(a.recommendations),
        warningSigns: parseArray(a.warning_signs),
        aiReviewPriority: a.ai_review_priority,
        status: a.status,
        reviewNotes: a.review_notes,
        reviewedBy: a.reviewed_by,
        reviewedAt: a.reviewed_at,
        createdAt: a.created_at
    };
}

// Server-side safety checks.
function performSafetyChecks(data) {
    const alerts = [];

    const temperature = data.temperature;
    const pulse = data.pulse;
    const respiratoryRate = data.respiratoryRate;
    const oxygen = data.oxygen;

    if (temperature !== null && temperature >= 40) {
        alerts.push("Very high temperature recorded (40°C or above).");
    }

    if (pulse !== null && (pulse > 130 || pulse < 40)) {
        alerts.push("Potentially concerning pulse rate recorded.");
    }

    if (
        respiratoryRate !== null &&
        (respiratoryRate > 30 || respiratoryRate < 8)
    ) {
        alerts.push("Potentially concerning respiratory rate recorded.");
    }

    if (oxygen !== null && oxygen <= 90) {
        alerts.push("Low oxygen saturation recorded (90% or below).");
    }

    if (
        temperature !== null &&
        temperature >= 38 &&
        temperature < 40
    ) {
        alerts.push("Elevated temperature recorded.");
    }

    if (oxygen !== null && oxygen > 90 && oxygen < 94) {
        alerts.push("Oxygen saturation is below 94%.");
    }

    return alerts;
}

// CREATE ASSESSMENT
exports.createAssessment = async (req, res) => {
    // Restrict Administrator role from creating or performing AI assessments
    if (req.user && req.user.role === "Administrator") {
        return res.status(403).json({
            success: false,
            message: "Administrators are not permitted to create or perform clinical AI assessments. Only clinical healthcare staff (Doctors, Nurses) may conduct assessments."
        });
    }

    let connection;

    try {
        const {
            patientId,
            ageGroup,
            symptoms,
            duration,
            severity,
            temperature,
            bloodPressure,
            pulse,
            respiratoryRate,
            respiratory,
            oxygen,
            weight,
            medicalHistory,
            medications,
            assessmentDate
        } = req.body;

        if (!patientId || !symptoms || !String(symptoms).trim()) {
            return res.status(400).json({
                success: false,
                message: "Patient and symptoms are required."
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Find the patient using either database ID or patient code.
        const [patients] = await connection.execute(
            `SELECT id, patient_id, full_name
             FROM patients
             WHERE id = ? OR patient_id = ?
             LIMIT 1`,
            [patientId, patientId]
        );

        if (!patients.length) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Patient record not found."
            });
        }

        const patient = patients[0];

        const assessmentData = {
            patientName: patient.full_name,
            patientCode: patient.patient_id,
            ageGroup: ageGroup || "",
            symptoms: String(symptoms).trim(),
            duration: duration || "",
            severity: severity || "",
            temperature: numberOrNull(temperature),
            bloodPressure: bloodPressure || "",
            pulse: numberOrNull(pulse),
            respiratoryRate: numberOrNull(
                respiratoryRate ?? respiratory
            ),
            oxygen: numberOrNull(oxygen),
            weight: numberOrNull(weight),
            medicalHistory: medicalHistory || "",
            medications: medications || ""
        };

        // Apply server-side safety checks.
        const safetyAlerts = performSafetyChecks(assessmentData);

        // Ask Gemini to generate preliminary decision support.
        let aiResult;

        try {
            aiResult = await generateClinicalAssessment({
                ...assessmentData
            });
        } catch (aiError) {
            console.error("Gemini assessment error:", aiError.message);

            await connection.rollback();

            return res.status(502).json({
                success: false,
                message: "The AI assessment could not be generated. Please try again.",
                error: aiError.message
            });
        }

        // Combine server-side alerts and AI warning signs.
        const warningSigns = [
            ...new Set([
                ...safetyAlerts,
                ...aiResult.warning_signs
            ])
        ];

        // The server controls the final review status.
        const isUrgent =
            safetyAlerts.length > 0 ||
            aiResult.suggested_review_priority === "Urgent";

        const status = isUrgent
            ? "Prompt Clinical Review Required"
            : "Clinical Review Required";

        const reviewPriority = isUrgent
            ? "Urgent"
            : aiResult.suggested_review_priority;

        const observations = [
            ...aiResult.observations,
            ...safetyAlerts
        ];

        const recommendations = aiResult.recommendations;

        const assessmentCode = generateAssessmentCode();

        const date = assessmentDate
            ? new Date(assessmentDate)
            : new Date();

        if (Number.isNaN(date.getTime())) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Invalid assessment date."
            });
        }

        // Save the assessment and Gemini results.
        const [insertResult] = await connection.execute(
            `INSERT INTO assessments (
                assessment_code,
                patient_id,
                clinician_id,
                assessment_date,
                age_group,
                symptoms,
                symptom_duration,
                severity,
                temperature,
                blood_pressure,
                pulse_rate,
                respiratory_rate,
                oxygen_saturation,
                weight,
                medical_history,
                medications,
                observations,
                ai_summary,
                recommendations,
                warning_signs,
                ai_review_priority,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                assessmentCode,
                patient.id,
                req.user.id,
                date,
                assessmentData.ageGroup,
                assessmentData.symptoms,
                assessmentData.duration,
                assessmentData.severity,
                assessmentData.temperature,
                assessmentData.bloodPressure,
                assessmentData.pulse,
                assessmentData.respiratoryRate,
                assessmentData.oxygen,
                assessmentData.weight,
                assessmentData.medicalHistory,
                assessmentData.medications,
                JSON.stringify(observations),
                aiResult.clinical_summary,
                JSON.stringify(recommendations),
                JSON.stringify(warningSigns),
                reviewPriority,
                status
            ]
        );

        const assessmentId = insertResult.insertId;

        // Record system activity.
        await connection.execute(
            `INSERT INTO activity_logs
             (user_id, action, description, ip_address)
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                "Assessment Created",
                `Assessment ${assessmentCode} created for ${patient.full_name}.`,
                req.ip
            ]
        );

        // Notify the clinician about the assessment.
        await connection.execute(
            `INSERT INTO notifications
             (title, message, type, priority, recipient_id, assessment_id, patient_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                "New AI Assessment",
                `An AI-assisted assessment has been generated for ${patient.full_name}. Clinical review is required.`,
                "assessment",
                isUrgent ? "high" : "medium",
                req.user.id,
                assessmentId,
                patient.id
            ]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "AI-assisted assessment generated and saved successfully.",
            assessment: {
                id: assessmentId,
                assessmentCode,
                patientId: patient.id,
                patientCode: patient.patient_id,
                patientName: patient.full_name,
                assessmentDate: date,
                clinician: req.user.fullName || req.user.full_name || "",
                observations,
                aiSummary: aiResult.clinical_summary,
                recommendations,
                warningSigns,
                aiReviewPriority: reviewPriority,
                status,
                vitalSigns: {
                    temperature: assessmentData.temperature,
                    bloodPressure: assessmentData.bloodPressure,
                    pulse: assessmentData.pulse,
                    respiratoryRate: assessmentData.respiratoryRate,
                    oxygen: assessmentData.oxygen,
                    weight: assessmentData.weight
                }
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Create assessment error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create assessment.",
            error: error.message
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// GET ALL ASSESSMENTS
exports.getAssessments = async (req, res) => {
    try {
        const {
            search,
            status,
            startDate,
            endDate
        } = req.query;

        let sql = `
            SELECT
                a.*,
                p.patient_id AS patient_code,
                p.full_name AS patient_name,
                p.gender,
                p.date_of_birth,
                p.phone AS patient_phone,
                p.blood_group,
                p.genotype,
                u.full_name AS clinician_name
            FROM assessments a
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN users u ON a.clinician_id = u.id
            WHERE 1 = 1
        `;

        const params = [];

        if (search) {
            sql += ` AND (
                a.assessment_code LIKE ?
                OR p.patient_id LIKE ?
                OR p.full_name LIKE ?
                OR a.symptoms LIKE ?
            )`;

            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        if (status) {
            sql += " AND a.status = ?";
            params.push(status);
        }

        if (startDate) {
            sql += " AND DATE(a.assessment_date) >= ?";
            params.push(startDate);
        }

        if (endDate) {
            sql += " AND DATE(a.assessment_date) <= ?";
            params.push(endDate);
        }

        sql += " ORDER BY a.assessment_date DESC";

        const [rows] = await pool.execute(sql, params);

        const [stats] = await pool.execute(`
            SELECT
                COUNT(*) AS total,
                SUM(status = 'Pending Review') AS pending,
                SUM(status = 'Clinical Review Required') AS clinicalReview,
                SUM(status = 'Prompt Clinical Review Required') AS urgentReview,
                SUM(status = 'Reviewed') AS reviewed
            FROM assessments
        `);

        return res.json({
            success: true,
            assessments: rows.map(formatAssessment),
            stats: stats[0]
        });

    } catch (error) {
        console.error("Get assessments error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve assessments."
        });
    }
};

// GET ONE ASSESSMENT
exports.getAssessmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.execute(
            `SELECT
                a.*,
                p.patient_id AS patient_code,
                p.full_name AS patient_name,
                p.gender,
                p.date_of_birth,
                p.phone AS patient_phone,
                p.blood_group,
                p.genotype,
                u.full_name AS clinician_name
             FROM assessments a
             LEFT JOIN patients p ON a.patient_id = p.id
             LEFT JOIN users u ON a.clinician_id = u.id
             WHERE a.id = ? OR a.assessment_code = ?
             LIMIT 1`,
            [id, id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Assessment not found."
            });
        }

        return res.json({
            success: true,
            assessment: formatAssessment(rows[0])
        });

    } catch (error) {
        console.error("Get assessment error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve assessment."
        });
    }
};

// DELETE ASSESSMENT
exports.deleteAssessment = async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { id } = req.params;

        const [rows] = await connection.execute(
            `SELECT id, assessment_code
             FROM assessments
             WHERE id = ? OR assessment_code = ?
             LIMIT 1`,
            [id, id]
        );

        if (!rows.length) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Assessment not found."
            });
        }

        const assessment = rows[0];

        await connection.execute(
            "DELETE FROM notifications WHERE assessment_id = ?",
            [assessment.id]
        );

        await connection.execute(
            "DELETE FROM assessments WHERE id = ?",
            [assessment.id]
        );

        await connection.execute(
            `INSERT INTO activity_logs
             (user_id, action, description, ip_address)
             VALUES (?, ?, ?, ?)`,
            [
                req.user.id,
                "Assessment Deleted",
                `Assessment ${assessment.assessment_code} deleted.`,
                req.ip
            ]
        );

        await connection.commit();

        return res.json({
            success: true,
            message: "Assessment deleted successfully."
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Delete assessment error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to delete assessment."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};
