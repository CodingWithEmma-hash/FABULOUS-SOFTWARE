
const DASHBOARD_API_URL = (/^https?:$/i.test(window.location.protocol) && ["", "80", "443", "8080"].includes(window.location.port) && /\/Frontend\//i.test(window.location.pathname))
    ? `${window.location.origin}${window.location.pathname.replace(/\/Frontend\/.*$/i, "/Backend/api")}`
    : "http://localhost:5001/api";

async function loadDashboardData() {
    const token = sessionStorage.getItem("hospitalToken");

    if (!token) return;

    try {
        const response = await fetch(
            `${DASHBOARD_API_URL}/dashboard`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to retrieve dashboard information.");
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Dashboard request failed.");
        }

        // Update statistics
        updateDashboardStats(data.stats);

        // Update recent activities
        updateRecentActivities(data.recentActivities);

        // Update clinical alerts
        updateClinicalAlerts(data.clinicalAlerts);

    } catch (error) {
        console.error("Dashboard loading error:", error);
    }
}


// ==========================================
// UPDATE STATISTICS
// ==========================================

function updateDashboardStats(stats) {
    if (!stats) return;

    const elements = {
        totalPatients: stats.totalPatients,
        totalAssessments: stats.totalAssessments,
        activeStaff: stats.activeStaff,
        clinicalAlerts: stats.clinicalAlerts
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = Number(value || 0).toLocaleString();
        }
    });

    // Update unread notification count
    const unreadElement = document.getElementById("sidebarUnread");

    if (unreadElement) {
        const unread = Number(stats.unreadNotifications || 0);

        unreadElement.textContent = unread;
        unreadElement.style.display = unread > 0 ? "" : "none";
    }
}


// ==========================================
// UPDATE RECENT ACTIVITIES
// ==========================================

function updateRecentActivities(activities) {
    const activityList = document.querySelector(".activity-list");

    if (!activityList) return;

    if (!activities || activities.length === 0) {
        activityList.innerHTML = `
            <p class="demo-note">No recent activities found.</p>
        `;
        return;
    }

    const icons = {
        LOGIN: "fa-right-to-bracket",
        LOGOUT: "fa-right-from-bracket",
        STAFF_REGISTRATION: "fa-user-plus",
        PATIENT_REGISTRATION: "fa-hospital-user",
        ASSESSMENT_CREATED: "fa-notes-medical",
        ASSESSMENT_UPDATED: "fa-clipboard-check"
    };

    activityList.innerHTML = activities.map(activity => {
        const icon = icons[activity.action] || "fa-clock";
        const date = new Date(activity.created_at);

        const time = date.toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
        });

        return `
            <div class="activity-item">
                <span class="activity-symbol clinical-symbol">
                    <i class="fa-solid ${icon}"></i>
                </span>

                <div>
                    <strong>${escapeDashboardText(activity.description)}</strong>
                    <small>${escapeDashboardText(activity.staff_name || "System user")}</small>
                </div>

                <time>${escapeDashboardText(time)}</time>
            </div>
        `;
    }).join("");
}


// ==========================================
// UPDATE CLINICAL ALERTS
// ==========================================

function updateClinicalAlerts(alerts) {
    const alertsPanel = document.querySelector(".alerts-panel");

    if (!alertsPanel) return;

    const heading = alertsPanel.querySelector(".panel-heading");

    if (!heading) return;

    // Remove previous alert items
    alertsPanel.querySelectorAll(".alert-item, .empty-alert-message")
        .forEach(element => element.remove());

    const badge = alertsPanel.querySelector(".alert-badge");

    const alertCount = alerts ? alerts.length : 0;

    if (badge) {
        badge.textContent = `${alertCount} requiring review`;
    }

    if (alertCount === 0) {
        const emptyMessage = document.createElement("p");

        emptyMessage.className = "empty-alert-message";
        emptyMessage.textContent = "There are currently no clinical alerts requiring review.";

        heading.insertAdjacentElement("afterend", emptyMessage);

        return;
    }

    alerts.forEach(alert => {
        const item = document.createElement("div");

        item.className = "alert-item";
        item.style.cursor = "pointer";

        const patientName = alert.patient_name || "Unknown patient";

        item.innerHTML = `
            <span class="alert-indicator urgent">
                <i class="fa-solid fa-exclamation"></i>
            </span>

            <div>
                <strong>${escapeDashboardText(alert.status)}</strong>
                <small>${escapeDashboardText(patientName)} — ${escapeDashboardText(alert.assessment_code)}</small>
            </div>
        `;

        item.addEventListener("click", () => {
            window.location.href = "history.html";
        });

        heading.insertAdjacentElement("afterend", item);
    });
}


// ==========================================
// SAFE TEXT OUTPUT
// ==========================================

function escapeDashboardText(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}


// ==========================================
// LOAD DASHBOARD
// ==========================================

// Role-based UI adjustments
function applyRoleRestrictions() {
    try {
        const rawUser = sessionStorage.getItem("hospitalUser");
        if (!rawUser) return;
        const user = JSON.parse(rawUser);
        if (user && user.role === "Administrator") {
            const quickActions = document.querySelectorAll(".quick-action");
            quickActions.forEach(btn => {
                const strong = btn.querySelector("strong");
                const small = btn.querySelector("small");
                if (strong && strong.textContent.includes("Run AI assessment")) {
                    strong.textContent = "Review Assessments";
                    if (small) small.textContent = "Inspect previous evaluations";
                    btn.setAttribute("onclick", "window.location.href='history.html'");
                }
            });
        }
    } catch (e) {}
}

loadDashboardData();
applyRoleRestrictions();
