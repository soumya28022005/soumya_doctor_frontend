// --- CONFIGURATION ---
const API_URL = 'http://localhost:3000'; // For local testing
// const API_URL = 'https://your-backend-app-name.onrender.com'; // CHANGE THIS AFTER DEPLOYING

// --- Universal Page Load Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();
    if (document.getElementById('logout-btn')) {
        document.getElementById('logout-btn').addEventListener('click', logout);
    }
    route(path);
});

function route(path) {
    switch (path) {
        case 'login.html': handleLoginPage(); break;
        case 'signup.html': handleSignupPage(); break;
        case 'patient-dashboard.html': loadDashboard('patient'); break;
        case 'doctor-dashboard.html': loadDashboard('doctor'); break;
        case 'receptionist-dashboard.html': loadDashboard('receptionist'); break;
        case 'admin-dashboard.html': loadDashboard('admin'); break;
    }
}

// --- AUTH ---
function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function handleLoginPage() {
    if (localStorage.getItem('user')) {
        window.location.href = `${localStorage.getItem('role')}-dashboard.html`;
        return;
    }
    const role = new URLSearchParams(window.location.search).get('role');
    if (!role) { window.location.href = 'index.html'; return; }
    
    document.getElementById('login-title').innerHTML = `Login as <span style="text-transform: capitalize;">${role}</span>`;
    if (role === 'patient') document.getElementById('signup-link-container').style.display = 'block';

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { username, password } = e.target.elements;
        const res = await apiRequest(`login/${role}`, 'POST', { username: username.value, password: password.value });
        if (res.success) {
            localStorage.setItem('user', JSON.stringify(res.user));
            localStorage.setItem('role', role);
            window.location.href = `${role}-dashboard.html`;
        } else {
            showError(res.message);
        }
    });
}

function handleSignupPage() {
     document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { name, dob, mobile, username, password } = e.target.elements;
        const res = await apiRequest('signup/patient', 'POST', { name: name.value, dob: dob.value, mobile: mobile.value, username: username.value, password: password.value });
        if (res.success) {
            alert('Signup successful! Please login.');
            window.location.href = 'login.html?role=patient';
        } else {
            showError(res.message);
        }
    });
}

// --- DASHBOARD & RENDERING ---
async function loadDashboard(role) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || localStorage.getItem('role') !== role) {
        window.location.href = `login.html?role=${role}`;
        return;
    }

    const container = document.getElementById('dashboard-container');
    const data = await apiRequest(`dashboard/${role}/${user.id}`);
    
    if (data.success) {
        const renderFunction = {
            patient: renderPatientDashboard,
            doctor: renderDoctorDashboard,
            receptionist: renderReceptionistDashboard,
            admin: renderAdminDashboard,
        }[role];
        renderFunction(container, data);
    } else {
        container.innerHTML = `<h1>Error: ${data.message}</h1>`;
        if (data.message.includes('not found')) logout();
    }
}

