const API_URL = "http://localhost:5001/api";

const assessmentTable = document.getElementById("assessmentTable");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const resetFilters = document.getElementById("resetFilters");

const detailsModal = document.getElementById("detailsModal");
const assessmentDetails = document.getElementById("assessmentDetails");
const closeModalBtn = document.getElementById("closeModal");
const closeDetailsBtn = document.getElementById("closeDetails");
const modalDownloadPdf = document.getElementById("modalDownloadPdf");
const toast = document.getElementById("toast");

let assessments = [];
let currentAssessment = null;

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
    }, 3500);
}

// Escape HTML utility
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// Format date utility (DD Mon YYYY)
function formatDate(dateString) {
    if (!dateString) return "—";
    try {
        const d = new Date(dateString);
        if (Number.isNaN(d.getTime())) {
            const parts = String(dateString).split("-");
            if (parts.length === 3) {
                const manualDate = new Date(parts[0], parts[1] - 1, parts[2]);
                return manualDate.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                });
            }
            return dateString;
        }
        return d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    } catch {
        return dateString;
    }
}

// Format date and time
function formatDateTime(dateString) {
    if (!dateString) return "—";
    try {
        const d = new Date(dateString);
        if (Number.isNaN(d.getTime())) return formatDate(dateString);
        return d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch {
        return dateString;
    }
}

// Normalize array data (parses JSON string if needed)
function normalizeArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
            if (parsed) return [parsed];
        } catch {
            if (value.includes("\n")) {
                return value.split("\n").map(s => s.trim()).filter(Boolean);
            }
            return [value];
        }
    }
    return [String(value)];
}

// Hide New Assessment button for Administrator role
function applyAdminRestrictions() {
    try {
        const user = JSON.parse(sessionStorage.getItem("hospitalUser") || "{}");
        if (user && user.role === "Administrator") {
            const newAssessmentBtn = document.querySelector(".page-heading a[href='assessment.html']");
            if (newAssessmentBtn) {
                newAssessmentBtn.style.display = "none";
            }
        }
    } catch (e) {}
}

// Load records from backend
async function loadAssessments() {
    applyAdminRestrictions();
    const token = sessionStorage.getItem("hospitalToken");
    if (!token) {
        window.location.href = "index.html";
        return;
    }

    if (assessmentTable) {
        assessmentTable.innerHTML = `<tr><td colspan="6" class="empty-row"><i class="fa-solid fa-spinner fa-spin"></i> Loading assessment history...</td></tr>`;
    }

    try {
        const response = await fetch(`${API_URL}/assessments`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Unable to retrieve assessment history.");
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || "Failed to load assessments.");
        }

        assessments = data.assessments || [];

        // Update statistics cards
        const totalEl = document.getElementById("totalAssessments");
        const promptEl = document.getElementById("promptReview") || document.getElementById("urgentReviews");
        const clinicalEl = document.getElementById("clinicalReview") || document.getElementById("standardReviews");

        let urgentCount = 0;
        let standardCount = 0;

        assessments.forEach(item => {
            const status = String(item.status || "");
            if (status.includes("Prompt") || item.aiReviewPriority === "Urgent") {
                urgentCount++;
            } else {
                standardCount++;
            }
        });

        if (totalEl) totalEl.textContent = assessments.length;
        if (promptEl) promptEl.textContent = data.stats?.urgentReview ?? urgentCount;
        if (clinicalEl) clinicalEl.textContent = data.stats?.clinicalReview ?? standardCount;

        // Check URL search parameters (e.g. from dashboard click)
        const params = new URLSearchParams(window.location.search);
        const statusParam = params.get("status");
        if (statusParam && statusFilter) {
            statusFilter.value = statusParam;
        }

        displayAssessments();

    } catch (error) {
        console.error("Load assessments error:", error);
        showToast(error.message, "error");
        if (assessmentTable) {
            assessmentTable.innerHTML = `<tr><td colspan="6" class="empty-row" style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHTML(error.message)}</td></tr>`;
        }
    }
}

