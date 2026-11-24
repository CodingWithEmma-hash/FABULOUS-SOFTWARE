const API_URL = "http://localhost:5001/api";

let allPatients = [];
let allAssessments = [];
let genderStats = { male: 0, female: 0, other: 0 };

let genderChart = null;
let statusChart = null;

const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");
const reportTable = document.getElementById("reportTable");

// Load live report data from backend
async function loadReportData(startDate = "", endDate = "") {
    const token = sessionStorage.getItem("hospitalToken");
    if (!token) return;

    if (reportTable) {
        reportTable.innerHTML = `<tr><td colspan="5" class="empty-row"><i class="fa-solid fa-spinner fa-spin"></i> Loading report data...</td></tr>`;
    }

    try {
        let url = `${API_URL}/reports`;
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Unable to retrieve report analytics.");
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || "Failed to load reports.");
        }

        allAssessments = data.assessments || [];
        genderStats = data.genderStats || { male: 0, female: 0, other: 0 };

        if (data.summary) {
            const patEl = document.getElementById("totalPatients");
            const asmEl = document.getElementById("totalAssessments");
            const clnEl = document.getElementById("clinicalReviews");
            const prmEl = document.getElementById("promptReviews");

            if (patEl) patEl.textContent = data.summary.totalPatients || 0;
            if (asmEl) asmEl.textContent = data.summary.totalAssessments || 0;
            if (clnEl) clnEl.textContent = data.summary.clinicalReviews || 0;
            if (prmEl) prmEl.textContent = data.summary.promptReviews || 0;
        }

        displayReports(allAssessments);
        updateGenderChart(genderStats);
        updateStatusChart(allAssessments);

    } catch (error) {
        console.error("Report loading error:", error);
        if (reportTable) {
            reportTable.innerHTML = `<tr><td colspan="5" class="empty-row" style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHTML(error.message)}</td></tr>`;
        }
    }
}

// Display records in table
function displayReports(records) {
    if (!reportTable) return;

    const clinicalCount = records.filter(record =>
        record.status === "Clinical Review Required"
    ).length;

    const promptCount = records.filter(record =>
        record.status === "Prompt Clinical Review Required"
    ).length;

    const asmEl = document.getElementById("totalAssessments");
    const clnEl = document.getElementById("clinicalReviews");
    const prmEl = document.getElementById("promptReviews");

    if (asmEl) asmEl.textContent = records.length;
    if (clnEl) clnEl.textContent = clinicalCount;
    if (prmEl) prmEl.textContent = promptCount;

    reportTable.innerHTML = "";

    if (records.length === 0) {
        reportTable.innerHTML = `
            <tr>
                <td colspan="5" class="empty-row">
                    No assessment records found for this period.
                </td>
            </tr>
        `;
    } else {
        records.forEach(record => {
            const isPrompt = record.status && record.status.includes("Prompt");
            const statusClass = isPrompt ? "prompt" : "clinical";

            const row = document.createElement("tr");

            row.innerHTML = `
                <td><code>${escapeHTML(record.code || record.id || "Not assigned")}</code></td>
                <td>
                    <strong>${escapeHTML(record.patientName || "Unknown patient")}</strong>
                    ${record.patientId ? `<small style="display:block; color:#64748b; font-size:11px;">${escapeHTML(record.patientId)}</small>` : ""}
                </td>
                <td>${formatDate(record.date || record.assessmentDate)}</td>
                <td>${escapeHTML(record.clinician || "Not recorded")}</td>
                <td>
                    <span class="status ${statusClass}">
                        ${escapeHTML(record.status || "Not specified")}
                    </span>
                </td>
            `;

            reportTable.appendChild(row);
        });
    }

    const countEl = document.getElementById("reportCount");
    if (countEl) {
        countEl.textContent = `${records.length} assessment record(s)`;
    }
}

// Gender chart
function updateGenderChart(counts) {
    const canvas = document.getElementById("genderChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (genderChart) {
        genderChart.destroy();
    }

    genderChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: ["Male", "Female", "Other / Unspecified"],
            datasets: [{
                data: [counts.male || 0, counts.female || 0, counts.other || 0],
                backgroundColor: ["#1769aa", "#f29b38", "#9aa8b7"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            cutout: "65%"
        }
    });
}

// Assessment status chart
function updateStatusChart(records) {
    const canvas = document.getElementById("statusChart");
    if (!canvas || typeof Chart === "undefined") return;

    const clinicalCount = records.filter(r => r.status && !r.status.includes("Prompt")).length;
    const promptCount = records.filter(r => r.status && r.status.includes("Prompt")).length;

    if (statusChart) {
        statusChart.destroy();
    }

    statusChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: ["Clinical Review", "Prompt Review"],
            datasets: [{
                data: [clinicalCount, promptCount],
                backgroundColor: ["#1769aa", "#f29b38"],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            cutout: "65%"
        }
    });
}

// Date formatting
function formatDate(value) {
    if (!value) return "Not recorded";
    try {
        const parts = value.split("-");
        if (parts.length === 3) {
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            return d.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
        }
        return new Date(value).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    } catch (e) {
        return escapeHTML(value);
    }
}

// Escape HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// Apply date filter
const applyFilterBtn = document.getElementById("applyFilter");
if (applyFilterBtn) {
    applyFilterBtn.addEventListener("click", () => {
        const startDate = startDateInput ? startDateInput.value : "";
        const endDate = endDateInput ? endDateInput.value : "";

        if (startDate && endDate && startDate > endDate) {
            alert("The start date cannot be later than the end date.");
            return;
        }

        loadReportData(startDate, endDate);
    });
}

// Clear date filter
const clearFilterBtn = document.getElementById("clearFilter");
if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", () => {
        if (startDateInput) startDateInput.value = "";
        if (endDateInput) endDateInput.value = "";
        loadReportData();
    });
}

// Export CSV report
const exportReportBtn = document.getElementById("exportReport");
if (exportReportBtn) {
    exportReportBtn.addEventListener("click", () => {
        if (allAssessments.length === 0) {
            alert("There are no assessment records to export.");
            return;
        }

        const headers = [
            "Assessment ID",
            "Patient ID",
            "Patient Name",
            "Assessment Date",
            "Clinician",
            "Status",
            "Observations"
        ];

        const rows = allAssessments.map(record => [
            record.code || record.id,
            record.patientId,
            record.patientName,
            record.date || record.assessmentDate,
            record.clinician,
            record.status,
            record.observations
        ]);

        function csvCell(value) {
            let text = String(value ?? "");
            if (/^[\s]*[=+\-@]/.test(text)) {
                text = "'" + text;
            }
            return `"${text.replace(/"/g, '""')}"`;
        }

        const csvContent = [
            headers.map(csvCell).join(","),
            ...rows.map(row => row.map(csvCell).join(","))
        ].join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `hospital-assessment-report-${new Date().toISOString().split("T")[0]}.csv`;

        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    });
}

// Initialize
loadReportData();
