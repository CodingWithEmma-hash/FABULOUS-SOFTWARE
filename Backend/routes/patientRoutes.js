const express = require("express");
const router = express.Router();

const {
    registerPatient,
    getPatients,
    getPatientById,
    updatePatient,
    deletePatient
} = require("../controllers/patientController");
const { protect } = require("../middleware/authMiddleware");

// All patient endpoints require authentication
router.post("/register", protect, registerPatient);
router.get("/", protect, getPatients);
router.get("/:id", protect, getPatientById);
router.put("/:id", protect, updatePatient);
router.delete("/:id", protect, deletePatient);

module.exports = router;
