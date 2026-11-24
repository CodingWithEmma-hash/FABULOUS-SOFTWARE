const API_URL = (/^https?:$/i.test(window.location.protocol) && ["", "80", "443", "8080"].includes(window.location.port) && /\/Frontend\//i.test(window.location.pathname))
    ? `${window.location.origin}${window.location.pathname.replace(/\/Frontend\/.*$/i, "/Backend/api")}`
    : "http://localhost:5001/api";

// Elements
const staffForm = document.getElementById("staffForm");
const toast = document.getElementById("toast");
const passwordButtons = document.querySelectorAll(".toggle-password");

// Toast helper
function showToast(message, type = "success") {
    if (!toast) {
        alert(message);
        return;
    }
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

// Show/hide passwords
passwordButtons.forEach(button => {
    button.addEventListener("click", function () {
        const targetId = this.dataset.target || (this.previousElementSibling ? this.previousElementSibling.id : null);
        const field = document.getElementById(targetId);
        const icon = this.querySelector("i");

        if (!field) return;

        if (field.type === "password") {
            field.type = "text";
            this.setAttribute("aria-label", "Hide password");
            if (icon) icon.className = "fa-solid fa-eye-slash";
        } else {
            field.type = "password";
            this.setAttribute("aria-label", "Show password");
            if (icon) icon.className = "fa-solid fa-eye";
        }
    });
});

// Staff registration form submit
if (staffForm) {
    staffForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const token = sessionStorage.getItem("hospitalToken");
        if (!token) {
            window.location.replace("index.html");
            return;
        }

        const fullName = document.getElementById("fullName").value.trim();
        const staffId = document.getElementById("staffId").value.trim();
        const email = document.getElementById("email") ? document.getElementById("email").value.trim() : "";
        const phone = document.getElementById("phone") ? document.getElementById("phone").value.trim() : "";
        const role = document.getElementById("role") ? document.getElementById("role").value : "Staff";
        const username = document.getElementById("username") ? document.getElementById("username").value.trim() : staffId.toLowerCase();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (!fullName || !staffId || !email || !username || !password || !role) {
            showToast("Please fill in all required fields.", "error");
            return;
        }

        if (password !== confirmPassword) {
            showToast("Passwords do not match. Please verify and try again.", "error");
            return;
        }

        if (password.length < 8) {
            showToast("Password must contain at least 8 characters.", "error");
            return;
        }

        const submitBtn = staffForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    staffId,
                    fullName,
                    email,
                    phone,
                    username,
                    password,
                    role
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Staff registration failed.");
            }

            showToast("Staff account registered successfully!", "success");

            const goToUsers = confirm(
                `Staff registration completed successfully!\n\n` +
                `Staff ID: ${staffId}\n` +
                `Name: ${fullName}\n` +
                `Role: ${role}\n\n` +
                `Click OK to view User Management, or Cancel to register another staff member.`
            );

            if (goToUsers) {
                window.location.href = "users.html";
            } else {
                staffForm.reset();
            }

        } catch (error) {
            console.error("Staff registration error:", error);
            showToast(error.message, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Register Staff";
        }
    });

    // Clear form
    staffForm.addEventListener("reset", function () {
        passwordButtons.forEach(button => {
            const icon = button.querySelector("i");
            if (icon) {
                button.setAttribute("aria-label", "Show password");
                icon.className = "fa-solid fa-eye";
            }
        });
    });
}
