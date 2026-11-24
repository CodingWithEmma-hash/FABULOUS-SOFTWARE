const API_URL = (/^https?:$/i.test(window.location.protocol) && ["", "80", "443", "8080"].includes(window.location.port) && /\/Frontend\//i.test(window.location.pathname))
    ? `${window.location.origin}${window.location.pathname.replace(/\/Frontend\/.*$/i, "/Backend/api")}`
    : "http://localhost/PROJECT%20SOFTWARE/FABULOUS%20SOFTWARE/Backend/api";

const patientForm = document.getElementById("patientForm");
const dobInput = document.getElementById("dob");
const patientIdInput = document.getElementById("patientId");

const registerButton = patientForm.querySelector(
    'button[type="submit"]'
);

const toast = document.getElementById("toast");

// Prevent future dates of birth
if (dobInput) {
    dobInput.max = new Date().toISOString().split("T")[0];
}

// Show notification
function showMessage(message, type = "success") {
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

// Collect form information
function getPatientData() {
    return {
        fullName: document.getElementById("fullName").value.trim(),
        dob: dobInput.value,
        gender: document.getElementById("gender").value,
        phone: document.getElementById("phone").value.trim(),
        email: document.getElementById("email").value.trim(),
        address: document.getElementById("address").value.trim(),

        emergencyName: document.getElementById("emergencyName").value.trim(),
        relationship: document.getElementById("relationship").value,
        emergencyPhone: document.getElementById("emergencyPhone").value.trim(),

        bloodGroup: document.getElementById("bloodGroup").value,
        genotype: document.getElementById("genotype").value,
        allergies: document.getElementById("allergies").value.trim(),
        medicalHistory: document.getElementById("medicalHistory").value.trim()
    };
}

// Validate phone numbers
function validatePhone(phone) {
    return /^[0-9+\-\s()]{7,20}$/.test(phone);
}

// Register patient
patientForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const token = sessionStorage.getItem("hospitalToken");

    if (!token) {
        window.location.replace("index.html");
        return;
    }

    const patientData = getPatientData();

    if (
        !patientData.fullName ||
        !patientData.dob ||
        !patientData.gender ||
        !patientData.phone ||
        !patientData.address ||
        !patientData.emergencyName ||
        !patientData.relationship ||
        !patientData.emergencyPhone
    ) {
        showMessage("Please complete all required fields.", "error");
        return;
    }

    if (!validatePhone(patientData.phone)) {
        showMessage("Please enter a valid patient phone number.", "error");
        return;
    }

    if (!validatePhone(patientData.emergencyPhone)) {
        showMessage("Please enter a valid emergency contact number.", "error");
        return;
    }

    registerButton.disabled = true;
    registerButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';

    try {
        const response = await fetch(`${API_URL}/patients/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(patientData)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Patient registration failed.");
        }

        const patient = data.patient;

        // Display generated patient ID
        patientIdInput.value = patient.patientId;

        showMessage(
            `Patient registered successfully! Patient ID: ${patient.patientId}`,
            "success"
        );

        const viewRecords = confirm(
            `Patient registered successfully!\n\n` +
            `Patient ID: ${patient.patientId}\n` +
            `Name: ${patient.fullName}\n\n` +
            `Click OK to view Patient Records, or Cancel to register another patient.`
        );

        if (viewRecords) {
            window.location.href = "patient.html";
        } else {
            patientForm.reset();
            patientIdInput.value = "";
        }

    } catch (error) {
        console.error("Patient registration error:", error);
        showMessage(error.message, "error");

    } finally {
        registerButton.disabled = false;
        registerButton.innerHTML = "Register Patient";
    }
});

// Clear generated ID when form is reset
patientForm.addEventListener("reset", () => {
    setTimeout(() => {
        patientIdInput.value = "";
    }, 0);
});