// Filter and display assessments
function displayAssessments() {
    if (!assessmentTable) return;

    const searchTerm = (searchInput ? searchInput.value : "").toLowerCase().trim();
    const selectedStatus = statusFilter ? statusFilter.value : "all";

    const filtered = assessments.filter(record => {
        const searchTarget = [
            record.id,
            record.assessmentCode,
            record.patientName,
            record.patientId,
            record.patientCode,
            record.clinician,
            record.symptoms
        ].join(" ").toLowerCase();

        const matchesSearch = !searchTerm || searchTarget.includes(searchTerm);
        const matchesStatus =
            selectedStatus === "all" ||
            !selectedStatus ||
            record.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    assessmentTable.innerHTML = "";

    if (filtered.length === 0) {
        assessmentTable.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">
                    <i class="fa-solid fa-folder-open" style="font-size:24px; margin-bottom:8px; display:block; opacity:0.5;"></i>
                    No assessment records matching your criteria.
                </td>
            </tr>
        `;
    } else {
        filtered.forEach(record => {
            const row = document.createElement("tr");
            const isPrompt = record.status && record.status.includes("Prompt");
            const statusClass = isPrompt ? "status-urgent" : "status-standard";
            const recordId = record.id || record.assessmentCode;

            row.innerHTML = `
                <td><code>${escapeHTML(record.assessmentCode || record.id)}</code></td>
                <td>
                    <span class="patient-name">
                        <strong>${escapeHTML(record.patientName || "Unknown Patient")}</strong>
                        <small style="display:block; color:#64748b; font-size:11px;">ID: ${escapeHTML(record.patientCode || record.patientId || "N/A")}</small>
                    </span>
                </td>
                <td>${escapeHTML(formatDate(record.date || record.assessmentDate))}</td>
                <td>${escapeHTML(record.clinician || "Staff Clinician")}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${escapeHTML(record.status || "Clinical Review Required")}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button class="view-button" data-action="view" data-id="${escapeHTML(recordId)}" title="View Assessment Details">
                            <i class="fa-solid fa-eye"></i> View
                        </button>
                        <button class="view-button download-btn" data-action="download" data-id="${escapeHTML(recordId)}" title="Download Medical Report (PDF)">
                            <i class="fa-solid fa-file-pdf"></i> PDF
                        </button>
                        <button class="view-button delete-btn" data-action="delete" data-id="${escapeHTML(recordId)}" title="Delete Assessment Record">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;

            assessmentTable.appendChild(row);
        });
    }

    const countElement = document.getElementById("recordCount") || document.getElementById("resultCount");
    if (countElement) {
        countElement.textContent = `Showing ${filtered.length} of ${assessments.length} assessment records`;
    }
}

