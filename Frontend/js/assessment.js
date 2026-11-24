const API_URL = (/^https?:$/i.test(window.location.protocol) && !["5500", "5501", "5173", "5174", "4200"].includes(window.location.port) && /\/Frontend\//i.test(window.location.pathname))
    ? `${window.location.origin}${window.location.pathname.replace(/\/Frontend\/.*$/i, "/Backend/api")}`
    : "http://localhost/PROJECT%20SOFTWARE/FABULOUS%20SOFTWARE/Backend/api";

document.addEventListener("DOMContentLoaded", () => {
    initializeAssessmentPage();
});

function getToken() {
    return sessionStorage.getItem("hospitalToken");
}

function getElement(id) {
    return document.getElementById(id);
}

function getFieldValue(id) {
    const element = getElement(id);
    return element ? element.value.trim() : "";
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

function showMessage(message, type = "info") {
    // Use the existing toast system if your page provides one.
    if (typeof window.showToast === "function") {
        window.showToast(message, type);
        return;
    }

    alert(message);
}

// Check if user is Administrator and apply restriction
function checkAdminRole() {
    let user = null;
    try {
        user = JSON.parse(sessionStorage.getItem("hospitalUser") || "{}");
    } catch (e) {}

    if (user && user.role === "Administrator") {
        const form = getElement("assessmentForm");

        if (form && !getElement("adminRestrictionBanner")) {
            const banner = document.createElement("div");
            banner.id = "adminRestrictionBanner";
            banner.style.cssText = `
                background: #fef2f2;
                border: 1px solid #fecaca;
                border-left: 5px solid #dc2626;
                border-radius: 12px;
                padding: 16px 20px;
                margin-bottom: 22px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                box-shadow: 0 2px 8px rgba(220, 38, 38, 0.08);
            `;
            banner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 44px; height: 44px; border-radius: 10px; background: #fee2e2; color: #dc2626; display: grid; place-items: center; font-size: 20px; flex-shrink: 0;">
                        <i class="fa-solid fa-user-shield"></i>
                    </div>
                    <div>
                        <strong style="color: #991b1b; font-size: 14px; display: block; margin-bottom: 2px;">
                            Role Restriction: Administrator Cannot Perform AI Assessments
                        </strong>
                        <span style="color: #7f1d1d; font-size: 12.5px; line-height: 1.45;">
                            Administrators are not permitted to create or perform clinical AI assessments. Clinical assessments must be performed by authorized healthcare practitioners (Doctors, Nurses). You can view all existing clinical assessments in Assessment History.
                        </span>
                    </div>
                </div>
                <a href="history.html" class="btn" style="background: #dc2626; color: #ffffff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(220, 38, 38, 0.25);">
                    <i class="fa-solid fa-clock-rotate-left"></i> View History
                </a>
            `;
            form.parentNode.insertBefore(banner, form);
        }

        if (form) {
            const inputs = form.querySelectorAll("input, select, textarea, button");
            inputs.forEach(el => {
                el.disabled = true;
                el.style.backgroundColor = "#f1f5f9";
                el.style.cursor = "not-allowed";
            });

            const submitBtn = form.querySelector('button[type="submit"], .btn-submit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.background = "#94a3b8";
                submitBtn.style.borderColor = "#94a3b8";
                submitBtn.style.cursor = "not-allowed";
                submitBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Restricted for Administrator';
            }
        }
        return true;
    }
    return false;
}

async function initializeAssessmentPage() {
    const isAdmin = checkAdminRole();

    const dateField = getElement("assessmentDate");

    if (dateField) {
        dateField.value = new Date().toISOString().split("T")[0];
    }

    initializeClinician();
    if (!isAdmin) {
        await initializePatientSelect();
    }

    const form = getElement("assessmentForm");

    if (form) {
        form.addEventListener("submit", handleAssessmentSubmit);
    }

    const closeButton = getElement("closeResults");

    if (closeButton) {
        closeButton.addEventListener("click", () => {
            const resultsCard = getElement("resultsCard");

            if (resultsCard) {
                resultsCard.style.display = "none";
            }
        });
    }
}

// Display the logged-in clinician's name.
function initializeClinician() {
    const clinicianField = getElement("clinician");

    if (!clinicianField) return;

    try {
        const user = JSON.parse(
            sessionStorage.getItem("hospitalUser") || "{}"
        );

        clinicianField.value =
            user.fullName ||
            user.full_name ||
            user.username ||
            "";
    } catch (error) {
        console.error("Unable to load clinician information:", error);
    }
}

// Load registered patients from the backend.
async function initializePatientSelect() {
    const patientSelect = getElement("patientId");

    if (!patientSelect) return;

    const token = getToken();

    if (!token) {
        showMessage("Your session has expired. Please log in again.", "error");
        window.location.replace("index.html");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/patients`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load patients.");
        }

        const patients = data.patients || [];

        patientSelect.innerHTML =
            '<option value="">Select a patient</option>';

        patients.forEach(patient => {
            const option = document.createElement("option");

            option.value = patient.id || patient.patientId;

            const patientCode =
                patient.patient_id ||
                patient.patientId ||
                "";

            const patientName =
                patient.full_name ||
                patient.fullName ||
                patient.name ||
                "Unnamed Patient";

            option.textContent = `${patientCode} - ${patientName}`;

            patientSelect.appendChild(option);
        });

        if (patients.length === 0) {
            patientSelect.innerHTML =
                '<option value="">No registered patients found</option>';
        }

    } catch (error) {
        console.error("Patient loading error:", error);

        patientSelect.innerHTML =
            '<option value="">Unable to load patients</option>';

        showMessage(error.message, "error");
    }
}

// Collect the assessment form information.
function collectAssessmentData() {
    return {
        patientId: getFieldValue("patientId"),
        assessmentDate: getFieldValue("assessmentDate"),
        ageGroup: getFieldValue("ageGroup"),
        symptoms: getFieldValue("symptoms"),
        duration: getFieldValue("duration"),
        severity: getFieldValue("severity"),
        temperature: getFieldValue("temperature"),
        bloodPressure: getFieldValue("bloodPressure"),
        pulse: getFieldValue("pulse"),
        respiratoryRate: getFieldValue("respiratory"),
        oxygen: getFieldValue("oxygen"),
        weight: getFieldValue("weight"),
        medicalHistory: getFieldValue("medicalHistory"),
        medications: getFieldValue("medications")
    };
}

// Validate required assessment information.
function validateAssessment(data) {
    if (!data.patientId) {
        return "Please select a patient.";
    }

    if (!data.symptoms) {
        return "Please enter the patient's symptoms.";
    }

    if (!data.severity) {
        return "Please select the symptom severity.";
    }

    return null;
}

// Display a list of AI-generated results.
function renderList(elementId, items, emptyMessage) {
    const element = getElement(elementId);

    if (!element) return;

    if (!items || items.length === 0) {
        element.innerHTML = `<li>${escapeHTML(emptyMessage)}</li>`;
        return;
    }

    element.innerHTML = items
        .map(item => `<li>${escapeHTML(item)}</li>`)
        .join("");
}

// Create additional result sections without changing assessment.html.
function createAIResultSections() {
    const resultsCard = getElement("resultsCard");

    if (!resultsCard) return;

    let aiSections = getElement("aiResultSections");

    if (!aiSections) {
        aiSections = document.createElement("div");
        aiSections.id = "aiResultSections";

        const riskDescription = getElement("riskDescription");

        if (riskDescription) {
            riskDescription.insertAdjacentElement("afterend", aiSections);
        } else {
            resultsCard.prepend(aiSections);
        }
    }

    aiSections.innerHTML = `
        <div class="ai-summary-section" style="margin: 20px 0;">
            <h3>AI Clinical Summary</h3>
            <p id="aiSummaryText"></p>
        </div>

        <div class="ai-warning-section" style="margin: 20px 0;">
            <h3>Warning Signs</h3>
            <ul id="aiWarningList"></ul>
        </div>

        <div class="ai-priority-section" style="margin: 20px 0;">
            <h3>AI Review Priority</h3>
            <p id="aiPriorityText"></p>
        </div>
    `;
}

// Display the AI assessment.
function displayAssessmentResults(assessment) {
    const resultsCard = getElement("resultsCard");

    if (!resultsCard) {
        showMessage("Assessment saved, but the results panel was not found.");
        return;
    }

    createAIResultSections();

    const summary = getElement("aiSummaryText");
    const priority = getElement("aiPriorityText");

    if (summary) {
        summary.textContent =
            assessment.aiSummary || "No AI summary was returned.";
    }

    if (priority) {
        priority.textContent =
            assessment.aiReviewPriority || "Not specified";
    }

    renderList(
        "observationsList",
        assessment.observations,
        "No additional observations."
    );

    renderList(
        "recommendationsList",
        assessment.recommendations,
        "No recommendations returned."
    );

    renderList(
        "aiWarningList",
        assessment.warningSigns,
        "No additional warning signs were identified by the assessment."
    );

    const riskLabel = getElement("riskLabel");
    const riskDescription = getElement("riskDescription");
    const riskPanel = getElement("riskPanel");

    const status = assessment.status || "Clinical Review Required";

    if (riskLabel) {
        riskLabel.textContent = status;
    }

    if (riskDescription) {
        riskDescription.textContent =
            `Assessment reference: ${assessment.assessmentCode || "Generated"}. ` +
            "This is preliminary AI decision support and requires review by a qualified clinician.";
    }

    if (riskPanel) {
        riskPanel.style.display = "block";
    }

    resultsCard.style.display = "block";

    resultsCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// Submit the assessment to the backend.
async function handleAssessmentSubmit(event) {
    event.preventDefault();

    let user = null;
    try {
        user = JSON.parse(sessionStorage.getItem("hospitalUser") || "{}");
    } catch (e) {}

    if (user && user.role === "Administrator") {
        showMessage("Administrators are not permitted to create or perform clinical AI assessments. Only clinical staff (Doctors, Nurses) may conduct assessments.", "error");
        return;
    }

    const form = getElement("assessmentForm");

    if (!form) return;

    const submitButton = form.querySelector(
        'button[type="submit"], button:not([type])'
    );

    const originalButtonText = submitButton
        ? submitButton.textContent
        : "";

    const assessmentData = collectAssessmentData();

    const validationError = validateAssessment(assessmentData);

    if (validationError) {
        showMessage(validationError, "error");
        return;
    }

    const token = getToken();

    if (!token) {
        showMessage("Your session has expired. Please log in again.", "error");
        window.location.replace("index.html");
        return;
    }

    try {
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Generating AI Assessment...";
        }

        const resultsCard = getElement("resultsCard");

        if (resultsCard) {
            resultsCard.style.display = "none";
        }

        const response = await fetch(`${API_URL}/assessments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(assessmentData)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Unable to generate the assessment."
            );
        }

        if (!data.assessment) {
            throw new Error("The server did not return assessment results.");
        }

        displayAssessmentResults(data.assessment);

        showMessage(
            "AI assessment generated and saved successfully.",
            "success"
        );

    } catch (error) {
        console.error("Assessment submission error:", error);

        showMessage(error.message, "error");

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    }
}
