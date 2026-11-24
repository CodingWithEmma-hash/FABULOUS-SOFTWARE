const express = require("express");
const router = express.Router();

const {
    getUsers,
    createUser,
    updateUser,
    toggleUserStatus,
    deleteUser
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");

// User management endpoints
router.get("/", protect, getUsers);
router.post("/", protect, authorize("Administrator"), createUser);
router.put("/:id", protect, authorize("Administrator"), updateUser);
router.patch("/:id/status", protect, authorize("Administrator"), toggleUserStatus);
router.delete("/:id", protect, authorize("Administrator"), deleteUser);

module.exports = router;
