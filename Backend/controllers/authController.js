const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

const allowedRoles = [
    "Administrator",
    "Doctor",
    "Pharmacist",
    "Nurse",
    "Staff"
];

// Generate JWT token
function generateToken(user) {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured.");
    }

    return jwt.sign(
        {
            id: user.id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "8h"
        }
    );
}

// Remove password hash from user data
function publicUser(user) {
    return {
        id: user.id,
        staffId: user.staff_id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        role: user.role,
        status: user.status
    };
}

// STAFF LOGIN
exports.login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: "Username/email and password are required."
            });
        }

        const [users] = await pool.execute(
            `SELECT * FROM users
             WHERE username = ?
                OR email = ?
                OR staff_id = ?
             LIMIT 1`,
            [identifier, identifier, identifier]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid login credentials."
            });
        }

        const user = users[0];

        if (user.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "This account is inactive. Contact an administrator."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid login credentials."
            });
        }

        const token = generateToken(user);

        // Record successful login
        await pool.execute(
            `INSERT INTO activity_logs (user_id, action, description)
             VALUES (?, ?, ?)`,
            [user.id, "LOGIN", "User logged in successfully."]
        );

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            user: publicUser(user)
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to complete login."
        });
    }
};

// REGISTER STAFF
exports.register = async (req, res) => {
    try {
        const {
            staffId,
            fullName,
            email,
            phone,
            username,
            password,
            role
        } = req.body;

        if (
            !staffId ||
            !fullName ||
            !email ||
            !username ||
            !password ||
            !role
        ) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid staff role."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedUsername = username.trim();
        const normalizedStaffId = staffId.trim();

        const [existingUsers] = await pool.execute(
            `SELECT id FROM users
             WHERE email = ? OR username = ? OR staff_id = ?
             LIMIT 1`,
            [
                normalizedEmail,
                normalizedUsername,
                normalizedStaffId
            ]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email, username or staff ID already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await pool.execute(
            `INSERT INTO users
             (staff_id, full_name, email, phone, username, password_hash, role)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                normalizedStaffId,
                fullName.trim(),
                normalizedEmail,
                phone || null,
                normalizedUsername,
                passwordHash,
                role
            ]
        );

        const userId = req.user ? req.user.id : null;
        if (userId) {
            await pool.execute(
                `INSERT INTO activity_logs
                 (user_id, action, description)
                 VALUES (?, ?, ?)`,
                [
                    userId,
                    "STAFF_REGISTRATION",
                    `Created staff account ${normalizedStaffId}.`
                ]
            );
        }

        return res.status(201).json({
            success: true,
            message: "Staff account created successfully.",
            userId: result.insertId
        });

    } catch (error) {
        console.error("Staff registration error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to register staff account."
        });
    }
};

// GET LOGGED-IN USER
exports.getMe = async (req, res) => {
    try {
        const [users] = await pool.execute(
            `SELECT id, staff_id, full_name, email, phone,
                    username, role, status
             FROM users
             WHERE id = ?
             LIMIT 1`,
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User account not found."
            });
        }

        if (users[0].status !== "active") {
            return res.status(403).json({
                success: false,
                message: "This account is inactive."
            });
        }

        return res.status(200).json({
            success: true,
            user: publicUser(users[0])
        });

    } catch (error) {
        console.error("Get user error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve user information."
        });
    }
};

// LOGOUT
exports.logout = async (req, res) => {
    try {
        if (req.user) {
            await pool.execute(
                `INSERT INTO activity_logs
                 (user_id, action, description)
                 VALUES (?, ?, ?)`,
                [req.user.id, "LOGOUT", "User logged out."]
            );
        }

        return res.status(200).json({
            success: true,
            message: "Logout recorded. Please clear the token in your browser."
        });

    } catch (error) {
        console.error("Logout error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to record logout."
        });
    }
};

// UPDATE PROFILE
exports.updateProfile = async (req, res) => {
    try {
        const { fullName, email, username } = req.body;

        if (!fullName || !email || !username) {
            return res.status(400).json({
                success: false,
                message: "Full name, email, and username are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedUsername = username.trim();

        const [conflict] = await pool.execute(
            `SELECT id FROM users
             WHERE (email = ? OR username = ?) AND id != ?
             LIMIT 1`,
            [normalizedEmail, normalizedUsername, req.user.id]
        );

        if (conflict.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email or username is already taken by another account."
            });
        }

        await pool.execute(
            `UPDATE users
             SET full_name = ?,
                 email = ?,
                 username = ?
             WHERE id = ?`,
            [fullName.trim(), normalizedEmail, normalizedUsername, req.user.id]
        );

        const [updated] = await pool.execute(
            `SELECT * FROM users WHERE id = ? LIMIT 1`,
            [req.user.id]
        );

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            user: publicUser(updated[0])
        });

    } catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update profile."
        });
    }
};

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required."
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 8 characters."
            });
        }

        const [rows] = await pool.execute(
            `SELECT password_hash FROM users WHERE id = ? LIMIT 1`,
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User account not found."
            });
        }

        const passwordMatches = await bcrypt.compare(
            currentPassword,
            rows[0].password_hash
        );

        if (!passwordMatches) {
            return res.status(400).json({
                success: false,
                message: "Current password does not match our records."
            });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);

        await pool.execute(
            `UPDATE users SET password_hash = ? WHERE id = ?`,
            [passwordHash, req.user.id]
        );

        await pool.execute(
            `INSERT INTO activity_logs (user_id, action, description)
             VALUES (?, ?, ?)`,
            [req.user.id, "PASSWORD_CHANGED", "User changed account password."]
        );

        return res.status(200).json({
            success: true,
            message: "Password changed successfully."
        });

    } catch (error) {
        console.error("Change password error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to change password."
        });
    }
};
