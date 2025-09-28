// --- CONFIGURATION ---
const API_URL = 'http://localhost:3000'; // Local test er jonno
// const API_URL = 'https://your-backend-app-name.onrender.com'; // Deploy korar por change korun

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
    const role = new URLSearchParams(window.location.search).get('role');
    const storedRole = localStorage.getItem('role');

    // *** LOGIN PROBLEM er SHOMADHAN ***
    // Jodi user logged in thake kintu onno role er login page e ashe, tahole purono login clear kore debe
    if (storedRole && role !== storedRole) {
        localStorage.clear();
    }

    // Jodi user age thekei thik role e login thake, tahole take dashboard e pathiye debe
    if (localStorage.getItem('user') && localStorage.getItem('role') === role) {
        window.location.href = `${role}-dashboard.html`;
        return;
    }
    
    if (!role) { 
        window.location.href = 'index.html'; 
        return; 
    }
    
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
    // Loading spinner dekhabe
    container.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;
    
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
    container.innerHTML = `
        <div class="dashboard-header"><h1>Welcome, ${data.patient.name}</h1><p>Find doctors and book your appointments.</p></div>
        <div class="dashboard-grid">
            <div class="card">
                <h3>Find a Doctor</h3>
                <div id="doctor-search-form">
                    <div class="form-group"><input type="text" id="doctorNameSearch" placeholder="Search by name..."></div>
                    <div class="form-group"><input type="text" id="specialtySearch" placeholder="Search by specialty..."></div>
                    <div class="form-group"><input type="text" id="clinicSearch" placeholder="Search by clinic..."></div>
                    <div class="form-group"><label>Select Date</label><input type="date" id="dateSearch"></div>
                </div>
                <div id="doctorSearchResults" style="margin-top: 1rem;"></div>
            </div>
            <div class="card">
                <h3>Your Appointments & Live Queue</h3>
                <ul id="appointment-list-container" class="appointment-list">
                    ${data.appointments.length > 0 ? data.appointments.map(app => `
                        <li class="appointment-item">
                            <div>
                                <strong>Dr. ${app.doctor_name}</strong> on ${new Date(app.date).toLocaleDateString()}<br>
                                <small>${app.clinic_name} at ${app.time} (Your No: #${app.queue_number})</small>
                            </div>
                            <div class="live-queue-status" data-doctor-id="${app.doctor_id}" data-clinic-id="${app.clinic_id}" data-queue-number="${app.queue_number}" style="margin-top: 1rem; padding: 1rem; border-radius: 8px; background: #f1f5f9;">
                                <p class="current-status-text" style="font-weight: bold;">Loading queue status...</p>
                                <p class="queue-info" style="font-size: 0.9rem;"></p>
                            </div>
                        </li>
                    `).join('') : '<p>You have no appointments.</p>'}
                </ul>
            </div>
        </div>`;

    document.getElementById('dateSearch').value = new Date().toISOString().slice(0, 10);
    
    const debouncedSearch = debounce(searchDoctors, 400);
    document.getElementById('doctorNameSearch').addEventListener('keyup', debouncedSearch);
    document.getElementById('specialtySearch').addEventListener('keyup', debouncedSearch);
    document.getElementById('clinicSearch').addEventListener('keyup', debouncedSearch);
    document.getElementById('dateSearch').addEventListener('change', searchDoctors);

    searchDoctors();
    updateAllLiveQueueStatuses();
    setInterval(updateAllLiveQueueStatuses, 30000); // Prottek 30 sec por por update hobe
}

