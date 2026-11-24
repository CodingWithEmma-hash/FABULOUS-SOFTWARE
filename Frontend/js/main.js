// ==========================================
// DASHBOARD USER INFORMATION
// ==========================================

const storedUser = sessionStorage.getItem("hospitalUser");

let currentUser = null;

try {
    currentUser = storedUser ? JSON.parse(storedUser) : null;
} catch (error) {
    console.error("Unable to read logged-in user:", error);
}

const displayName = currentUser?.fullName || "Hospital Staff";

// Display logged-in user's name
const userName = document.getElementById("userName");
const welcomeName = document.getElementById("welcomeName");

if (userName) {
    userName.textContent = displayName;
}

if (welcomeName) {
    welcomeName.textContent = displayName;
}

// Display user initials in avatar
const avatar = document.querySelector(".avatar");

if (avatar) {
    const initials = displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("");

    avatar.textContent = initials || "HS";
}

// ==========================================
// DISPLAY CURRENT DATE
// ==========================================

const todayDate = document.getElementById("todayDate");
const welcomeDate = document.querySelector(".welcome-row .eyebrow");

const now = new Date();

if (todayDate) {
    todayDate.textContent = now.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

if (welcomeDate) {
    welcomeDate.textContent = now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    }).toUpperCase();
}

// ==========================================
// MOBILE SIDEBAR NAVIGATION
// ==========================================

const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");

if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");

        if (sidebarBackdrop) {
            sidebarBackdrop.classList.toggle("show");
        }
    });
}

if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", () => {
        sidebar.classList.remove("open");
        sidebarBackdrop.classList.remove("show");
    });
}

window.addEventListener("resize", () => {
    if (window.innerWidth > 760 && sidebar) {
        sidebar.classList.remove("open");

        if (sidebarBackdrop) {
            sidebarBackdrop.classList.remove("show");
        }
    }
});

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

const toast = document.getElementById("toast");
let toastTimer;

function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2600);
}

// ==========================================
// PAGES NOT YET AVAILABLE
// ==========================================

document.querySelectorAll("[data-not-ready]").forEach(element => {
    element.addEventListener("click", event => {
        event.preventDefault();

        showToast(`${element.dataset.notReady} page will be added next.`);

        if (window.innerWidth <= 760 && sidebar) {
            sidebar.classList.remove("open");

            if (sidebarBackdrop) {
                sidebarBackdrop.classList.remove("show");
            }
        }
    });
});

// ==========================================
// NOTIFICATION BUTTON
// ==========================================

const notificationButton = document.getElementById("notificationButton");

if (notificationButton) {
    notificationButton.addEventListener("click", event => {
        event.preventDefault();

        if (!window.location.pathname.toLowerCase().endsWith("notifications.html")) {
            window.location.href = "notifications.html";
        }
    });
}

// ==========================================
// LOGOUT
// ==========================================

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", async event => {
        event.preventDefault();

        const token = sessionStorage.getItem("hospitalToken");

        try {
            if (token) {
                await fetch("http://localhost:5001/api/auth/logout", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });
            }
        } catch (error) {
            console.error("Logout request failed:", error);
        } finally {
            sessionStorage.removeItem("hospitalToken");
            sessionStorage.removeItem("hospitalUser");
            sessionStorage.removeItem("hospitalDemoUser");

            window.location.replace("index.html");
        }
    });
}