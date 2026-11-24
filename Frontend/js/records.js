const API_URL = "http://localhost:5001/api";

let patients = [];

// Elements
const tableBody = document.getElementById("patientTableBody");
const searchInput = document.getElementById("searchInput");
const genderFilter = document.getElementById("genderFilter");
const resetFilterBtn = document.getElementById("resetFilter");
const emptyState = document.getElementById("emptyState");
const showingText = document.getElementById("showingText");
const recordCount = document.getElementById("recordCount");

const totalPatientsEl = document.getElementById("totalPatients");
const malePatientsEl = document.getElementById("malePatients");
const femalePatientsEl = document.getElementById("femalePatients");

const detailsModal = document.getElementById("detailsModal");
const editModal = document.getElementById("editModal");
const patientDetailsEl = document.getElementById("patientDetails");
const editForm = document.getElementById("editForm");
const toast = document.getElementById("toast");

// Toast helper
let toastTimer;
function showToast(message, type = "success") {
    if (!toast) {
        alert(message);
        return;
    }
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);
}

// Escape HTML utility
function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Format date utility
function formatDate(dateString) {
    if (!dateString) return "—";
    try {
        const parts = dateString.split("-");
        if (parts.length === 3) {
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            return d.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
        }
        return new Date(dateString).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    } catch (e) {
        return dateString;
    }
}

// Load patients from backend
async function loadPatients() {
    const token = sessionStorage.getItem("hospitalToken");
    if (!token) return;

    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Loading patient records...</td></tr>`;
    }

    try {
        const response = await fetch(`${API_URL}/patients`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error("Unable to retrieve patient records.");
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || "Failed to load patient records.");
        }

        patients = data.patients || [];

        // Update statistics
        if (data.stats) {
            if (totalPatientsEl) totalPatientsEl.textContent = data.stats.total || 0;
            if (malePatientsEl) malePatientsEl.textContent = data.stats.male || 0;
            if (femalePatientsEl) femalePatientsEl.textContent = data.stats.female || 0;
        } else {
            updateStatsFromList(patients);
        }

        renderTable();

    } catch (error) {
        console.error("Load patients error:", error);
        showToast(error.message, "error");
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHTML(error.message)}</td></tr>`;
        }
    }
}

function updateStatsFromList(list) {
    const total = list.length;
    const male = list.filter(p => (p.gender || "").toLowerCase() === "male").length;
    const female = list.filter(p => (p.gender || "").toLowerCase() === "female").length;

    if (totalPatientsEl) totalPatientsEl.textContent = total;
    if (malePatientsEl) malePatientsEl.textContent = male;
    if (femalePatientsEl) femalePatientsEl.textContent = female;
}

// Filter patients
function getFilteredPatients() {
    const query = (searchInput ? searchInput.value : "").trim().toLowerCase();
    const gender = genderFilter ? genderFilter.value : "All";

    return patients.filter(p => {
        const matchesQuery =
            !query ||
            (p.name && p.name.toLowerCase().includes(query)) ||
            (p.fullName && p.fullName.toLowerCase().includes(query)) ||
            (p.patientId && p.patientId.toLowerCase().includes(query)) ||
            (p.phone && p.phone.toLowerCase().includes(query));

        const matchesGender =
            gender === "All" ||
            !gender ||
            (p.gender && p.gender.toLowerCase() === gender.toLowerCase());

        return matchesQuery && matchesGender;
    });
}

