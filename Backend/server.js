const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const { pool, testDatabaseConnection } = require("./config/db");
const { initializeDatabase } = require("./config/initDb");

const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const patientRoutes = require("./routes/patientRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const reportRoutes = require("./routes/reportRoutes");
const settingsRoutes = require("./routes/settingsRoutes");

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: false
}));

// CORS allowing localhost / local development ports
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, or file://)
        // or any localhost / 127.0.0.1 origin
        if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);

// Home route
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Hospital Decision Support System API is running."
    });
});

// Database health check
app.get("/api/health", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS database_status");

        res.status(200).json({
            success: true,
            message: "Backend and MySQL are connected successfully.",
            database: rows[0].database_status === 1
                ? "Connected"
                : "Disconnected"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Database connection error."
        });
    }
});

// Start server
async function startServer() {
    await testDatabaseConnection();
    await initializeDatabase();

    app.listen(PORT, () => {
        console.log(`Hospital DSS server running at http://localhost:${PORT}`);
    });
}

startServer();
