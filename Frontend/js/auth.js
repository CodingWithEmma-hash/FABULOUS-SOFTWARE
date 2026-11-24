
const API_URL = (/^https?:$/i.test(window.location.protocol) && ["", "80", "443", "8080"].includes(window.location.port) && /\/Frontend\//i.test(window.location.pathname))
    ? `${window.location.origin}${window.location.pathname.replace(/\/Frontend\/.*$/i, "/Backend/api")}`
    : "http://localhost:5001/api";

const loginForm = document.getElementById("loginForm");
const staffIdInput = document.getElementById("staffId");
const passwordInput = document.getElementById("password");
const message = document.getElementById("loginMessage");
const toggleButton = document.getElementById("togglePassword");
const rememberCheckbox = document.getElementById("remember");

document.getElementById("year").textContent = new Date().getFullYear();

// Show or hide password
toggleButton.addEventListener("click", () => {
    const show = passwordInput.type === "password";

    passwordInput.type = show ? "text" : "password";

    toggleButton.setAttribute(
        "aria-label",
        show ? "Hide password" : "Show password"
    );

    toggleButton.querySelector("i").className = show
        ? "fa-solid fa-eye-slash"
        : "fa-solid fa-eye";
});

// Display login messages
function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `form-message ${type}`;
}

// Login functionality
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const identifier = staffIdInput.value.trim();
    const password = passwordInput.value;

    if (!identifier || !password) {
        showMessage("Please enter your username or staff ID and password.");
        return;
    }

    const loginButton = loginForm.querySelector(".login-button");

    loginButton.disabled = true;
    loginButton.innerHTML = "Signing in...";

    showMessage("");

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                identifier: identifier,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Login failed. Please try again.");
        }

        if (!data.token || !data.user) {
            throw new Error("Invalid response received from the server.");
        }

        // Store the authentication token for this browser session.
        sessionStorage.setItem("hospitalToken", data.token);

        // Store user information for the dashboard.
        sessionStorage.setItem(
            "hospitalUser",
            JSON.stringify(data.user)
        );

        // Remember username only, not the password or token.
        if (rememberCheckbox.checked) {
            localStorage.setItem("hospitalRememberedUser", identifier);
        } else {
            localStorage.removeItem("hospitalRememberedUser");
        }

        showMessage("Login successful. Redirecting...", "success");

        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Login error:", error);

        if (error instanceof TypeError) {
            showMessage(
                "Unable to connect to the server. Make sure your backend is running."
            );
        } else {
            showMessage(error.message);
        }

    } finally {
        loginButton.disabled = false;
        loginButton.innerHTML = 'Sign in <span>→</span>';
    }
});

// Restore remembered username
const rememberedUser = localStorage.getItem("hospitalRememberedUser");

if (rememberedUser) {
    staffIdInput.value = rememberedUser;
    rememberCheckbox.checked = true;
}

// Forgot password
document.getElementById("forgotLink").addEventListener("click", (event) => {
    event.preventDefault();

    showMessage(
        "Please contact your system administrator to reset your password."
    );
});