// Show assessment details in modal
function showDetails(id) {
    const record = assessments.find(item =>
        String(item.id) === String(id) ||
        String(item.assessmentCode) === String(id) ||
        String(item.dbId) === String(id)
    );

    if (!record || !assessmentDetails) return;

    currentAssessment = record;

    const isPrompt = record.status && record.status.includes("Prompt");
    const statusClass = isPrompt ? "status-urgent" : "status-standard";
    const observations = normalizeArray(record.observations);
    const recommendations = normalizeArray(record.recommendations);
    const warningSigns = normalizeArray(record.warningSigns);

    const tempVal = parseFloat(record.temperature);
    const isTempElevated = !Number.isNaN(tempVal) && tempVal >= 38.0;

    assessmentDetails.innerHTML = `
        <div class="detail-section">
            <h3><i class="fa-solid fa-id-card-clip"></i> Patient & Case Overview</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <small>Assessment Code</small>
                    <strong><code>${escapeHTML(record.assessmentCode || record.id)}</code></strong>
                </div>
                <div class="detail-item">
                    <small>Date of Assessment</small>
                    <strong>${escapeHTML(formatDateTime(record.date || record.assessmentDate || record.createdAt))}</strong>
                </div>
                <div class="detail-item">
                    <small>Patient Full Name</small>
                    <strong>${escapeHTML(record.patientName || "—")}</strong>
                </div>
                <div class="detail-item">
                    <small>Patient Folder ID</small>
                    <strong>${escapeHTML(record.patientCode || record.patientId || "—")}</strong>
                </div>
                <div class="detail-item">
                    <small>Age Group</small>
                    <strong style="text-transform: capitalize;">${escapeHTML(record.ageGroup || "—")}</strong>
                </div>
                <div class="detail-item">
                    <small>Gender</small>
                    <strong>${escapeHTML(record.gender || "—")}</strong>
                </div>
                <div class="detail-item">
                    <small>Attending Clinician</small>
                    <strong>${escapeHTML(record.clinician || "Staff Clinician")}</strong>
                </div>
                <div class="detail-item">
                    <small>Clinical Status</small>
                    <span class="status-badge ${statusClass}">${escapeHTML(record.status || "Clinical Review Required")}</span>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3><i class="fa-solid fa-heart-pulse"></i> Vital Signs & Clinical Measurements</h3>
            <div class="vitals-grid-modal">
                <div class="vital-chip" style="${isTempElevated ? 'border-color:#fca5a5; background:#fff1f2;' : ''}">
                    <small>Temperature</small>
                    <div class="vital-val" style="${isTempElevated ? 'color:#b91c1c;' : ''}">
                        ${escapeHTML(record.temperature || "—")} °C
                    </div>
                </div>
                <div class="vital-chip">
                    <small>Blood Pressure</small>
                    <div class="vital-val">${escapeHTML(record.bloodPressure || "—")}</div>
                </div>
                <div class="vital-chip">
                    <small>Pulse (Heart Rate)</small>
                    <div class="vital-val">${escapeHTML(record.pulse || "—")} BPM</div>
                </div>
                <div class="vital-chip">
                    <small>Respiratory Rate</small>
                    <div class="vital-val">${escapeHTML(record.respiratoryRate || "—")} /min</div>
                </div>
                <div class="vital-chip">
                    <small>Oxygen (SpO2)</small>
                    <div class="vital-val">${escapeHTML(record.oxygen || "—")} %</div>
                </div>
                <div class="vital-chip">
                    <small>Weight</small>
                    <div class="vital-val">${escapeHTML(record.weight || "—")} kg</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3><i class="fa-solid fa-notes-medical"></i> Symptoms & Clinical Presentation</h3>
            <div class="detail-grid">
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <small>Reported Symptoms</small>
                    <strong>${escapeHTML(record.symptoms || "None reported")}</strong>
                </div>
                <div class="detail-item">
                    <small>Severity</small>
                    <strong style="text-transform: capitalize;">${escapeHTML(record.severity || "Moderate")}</strong>
                </div>
                <div class="detail-item">
                    <small>Duration</small>
                    <strong>${escapeHTML(record.duration ? `${record.duration} day(s)` : "—")}</strong>
                </div>
                <div class="detail-item">
                    <small>Medical History</small>
                    <strong>${escapeHTML(record.medicalHistory || "None reported")}</strong>
                </div>
                <div class="detail-item">
                    <small>Current Medications</small>
                    <strong>${escapeHTML(record.medications || "None")}</strong>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3><i class="fa-solid fa-brain"></i> AI Clinical Summary & Observations</h3>
            ${record.aiSummary ? `
                <div style="margin-bottom:12px;">
                    <small style="display:block; color:#64748b; font-size:11px; font-weight:600; text-transform:uppercase; margin-bottom:4px;">Clinical Synthesis</small>
                    <p style="margin:0; font-size:13px; line-height:1.6; color:#1e293b; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                        ${escapeHTML(record.aiSummary)}
                    </p>
                </div>
            ` : ""}

            <div style="margin-top:10px;">
                <small style="display:block; color:#64748b; font-size:11px; font-weight:600; text-transform:uppercase; margin-bottom:6px;">Key Observations</small>
                ${observations.length > 0 ? `
                    <ul class="recommendations-list">
                        ${observations.map(obs => `<li>${escapeHTML(obs)}</li>`).join("")}
                    </ul>
                ` : `<p class="detail-observations">Standard clinical review required.</p>`}
            </div>

            ${warningSigns.length > 0 ? `
                <div class="warning-callout">
                    <strong><i class="fa-solid fa-triangle-exclamation"></i> Critical Warning Signs Flagged</strong>
                    <ul>
                        ${warningSigns.map(sign => `<li>${escapeHTML(sign)}</li>`).join("")}
                    </ul>
                </div>
            ` : ""}
        </div>

        <div class="detail-section">
            <h3><i class="fa-solid fa-clipboard-check"></i> Recommendations & Proposed Plan</h3>
            ${recommendations.length > 0 ? `
                <ol class="recommendations-list">
                    ${recommendations.map(rec => `<li>${escapeHTML(rec)}</li>`).join("")}
                </ol>
            ` : `<p style="font-size:13px; color:#64748b; margin:0;">No specific recommendations recorded.</p>`}
        </div>
    `;

    if (detailsModal) {
        detailsModal.classList.add("show");
        detailsModal.classList.add("active");
    }
}

