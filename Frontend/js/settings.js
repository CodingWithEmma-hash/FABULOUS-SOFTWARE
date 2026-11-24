const API_URL = "http://localhost:5001/api";

const hospitalForm = document.getElementById("hospitalForm");
const systemForm = document.getElementById("systemForm");
const accountForm = document.getElementById("accountForm");
const passwordForm = document.getElementById("passwordForm");
const toast = document.getElementById("toast");

// Display notification
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

// Switch between settings tabs
const tabs = document.querySelectorAll(".settings-tab");
const panels = document.querySelectorAll(".settings-panel");

tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        const target = tab.dataset.tab;

        tabs.forEach(item => item.classList.remove("active"));
        panels.forEach(panel => panel.classList.remove("active"));

        tab.classList.add("active");
        const targetPanel = document.getElementById(target);
        if (targetPanel) targetPanel.classList.add("active");
    });
});

// Load settings from backend
async function loadSettings() {
    const token = sessionStorage.getItem("hospitalToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/settings`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Unable to retrieve system settings.");
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || "Failed to load settings.");
        }

        // Fill Hospital Information
        if (data.hospital) {
            const h = data.hospital;
            if (document.getElementById("hospitalName")) document.getElementById("hospitalName").value = h.name || "";
            if (document.getElementById("hospitalEmail")) document.getElementById("hospitalEmail").value = h.email || "";
            if (document.getElementById("hospitalPhone")) document.getElementById("hospitalPhone").value = h.phone || "";
            if (document.getElementById("hospitalAddress")) document.getElementById("hospitalAddress").value = h.address || "";
            if (document.getElementById("hospitalCity")) document.getElementById("hospitalCity").value = h.city || "";
            if (document.getElementById("hospitalState")) document.getElementById("hospitalState").value = h.state || "";
        }

        // Fill System Preferences
        if (data.system) {
            const s = data.system;
            if (document.getElementById("systemName")) document.getElementById("systemName").value = s.systemName || "AI-Based Hospital Decision Support System";
            if (document.getElementById("dateFormat")) document.getElementById("dateFormat").value = s.dateFormat || "DD/MM/YYYY";
            if (document.getElementById("language")) document.getElementById("language").value = s.language || "English";
            if (document.getElementById("timezone")) document.getElementById("timezone").value = s.timezone || "Africa/Lagos";
            if (document.getElementById("historyEnabled")) document.getElementById("historyEnabled").checked = s.historyEnabled !== false;
        }

        // Fill Account Profile
        if (data.account) {
            const a = data.account;
            if (document.getElementById("adminName")) document.getElementById("adminName").value = a.fullName || "";
            if (document.getElementById("adminEmail")) document.getElementById("adminEmail").value = a.email || "";
            if (document.getElementById("adminUsername")) document.getElementById("adminUsername").value = a.username || "";
        }

    } catch (error) {
        console.error("Load settings error:", error);
        showToast(error.message, "error");
    }
}

// 1. Save hospital information
if (hospitalForm) {
    hospitalForm.addEventListener("submit", async event => {
        event.preventDefault();

        const token = sessionStorage.getItem("hospitalToken");
        if (!token) return;

        const payload = {
            name: document.getElementById("hospitalName").value.trim(),
            email: document.getElementById("hospitalEmail").value.trim(),
            phone: document.getElementById("hospitalPhone").value.trim(),
            address: document.getElementById("hospitalAddress").value.trim(),
            city: document.getElementById("hospitalCity").value.trim(),
            state: document.getElementById("hospitalState").value.trim()
        };

        const submitBtn = hospitalForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/settings/hospital`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to save hospital information.");
            }

            showToast("Hospital information saved successfully.");

        } catch (error) {
            console.error("Save hospital error:", error);
            showToast(error.message, "error");
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// 2. Save system preferences
if (systemForm) {
    systemForm.addEventListener("submit", async event => {
        event.preventDefault();

        const token = sessionStorage.getItem("hospitalToken");
        if (!token) return;

        const payload = {
            systemName: document.getElementById("systemName").value.trim(),
            dateFormat: document.getElementById("dateFormat").value,
            language: document.getElementById("language").value,
            timezone: document.getElementById("timezone").value,
            historyEnabled: document.getElementById("historyEnabled").checked
        };

        const submitBtn = systemForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/settings/system`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to save system preferences.");
            }

            showToast("System preferences saved successfully.");

        } catch (error) {
            console.error("Save system error:", error);
            showToast(error.message, "error");
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// 3. Save account information (Update Profile)
if (accountForm) {
    accountForm.addEventListener("submit", async event => {
        event.preventDefault();

        const token = sessionStorage.getItem("hospitalToken");
        if (!token) return;

        const payload = {
            fullName: document.getElementById("adminName").value.trim(),
            email: document.getElementById("adminEmail").value.trim(),
            username: document.getElementById("adminUsername").value.trim()
        };

        const submitBtn = accountForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/auth/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to update profile.");
            }

            if (data.user) {
                sessionStorage.setItem("hospitalUser", JSON.stringify(data.user));
                const userNameEl = document.getElementById("userName");
                if (userNameEl) userNameEl.textContent = data.user.fullName || data.user.full_name;
            }

            showToast("Account profile updated successfully.");

        } catch (error) {
            console.error("Update profile error:", error);
            showToast(error.message, "error");
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// 4. Change password
if (passwordForm) {
    passwordForm.addEventListener("submit", async event => {
        event.preventDefault();

        const token = sessionStorage.getItem("hospitalToken");
        if (!token) return;

        const currentPassword = document.getElementById("currentPassword").value;
        const newPassword = document.getElementById("newPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast("Please complete all password fields.", "error");
            return;
        }

        if (newPassword.length < 8) {
            showToast("New password must contain at least 8 characters.", "error");
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast("The new passwords do not match.", "error");
            return;
        }

        const submitBtn = passwordForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/auth/change-password`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to change password.");
            }

            showToast("Password changed successfully!", "success");
            passwordForm.reset();

        } catch (error) {
            console.error("Change password error:", error);
            showToast(error.message, "error");
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// Initialize
loadSettings();
