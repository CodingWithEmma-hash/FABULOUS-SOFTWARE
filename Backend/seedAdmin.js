require("dotenv").config();

const bcrypt = require("bcrypt");
const { pool } = require("./config/db");

async function createAdmin() {
    try {
        const {
            ADMIN_STAFF_ID,
            ADMIN_FULL_NAME,
            ADMIN_EMAIL,
            ADMIN_USERNAME,
            ADMIN_PASSWORD
        } = process.env;

        if (
            !ADMIN_STAFF_ID ||
            !ADMIN_FULL_NAME ||
            !ADMIN_EMAIL ||
            !ADMIN_USERNAME ||
            !ADMIN_PASSWORD
        ) {
            throw new Error("Complete all ADMIN settings in your .env file.");
        }

        if (ADMIN_PASSWORD.length < 12) {
            throw new Error("Administrator password must be at least 12 characters.");
        }

        const [existing] = await pool.execute(
            `SELECT id FROM users
             WHERE username = ? OR email = ? OR staff_id = ?
             LIMIT 1`,
            [
                ADMIN_USERNAME,
                ADMIN_EMAIL.toLowerCase(),
                ADMIN_STAFF_ID
            ]
        );

        if (existing.length > 0) {
            console.log("An account with these administrator details already exists.");
            return;
        }

        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

        await pool.execute(
            `INSERT INTO users
             (staff_id, full_name, email, username, password_hash, role, status)
             VALUES (?, ?, ?, ?, ?, 'Administrator', 'active')`,
            [
                ADMIN_STAFF_ID,
                ADMIN_FULL_NAME,
                ADMIN_EMAIL.toLowerCase(),
                ADMIN_USERNAME,
                passwordHash
            ]
        );

        console.log("Administrator account created successfully.");
        console.log("Username:", ADMIN_USERNAME);
        console.log("Log in using the administrator password in your .env file.");

    } catch (error) {
        console.error("Administrator setup failed:", error.message);
        process.exitCode = 1;

    } finally {
        await pool.end();
    }
}

createAdmin();