async function updateAllLiveQueueStatuses() {
    document.querySelectorAll('.live-queue-status').forEach(async (element) => {
        const { doctorId, clinicId, queueNumber } = element.dataset;
        const yourQueueNumber = parseInt(queueNumber);

        const statusTextEl = element.querySelector('.current-status-text');
        const queueInfoEl = element.querySelector('.queue-info');

        const res = await apiRequest(`queue-status/${doctorId}/${clinicId}`);

        if (res.success) {
            const currentNumber = res.currentNumber;
            if (currentNumber === 0) {
                statusTextEl.textContent = '🕐 Queue has not started yet';
                queueInfoEl.textContent = `You are #${yourQueueNumber} in line.`;
            } else if (yourQueueNumber <= currentNumber) {
                statusTextEl.textContent = '✅ Your turn is over.';
                queueInfoEl.textContent = 'Please contact the clinic if you missed your turn.';
            } else if (yourQueueNumber === currentNumber + 1) {
                statusTextEl.textContent = "🎯 You're NEXT!";
                queueInfoEl.textContent = `Currently serving #${currentNumber}. Please be ready.`;
            } else {
                const patientsAhead = yourQueueNumber - currentNumber - 1;
                statusTextEl.textContent = `⏳ ${patientsAhead} patient(s) ahead of you.`;
                queueInfoEl.textContent = `Currently serving #${currentNumber}.`;
            }
        } else {
            statusTextEl.textContent = '❌ Unable to load queue status.';
        }
    });
}

async function searchDoctors() {
    const resultsContainer = document.getElementById('doctorSearchResults');
    resultsContainer.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;

    const name = document.getElementById('doctorNameSearch').value;
    const specialty = document.getElementById('specialtySearch').value;
    const clinic = document.getElementById('clinicSearch').value;
    const date = document.getElementById('dateSearch').value;
    
    if (!date) {
        resultsContainer.innerHTML = '<p style="color:red;">Please select a date.</p>';
        return;
    }
    
    const queryParams = new URLSearchParams({ date });
    if (name) queryParams.append('name', name);
    if (specialty) queryParams.append('specialty', specialty);
    if (clinic) queryParams.append('clinic', clinic);

    const res = await apiRequest(`doctors?${queryParams.toString()}`);
    
    if (res.success && res.doctors) {
        resultsContainer.innerHTML = res.doctors.map(doctor => `
            <div class="appointment-item">
                <strong>Dr. ${doctor.name}</strong> - ${doctor.specialty}<br>
                ${doctor.schedules.map(s => `
                    <div style="padding-left: 1rem; margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                        <small>${s.clinic_name}</small>
                        <button class="btn btn-small" onclick="bookAppointment(${doctor.id}, ${s.clinic_id}, '${date}')">Book</button>
                    </div>
                `).join('') || '<small>No schedules found.</small>'}
            </div>`).join('') || '<p>No doctors found matching your criteria.</p>';
    } else {
        resultsContainer.innerHTML = `<p style="color: red;">${res.message || 'Error fetching doctors.'}</p>`;
    }
}

async function bookAppointment(doctorId, clinicId, date) {
    const user = JSON.parse(localStorage.getItem('user'));
    const res = await apiRequest('appointments/book', 'POST', { patientId: user.id, doctorId, clinicId, date });
    if (res.success) {
        alert('Appointment booked successfully!');
        loadDashboard('patient');
    } else {
        alert(`Booking Failed: ${res.message}`);
    }
}

