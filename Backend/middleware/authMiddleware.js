const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

// Verify login token
exports.protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in."
            });
        }

        const token = authHeader.split(" ")[1];

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Authentication configuration error."
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const [users] = await pool.execute(
            `SELECT id, staff_id, full_name, email,
                    username, role, status
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [decoded.id]
        );

        if (users.length === 0 || users[0].status !== "active") {
            return res.status(401).json({
                success: false,
                message: "Your account is unavailable. Please log in again."
            });
        }

        req.user = users[0];

        next();

    } catch (error) {
        if (
            error.name === "TokenExpiredError" ||
            error.name === "JsonWebTokenError"
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired login token."
            });
        }

        console.error("Authentication error:", error);

        return res.status(500).json({
            success: false,
            message: "Authentication failed."
        });
    }
};


// Check user role
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to perform this action."
            });
        }

        next();
    };
};