// Render patient table
function renderTable() {
    if (!tableBody) return;

    const filtered = getFilteredPatients();
    tableBody.innerHTML = "";

    if (filtered.length === 0) {
        if (emptyState) emptyState.classList.remove("hidden");
        if (showingText) {
            showingText.textContent = `Showing 0 of ${patients.length} records`;
        }
        return;
    }

    if (emptyState) emptyState.classList.add("hidden");
    if (showingText) {
        showingText.textContent = `Showing ${filtered.length} of ${patients.length} records`;
    }

    filtered.forEach(p => {
        const tr = document.createElement("tr");
        const genderClass = (p.gender || "").toLowerCase();

        tr.innerHTML = `
            <td><span class="patient-id">${escapeHTML(p.patientId || p.id)}</span></td>
            <td>
                <div class="patient-name-cell">
                    <strong>${escapeHTML(p.fullName || p.name)}</strong>
                    ${p.email ? `<small>${escapeHTML(p.email)}</small>` : ""}
                </div>
            </td>
            <td><span class="gender-tag ${genderClass}">${escapeHTML(p.gender || "—")}</span></td>
            <td>${escapeHTML(p.phone || "—")}</td>
            <td>${escapeHTML(formatDate(p.dob || p.dateOfBirth))}</td>
            <td>
                <div class="action-cell">
                    <button class="action-btn view-btn" data-id="${escapeHTML(p.id || p.patientId)}" title="View Record">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                    <button class="action-btn edit-btn" data-id="${escapeHTML(p.id || p.patientId)}" title="Edit Record">
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button class="action-btn del-btn" data-id="${escapeHTML(p.id || p.patientId)}" title="Delete Record">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// Search and filter listeners
if (searchInput) {
    searchInput.addEventListener("input", renderTable);
}

if (genderFilter) {
    genderFilter.addEventListener("change", renderTable);
}

if (resetFilterBtn) {
    resetFilterBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (genderFilter) genderFilter.value = "All";
        renderTable();
    });
}

// Modal handling
function openModal(modal) {
    if (modal) modal.classList.add("show");
}

function closeModal(modal) {
    if (modal) modal.classList.remove("show");
}

document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-close");
        closeModal(document.getElementById(targetId));
    });
});

window.addEventListener("click", e => {
    if (e.target === detailsModal) closeModal(detailsModal);
    if (e.target === editModal) closeModal(editModal);
});

// View Details Modal
function viewPatientDetails(id) {
    const p = patients.find(item => String(item.id) === String(id) || String(item.patientId) === String(id));
    if (!p || !patientDetailsEl) return;

    patientDetailsEl.innerHTML = `
        <div class="detail-item">
            <span class="detail-label">Full Name</span>
            <span class="detail-value"><strong>${escapeHTML(p.fullName || p.name)}</strong></span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Patient ID</span>
            <span class="detail-value"><code>${escapeHTML(p.patientId || p.id)}</code></span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Gender</span>
            <span class="detail-value">${escapeHTML(p.gender || "—")}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Date of Birth</span>
            <span class="detail-value">${escapeHTML(formatDate(p.dob || p.dateOfBirth))}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Phone Number</span>
            <span class="detail-value">${escapeHTML(p.phone || "—")}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Email Address</span>
            <span class="detail-value">${escapeHTML(p.email || "—")}</span>
        </div>
        <div class="detail-item full-width">
            <span class="detail-label">Residential Address</span>
            <span class="detail-value">${escapeHTML(p.address || p.residentialAddress || "—")}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Emergency Contact</span>
            <span class="detail-value">${escapeHTML(p.emergencyName || p.contactPerson || "—")}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Relationship</span>
            <span class="detail-value">${escapeHTML(p.relationship || "—")}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Emergency Phone</span>
            <span class="detail-value">${escapeHTML(p.emergencyPhone || "—")}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Blood Group</span>
            <span class="detail-value">${escapeHTML(p.bloodGroup || "Unknown")}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Genotype</span>
            <span class="detail-value">${escapeHTML(p.genotype || "Unknown")}</span>
        </div>
        <div class="detail-item full-width">
            <span class="detail-label">Known Allergies</span>
            <span class="detail-value">${escapeHTML(p.allergies || "None")}</span>
        </div>
        <div class="detail-item full-width">
            <span class="detail-label">Medical History</span>
            <span class="detail-value">${escapeHTML(p.medicalHistory || "None")}</span>
        </div>
    `;

    openModal(detailsModal);
}

// Edit Modal
function openEditPatient(id) {
    const p = patients.find(item => String(item.id) === String(id) || String(item.patientId) === String(id));
    if (!p) return;

    document.getElementById("editId").value = p.id || p.patientId;
    document.getElementById("editName").value = p.fullName || p.name || "";
    document.getElementById("editGender").value = p.gender || "Male";
    document.getElementById("editPhone").value = p.phone || "";
    document.getElementById("editDob").value = p.dob || p.dateOfBirth || "";
    document.getElementById("editEmail").value = p.email || "";
    document.getElementById("editAddress").value = p.address || p.residentialAddress || "";

    openModal(editModal);
}

// Save Edit
if (editForm) {
    editForm.addEventListener("submit", async e => {
        e.preventDefault();

        const token = sessionStorage.getItem("hospitalToken");
        if (!token) {
            window.location.replace("index.html");
            return;
        }

        const id = document.getElementById("editId").value;
        const payload = {
            fullName: document.getElementById("editName").value.trim(),
            gender: document.getElementById("editGender").value,
            phone: document.getElementById("editPhone").value.trim(),
            dob: document.getElementById("editDob").value,
            email: document.getElementById("editEmail").value.trim(),
            address: document.getElementById("editAddress").value.trim()
        };

        const submitBtn = editForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const response = await fetch(`${API_URL}/patients/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to update patient record.");
            }

            showToast("Patient record updated successfully.");
            closeModal(editModal);
            await loadPatients();

        } catch (error) {
            console.error("Edit patient error:", error);
            showToast(error.message, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Save Changes";
        }
    });
}

// Delete Patient
async function deletePatient(id) {
    const p = patients.find(item => String(item.id) === String(id) || String(item.patientId) === String(id));
    const name = p ? (p.fullName || p.name) : "this patient";

    const confirmed = confirm(`Are you sure you want to delete the record for ${name}?\n\nThis action cannot be undone.`);
    if (!confirmed) return;

    const token = sessionStorage.getItem("hospitalToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/patients/${id}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || "Failed to delete patient record.");
        }

        showToast("Patient record deleted successfully.");
        await loadPatients();

    } catch (error) {
        console.error("Delete patient error:", error);
        showToast(error.message, "error");
    }
}

// Event delegation for table buttons
if (tableBody) {
    tableBody.addEventListener("click", e => {
        const viewBtn = e.target.closest(".view-btn");
        const editBtn = e.target.closest(".edit-btn");
        const delBtn = e.target.closest(".del-btn");

        if (viewBtn) {
            viewPatientDetails(viewBtn.getAttribute("data-id"));
        } else if (editBtn) {
            openEditPatient(editBtn.getAttribute("data-id"));
        } else if (delBtn) {
            deletePatient(delBtn.getAttribute("data-id"));
        }
    });
}

// Initialize
loadPatients();
