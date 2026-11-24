document.addEventListener("DOMContentLoaded", () => {
    const API_URL = "http://localhost:5001/api";

    const notificationList = document.getElementById("notificationList");
    const emptyState = document.getElementById("emptyState");

    const searchInput = document.getElementById("searchInput");
    const typeFilter = document.getElementById("typeFilter");
    const statusFilter = document.getElementById("statusFilter");
    const priorityFilter = document.getElementById("priorityFilter");

    const totalNotifications = document.getElementById("totalNotifications");
    const unreadNotifications = document.getElementById("unreadNotifications");
    const highPriority = document.getElementById("highPriority");
    const systemUpdates = document.getElementById("systemUpdates");
    const sidebarUnread = document.getElementById("sidebarUnread");
    const resultCount = document.getElementById("resultCount");
    const toast = document.getElementById("toast");

    let notifications = [];

    function showToast(message, type = "success") {
        if (!toast) return;
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    function getTypeDetails(type) {
        switch (type ? type.toLowerCase() : "") {
            case "assessment":
                return { label: "Clinical Assessment", icon: "fa-notes-medical" };
            case "patient":
                return { label: "Patient Record", icon: "fa-user-injured" };
            case "system":
            default:
                return { label: "System Message", icon: "fa-circle-info" };
        }
    }

    function getRelativeTime(timestamp) {
        if (!timestamp) return "Just now";
        const date = new Date(timestamp);
        const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

        if (diffSeconds < 60) return "Just now";
        if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`;
        if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hr ago`;
        return `${Math.floor(diffSeconds / 86400)} day(s) ago`;
    }

    function formatDate(timestamp) {
        if (!timestamp) return "—";
        try {
            return new Date(timestamp).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric"
            });
        } catch (e) {
            return timestamp;
        }
    }

    // Load from backend
    async function loadNotifications() {
        const token = sessionStorage.getItem("hospitalToken");
        if (!token) return;

        if (notificationList) {
            notificationList.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading notifications...</div>`;
        }

        try {
            const response = await fetch(`${API_URL}/notifications`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error("Unable to retrieve notifications.");
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || "Failed to load notifications.");
            }

            notifications = data.notifications || [];

            // Update statistics
            if (data.stats) {
                if (totalNotifications) totalNotifications.textContent = data.stats.total || 0;
                if (unreadNotifications) unreadNotifications.textContent = data.stats.unread || 0;
                if (highPriority) highPriority.textContent = data.stats.highPriority || 0;
                if (systemUpdates) systemUpdates.textContent = data.stats.systemUpdates || 0;

                const unread = data.stats.unread || 0;
                if (sidebarUnread) {
                    sidebarUnread.textContent = unread;
                    sidebarUnread.style.display = unread > 0 ? "inline-block" : "none";
                }
            }

            renderNotifications();

        } catch (error) {
            console.error("Load notifications error:", error);
            showToast(error.message, "error");
            if (notificationList) {
                notificationList.innerHTML = `<div style="text-align:center; padding:30px; color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHTML(error.message)}</div>`;
            }
        }
    }

    function renderNotifications() {
        if (!notificationList) return;

        const searchTerm = (searchInput ? searchInput.value : "").toLowerCase().trim();
        const selectedType = typeFilter ? typeFilter.value : "all";
        const selectedStatus = statusFilter ? statusFilter.value : "all";
        const selectedPriority = priorityFilter ? priorityFilter.value : "all";

        const filtered = notifications.filter(item => {
            const searchableText = [
                item.title,
                item.message,
                item.id,
                item.type,
                item.priority
            ].join(" ").toLowerCase();

            const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
            const matchesType = selectedType === "all" || (item.type || "").toLowerCase() === selectedType.toLowerCase();
            const matchesStatus =
                selectedStatus === "all" ||
                (selectedStatus === "read" && (item.read || item.isRead)) ||
                (selectedStatus === "unread" && !(item.read || item.isRead));

            const matchesPriority =
                selectedPriority === "all" || (item.priority || "").toLowerCase() === selectedPriority.toLowerCase();

            return matchesSearch && matchesType && matchesStatus && matchesPriority;
        });

        notificationList.innerHTML = "";

        filtered.forEach(item => {
            const isRead = Boolean(item.read || item.isRead);
            const typeDetails = getTypeDetails(item.type);
            const article = document.createElement("article");

            article.className = `notification-item ${isRead ? "" : "unread"}`;

            article.innerHTML = `
                <div class="notification-icon ${escapeHTML(item.type)}">
                    <i class="fas ${typeDetails.icon}"></i>
                </div>

                <div class="notification-content">
                    <div class="notification-title-row">
                        ${isRead ? "" : '<span class="unread-dot" title="Unread"></span>'}
                        <span class="notification-title">${escapeHTML(item.title)}</span>
                        <span class="priority ${escapeHTML(item.priority)}">
                            ${escapeHTML(item.priority)}
                        </span>
                        <span class="category-label">${escapeHTML(typeDetails.label)}</span>
                    </div>

                    <p class="notification-message">${escapeHTML(item.message)}</p>

                    <div class="notification-meta">
                        <span><i class="far fa-clock"></i> ${escapeHTML(getRelativeTime(item.createdAt))}</span>
                        <span><i class="far fa-calendar"></i> ${escapeHTML(formatDate(item.createdAt))}</span>
                        <span>${isRead ? "Read" : "Unread"}</span>
                    </div>
                </div>

                <div class="notification-actions">
                    <button class="icon-button"
                        data-action="toggle-read"
                        data-id="${escapeHTML(item.id)}"
                        data-db-id="${escapeHTML(item.dbId || item.id)}"
                        title="${isRead ? "Read" : "Mark as read"}"
                        aria-label="${isRead ? "Read" : "Mark as read"}">
                        <i class="fas ${isRead ? "fa-envelope-open" : "fa-envelope"}"></i>
                    </button>

                    <button class="icon-button delete"
                        data-action="delete"
                        data-id="${escapeHTML(item.id)}"
                        data-db-id="${escapeHTML(item.dbId || item.id)}"
                        title="Delete notification"
                        aria-label="Delete notification">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            notificationList.appendChild(article);
        });

        if (emptyState) emptyState.classList.toggle("hidden", filtered.length !== 0);
        notificationList.classList.toggle("hidden", filtered.length === 0);

        if (resultCount) {
            resultCount.textContent = `Showing ${filtered.length} of ${notifications.length} notification(s)`;
        }
    }

    function resetFilters() {
        if (searchInput) searchInput.value = "";
        if (typeFilter) typeFilter.value = "all";
        if (statusFilter) statusFilter.value = "all";
        if (priorityFilter) priorityFilter.value = "all";
        renderNotifications();
    }

    if (searchInput) searchInput.addEventListener("input", renderNotifications);
    if (typeFilter) typeFilter.addEventListener("change", renderNotifications);
    if (statusFilter) statusFilter.addEventListener("change", renderNotifications);
    if (priorityFilter) priorityFilter.addEventListener("change", renderNotifications);

    const resetFiltersBtn = document.getElementById("resetFilters");
    if (resetFiltersBtn) resetFiltersBtn.addEventListener("click", resetFilters);

    // Notification action clicks
    if (notificationList) {
        notificationList.addEventListener("click", async event => {
            const button = event.target.closest("button[data-action]");
            if (!button) return;

            const id = button.dataset.dbId || button.dataset.id;
            const action = button.dataset.action;
            const token = sessionStorage.getItem("hospitalToken");
            if (!token) return;

            if (action === "toggle-read") {
                try {
                    const res = await fetch(`${API_URL}/notifications/${id}/read`, {
                        method: "PATCH",
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (res.ok) {
                        showToast("Marked as read.");
                        await loadNotifications();
                    }
                } catch (e) {
                    console.error("Mark read error:", e);
                }
            } else if (action === "delete") {
                const confirmed = confirm("Are you sure you want to delete this notification?");
                if (!confirmed) return;

                try {
                    const res = await fetch(`${API_URL}/notifications/${id}`, {
                        method: "DELETE",
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (res.ok) {
                        showToast("Notification deleted.");
                        await loadNotifications();
                    }
                } catch (e) {
                    console.error("Delete notification error:", e);
                }
            }
        });
    }

    // Mark all as read button
    const markAllReadBtn = document.getElementById("markAllRead");
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener("click", async () => {
            const token = sessionStorage.getItem("hospitalToken");
            if (!token) return;

            try {
                const res = await fetch(`${API_URL}/notifications/mark-all-read`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    showToast("All notifications marked as read.", "success");
                    await loadNotifications();
                }
            } catch (e) {
                console.error("Mark all read error:", e);
            }
        });
    }

    // Initialize
    loadNotifications();
});
