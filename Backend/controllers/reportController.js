const { pool } = require("../config/db");

exports.getReportData = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // 1. Patient statistics
        const [[patientStats]] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) AS male,
                SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) AS female,
                SUM(CASE WHEN gender NOT IN ('Male', 'Female') THEN 1 ELSE 0 END) AS other
            FROM patients
        `);

        // 2. Assessments filtered by date
        let query = `
            SELECT a.*, p.full_name AS lookup_patient_name
            FROM assessments a
            LEFT JOIN patients p ON a.patient_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            query += ` AND a.assessment_date >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND a.assessment_date <= ?`;
            params.push(endDate);
        }

        query += ` ORDER BY a.assessment_date DESC`;

        const [assessmentsRows] = await pool.query(query, params);

        let promptCount = 0;
        let standardCount = 0;

        const assessments = assessmentsRows.map(a => {
            let dateStr = "";
            if (a.assessment_date) {
                if (typeof a.assessment_date === "string") {
                    dateStr = a.assessment_date.split("T")[0];
                } else if (a.assessment_date instanceof Date) {
                    dateStr = a.assessment_date.toISOString().split("T")[0];
                }
            }

            const isPrompt = a.status && a.status.includes("Prompt");
            if (isPrompt) promptCount++;
            else standardCount++;

            return {
                id: a.assessment_code || `ASM${a.id}`,
                code: a.assessment_code,
                patientId: a.patient_code || String(a.patient_id),
                patientName: a.patient_name || a.lookup_patient_name || "Unknown Patient",
                date: dateStr,
                clinician: a.clinician || "Staff Clinician",
                severity: a.severity || "Moderate",
                status: a.status || "Clinical Review Required",
                observations: a.observations || "",
                recommendations: a.recommendations || ""
            };
        });

        return res.status(200).json({
            success: true,
            summary: {
                totalPatients: Number(patientStats.total || 0),
                totalAssessments: assessments.length,
                clinicalReviews: standardCount,
                promptReviews: promptCount
            },
            genderStats: {
                male: Number(patientStats.male || 0),
                female: Number(patientStats.female || 0),
                other: Number(patientStats.other || 0)
            },
            statusStats: {
                prompt: promptCount,
                clinical: standardCount
            },
            assessments
        });

    } catch (error) {
        console.error("Report data error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to generate report data."
        });
    }
};
