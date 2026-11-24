
const { pool } = require("../config/db");

// GET DASHBOARD DATA
exports.getDashboard = async (req, res) => {
    try {
        const userId = req.user.id;

        const [
            [patientCount],
            [assessmentCount],
            [alertCount],
            [staffCount],
            [notificationCount],
            [recentActivities],
            [recentPatients],
            [clinicalAlerts]
        ] = await Promise.all([

            // Total registered patients
            pool.execute(
                "SELECT COUNT(*) AS total FROM patients"
            ),

            // Total assessments
            pool.execute(
                "SELECT COUNT(*) AS total FROM assessments"
            ),

            // Assessments requiring clinical review
            pool.execute(
                `SELECT COUNT(*) AS total
                 FROM assessments
                 WHERE status IN (
                    'Clinical Review Required',
                    'Prompt Clinical Review Required'
                 )`
            ),

            // Active staff members
            pool.execute(
                "SELECT COUNT(*) AS total FROM users WHERE status = 'active'"
            ),

            // Unread notifications for logged-in user
            pool.execute(
                `SELECT COUNT(*) AS total
                 FROM notifications
                 WHERE recipient_id = ? AND is_read = 0`,
                [userId]
            ),

            // Latest system activities
            pool.execute(
                `SELECT
                    a.id,
                    a.action,
                    a.description,
                    a.created_at,
                    u.full_name AS staff_name
                 FROM activity_logs a
                 LEFT JOIN users u ON a.user_id = u.id
                 ORDER BY a.created_at DESC
                 LIMIT 5`
            ),

            // Recently registered patients
            pool.execute(
                `SELECT
                    id,
                    patient_id,
                    full_name,
                    gender,
                    created_at
                 FROM patients
                 ORDER BY created_at DESC
                 LIMIT 5`
            ),

            // Latest assessments requiring clinical review
            pool.execute(
                `SELECT
                    a.id,
                    a.assessment_code,
                    a.status,
                    a.assessment_date,
                    p.full_name AS patient_name,
                    p.patient_id
                 FROM assessments a
                 LEFT JOIN patients p ON a.patient_id = p.id
                 WHERE a.status IN (
                    'Clinical Review Required',
                    'Prompt Clinical Review Required'
                 )
                 ORDER BY a.assessment_date DESC
                 LIMIT 5`
            )
        ]);

        return res.status(200).json({
            success: true,
            message: "Dashboard data retrieved successfully.",

            stats: {
                totalPatients: Number(patientCount[0].total),
                totalAssessments: Number(assessmentCount[0].total),
                clinicalAlerts: Number(alertCount[0].total),
                activeStaff: Number(staffCount[0].total),
                unreadNotifications: Number(notificationCount[0].total)
            },

            recentActivities,
            recentPatients,
            clinicalAlerts
        });

    } catch (error) {
        console.error("Dashboard data error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve dashboard information."
        });
    }
};
