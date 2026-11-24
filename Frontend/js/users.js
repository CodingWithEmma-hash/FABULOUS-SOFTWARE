const API_URL = "http://localhost:5001/api";

const usersTable = document.getElementById("usersTable");
const userForm = document.getElementById("userForm");
const userModal = document.getElementById("userModal");

const searchInput = document.getElementById("searchInput");
const roleFilter = document.getElementById("roleFilter");
const statusFilter = document.getElementById("statusFilter");
const toast = document.getElementById("toast");

let users = [];

// Toast notification helper
function showToast(message, type = "success") {
    if (!toast) {
        alert(message);
        return;
    }
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);
}

// Escape text
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// Load users from backend
async function loadUsers() {
    const token = sessionStorage.getItem("hospitalToken");
    if (!token) return;

    if (usersTable) {
        usersTable.innerHTML = `<tr><td colspan="7" class="empty-row"><i class="fa-solid fa-spinner fa-spin"></i> Loading users...</td></tr>`;
    }

    try {
        const response = await fetch(`${API_URL}/users`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Unable to retrieve user records.");
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || "Failed to load users.");
        }

        users = data.users || [];

        // Update statistics
        if (data.stats) {
            const totalEl = document.getElementById("totalUsers");
            const activeEl = document.getElementById("activeUsers");
            const adminEl = document.getElementById("adminUsers");
            const pharmEl = document.getElementById("pharmacistUsers");

            if (totalEl) totalEl.textContent = data.stats.total || 0;
            if (activeEl) activeEl.textContent = data.stats.active || 0;
            if (adminEl) adminEl.textContent = data.stats.admins || 0;
            if (pharmEl) pharmEl.textContent = data.stats.pharmacists || 0;
        }

        displayUsers();

    } catch (error) {
        console.error("Load users error:", error);
        showToast(error.message, "error");
        if (usersTable) {
            usersTable.innerHTML = `<tr><td colspan="7" class="empty-row" style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHTML(error.message)}</td></tr>`;
        }
    }
}

// Filter and display users
function displayUsers() {
    if (!usersTable) return;

    const searchTerm = (searchInput ? searchInput.value : "").toLowerCase().trim();
    const selectedRole = roleFilter ? roleFilter.value : "all";
    const selectedStatus = statusFilter ? statusFilter.value : "all";

    const filteredUsers = users.filter(user => {
        const searchableText = [
            user.staffId,
            user.fullName,
            user.username,
            user.email
        ].join(" ").toLowerCase();

        return (
            (!searchTerm || searchableText.includes(searchTerm)) &&
            (selectedRole === "all" || user.role === selectedRole) &&
            (selectedStatus === "all" || (user.status || "").toLowerCase() === selectedStatus.toLowerCase())
        );
    });

    usersTable.innerHTML = "";

    if (filteredUsers.length === 0) {
        usersTable.innerHTML = `
            <tr>
                <td colspan="7" class="empty-row">
                    No users matching your criteria.
                </td>
            </tr>
        `;
    } else {
        filteredUsers.forEach(user => {
            const row = document.createElement("tr");
            const isActive = (user.status || "").toLowerCase() === "active";

            row.innerHTML = `
                <td><code>${escapeHTML(user.staffId)}</code></td>
                <td>
                    <span class="user-name">
                        <strong>${escapeHTML(user.fullName)}</strong>
                    </span>
                </td>
                <td>${escapeHTML(user.username)}</td>
                <td>${escapeHTML(user.email)}</td>
                <td>
                    <span class="user-role">
                        ${escapeHTML(user.role)}
                    </span>
                </td>
                <td>
                    <span class="account-status ${isActive ? "active" : "inactive"}">
                        ${isActive ? "Active" : "Inactive"}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button
                            class="edit-button"
                            data-action="edit"
                            data-id="${escapeHTML(user.id)}"
                            title="Edit User"
                        >
                            Edit
                        </button>
                        <button
                            class="toggle-button"
                            data-action="toggle"
                            data-id="${escapeHTML(user.id)}"
                            title="${isActive ? "Deactivate User" : "Activate User"}"
                        >
                            ${isActive ? "Deactivate" : "Activate"}
                        </button>
                    </div>
                </td>
            `;

            usersTable.appendChild(row);
        });
    }

    const countEl = document.getElementById("recordCount");
    if (countEl) {
        countEl.textContent = `Showing ${filteredUsers.length} of ${users.length} users`;
    }
}