function renderPatientDashboard(container, data) {
    // This new HTML structure includes separate search inputs for name, specialty, and clinic.
    container.innerHTML = `
        <div class="dashboard-header"><h1>Welcome, ${data.patient.name}</h1><p>Find doctors and book your appointments.</p></div>
        <div class="dashboard-grid">
            <div class="card">
                <h3>Find a Doctor</h3>
                <div class="form-group">
                    <input type="text" id="doctorNameSearch" placeholder="Search by name...">
                </div>
                <div class="form-group">
                    <input type="text" id="specialtySearch" placeholder="Search by specialty (e.g., Dentist)...">
                </div>
                <div class="form-group">
                    <input type="text" id="clinicSearch" placeholder="Search by clinic name or place...">
                </div>
                <div class="form-group">
                    <label>Select Date to See Availability</label>
                    <input type="date" id="dateSearch">
                </div>
                <div id="doctorSearchResults" style="margin-top: 20px;"></div>
            </div>
            <div class="card">
                <h3>Your Appointments</h3>
                <ul class="appointment-list">${data.appointments.map(app => `
                    <li class="appointment-item">
                        <strong>Dr. ${app.doctor_name}</strong> on ${new Date(app.date).toLocaleDateString()}<br>
                        <small>${app.clinic_name} at ${app.time} (Queue #${app.queue_number})</small>
                    </li>`).join('') || '<p>You have no appointments.</p>'}
                </ul>
            </div>
        </div>`;

    // Get references to all the new search inputs
    const nameInput = document.getElementById('doctorNameSearch');
    const specialtyInput = document.getElementById('specialtySearch');
    const clinicInput = document.getElementById('clinicSearch');
    const dateInput = document.getElementById('dateSearch');

    // Set the date input to today's date by default
    dateInput.value = new Date().toISOString().slice(0, 10);
    
    // Add event listeners to trigger the search whenever the user types or changes the date
    nameInput.addEventListener('keyup', searchDoctors);
    specialtyInput.addEventListener('keyup', searchDoctors);
    clinicInput.addEventListener('keyup', searchDoctors);
    dateInput.addEventListener('change', searchDoctors);

    // Perform an initial search to show all available doctors for today
    searchDoctors(); 
}

async function searchDoctors() {
    // Get the values from all four input fields
    const name = document.getElementById('doctorNameSearch').value;
    const specialty = document.getElementById('specialtySearch').value;
    const clinic = document.getElementById('clinicSearch').value;
    const date = document.getElementById('dateSearch').value;
    const resultsContainer = document.getElementById('doctorSearchResults');

    // Check if a date is selected
    if (!date) {
        resultsContainer.innerHTML = '<p style="color:red;">Please select a date to see availability.</p>';
        return;
    }
    
    // Build the query string dynamically, only adding parameters if they have a value
    const queryParams = new URLSearchParams({ date });
    if (name) queryParams.append('name', name);
    if (specialty) queryParams.append('specialty', specialty);
    if (clinic) queryParams.append('clinic', clinic);

    // Call the API with the new query string
    const res = await apiRequest(`doctors?${queryParams.toString()}`);
    
    if (res.success && res.doctors) {
        resultsContainer.innerHTML = res.doctors.map(doctor => `
            <div class="appointment-item">
                <strong>Dr. ${doctor.name}</strong> - ${doctor.specialty}<br>
                ${doctor.schedules.map(s => `
                    <div style="padding-left: 1rem; margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <small>${s.clinic_name}</small><br>
                            <small>Time: ${s.start_time} - ${s.end_time}</small>
                        </div>
                        <button class="btn btn-small" onclick="bookAppointment(${doctor.id}, ${s.clinic_id}, '${date}')">Book</button>
                    </div>
                `).join('') || '<small>No schedules available for this doctor on the selected date.</small>'}
            </div>`).join('') || '<p>No doctors found matching your criteria.</p>';
    } else {
        resultsContainer.innerHTML = `<p style="color: red;">${res.message || 'Error fetching doctors.'}</p>`;
    }
}

async function bookAppointment(doctorId, clinicId, date) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!date) {
        alert("Please select a date first.");
        return;
    }
    const res = await apiRequest('appointments/book', 'POST', { patientId: user.id, doctorId, clinicId, date });
    if (res.success) {
        alert('Appointment booked successfully!');
        loadDashboard('patient');
    } else {
        alert(`Booking Failed: ${res.message}`);
    }
}

// Other dashboard render functions remain the same...