function renderDoctorDashboard(container, data) {
    const { doctor, appointments = [], schedules = [], invitations = [] } = data;
    
    const doneAppointments = appointments.filter(app => app.status === 'Done');
    const availableAppointments = appointments.filter(app => !['Done', 'Absent'].includes(app.status)).sort((a, b) => a.queue_number - b.queue_number);
    const currentPatientInfo = availableAppointments[0] || null;
    const nextPatientInfo = availableAppointments[1] || null;
    const progressPercent = appointments.length > 0 ? ((doneAppointments.length / appointments.length) * 100).toFixed(2) : 0;
    const selectedClinicId = new URLSearchParams(window.location.search).get('clinicId');

    container.innerHTML = `
        <div class="dashboard-header">
            <h1>Welcome, Dr. ${doctor.name}</h1>
            <p>Manage your appointments and queue.</p>
        </div>
        <div class="dashboard-grid">
            <div class="card">
                <h3>Live Queue Management</h3>
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 12px; text-align: center; margin-bottom: 1rem;">
                    <h2 style="margin: 0; font-size: 1.5rem;">Currently Serving</h2>
                    <div style="font-size: 3rem; font-weight: bold; margin: 0.5rem 0;">#${doneAppointments.length > 0 ? Math.max(...doneAppointments.map(a => a.queue_number)) : 0}</div>
                </div>
                ${currentPatientInfo ? `
                    <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px; border-left: 4px solid #0ea5e9; margin-bottom: 1rem;">
                        <h4 style="color: #0ea5e9; margin: 0 0 0.5rem 0;">Current Patient</h4>
                        <p style="margin: 0; font-size: 1.1rem; font-weight: 600;">${currentPatientInfo.patient_name} (#${currentPatientInfo.queue_number})</p>
                    </div>` : '<p>No patient currently being served.</p>'}
                ${nextPatientInfo ? `
                    <div style="background: #fefce8; padding: 1rem; border-radius: 8px; border-left: 4px solid #eab308; margin-bottom: 1rem;">
                        <h5 style="color: #eab308; margin:0 0 0.5rem 0;">Up Next</h5>
                        <p style="margin: 0;">${nextPatientInfo.patient_name} (#${nextPatientInfo.queue_number})</p>
                    </div>` : ''}

                <form id="next-patient-form">
                    <button type="submit" class="btn" style="width: 100%; background: #10b981;" ${!currentPatientInfo ? 'disabled' : ''}>
                        ✅ Next Patient
                    </button>
                </form>
                <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden; margin: 1rem 0;">
                    <div style="background: #667eea; height: 100%; width: ${progressPercent}%;"></div>
                </div>
                <p style="text-align: center; color: #64748b; font-size: 0.9rem;">
                    Progress: ${doneAppointments.length} of ${appointments.length} patients completed
                </p>
            </div>

            <div class="card">
                <h3>Today's Appointments</h3>
                <ul class="appointment-list">
                    ${appointments.length > 0 ? appointments.map(app => `
                        <li class="appointment-item" style="${app.id === currentPatientInfo?.id ? 'background: #dbeafe;' : ''} ${app.status === 'Done' ? 'background: #dcfce7;' : ''}">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div><strong>#${app.queue_number} - ${app.patient_name}</strong><br><small>Status: ${app.status}</small></div>
                                <select class="status-select" data-appointment-id="${app.id}">
                                    <option value="Confirmed" ${app.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                                    <option value="Waiting" ${app.status === 'Waiting' ? 'selected' : ''}>Waiting</option>
                                    <option value="Done" ${app.status === 'Done' ? 'selected' : ''}>Done</option>
                                    <option value="Absent" ${app.status === 'Absent' ? 'selected' : ''}>Absent</option>
                                </select>
                            </div>
                        </li>`).join('') : '<p>No appointments today.</p>'}
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

    document.getElementById('next-patient-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const clinicToUpdate = selectedClinicId || schedules[0]?.clinic_id;
        if (!clinicToUpdate) {
            alert("Please select a clinic.");
            return;
        }
        const res = await apiRequest('doctor/next-patient', 'POST', { doctorId: doctor.id, clinicId: clinicToUpdate });
        if (res.success) {
            loadDashboard('doctor');
        } else {
            alert(`Error: ${res.message}`);
        }
    });

    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const appointmentId = e.target.dataset.appointmentId;
            const newStatus = e.target.value;
            await apiRequest('doctor/update-appointment-status', 'POST', { appointmentId, status: newStatus });
            loadDashboard('doctor');
        });
    });

    document.querySelectorAll('.invitation-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const invitationId = e.target.dataset.invitationId;
            const action = e.target.dataset.action;
            await apiRequest('doctor/handle-invitation', 'POST', { invitationId, action });
            loadDashboard('doctor');
        });
    });
}


function renderReceptionistDashboard(container, data) {
     container.innerHTML = `<h1>Receptionist Dashboard</h1><p>Welcome, ${data.receptionist.name} at ${data.clinic.name}</p>`;
}

function renderAdminDashboard(container, data) {
    container.innerHTML = `<h1>Admin Dashboard</h1><p>Welcome, ${data.admin.name}</p>`;
}

// --- UTILITIES ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

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