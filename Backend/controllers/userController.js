const bcrypt = require("bcrypt");
const { pool } = require("../config/db");

function formatUser(u) {
    return {
        id: u.id,
        staffId: u.staff_id,
        fullName: u.full_name,
        username: u.username,
        email: u.email,
        phone: u.phone || "",
        role: u.role,
        status: u.status === "active" ? "Active" : "Inactive",
        createdAt: u.created_at
    };
}

// GET ALL USERS
exports.getUsers = async (req, res) => {
    try {
        const { search, role, status } = req.query;

        let query = `
            SELECT id, staff_id, full_name, username, email, phone, role, status, created_at
            FROM users
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (full_name LIKE ? OR username LIKE ? OR staff_id LIKE ? OR email LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        if (role && role !== "all" && role !== "All") {
            query += ` AND role = ?`;
            params.push(role);
        }

        if (status && status !== "all" && status !== "All") {
            const normalizedStatus = status.toLowerCase();
            query += ` AND status = ?`;
            params.push(normalizedStatus);
        }

        query += ` ORDER BY created_at DESC`;

        const [rows] = await pool.query(query, params);
        const users = rows.map(formatUser);

        // Calculate statistics
        const [[statsRow]] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN role = 'Administrator' THEN 1 ELSE 0 END) AS admins,
                SUM(CASE WHEN role = 'Pharmacist' THEN 1 ELSE 0 END) AS pharmacists
            FROM users
        `);

        return res.status(200).json({
            success: true,
            users,
            stats: {
                total: Number(statsRow.total || 0),
                active: Number(statsRow.active || 0),
                admins: Number(statsRow.admins || 0),
                pharmacists: Number(statsRow.pharmacists || 0)
            }
        });

    } catch (error) {
        console.error("Get users error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve user accounts."
        });
    }
};

// CREATE USER
exports.createUser = async (req, res) => {
    try {
        const {
            staffId,
            fullName,
            email,
            phone,
            username,
            password,
            role,
            status
        } = req.body;

        if (!staffId || !fullName || !email || !username || !password || !role) {
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

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedUsername = username.trim();
        const normalizedStaffId = staffId.trim();
        const normalizedStatus = status ? status.toLowerCase() : "active";

        const [existing] = await pool.execute(
            `SELECT id FROM users WHERE email = ? OR username = ? OR staff_id = ? LIMIT 1`,
            [normalizedEmail, normalizedUsername, normalizedStaffId]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "A staff account with this email, username or Staff ID already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await pool.execute(
            `INSERT INTO users (staff_id, full_name, email, phone, username, password_hash, role, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                normalizedStaffId,
                fullName.trim(),
                normalizedEmail,
                phone?.trim() || null,
                normalizedUsername,
                passwordHash,
                role,
                normalizedStatus
            ]
        );

        if (req.user) {
            await pool.execute(
                `INSERT INTO activity_logs (user_id, action, description)
                 VALUES (?, ?, ?)`,
                [
                    req.user.id,
                    "STAFF_REGISTRATION",
                    `Created staff account ${normalizedStaffId} (${fullName.trim()}).`
                ]
            );
        }

        return res.status(201).json({
            success: true,
            message: "User account created successfully.",
            userId: result.insertId
        });

    } catch (error) {
        console.error("Create user error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to create user account."
        });
    }
};

// UPDATE USER
exports.updateUser = async (req, res) => {
    try {
        const id = req.params.id;
        const {
            fullName,
            username,
            email,
            phone,
            role,
            status,
            password
        } = req.body;

        const [existing] = await pool.execute(
            `SELECT * FROM users WHERE id = ? OR staff_id = ? LIMIT 1`,
            [id, id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User account not found."
            });
        }

        const user = existing[0];
        const newName = fullName?.trim() || user.full_name;
        const newEmail = email?.trim().toLowerCase() || user.email;
        const newUsername = username?.trim() || user.username;
        const newPhone = phone !== undefined ? phone?.trim() : user.phone;
        const newRole = role || user.role;
        const newStatus = status ? status.toLowerCase() : user.status;

        let passwordHash = user.password_hash;
        if (password && password.trim().length >= 8) {
            passwordHash = await bcrypt.hash(password.trim(), 12);
        }

        await pool.execute(
            `UPDATE users
             SET full_name = ?,
                 email = ?,
                 username = ?,
                 phone = ?,
                 role = ?,
                 status = ?,
                 password_hash = ?
             WHERE id = ?`,
            [
                newName,
                newEmail,
                newUsername,
                newPhone || null,
                newRole,
                newStatus,
                passwordHash,
                user.id
            ]
        );

        if (req.user) {
            await pool.execute(
                `INSERT INTO activity_logs (user_id, action, description)
                 VALUES (?, ?, ?)`,
                [
                    req.user.id,
                    "USER_UPDATED",
                    `Updated user profile for ${user.staff_id} (${newName}).`
                ]
            );
        }

        return res.status(200).json({
            success: true,
            message: "User account updated successfully."
        });

    } catch (error) {
        console.error("Update user error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update user account."
        });
    }
};

// TOGGLE USER STATUS
exports.toggleUserStatus = async (req, res) => {
    try {
        const id = req.params.id;

        const [existing] = await pool.execute(
            `SELECT id, staff_id, full_name, status FROM users WHERE id = ? OR staff_id = ? LIMIT 1`,
            [id, id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const user = existing[0];
        const newStatus = user.status === "active" ? "inactive" : "active";

        await pool.execute(
            `UPDATE users SET status = ? WHERE id = ?`,
            [newStatus, user.id]
        );

        if (req.user) {
            await pool.execute(
                `INSERT INTO activity_logs (user_id, action, description)
                 VALUES (?, ?, ?)`,
                [
                    req.user.id,
                    "USER_STATUS_CHANGE",
                    `Changed status of ${user.staff_id} to ${newStatus}.`
                ]
            );
        }

        return res.status(200).json({
            success: true,
            message: `User status changed to ${newStatus === "active" ? "Active" : "Inactive"}.`,
            status: newStatus === "active" ? "Active" : "Inactive"
        });

    } catch (error) {
        console.error("Toggle user status error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update user status."
        });
    }
};

// DELETE USER
exports.deleteUser = async (req, res) => {
    try {
        const id = req.params.id;

        if (req.user && (req.user.id == id || req.user.staff_id == id)) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account."
            });
        }

        await pool.execute(
            `DELETE FROM users WHERE id = ? OR staff_id = ?`,
            [id, id]
        );

        return res.status(200).json({
            success: true,
            message: "User deleted successfully."
        });

    } catch (error) {
        console.error("Delete user error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to delete user."
        });
    }
};