function renderDoctorDashboard(container, data) {
    const doctor = data.doctor;
    const appointments = data.appointments || [];
    const schedules = data.schedules || [];
    const invitations = data.invitations || [];

    // Logic to find current and next patient
    const doneAppointments = appointments.filter(app => app.status === 'Done');
    const availableAppointments = appointments.filter(app => !['Done', 'Absent'].includes(app.status));
    const currentPatientInfo = availableAppointments[0] || null;
    const nextPatientInfo = availableAppointments[1] || null;
    const progressPercent = appointments.length > 0 ? ((doneAppointments.length / appointments.length) * 100).toFixed(2) : 0;

    // The selected clinic ID for filtering, taken from the URL
    const selectedClinicId = new URLSearchParams(window.location.search).get('clinicId');

    // Build the main HTML structure
    container.innerHTML = `
        <div class="dashboard-header">
            <h1>Welcome, Dr. ${doctor.name}</h1>
            <p>Manage your appointments and queue.</p>
        </div>
        <div class="dashboard-grid">
            <div class="card">
                <h3>Live Queue Management</h3>
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 12px; margin-bottom: 1rem; text-align: center;">
                    <h2 style="margin: 0; font-size: 1.5rem;">Currently Serving</h2>
                    <div style="font-size: 3rem; font-weight: bold; margin: 0.5rem 0;">#${currentPatientInfo ? currentPatientInfo.queue_number -1 : doneAppointments.length}</div>
                </div>
                ${currentPatientInfo ? `
                    <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px; border-left: 4px solid #0ea5e9; margin-bottom: 1rem;">
                        <h4 style="color: #0ea5e9; margin: 0 0 0.5rem 0;">Current Patient</h4>
                        <p style="margin: 0; font-size: 1.1rem; font-weight: 600;">${currentPatientInfo.patient_name} (#${currentPatientInfo.queue_number})</p>
                    </div>` : ''}
                ${nextPatientInfo ? `
                    <div style="background: #fefce8; padding: 1rem; border-radius: 8px; border-left: 4px solid #eab308; margin-bottom: 1rem;">
                        <h5 style="color: #eab308; margin:0 0 0.5rem 0;">Up Next</h5>
                        <p style="margin: 0;">${nextPatientInfo.patient_name} (#${nextPatientInfo.queue_number})</p>
                    </div>` : ''}

                <form id="next-patient-form">
                    <button type="submit" class="btn" style="width: 100%; background: #10b981; font-size: 1.1rem; padding: 0.75rem;" ${!currentPatientInfo ? 'disabled' : ''}>
                        ✅ Next Patient
                    </button>
                </form>
                <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden; margin: 1rem 0;">
                    <div style="background: #667eea; height: 100%; width: ${progressPercent}%; transition: width 0.3s ease;"></div>
                </div>
                <p style="text-align: center; color: #64748b; font-size: 0.9rem; margin: 0;">
                    Progress: ${doneAppointments.length} of ${appointments.length} patients completed
                </p>
            </div>

            <div class="card">
                <h3>Today's Appointments Queue</h3>
                <ul class="appointment-list">
                    ${appointments.length > 0 ? appointments.map(app => `
                        <li class="appointment-item" style="${app.id === currentPatientInfo?.id ? 'background: #dbeafe;' : ''} ${app.status === 'Done' ? 'background: #dcfce7;' : ''}">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>#${app.queue_number} - ${app.patient_name}</strong>
                                    <br><small>Status: ${app.status}</small>
                                </div>
                                <select class="status-select" data-appointment-id="${app.id}">
                                    <option value="Confirmed" ${app.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                                    <option value="Waiting" ${app.status === 'Waiting' ? 'selected' : ''}>Waiting</option>
                                    <option value="Done" ${app.status === 'Done' ? 'selected' : ''}>Done</option>
                                    <option value="Absent" ${app.status === 'Absent' ? 'selected' : ''}>Absent</option>
                                </select>
                            </div>
                        </li>
                    `).join('') : '<p>No appointments for today.</p>'}
                </ul>
            </div>

            <div class="card">
                <h3>Your Clinics</h3>
                <ul class="appointment-list">
                    <li class="appointment-item" style="${!selectedClinicId ? 'background-color: #e0e7ff;' : ''}">
                        <a href="doctor-dashboard.html" style="text-decoration: none; color: inherit;"><strong>All Clinics Today</strong></a>
                    </li>
                    ${schedules.map(s => `
                        <li class="appointment-item" style="${selectedClinicId == s.clinic_id ? 'background-color: #e0e7ff;' : ''}">
                            <a href="doctor-dashboard.html?clinicId=${s.clinic_id}" style="text-decoration: none; color: inherit;">
                                <strong>${s.clinic_name}</strong><br>
                                <small>${s.days} from ${s.start_time} to ${s.end_time}</small>
                            </a>
                        </li>
                    `).join('')}
                </ul>
                ${invitations.length > 0 ? `
                    <h4 style="margin-top: 1rem;">Invitations</h4>
                    <ul class="appointment-list">
                        ${invitations.map(inv => `
                            <li class="appointment-item">
                                <strong>${inv.clinic_name}</strong> has invited you.
                                <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                                    <button class="btn btn-small btn-success invitation-btn" data-invitation-id="${inv.id}" data-action="accept">Accept</button>
                                    <button class="btn btn-small btn-danger invitation-btn" data-invitation-id="${inv.id}" data-action="delete">Delete</button>
                                </div>
                            </li>
                        `).join('')}
                    </ul>` : ''}
            </div>
        </div>
    `;

      const nextPatientForm = document.getElementById('next-patient-form');
    if (nextPatientForm) {
        nextPatientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clinicToUpdate = selectedClinicId || schedules[0]?.clinic_id;
            if (!clinicToUpdate) {
                alert("Please select a clinic first to manage its queue.");
                return;
            }
            const res = await apiRequest('doctor/next-patient', 'POST', {
                doctorId: doctor.id,
                clinicId: clinicToUpdate
            });
            if (res.success) {
                loadDashboard('doctor'); // Reload the dashboard to show the change
            } else {
                alert(`Error: ${res.message}`);
            }
        });
    }

    // Event listeners for all status dropdowns
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const appointmentId = e.target.dataset.appointmentId;
            const newStatus = e.target.value;
            const res = await apiRequest('doctor/update-appointment-status', 'POST', {
                appointmentId: appointmentId,
                status: newStatus
            });
            if (res.success) {
                loadDashboard('doctor'); // Reload to see the changes
            } else {
                alert(`Error: ${res.message}`);
            }
        });
    });

    // Event listeners for invitation buttons
    document.querySelectorAll('.invitation-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const invitationId = e.target.dataset.invitationId;
            const action = e.target.dataset.action;
            const res = await apiRequest('doctor/handle-invitation', 'POST', {
                invitationId: invitationId,
                action: action
            });
             if (res.success) {
                loadDashboard('doctor'); // Reload to see the changes
            } else {
                alert(`Error: ${res.message}`);
            }
        });
    });
}

