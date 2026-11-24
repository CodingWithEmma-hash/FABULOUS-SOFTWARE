const { pool } = require("../config/db");

function formatNotification(n) {
    return {
        id: `NOT${String(n.id).padStart(3, "0")}`,
        dbId: n.id,
        title: n.title,
        message: n.message,
        type: n.type || "system",
        priority: n.priority || "low",
        read: Boolean(n.is_read),
        isRead: Boolean(n.is_read),
        createdAt: n.created_at
    };
}

// GET NOTIFICATIONS
exports.getNotifications = async (req, res) => {
    try {
        const { search, type, priority, status } = req.query;

        let query = `
            SELECT id, title, message, type, priority, is_read, created_at
            FROM notifications
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (title LIKE ? OR message LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s);
        }

        if (type && type !== "all" && type !== "All") {
            query += ` AND type = ?`;
            params.push(type.toLowerCase());
        }

        if (priority && priority !== "all" && priority !== "All") {
            query += ` AND priority = ?`;
            params.push(priority.toLowerCase());
        }

        if (status && status !== "all" && status !== "All") {
            if (status.toLowerCase() === "unread") {
                query += ` AND is_read = 0`;
            } else if (status.toLowerCase() === "read") {
                query += ` AND is_read = 1`;
            }
        }

        query += ` ORDER BY created_at DESC LIMIT 50`;

        const [rows] = await pool.query(query, params);
        const notifications = rows.map(formatNotification);

        const [[statsRow]] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread,
                SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) AS highPriority,
                SUM(CASE WHEN type = 'system' THEN 1 ELSE 0 END) AS systemUpdates
            FROM notifications
        `);

        return res.status(200).json({
            success: true,
            notifications,
            stats: {
                total: Number(statsRow.total || 0),
                unread: Number(statsRow.unread || 0),
                highPriority: Number(statsRow.highPriority || 0),
                systemUpdates: Number(statsRow.systemUpdates || 0)
            }
        });

    } catch (error) {
        console.error("Get notifications error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to retrieve notifications."
        });
    }
};

// GET UNREAD COUNT
exports.getUnreadCount = async (req, res) => {
    try {
        const [[statsRow]] = await pool.query(`
            SELECT COUNT(*) AS unread FROM notifications WHERE is_read = 0
        `);

        return res.status(200).json({
            success: true,
            unread: Number(statsRow.unread || 0)
        });

    } catch (error) {
        return res.status(200).json({ success: true, unread: 0 });
    }
};

// MARK AS READ
exports.markAsRead = async (req, res) => {
    try {
        const id = req.params.id.replace(/^NOT/i, "");

        await pool.execute(
            `UPDATE notifications SET is_read = 1 WHERE id = ?`,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: "Notification marked as read."
        });

    } catch (error) {
        console.error("Mark notification read error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update notification."
        });
    }
};

// MARK ALL AS READ
exports.markAllAsRead = async (req, res) => {
    try {
        await pool.execute(
            `UPDATE notifications SET is_read = 1 WHERE is_read = 0`
        );

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read."
        });

    } catch (error) {
        console.error("Mark all notifications read error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update notifications."
        });
    }
};

// DELETE NOTIFICATION
exports.deleteNotification = async (req, res) => {
    try {
        const id = req.params.id.replace(/^NOT/i, "");

        await pool.execute(
            `DELETE FROM notifications WHERE id = ?`,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: "Notification deleted."
        });

    } catch (error) {
        console.error("Delete notification error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to delete notification."
        });
    }
};
