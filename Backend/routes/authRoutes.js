const express = require("express");
const router = express.Router();

const {
    login,
    register,
    getMe,
    logout,
    updateProfile,
    changePassword
} = require("../controllers/authController");

const {
    protect,
    authorize
} = require("../middleware/authMiddleware");

// Public route
router.post("/login", login);

// Protected routes
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

// Registration can be done by logged in Administrator or authenticated staff
router.post(
    "/register",
    protect,
    authorize("Administrator"),
    register
);

module.exports = router;