// Hide details modal
function hideDetails() {
    if (detailsModal) {
        detailsModal.classList.remove("show");
        detailsModal.classList.remove("active");
    }
    currentAssessment = null;
}

// Delete assessment
async function deleteAssessment(id) {
    const confirmed = confirm("Are you sure you want to delete this assessment record?\n\nThis action cannot be undone.");
    if (!confirmed) return;

    const token = sessionStorage.getItem("hospitalToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/assessments/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to delete assessment.");
        }

        showToast("Assessment record deleted successfully.", "success");
        await loadAssessments();

    } catch (error) {
        console.error("Delete assessment error:", error);
        showToast(error.message, "error");
    }
}

// Generate and Download Official Doctor's Report as PDF
async function downloadAssessmentPDF(recordOrId) {
    let record = recordOrId;

    if (typeof recordOrId === "string" || typeof recordOrId === "number") {
        record = assessments.find(item =>
            String(item.id) === String(recordOrId) ||
            String(item.assessmentCode) === String(recordOrId) ||
            String(item.dbId) === String(recordOrId)
        );
    }

    if (!record) {
        showToast("Unable to find assessment record to download.", "error");
        return;
    }

    showToast("Generating official doctor's report PDF...", "success");

    const assessmentCode = record.assessmentCode || `ASM-${record.id}`;
    const patientName = record.patientName || "Unknown Patient";
    const patientCode = record.patientCode || record.patientId || "GH-N/A";
    const dateFormatted = formatDate(record.date || record.assessmentDate);
    const datePrinted = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
    const clinicianName = record.clinician || "Staff Clinician";
    const status = record.status || "Clinical Review Required";
    const isUrgent = (status && status.includes("Prompt")) || record.aiReviewPriority === "Urgent";

    const observations = normalizeArray(record.observations);
    const recommendations = normalizeArray(record.recommendations);
    const warningSigns = normalizeArray(record.warningSigns);

    const tempVal = parseFloat(record.temperature);
    const isTempElevated = !Number.isNaN(tempVal) && tempVal >= 38.0;

    // Build the official medical report element
    const container = document.createElement("div");
    container.id = "official-doctor-report-pdf";
    container.style.width = "780px";
    container.style.padding = "30px 36px";
    container.style.background = "#ffffff";
    container.style.color = "#0f172a";
    container.style.fontFamily = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    container.style.fontSize = "12px";
    container.style.lineHeight = "1.5";
    container.style.boxSizing = "border-box";
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.zIndex = "-9999";

    container.innerHTML = `
        <!-- OFFICIAL HOSPITAL LETTERHEAD -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 3px solid #104b9a;">
            <!-- Left: Site Logo and Hospital Branding -->
            <div style="display: flex; align-items: center; gap: 14px;">
                <!-- Hospital Site Logo SVG -->
                <svg width="52" height="52" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
                    <rect width="48" height="48" rx="12" fill="#1769d2"/>
                    <path d="M24 10V38M10 24H38" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"/>
                    <path d="M9 25H16L19 19L24 31L28 22L31 26H39" stroke="#f39a32" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div>
                    <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #0f3b75; letter-spacing: 0.5px; text-transform: uppercase;">
                        General Hospital, Ikot Ekpene
                    </h1>
                    <p style="margin: 2px 0 0; font-size: 11px; font-weight: 600; color: #1769d2; letter-spacing: 0.2px;">
                        Department of Clinical Medicine & AI Decision Support Services
                    </p>
                    <p style="margin: 3px 0 0; font-size: 10px; color: #64748b;">
                        14 Hospital Road, Ikot Ekpene, Akwa Ibom State, Nigeria &bull; Tel: +234 803 000 1234
                    </p>
                </div>
            </div>

            <!-- Right: Document Classification Badge -->
            <div style="text-align: right;">
                <div style="display: inline-block; background: #0f3b75; color: #ffffff; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">
                    Official Medical Report
                </div>
                <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
                    Confidential Clinical Record
                </div>
                <div style="font-size: 10px; font-weight: 700; color: #0f3b75; margin-top: 2px;">
                    Ref: <code>${escapeHTML(assessmentCode)}</code>
                </div>
            </div>
        </div>

        <!-- Decorative Accent Bar -->
        <div style="height: 3px; background: #f39a32; margin-top: 2px; margin-bottom: 16px;"></div>

        <!-- REPORT META RIBBON -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
            <div>
                <strong style="color: #64748b; font-size: 10px; text-transform: uppercase; display: block;">Encounter Date</strong>
                <span style="font-weight: 700; color: #1e293b;">${escapeHTML(dateFormatted)}</span>
            </div>
            <div>
                <strong style="color: #64748b; font-size: 10px; text-transform: uppercase; display: block;">Attending Clinician</strong>
                <span style="font-weight: 700; color: #1e293b;">${escapeHTML(clinicianName)}</span>
            </div>
            <div>
                <strong style="color: #64748b; font-size: 10px; text-transform: uppercase; display: block;">Evaluation Type</strong>
                <span style="font-weight: 700; color: #1e293b;">AI-Assisted Outpatient Clinical DSS</span>
            </div>
            <div>
                <strong style="color: #64748b; font-size: 10px; text-transform: uppercase; display: block;">Triage Status</strong>
                <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; ${isUrgent ? 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;' : 'background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;'}">
                    ${escapeHTML(status)}
                </span>
            </div>
        </div>

        <!-- SECTION 1: PATIENT DEMOGRAPHICS -->
        <div style="margin-bottom: 16px;">
            <div style="background: #0f3b75; color: #ffffff; padding: 5px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 4px 4px 0 0;">
                1. Patient Demographic & Encounter Profile
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #cbd5e1; border-top: none;">
                <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 7px 10px; background: #f8fafc; width: 22%; font-weight: 600; color: #475569;">Patient Full Name</td>
                        <td style="padding: 7px 10px; width: 28%; font-weight: 700; color: #0f172a;">${escapeHTML(patientName)}</td>
                        <td style="padding: 7px 10px; background: #f8fafc; width: 22%; font-weight: 600; color: #475569;">Hospital Folder ID</td>
                        <td style="padding: 7px 10px; width: 28%; font-weight: 700; color: #0f3b75;"><code>${escapeHTML(patientCode)}</code></td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 7px 10px; background: #f8fafc; font-weight: 600; color: #475569;">Age Category</td>
                        <td style="padding: 7px 10px; text-transform: capitalize; color: #0f172a;">${escapeHTML(record.ageGroup || "Adult")}</td>
                        <td style="padding: 7px 10px; background: #f8fafc; font-weight: 600; color: #475569;">Gender</td>
                        <td style="padding: 7px 10px; color: #0f172a;">${escapeHTML(record.gender || "—")}</td>
                    </tr>
                    <tr>
                        <td style="padding: 7px 10px; background: #f8fafc; font-weight: 600; color: #475569;">Contact Telephone</td>
                        <td style="padding: 7px 10px; color: #0f172a;">${escapeHTML(record.phone || "—")}</td>
                        <td style="padding: 7px 10px; background: #f8fafc; font-weight: 600; color: #475569;">Blood Group / Genotype</td>
                        <td style="padding: 7px 10px; color: #0f172a;">
                            ${escapeHTML(record.bloodGroup || "—")} / ${escapeHTML(record.genotype || "—")}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- SECTION 2: VITAL SIGNS -->
        <div style="margin-bottom: 16px;">
            <div style="background: #0f3b75; color: #ffffff; padding: 5px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 4px 4px 0 0;">
                2. Triage Vital Signs & Physiological Measurements
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #cbd5e1; border-top: none; text-align: center;">
                <thead>
                    <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-weight: 700; color: #334155; font-size: 10px;">
                        <th style="padding: 6px 8px;">TEMPERATURE</th>
                        <th style="padding: 6px 8px;">BLOOD PRESSURE</th>
                        <th style="padding: 6px 8px;">PULSE RATE</th>
                        <th style="padding: 6px 8px;">RESPIRATORY</th>
                        <th style="padding: 6px 8px;">SPO2 (OXYGEN)</th>
                        <th style="padding: 6px 8px;">BODY WEIGHT</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 8px 6px; font-weight: 700; font-size: 12px; ${isTempElevated ? 'color:#b91c1c; background:#fff1f2;' : 'color:#0f172a;'}">
                            ${escapeHTML(record.temperature || "—")} °C
                            ${isTempElevated ? '<br><span style="font-size:9px; color:#b91c1c; font-weight:600;">(Pyrexia)</span>' : ''}
                        </td>
                        <td style="padding: 8px 6px; font-weight: 700; font-size: 12px; color: #0f172a;">
                            ${escapeHTML(record.bloodPressure || "—")} mmHg
                        </td>
                        <td style="padding: 8px 6px; font-weight: 700; font-size: 12px; color: #0f172a;">
                            ${escapeHTML(record.pulse || "—")} BPM
                        </td>
                        <td style="padding: 8px 6px; font-weight: 700; font-size: 12px; color: #0f172a;">
                            ${escapeHTML(record.respiratoryRate || "—")} /min
                        </td>
                        <td style="padding: 8px 6px; font-weight: 700; font-size: 12px; color: #0f172a;">
                            ${escapeHTML(record.oxygen || "—")} %
                        </td>
                        <td style="padding: 8px 6px; font-weight: 700; font-size: 12px; color: #0f172a;">
                            ${escapeHTML(record.weight || "—")} kg
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- SECTION 3: CLINICAL PRESENTATION -->
        <div style="margin-bottom: 16px;">
            <div style="background: #0f3b75; color: #ffffff; padding: 5px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 4px 4px 0 0;">
                3. Chief Complaints & Clinical History
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #cbd5e1; border-top: none;">
                <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 6px 10px; background: #f8fafc; width: 25%; font-weight: 600; color: #475569;">Presenting Symptoms</td>
                        <td style="padding: 6px 10px; font-weight: 700; color: #0f172a;" colspan="3">${escapeHTML(record.symptoms || "None reported")}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 6px 10px; background: #f8fafc; font-weight: 600; color: #475569;">Duration</td>
                        <td style="padding: 6px 10px; width: 25%; color: #0f172a;">${escapeHTML(record.duration ? `${record.duration} day(s)` : "—")}</td>
                        <td style="padding: 6px 10px; background: #f8fafc; width: 25%; font-weight: 600; color: #475569;">Reported Severity</td>
                        <td style="padding: 6px 10px; width: 25%; text-transform: capitalize; color: #0f172a;">${escapeHTML(record.severity || "Moderate")}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 10px; background: #f8fafc; font-weight: 600; color: #475569;">Past Medical History</td>
                        <td style="padding: 6px 10px; color: #0f172a;">${escapeHTML(record.medicalHistory || "None reported")}</td>
                        <td style="padding: 6px 10px; background: #f8fafc; font-weight: 600; color: #475569;">Current Medications</td>
                        <td style="padding: 6px 10px; color: #0f172a;">${escapeHTML(record.medications || "None")}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- SECTION 4: AI DIAGNOSTIC FINDINGS & OBSERVATIONS -->
        <div style="margin-bottom: 16px;">
            <div style="background: #0f3b75; color: #ffffff; padding: 5px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 4px 4px 0 0;">
                4. Diagnostic Observations & Clinical Synthesis
            </div>
            <div style="border: 1px solid #cbd5e1; border-top: none; padding: 10px 14px; font-size: 11px; background: #ffffff;">
                ${record.aiSummary ? `
                    <div style="background: #f8fafc; border-left: 3px solid #1769d2; padding: 8px 10px; margin-bottom: 10px; font-size: 11px; color: #1e293b; line-height: 1.55;">
                        <strong style="color: #0f3b75; display: block; font-size: 10px; text-transform: uppercase; margin-bottom: 2px;">Clinical Case Summary:</strong>
                        ${escapeHTML(record.aiSummary)}
                    </div>
                ` : ""}

                <div style="margin-bottom: 6px;">
                    <strong style="color: #0f3b75; font-size: 10px; text-transform: uppercase;">Key Clinical Observations:</strong>
                    ${observations.length > 0 ? `
                        <ul style="margin: 4px 0 8px; padding-left: 18px; color: #334155; line-height: 1.5;">
                            ${observations.map(obs => `<li>${escapeHTML(obs)}</li>`).join("")}
                        </ul>
                    ` : `<p style="margin: 4px 0; color: #64748b;">Standard clinical examination protocol maintained.</p>`}
                </div>

                ${warningSigns.length > 0 ? `
                    <div style="background: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; padding: 8px 10px; border-radius: 4px; margin-top: 6px;">
                        <strong style="color: #9f1239; font-size: 10px; text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
                            &#9888; Critical Warning Signs & Clinical Red Flags:
                        </strong>
                        <ul style="margin: 4px 0 0; padding-left: 18px; color: #881337; font-size: 10.5px;">
                            ${warningSigns.map(sign => `<li>${escapeHTML(sign)}</li>`).join("")}
                        </ul>
                    </div>
                ` : ""}
            </div>
        </div>

        <!-- SECTION 5: RECOMMENDATIONS -->
        <div style="margin-bottom: 18px;">
            <div style="background: #0f3b75; color: #ffffff; padding: 5px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 4px 4px 0 0;">
                5. Clinical Recommendations & Action Plan
            </div>
            <div style="border: 1px solid #cbd5e1; border-top: none; padding: 10px 14px; font-size: 11px; background: #ffffff;">
                ${recommendations.length > 0 ? `
                    <ol style="margin: 0; padding-left: 18px; color: #1e293b; line-height: 1.6;">
                        ${recommendations.map(rec => `<li style="margin-bottom: 4px;">${escapeHTML(rec)}</li>`).join("")}
                    </ol>
                ` : `<p style="margin: 0; color: #64748b;">Standard follow-up and monitoring recommended.</p>`}
            </div>
        </div>

        <!-- SECTION 6: DOCTOR ATTESTATION & OFFICIAL HOSPITAL SEAL -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
            <!-- Clinician Sign-off Block -->
            <div style="width: 55%;">
                <div style="font-size: 10px; font-weight: 700; color: #0f3b75; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 24px;">
                    Attending Clinician / Reviewing Officer Attestation
                </div>
                <div style="border-bottom: 1px solid #0f172a; width: 220px; margin-bottom: 4px;"></div>
                <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Dr. ${escapeHTML(clinicianName)}</div>
                <div style="font-size: 10px; color: #64748b;">Medical Officer &bull; General Hospital Ikot Ekpene</div>
                <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Date Certified: ${escapeHTML(datePrinted)}</div>
            </div>

            <!-- Official Hospital Seal Stamp (SVG) -->
            <div style="width: 40%; text-align: center;">
                <svg width="112" height="112" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="56" fill="none" stroke="#0f3b75" stroke-width="2.5" stroke-dasharray="4 2"/>
                    <circle cx="60" cy="60" r="48" fill="none" stroke="#0f3b75" stroke-width="1.5"/>
                    <circle cx="60" cy="60" r="32" fill="#f0f7ff" stroke="#1769d2" stroke-width="1"/>
                    <text x="60" y="24" text-anchor="middle" fill="#0f3b75" font-size="7" font-weight="800" font-family="'Segoe UI', Arial, sans-serif" letter-spacing="1">GENERAL HOSPITAL</text>
                    <text x="60" y="33" text-anchor="middle" fill="#1769d2" font-size="6.5" font-weight="700" font-family="'Segoe UI', Arial, sans-serif" letter-spacing="1.5">&#9733; IKOT EKPENE &#9733;</text>
                    <text x="60" y="58" text-anchor="middle" fill="#0f3b75" font-size="6" font-weight="700" font-family="'Segoe UI', Arial, sans-serif">CLINICAL DSS</text>
                    <text x="60" y="67" text-anchor="middle" fill="#16a34a" font-size="8" font-weight="900" font-family="'Segoe UI', Arial, sans-serif" letter-spacing="0.5">VERIFIED</text>
                    <text x="60" y="76" text-anchor="middle" fill="#64748b" font-size="6" font-family="'Segoe UI', Arial, sans-serif">${escapeHTML(datePrinted)}</text>
                    <text x="60" y="98" text-anchor="middle" fill="#0f3b75" font-size="6.5" font-weight="700" font-family="'Segoe UI', Arial, sans-serif" letter-spacing="0.8">MEDICAL RECORDS</text>
                </svg>
            </div>
        </div>

        <!-- SECTION 7: STATUTORY CONFIDENTIALITY & DISCLAIMER -->
        <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 8.5px; color: #94a3b8; line-height: 1.45; text-align: justify;">
            <strong>STATUTORY MEDICAL CONFIDENTIALITY NOTICE:</strong> This clinical record contains confidential patient healthcare data protected under the National Health Act and international medical privacy standards. Unauthorized duplication or distribution is strictly prohibited. The recommendations herein were generated in assistance with the General Hospital Ikot Ekpene AI Clinical Decision Support System to assist certified physicians and clinical officers. Definitive clinical judgment and final prescription remain under the direct authority of the attending licensed medical practitioner.
        </div>
        <div style="margin-top: 6px; display: flex; justify-content: space-between; font-size: 8.5px; color: #94a3b8;">
            <span>System Document: ${escapeHTML(assessmentCode)} &bull; GH-IKP-DSS</span>
            <span>Official Clinical Output &bull; Page 1 of 1</span>
        </div>
    `;

    document.body.appendChild(container);

    const safePatient = String(patientName).replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeRef = String(assessmentCode).replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Doctor_Report_${safePatient}_${safeRef}.pdf`;

    const opt = {
        margin: [6, 8, 6, 8],
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            letterRendering: true,
            scrollY: 0
        },
        jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait"
        }
    };

    if (typeof html2pdf !== "undefined") {
        container.style.position = "static";
        container.style.left = "auto";
        container.style.top = "auto";
        container.style.zIndex = "1";

        // Create a wrapper to isolate styling
        const wrapper = document.createElement("div");
        wrapper.style.position = "fixed";
        wrapper.style.left = "0";
        wrapper.style.top = "0";
        wrapper.style.width = "100%";
        wrapper.style.height = "100%";
        wrapper.style.background = "rgba(0,0,0,0.5)";
        wrapper.style.zIndex = "99999";
        wrapper.style.display = "flex";
        wrapper.style.justifyContent = "center";
        wrapper.style.alignItems = "flex-start";
        wrapper.style.overflow = "auto";
        wrapper.style.padding = "20px";
        wrapper.appendChild(container);
        document.body.appendChild(wrapper);

        try {
            await html2pdf().set(opt).from(container).save();
            showToast("Official doctor's report PDF saved successfully.", "success");
        } catch (err) {
            console.error("html2pdf generation error:", err);
            fallbackPrint(container, filename);
        } finally {
            if (wrapper && wrapper.parentNode) {
                wrapper.parentNode.removeChild(wrapper);
            }
        }
    } else {
        fallbackPrint(container, filename);
    }
}

// Fallback printing method
function fallbackPrint(container, filename) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        showToast("Please allow popups to save/print the medical report.", "error");
        if (container.parentNode) container.parentNode.removeChild(container);
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>${escapeHTML(filename)}</title>
            <style>
                @page { size: A4 portrait; margin: 10mm; }
                body {
                    margin: 0;
                    padding: 0;
                    background: #ffffff;
                    color: #0f172a;
                    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                }
                @media print {
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            </style>
        </head>
        <body>
            ${container.innerHTML}
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 400);
                };
            <\/script>
        </body>
        </html>
    `);

    printWindow.document.close();
    if (container.parentNode) container.parentNode.removeChild(container);
    showToast("Opening print dialogue to save as PDF...", "success");
}