function renderReceptionistDashboard(container, data) {
     container.innerHTML = `
        <div class="dashboard-header"><h1>${data.clinic.name}</h1><p>Welcome, ${data.receptionist.name}</p></div>
        <div class="dashboard-grid">
            <div class="card">
                <h3>Doctors at this Clinic</h3>
                <ul class="appointment-list">${data.doctors.map(d => `
                    <li class="appointment-item"><strong>Dr. ${d.name}</strong> - ${d.specialty}</li>
                `).join('')}</ul>
            </div>
            <div class="card">
                <h3>Invite Existing Doctor</h3>
                <form id="invite-form">
                    <div class="form-group">
                        <label>Select Doctor</label>
                        <select name="doctorId" required>${data.allDoctors.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}</select>
                    </div>
                    <div class="form-group"><label>Start Time</label><input type="time" name="startTime" required></div>
                    <div class="form-group"><label>End Time</label><input type="time" name="endTime" required></div>
                    <div class="form-group"><label>Days</label><input type="text" name="days" placeholder="Monday, Wednesday" required></div>
                    <button type="submit" class="btn">Send Invite</button>
                </form>
            </div>
        </div>`;
    
    document.getElementById('invite-form').addEventListener('submit', async e => {
        e.preventDefault();
        const user = JSON.parse(localStorage.getItem('user'));
        const { doctorId, startTime, endTime, days } = e.target.elements;
        const res = await apiRequest('receptionist/invite-doctor', 'POST', {
            receptionistId: user.id,
            doctorId: doctorId.value,
            startTime: startTime.value,
            endTime: endTime.value,
            days: days.value
        });
        alert(res.message);
        if(res.success) loadDashboard('receptionist');
    });
}

function renderAdminDashboard(container, data) {
    container.innerHTML = `
        <div class="dashboard-header"><h1>Admin Overview</h1></div>
        <div class="dashboard-grid">
            <div class="card"><h3>Clinics (${data.clinics.length})</h3></div>
            <div class="card"><h3>Doctors (${data.doctors.length})</h3></div>
            <div class="card"><h3>Patients (${data.patients.length})</h3></div>
            <div class="card"><h3>Receptionists (${data.receptionists.length})</h3></div>
        </div>`;
}


// --- UTILITIES ---
async function apiRequest(endpoint, method = 'GET', body = null) {
    try {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) options.body = JSON.stringify(body);
        const response = await fetch(`${API_URL}/api/${endpoint}`, options);
        if (!response.ok) {
             const err = await response.json();
             return { success: false, message: err.message || `Error: ${response.status}` };
        }
        return await response.json();
    } catch (error) {
        return { success: false, message: 'Could not connect to the server.' };
    }
}

function showError(message) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