// Modal management
function openModal(editing = false) {
    if (!userModal) return;
    userModal.classList.add("show");
    const modalTitle = document.getElementById("modalTitle");
    const submitBtn = document.getElementById("submitButton");
    if (modalTitle) modalTitle.textContent = editing ? "Edit User Details" : "Register New User";
    if (submitBtn) submitBtn.textContent = editing ? "Save Changes" : "Register User";
}

function closeModal() {
    if (!userModal) return;
    userModal.classList.remove("show");
    if (userForm) userForm.reset();
    const editIdInput = document.getElementById("editUserId");
    if (editIdInput) editIdInput.value = "";
    const passGroup = document.getElementById("passwordGroup");
    if (passGroup) passGroup.style.display = "block";
    const passInput = document.getElementById("password");
    if (passInput) passInput.required = false;
}

const openAddModalBtn = document.getElementById("openAddModal");
if (openAddModalBtn) {
    openAddModalBtn.addEventListener("click", () => {
        closeModal();
        openModal(false);
        const passInput = document.getElementById("password");
        if (passInput) passInput.required = true;
    });
}

const closeModalBtn = document.getElementById("closeModal");
const cancelModalBtn = document.getElementById("cancelModal");
if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeModal);

if (userModal) {
    userModal.addEventListener("click", event => {
        if (event.target === userModal) closeModal();
    });
}

// Edit user fill form
function editUser(id) {
    const user = users.find(item => String(item.id) === String(id));
    if (!user) return;

    const editIdInput = document.getElementById("editUserId");
    if (editIdInput) editIdInput.value = user.id;

    const staffIdInput = document.getElementById("staffId");
    if (staffIdInput) {
        staffIdInput.value = user.staffId || "";
        staffIdInput.disabled = true; // Staff ID cannot be edited
    }

    const nameInput = document.getElementById("fullName");
    if (nameInput) nameInput.value = user.fullName || "";

    const usernameInput = document.getElementById("username");
    if (usernameInput) usernameInput.value = user.username || "";

    const emailInput = document.getElementById("email");
    if (emailInput) emailInput.value = user.email || "";

    const phoneInput = document.getElementById("phone");
    if (phoneInput) phoneInput.value = user.phone || "";

    const roleInput = document.getElementById("userRole");
    if (roleInput) roleInput.value = user.role || "Staff";

    const statusInput = document.getElementById("status");
    if (statusInput) statusInput.value = user.status === "Inactive" ? "Inactive" : "Active";

    const passInput = document.getElementById("password");
    if (passInput) {
        passInput.value = "";
        passInput.required = false;
        passInput.placeholder = "Leave blank to keep current password";
    }

    openModal(true);
}

// Toggle user status
async function toggleUserStatus(id) {
    const user = users.find(item => String(item.id) === String(id));
    if (!user) return;

    const token = sessionStorage.getItem("hospitalToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/users/${id}/status`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to update user status.");
        }

        showToast(data.message, "success");
        await loadUsers();

    } catch (error) {
        console.error("Toggle user status error:", error);
        showToast(error.message, "error");
    }
}

// Form submit (Add or Edit)
if (userForm) {
    userForm.addEventListener("submit", async event => {
        event.preventDefault();

        const token = sessionStorage.getItem("hospitalToken");
        if (!token) {
            window.location.replace("index.html");
            return;
        }

        const editId = document.getElementById("editUserId").value;
        const isEditing = Boolean(editId);

        const payload = {
            fullName: document.getElementById("fullName").value.trim(),
            staffId: document.getElementById("staffId").value.trim(),
            username: document.getElementById("username").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            role: document.getElementById("userRole").value,
            status: document.getElementById("status").value
        };

        const passValue = document.getElementById("password").value;
        if (passValue) {
            payload.password = passValue;
        }

        const submitBtn = document.getElementById("submitButton");
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const url = isEditing ? `${API_URL}/users/${editId}` : `${API_URL}/users`;
            const method = isEditing ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to save user.");
            }

            showToast(data.message, "success");
            closeModal();
            await loadUsers();

        } catch (error) {
            console.error("Save user error:", error);
            showToast(error.message, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isEditing ? "Save Changes" : "Register User";
        }
    });
}

// Action button clicks inside table
if (usersTable) {
    usersTable.addEventListener("click", event => {
        const target = event.target.closest("button");
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === "edit") {
            editUser(id);
        } else if (action === "toggle") {
            toggleUserStatus(id);
        }
    });
}

// Search & filters
if (searchInput) searchInput.addEventListener("input", displayUsers);
if (roleFilter) roleFilter.addEventListener("change", displayUsers);
if (statusFilter) statusFilter.addEventListener("change", displayUsers);

// Initialize
loadUsers();