// Table action buttons event delegation
if (assessmentTable) {
    assessmentTable.addEventListener("click", event => {
        const target = event.target.closest("button");
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === "view") {
            showDetails(id);
        } else if (action === "download") {
            downloadAssessmentPDF(id);
        } else if (action === "delete") {
            deleteAssessment(id);
        }
    });
}

// Modal action buttons
if (modalDownloadPdf) {
    modalDownloadPdf.addEventListener("click", () => {
        if (currentAssessment) {
            downloadAssessmentPDF(currentAssessment);
        }
    });
}

if (closeModalBtn) closeModalBtn.addEventListener("click", hideDetails);
if (closeDetailsBtn) closeDetailsBtn.addEventListener("click", hideDetails);

if (detailsModal) {
    detailsModal.addEventListener("click", event => {
        if (event.target === detailsModal) hideDetails();
    });
}

// Keyboard shortcuts (Escape closes modal)
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && detailsModal && detailsModal.classList.contains("show")) {
        hideDetails();
    }
});

// Search & Filter listeners
if (searchInput) searchInput.addEventListener("input", displayAssessments);
if (statusFilter) statusFilter.addEventListener("change", displayAssessments);

if (resetFilters) {
    resetFilters.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (statusFilter) statusFilter.value = "all";
        displayAssessments();
    });
}

// Initialize on page load
loadAssessments();
