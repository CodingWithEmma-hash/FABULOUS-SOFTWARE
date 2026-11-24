require("dotenv").config();

const bcrypt = require("bcrypt");
const { pool } = require("./config/db");

async function resetAdminPassword() {
    try {
        const username = process.env.ADMIN_USERNAME;
        const newPassword = process.env.ADMIN_PASSWORD;

        if (!username || !newPassword) {
            throw new Error("Admin username or password missing from .env");
        }

        if (newPassword.length < 12) {
            throw new Error("Admin password must be at least 12 characters.");
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        const [result] = await pool.execute(
            `UPDATE users
             SET password_hash = ?
             WHERE username = ? AND role = 'Administrator'`,
            [hashedPassword, username]
        );

        if (result.affectedRows === 0) {
            console.log("Administrator account not found.");
        } else {
            console.log("Administrator password reset successfully!");
        }

    } catch (error) {
        console.error("Password reset failed:", error.message);
    } finally {
        await pool.end();
    }
}

resetAdminPassword();