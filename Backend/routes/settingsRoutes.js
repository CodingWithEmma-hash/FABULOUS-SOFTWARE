const express = require("express");
const router = express.Router();

const {
    getSettings,
    saveHospitalSettings,
    saveSystemSettings
} = require("../controllers/settingsController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getSettings);
router.post("/hospital", protect, saveHospitalSettings);
router.post("/system", protect, saveSystemSettings);

module.exports = router;
