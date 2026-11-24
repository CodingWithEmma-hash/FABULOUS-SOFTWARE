// Common Navigation & Shell Behaviors across all pages
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:5001/api";
  const token = sessionStorage.getItem("hospitalToken");

  // 1. Sidebar Toggle for Mobile & Backdrop
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menuToggle");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");

  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      sidebar.classList.toggle("open");
      if (sidebarBackdrop) sidebarBackdrop.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
      if (
        window.innerWidth <= 760 &&
        sidebar.classList.contains("open") &&
        !sidebar.contains(e.target) &&
        !menuToggle.contains(e.target)
      ) {
        sidebar.classList.remove("open");
        if (sidebarBackdrop) sidebarBackdrop.classList.remove("show");
      }
    });
  }

  if (sidebarBackdrop && sidebar) {
    sidebarBackdrop.addEventListener("click", () => {
      sidebar.classList.remove("open");
      sidebarBackdrop.classList.remove("show");
    });
  }

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760 && sidebar) {
      sidebar.classList.remove("open");
      if (sidebarBackdrop) sidebarBackdrop.classList.remove("show");
    }
  });

  // 2. Sign Out Handlers
  const logoutButtons = document.querySelectorAll("#logoutButton, .logout-link");
  logoutButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (token) {
        try {
          await fetch(`${API_BASE}/auth/logout`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
          });
        } catch (err) {
          // Continue clearing session even if network fails
        }
      }
      sessionStorage.removeItem("hospitalToken");
      sessionStorage.removeItem("hospitalUser");
      sessionStorage.removeItem("hospitalDemoUser");
      window.location.href = "index.html";
    });
  });

  // 3. User Name & Profile Display
  let displayName = "Hospital Staff";
  let displayRole = "Authorised staff";
  let initials = "GH";

  try {
    const rawUser = sessionStorage.getItem("hospitalUser");
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed) {
        displayName = parsed.fullName || parsed.full_name || parsed.username || displayName;
        displayRole = parsed.role || displayRole;
        const parts = displayName.trim().split(" ");
        if (parts.length >= 2) {
          initials = (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (displayName.length > 0) {
          initials = displayName.slice(0, 2).toUpperCase();
        }
      }
    } else {
      displayName = sessionStorage.getItem("hospitalDemoUser") || displayName;
    }
  } catch (err) {
    // fallback
  }

  const userNameEl = document.getElementById("userName");
  const welcomeNameEl = document.getElementById("welcomeName");
  if (userNameEl) userNameEl.textContent = displayName;
  if (welcomeNameEl) welcomeNameEl.textContent = displayName;

  // Update topbar avatar initials if available
  const avatarEls = document.querySelectorAll(".user-menu .avatar, .profile .avatar");
  avatarEls.forEach(avatar => {
    if (!avatar.querySelector("i")) {
      avatar.textContent = initials;
    }
  });

  // 4. Clickable User Profile / Menu -> Settings
  const userMenus = document.querySelectorAll(".user-menu, .profile");
  userMenus.forEach((menu) => {
    menu.style.cursor = "pointer";
    menu.setAttribute("title", "Open System Settings");
    menu.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("a")) return;
      window.location.href = "settings.html";
    });
  });

  // 5. Notifications Bell Handler -> Navigates to notifications.html
  const notifButtons = document.querySelectorAll("#notificationButton, .notification-button");
  notifButtons.forEach((btn) => {
    btn.setAttribute("title", "View Notifications & Alerts");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const currentPath = window.location.pathname.toLowerCase();
      if (!currentPath.endsWith("notifications.html")) {
        window.location.href = "notifications.html";
      }
    });
  });

  // 6. Dynamic Unread Count Synchronization from Backend
  async function updateUnreadBadges() {
    let count = 0;
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/notifications/unread-count`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && typeof data.unread === "number") {
            count = data.unread;
          }
        }
      } catch (e) {
        // Fallback to localStorage if offline
        try {
          const raw = localStorage.getItem("hospitalNotifications");
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) count = list.filter(n => !n.read).length;
          }
        } catch (err) {}
      }
    }

    const badges = document.querySelectorAll("#sidebarUnread, .nav-count");
    badges.forEach((b) => {
      b.textContent = count;
      b.style.display = count > 0 ? "inline-block" : "none";
    });
  }

  updateUnreadBadges();
});
