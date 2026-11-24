const AUTH_API_URL = (/^https?:$/i.test(window.location.protocol) && ["", "80", "443", "8080"].includes(window.location.port) && /\/Frontend\//i.test(window.location.pathname))
    ? `${window.location.origin}${window.location.pathname.replace(/\/Frontend\/.*$/i, "/Backend/api")}`
    : "http://localhost/PROJECT%20SOFTWARE/FABULOUS%20SOFTWARE/Backend/api";

async function protectPage() {
    const token = sessionStorage.getItem("hospitalToken");

    if (!token) {
        window.location.replace("index.html");
        return;
    }

    document.body.style.visibility = "hidden";

    try {
        const response = await fetch(`${AUTH_API_URL}/auth/me`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            sessionStorage.removeItem("hospitalToken");
            sessionStorage.removeItem("hospitalUser");

            window.location.replace("index.html");
            return;
        }

        const data = await response.json();

        if (!data.success || !data.user || !data.user.id) {
            throw new Error("Invalid user information returned by the server.");
        }

        sessionStorage.setItem(
            "hospitalUser",
            JSON.stringify(data.user)
        );

        document.body.style.visibility = "visible";

    } catch (error) {
        console.error("Authentication check failed:", error);

        document.body.style.visibility = "visible";

        document.body.innerHTML = `
            <div style="padding:40px;text-align:center;font-family:Arial,sans-serif;">
                <h2>Unable to verify your session</h2>
                <p>Please check that your backend server is running.</p>
                <button onclick="location.reload()">Try Again</button>
                <button onclick="sessionStorage.removeItem('hospitalToken');sessionStorage.removeItem('hospitalUser');location.replace('index.html')">
                    Return to Login
                </button>
            </div>
        `;
    }
}

protectPage();