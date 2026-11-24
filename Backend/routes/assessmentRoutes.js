const express = require("express");
const router = express.Router();

const {
    createAssessment,
    getAssessments,
    getAssessmentById,
    deleteAssessment
} = require("../controllers/assessmentController");
const { protect } = require("../middleware/authMiddleware");

// Middleware to restrict Administrator role from creating or performing AI assessments
function disallowAdministrator(req, res, next) {
    if (req.user && req.user.role === "Administrator") {
        return res.status(403).json({
            success: false,
            message: "Administrators are not permitted to create or perform clinical AI assessments. Only clinical healthcare staff may conduct assessments."
        });
    }
    next();
}

router.post("/", protect, disallowAdministrator, createAssessment);
router.get("/", protect, getAssessments);
router.get("/:id", protect, getAssessmentById);
router.delete("/:id", protect, deleteAssessment);

module.exports = router;
