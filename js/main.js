// Configuration
const API_BASE_URL = 'https://soumya-doctor-1.onrender.com'; // Use this for local testing
// const API_BASE_URL = 'https://your-backend-app-name.onrender.com'; // Change this after deploying

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const pageName = window.location.pathname.split('/').pop();
    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
    handlePageLoad(pageName);
});

// Navigate to the correct page setup
function handlePageLoad(page) {
    switch (page) {
        case 'login.html':
            setupLoginPage();
            break;
        case 'signup.html':
            setupSignupPage();
            break;
        case 'patient-dashboard.html':
            loadDashboard('patient');
            break;
        case 'doctor-dashboard.html':
            loadDashboard('doctor');
            break;
        case 'receptionist-dashboard.html':
            loadDashboard('receptionist');
            break;
        case 'admin-dashboard.html':
            loadDashboard('admin');
            break;
    }
}

// --- Authentication ---
function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function setupLoginPage() {
    const role = new URLSearchParams(window.location.search).get('role');
    if (localStorage.getItem('user') && localStorage.getItem('role') === role) {
        window.location.href = `${role}-dashboard.html`;
        return;
    }

    if (!role) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('login-title').innerHTML = `Login as <span style="text-transform: capitalize;">${role}</span>`;
    if (role === 'patient') {
        document.getElementById('signup-link-container').style.display = 'block';
    }

    document.getElementById('login-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const { username, password } = event.target.elements;
        const response = await apiRequest(`login/${role}`, 'POST', { username: username.value, password: password.value });

        if (response.success) {
            localStorage.setItem('user', JSON.stringify(response.user));
            localStorage.setItem('role', role);
            window.location.href = `${role}-dashboard.html`;
        } else {
            displayError(response.message);
        }
    });
}
function toggleClinicForm() {
    const option = document.querySelector('input[name="addClinicOption"]:checked').value;
    document.getElementById('privateClinicForm').style.display = (option === 'private') ? 'block' : 'none';
    document.getElementById('existingClinicForm').style.display = (option === 'existing') ? 'block' : 'none';
}

async function searchClinics() {
    const searchInput = document.getElementById('clinicSearchInput').value;
    const resultsContainer = document.getElementById('clinicSearchResults');
    if (searchInput.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }
    const response = await apiRequest(`clinics/search?name=${searchInput}`);
    if (response.success && response.clinics) {
        resultsContainer.innerHTML = response.clinics.map(clinic => `
            <div class="form-group">
                <label><input type="radio" name="clinicId" value="${clinic.id}"> ${clinic.name} - ${clinic.address}</label>
            </div>
        `).join('');
    }
}
window.deleteClinicForDoctor = async (doctorId, clinicId) => {
    if (!confirm('Are you sure you want to remove this clinic from your schedule? This action cannot be undone.')) {
        return;
    }
    const response = await apiRequest('doctor/delete-clinic', 'POST', { doctorId, clinicId });
    if (response.success) {
        alert('Clinic removed successfully.');
        loadDashboard('doctor');
    } else {
        alert('Error: ' + response.message);
    }
};

function setupSignupPage() {
    document.getElementById('signup-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const { name, dob, mobile, username, password } = event.target.elements;
        const response = await apiRequest('signup/patient', 'POST', {
            name: name.value,
            dob: dob.value,
            mobile: mobile.value,
            username: username.value,
            password: password.value
        });

        if (response.success) {
            alert('Signup successful! Please login.');
            window.location.href = 'login.html?role=patient';
        } else {
            displayError(response.message);
        }
    });
}

// --- Dashboard ---
async function loadDashboard(role) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || localStorage.getItem('role') !== role) {
        window.location.href = `login.html?role=${role}`;
        return;
    }

    const dashboardContainer = document.getElementById('dashboard-container');
    dashboardContainer.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;

    const clinicId = new URLSearchParams(window.location.search).get('clinicId');
    let url = `dashboard/${role}/${user.id}`;
    if (role === 'doctor' && clinicId) {
        url += `?clinicId=${clinicId}`;
    }

    const data = await apiRequest(url);

    if (data.success) {
        const buildDashboard = {
            patient: buildPatientDashboard,
            doctor: buildDoctorDashboard,
            receptionist: buildReceptionistDashboard,
            admin: buildAdminDashboard,
        }[role];
        buildDashboard(dashboardContainer, data);
    } else {
        dashboardContainer.innerHTML = `<h1>Error: ${data.message}</h1>`;
        if (data.message && data.message.includes('not found')) {
            logout();
        }
    }
}

function buildPatientDashboard(container, data) {
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
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>Dr. ${app.doctor_name}</strong> on ${new Date(app.date).toLocaleDateString()}<br>
                                    <small>${app.clinic_name} at ${app.time} (Your No: #${app.queue_number})</small>
                                </div>
                                <button class="btn btn-danger btn-small" onclick="deleteAppointment(${app.id})">Cancel</button>
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

    const debouncedSearch = debounce(searchForDoctors, 400);
    document.getElementById('doctorNameSearch').addEventListener('keyup', debouncedSearch);
    document.getElementById('specialtySearch').addEventListener('keyup', debouncedSearch);
    document.getElementById('clinicSearch').addEventListener('keyup', debouncedSearch);
    document.getElementById('dateSearch').addEventListener('change', searchForDoctors);

    searchForDoctors();
    updateAllQueueStatuses();
    setInterval(updateAllQueueStatuses, 30000);
}



async function updateAllQueueStatuses() {
    document.querySelectorAll('.live-queue-status').forEach(async (element) => {
        const { doctorId, clinicId, queueNumber } = element.dataset;
        const patientQueueNumber = parseInt(queueNumber);

        const statusText = element.querySelector('.current-status-text');
        const queueInfo = element.querySelector('.queue-info');

        const response = await apiRequest(`queue-status/${doctorId}/${clinicId}`);

        if (response.success) {
            const currentNumber = response.currentNumber;
            if (currentNumber === 0) {
                statusText.textContent = '🕐 Queue has not started yet';
                queueInfo.textContent = `You are #${patientQueueNumber} in line.`;
            } else if (patientQueueNumber <= currentNumber) {
                statusText.textContent = '✅ Your turn is over.';
                queueInfo.textContent = 'Please contact the clinic if you missed your turn.';
            } else if (patientQueueNumber === currentNumber + 1) {
                statusText.textContent = "🎯 You're NEXT!";
                queueInfo.textContent = `Currently serving #${currentNumber}. Please be ready.`;
            } else {
                const patientsAhead = patientQueueNumber - currentNumber - 1;
                statusText.textContent = `⏳ ${patientsAhead} patient(s) ahead of you.`;
                queueInfo.textContent = `Currently serving #${currentNumber}.`;
            }
        } else {
            statusText.textContent = '❌ Unable to load queue status.';
        }
    });
}

async function searchForDoctors() {
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

    const response = await apiRequest(`doctors?${queryParams.toString()}`);

    if (response.success && response.doctors) {
        resultsContainer.innerHTML = response.doctors.map(doctor => `
            <div class="appointment-item">
                <strong>Dr. ${doctor.name}</strong> - ${doctor.specialty}<br>
                ${doctor.schedules.map(schedule => `
                    <div style="padding-left: 1rem; margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                        <small>${schedule.clinic_name}</small>
                        <button class="btn btn-small" onclick="bookAppointment(${doctor.id}, ${schedule.clinic_id}, '${date}')">Book</button>
                    </div>
                `).join('') || '<small>No schedules found.</small>'}
            </div>`).join('') || '<p>No doctors found matching your criteria.</p>';
    } else {
        resultsContainer.innerHTML = `<p style="color: red;">${response.message || 'Error fetching doctors.'}</p>`;
    }
}

async function bookAppointment(doctorId, clinicId, date) {
    const user = JSON.parse(localStorage.getItem('user'));
    const response = await apiRequest('appointments/book', 'POST', { patientId: user.id, doctorId, clinicId, date });
    if (response.success) {
        alert('Appointment booked successfully!');
        loadDashboard('patient');
    } else {
        alert(`Booking Failed: ${response.message}`);
    }
}

function buildDoctorDashboard(container, data) {
    const { doctor, appointments = [], schedules = [], invitations = [], doctorRequests = [] } = data;

    const doneAppointments = appointments.filter(app => app.status === 'Done');
    const availableAppointments = appointments.filter(app => !['Done', 'Absent'].includes(app.status)).sort((a, b) => a.queue_number - b.queue_number);
    const currentPatient = availableAppointments[0] || null;
    const nextPatient = availableAppointments[1] || null;
    const progress = appointments.length > 0 ? ((doneAppointments.length / appointments.length) * 100).toFixed(2) : 0;
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
                ${currentPatient ? `
                    <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px; border-left: 4px solid #0ea5e9; margin-bottom: 1rem;">
                        <h4 style="color: #0ea5e9; margin: 0 0 0.5rem 0;">Current Patient</h4>
                        <p style="margin: 0; font-size: 1.1rem; font-weight: 600;">${currentPatient.patient_name} (#${currentPatient.queue_number}) - Age: ${calculateAge(currentPatient.dob)}</p>
                    </div>` : '<p>No patient currently being served.</p>'}
                ${nextPatient ? `
                    <div style="background: #fefce8; padding: 1rem; border-radius: 8px; border-left: 4px solid #eab308; margin-bottom: 1rem;">
                        <h5 style="color: #eab308; margin:0 0 0.5rem 0;">Up Next</h5>
                        <p style="margin: 0;">${nextPatient.patient_name} (#${nextPatient.queue_number})</p>
                    </div>` : ''}

                <form id="next-patient-form">
                    <button type="submit" class="btn" style="width: 100%; background: #10b981;" ${!currentPatient ? 'disabled' : ''}>
                        ✅ Next Patient
                    </button>
                </form>
                <div style="background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden; margin: 1rem 0;">
                    <div style="background: #667eea; height: 100%; width: ${progress}%;"></div>
                </div>
                <p style="text-align: center; color: #64748b; font-size: 0.9rem;">
                    Progress: ${doneAppointments.length} of ${appointments.length} patients completed
                </p>
            </div>

            <div class="card">
                <h3>Today's Appointments</h3>
                <ul class="appointment-list">
                    ${appointments.length > 0 ? appointments.map(app => `
                        <li class="appointment-item" style="${app.id === currentPatient?.id ? 'background: #dbeafe;' : ''} ${app.status === 'Done' ? 'background: #dcfce7;' : ''}">
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
                <h3>Your Clinics & Settings</h3>
                <ul class="appointment-list">
                    <li class="appointment-item" style="cursor: pointer; ${!selectedClinicId ? 'background-color: #e0e7ff;' : ''}" onclick="location.href='doctor-dashboard.html'">
                        <strong>All Clinics Today</strong>
                    </li>
                    ${schedules.map(schedule => `
                        <li class="appointment-item" style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="cursor: pointer;" onclick="location.href='doctor-dashboard.html?clinicId=${schedule.clinic_id}'">
                                <strong>${schedule.clinic_name}</strong><br>
                                <small>${schedule.days} from ${schedule.start_time} to ${schedule.end_time}</small>
                            </div>
                            <button class="btn btn-danger btn-small" onclick="deleteClinicForDoctor(${doctor.id}, ${schedule.clinic_id})">Delete</button>
                        </li>
                    `).join('')}
                </ul>
                <div id="doctor-settings" style="margin-top: 2rem;">
                    <h4>Settings</h4>
                    <div class="form-group">
                        <label for="daily-patient-limit">Daily Patient Limit</label>
                        <input type="number" id="daily-patient-limit" value="${doctor.daily_patient_limit || ''}" placeholder="e.g., 20">
                    </div>
                    <button id="save-settings-btn" class="btn">Save Settings</button>
                </div>
                <div id="doctor-controls" style="margin-top: 2rem;">
                    <h4>Controls</h4>
                    <div style="display: flex; gap: 1rem;">
                        <button id="clear-appointments-btn" class="btn btn-danger">Clear List</button>
                        <button id="reset-queue-btn" class="btn btn-warning">Reset Queue</button>
                    </div>
                </div>
                ${invitations.length > 0 ? `
                    <h4 style="margin-top: 1rem;">Invitations</h4>
                    <ul class="appointment-list">
                        ${invitations.map(invitation => `
                            <li class="appointment-item">
                                <strong>${invitation.clinic_name}</strong> has invited you.
                                <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                                    <button class="btn btn-small btn-success invitation-btn" data-invitation-id="${invitation.id}" data-action="accept">Accept</button>
                                    <button class="btn btn-small btn-danger invitation-btn" data-invitation-id="${invitation.id}" data-action="delete">Delete</button>
                                </div>
                            </li>
                        `).join('')}
                    </ul>` : ''}
            </div>

            <div class="card">
                <h3>Add a New Clinic</h3>
                <div class="form-group" style="display: flex; gap: 20px;">
                    <label style="font-weight: normal;"><input type="radio" name="addClinicOption" value="private" checked onchange="toggleClinicForm()"> Create a Private Clinic</label>
                    <label style="font-weight: normal;"><input type="radio" name="addClinicOption" value="existing" onchange="toggleClinicForm()"> Join an Existing Clinic</label>
                </div>
    
                <form id="privateClinicForm">
                    <h4>Create New Private Clinic</h4>
                    <div class="form-group"><label>Clinic Name</label><input type="text" name="name" required></div>
                    <div class="form-group"><label>Clinic Address</label><input type="text" name="address" required></div>
                    <div class="form-group"><label>Start Time</label><input type="time" name="startTime" required></div>
                    <div class="form-group"><label>End Time</label><input type="time" name="endTime" required></div>
                    <div class="form-group">
                        <label>Select Days</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-top: 5px;">
                            ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => `<label><input type="checkbox" name="days" value="${day}"> ${day}</label>`).join('')}
                        </div>
                    </div>
                    <button type="submit" class="btn">Create Clinic</button>
                </form>
    
                <form id="existingClinicForm" style="display: none;">
                    <h4>Join Existing Clinic</h4>
                    <div class="form-group"><label>Search Clinic by Name</label><input type="text" id="clinicSearchInput" placeholder="Enter clinic name..."></div>
                    <div id="clinicSearchResults"></div>
                    <div class="form-group"><label>Start Time</label><input type="time" name="startTime" required></div>
                    <div class="form-group"><label>End Time</label><input type="time" name="endTime" required></div>
                    <div class="form-group">
                        <label>Select Days</label>
                        <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-top: 5px;">
                            ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => `<label><input type="checkbox" name="days" value="${day}"> ${day}</label>`).join('')}
                        </div>
                    </div>
                    <button type="submit" class="btn">Send Join Request</button>
                </form>
    
                ${doctorRequests.length > 0 ? `
                    <h4 style="margin-top: 2rem;">Your Clinic Join Requests</h4>
                    <ul class="appointment-list">
                        ${doctorRequests.map(req => `
                            <li class="appointment-item">
                                <strong>${req.clinic_name}</strong> - <span style="text-transform: capitalize;">${req.status}</span>
                                ${req.status === 'rejected' ? '<br><small style="color: red;">The clinic has rejected your request.</small>' : ''}
                            </li>
                        `).join('')}
                    </ul>` : ''}
            </div>
        </div>
    `;
    
        document.getElementById('next-patient-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const clinicToUpdate = selectedClinicId || schedules[0]?.clinic_id;
            if (!clinicToUpdate) {
                alert("Please select a clinic to manage its queue.");
                return;
            }
            const response = await apiRequest('doctor/next-patient', 'POST', { doctorId: doctor.id, clinicId: clinicToUpdate });
            if (response.success) {
                const currentUrl = new URL(window.location);
                loadDashboard('doctor', currentUrl.searchParams.get('clinicId'));
            } else {
                alert(`Error: ${response.message}`);
            }
        });
    
        document.getElementById('privateClinicForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            data.days = formData.getAll('days');
            data.doctorId = doctor.id;
            const response = await apiRequest('doctor/create-clinic', 'POST', data);
            if (response.success) {
                alert('Private clinic created successfully!');
                loadDashboard('doctor');
            } else {
                alert('Error: ' + response.message);
            }
        });

        const debouncedClinicSearch = debounce(searchClinics, 400);
        document.getElementById('clinicSearchInput').addEventListener('keyup', debouncedClinicSearch);

        document.getElementById('existingClinicForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const selectedClinic = document.querySelector('input[name="clinicId"]:checked');
            if (!selectedClinic) {
                alert('Please select a clinic.');
                return;
            }
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            data.days = formData.getAll('days');
            data.doctorId = doctor.id;
            data.clinicId = selectedClinic.value;
            const response = await apiRequest('doctor/join-clinic', 'POST', data);
            if (response.success) {
                alert('Join request sent!');
                loadDashboard('doctor');
            } else {
                alert('Error: ' + response.message);
            }
        });

        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (event) => {
                const appointmentId = event.target.dataset.appointmentId;
                const newStatus = event.target.value;
                await apiRequest('doctor/update-appointment-status', 'POST', { appointmentId, status: newStatus });
                const currentUrl = new URL(window.location);
                loadDashboard('doctor', currentUrl.searchParams.get('clinicId'));
            });
        });

        document.querySelectorAll('.invitation-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const invitationId = event.target.dataset.invitationId;
                const action = event.target.dataset.action;
                await apiRequest('doctor/handle-invitation', 'POST', { invitationId, action });
                loadDashboard('doctor');
            });
        });

        document.getElementById('clear-appointments-btn').addEventListener('click', async () => {
            if (confirm("Are you sure you want to clear the appointments for the selected clinic(s)? This action cannot be undone.")) {
                const response = await apiRequest(`doctor/${doctor.id}/appointments/today`, 'DELETE', { clinicId: selectedClinicId });
                if (response.success) {
                    alert('Appointments cleared successfully.');
                    const currentUrl = new URL(window.location);
                    loadDashboard('doctor', currentUrl.searchParams.get('clinicId'));
                } else {
                    alert(`Error: ${response.message}`);
                }
            }
        });

        document.getElementById('save-settings-btn').addEventListener('click', async () => {
            const dailyPatientLimit = document.getElementById('daily-patient-limit').value;
            const response = await apiRequest('doctor/settings', 'POST', { doctorId: doctor.id, dailyPatientLimit });
            if (response.success) {
                alert('Settings saved successfully.');
            } else {
                alert(`Error: ${response.message}`);
            }
        });

        document.getElementById('reset-queue-btn').addEventListener('click', async () => {
            if (confirm("Are you sure you want to reset the queue for the selected clinic(s)?")) {
                const response = await apiRequest(`doctor/${doctor.id}/queue/reset`, 'POST', { clinicId: selectedClinicId });
                if (response.success) {
                    alert('Queue reset successfully.');
                    const currentUrl = new URL(window.location);
                    loadDashboard('doctor', currentUrl.searchParams.get('clinicId'));
                } else {
                    alert(`Error: ${response.message}`);
                }
            }
        });
}


function buildReceptionistDashboard(container, data) {
    const { receptionist, clinic, doctors, allDoctors, joinRequests, invitations } = data;

    container.innerHTML = `
        <div class="dashboard-header">
            <h1>Welcome, ${receptionist.name} (Receptionist)</h1>
            <p>Managing ${clinic.name} - ${clinic.address}</p>
        </div>
        <div class="portal-container">
            <a href="#" id="add-doctor-portal" class="portal-card">
                <h2>Add Doctor to ${clinic.name}</h2>
                <p>Add a new or existing doctor to the clinic.</p>
            </a>
            <a href="#" id="view-doctors-portal" class="portal-card">
                <h2>Doctors at ${clinic.name}</h2>
                <p>View doctors and manage their appointments.</p>
            </a>
        </div>
        <div id="receptionist-dynamic-content"></div>
    `;

    document.getElementById('add-doctor-portal').addEventListener('click', (e) => {
        e.preventDefault();
        showAddDoctorForm(data);
    });

    document.getElementById('view-doctors-portal').addEventListener('click', (e) => {
        e.preventDefault();
        showClinicDoctors(data);
    });

    if (joinRequests && joinRequests.length > 0) {
        const joinRequestHtml = `
        <div class="card" style="background: #fffbeb; border-left: 4px solid #f59e0b; margin-top: 2rem;">
            <h3>Doctor Join Requests (${joinRequests.length})</h3>
            <ul class="appointment-list">
                ${joinRequests.map(req => `
                    <li class="appointment-item">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                            <div>
                                <strong>Dr. ${req.doctor_name}</strong> (${req.doctor_specialty}) wants to join.<br>
                                <small>Proposed: ${req.start_time} - ${req.end_time} on ${req.days}</small>
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <button class="btn btn-success btn-small" onclick="handleJoinRequest(${req.id}, 'accept')">Accept</button>
                                <button class="btn btn-danger btn-small" onclick="handleJoinRequest(${req.id}, 'delete')">Delete</button>
                            </div>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>`;
        document.getElementById('receptionist-dynamic-content').innerHTML = joinRequestHtml;
    }
}

function showAddDoctorForm(data) {
    const { clinic, allDoctors, invitations } = data;
    const dynamicContent = document.getElementById('receptionist-dynamic-content');
    dynamicContent.innerHTML = `
        <div class="card" style="margin-top: 2rem;">
            <h3>Add Doctor to ${clinic.name}</h3>
            <div class="form-group" style="display: flex; gap: 20px;">
                <label style="font-weight: normal;"><input type="radio" name="addDoctorOption" value="new" checked onchange="toggleDoctorForm()"> Add New Doctor</label>
                <label style="font-weight: normal;"><input type="radio" name="addDoctorOption" value="existing" onchange="toggleDoctorForm()"> Invite Existing Doctor</label>
            </div>

            <form id="newDoctorForm">
                <div class="form-group"><label>Doctor's Full Name</label><input type="text" name="name" required></div>
                <div class="form-group"><label>Specialty</label><input type="text" name="specialty" required></div>
                <div class="form-group"><label>Create Username</label><input type="text" name="username" required></div>
                <div class="form-group"><label>Create Password</label><input type="password" name="password" required></div>
                <div class="form-group"><label>Phone Number</label><input type="tel" name="Phonenumber" required pattern="[0-9]{10}"></div>
                <div class="form-group"><label>Start Time</label><input type="time" name="startTime" required></div>
                <div class="form-group"><label>End Time</label><input type="time" name="endTime" required></div>
                <div class="form-group">
                    <label><input type="checkbox" id="select-all-days-new"> Every Day</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-top: 5px;">
                        ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => `<label><input type="checkbox" class="day-checkbox-new" name="days" value="${day}"> ${day}</label>`).join('')}
                    </div>
                </div>
                <button type="submit" class="btn">Add Doctor</button>
            </form>

            <form id="existingDoctorForm" style="display: none;">
                <div class="form-group"><label>Select Doctor</label><select name="doctorId" required>${allDoctors.map(d => `<option value="${d.id}">${d.name} (Phone: ${d.phone})</option>`).join('')}</select></div>
                <div class="form-group"><label>Start Time</label><input type="time" name="startTime" required></div>
                <div class="form-group"><label>End Time</label><input type="time" name="endTime" required></div>
                <div class="form-group">
                    <label><input type="checkbox" id="select-all-days-invite"> Every Day</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-top: 5px;">
                         ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => `<label><input type="checkbox" class="day-checkbox-invite" name="days" value="${day}"> ${day}</label>`).join('')}
                    </div>
                </div>
                <button type="submit" class="btn">Send Invite</button>
            </form>
        </div>
    `;
    document.getElementById('select-all-days-new').addEventListener('change', e => document.querySelectorAll('.day-checkbox-new').forEach(cb => cb.checked = e.target.checked));
    document.getElementById('select-all-days-invite').addEventListener('change', e => document.querySelectorAll('.day-checkbox-invite').forEach(cb => cb.checked = e.target.checked));

    document.getElementById('newDoctorForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.days = formData.getAll('days');
        data.clinicId = clinic.id;
        const response = await apiRequest('receptionist/add-doctor', 'POST', data);
        if (response.success) {
            alert('Doctor added!');
            loadDashboard('receptionist');
        } else {
            alert('Error: ' + response.message);
        }
    });

    document.getElementById('existingDoctorForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.days = formData.getAll('days');
        data.clinicId = clinic.id;
        const response = await apiRequest('receptionist/invite-doctor', 'POST', data);
        if (response.success) {
            alert('Invite sent!');
            loadDashboard('receptionist');
        } else {
            alert('Error: ' + response.message);
        }
    });
}

function showClinicDoctors(data) {
    const { clinic, doctors, invitations, allDoctors } = data;
    const dynamicContent = document.getElementById('receptionist-dynamic-content');
    dynamicContent.innerHTML = `
        <div class="card" style="margin-top: 2rem;">
            <h3>Doctors at ${clinic.name}</h3>
            <ul class="appointment-list">
                ${doctors.map(doc => `
                    <li class="appointment-item" style="cursor: pointer;" onclick="viewDoctorAppointments(${doc.id}, '${doc.name}', ${clinic.id})">
                        <div><strong>${doc.name}</strong> (${doc.specialty})<br><small>Schedule: ${doc.start_time} - ${doc.end_time} on ${doc.days}</small></div>
                    </li>
                `).join('')}
                ${invitations.map(inv => {
                    const invitedDoctor = allDoctors.find(d => d.id === inv.doctor_id);
                    return invitedDoctor ? `<li class="appointment-item"><strong>${invitedDoctor.name}</strong> <span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8em;">Pending</span></li>` : '';
                }).join('')}
            </ul>
        </div>
    `;
}

async function viewDoctorAppointments(doctorId, doctorName, clinicId) {
    const dynamicContent = document.getElementById('receptionist-dynamic-content');
    dynamicContent.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;

    const response = await apiRequest(`dashboard/receptionist/${JSON.parse(localStorage.getItem('user')).id}`);
    if(response.success){
        const {appointments} = response;
        const doctorAppointments = appointments.filter(a => a.doctor_id === doctorId && new Date(a.date).toDateString() === new Date().toDateString());

        dynamicContent.innerHTML = `
            <div class="card" style="margin-top: 2rem;">
                 <button class="btn btn-secondary btn-small" onclick="loadDashboard('receptionist')"> &larr; Back to Main</button>
                <h3 style="margin-top: 1rem;">Appointments for Dr. ${doctorName}</h3>
                <ul class="appointment-list">
                    ${doctorAppointments.map(app => `
                        <li class="appointment-item">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>#${app.queue_number} - ${app.patient_name}</strong><br>
                                    <small>Time: ${app.time}</small>
                                </div>
                                <select class="status-select" data-appointment-id="${app.id}" onchange="updateAppointmentStatus(this.dataset.appointmentId, this.value, ${doctorId}, '${doctorName}', ${clinicId})">
                                    <option value="Confirmed" ${app.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                                    <option value="Waiting" ${app.status === 'Waiting' ? 'selected' : ''}>Waiting</option>
                                    <option value="Done" ${app.status === 'Done' ? 'selected' : ''}>Done</option>
                                    <option value="Absent" ${app.status === 'Absent' ? 'selected' : ''}>Absent</option>
                                </select>
                            </div>
                        </li>
                    `).join('') || '<p>No appointments today for this doctor.</p>'}
                </ul>

                <h4 style="margin-top: 2rem;">Add New Appointment</h4>
                <form id="add-appointment-form">
                    <div class="form-group">
                        <label for="patientName">Patient Name</label>
                        <input type="text" id="patientName" name="patientName" required>
                    </div>
                    <div class="form-group">
                        <label for="patientAge">Patient Age</label>
                        <input type="number" id="patientAge" name="patientAge" required>
                    </div>
                    <button type="submit" class="btn">Add Appointment</button>
                </form>
            </div>
        `;

        document.getElementById('add-appointment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const patientName = document.getElementById('patientName').value;
            const patientAge = document.getElementById('patientAge').value;
            const response = await apiRequest('receptionist/add-patient-and-book', 'POST', {
                patientName,
                patientAge,
                doctorId,
                clinicId
            });
            if (response.success) {
                alert('Patient added and appointment booked!');
                viewDoctorAppointments(doctorId, doctorName, clinicId); // Refresh the view
            } else {
                alert('Error: ' + response.message);
            }
        });
    } else {
        dynamicContent.innerHTML = `<p style="color:red;">Could not load appointments.</p>`;
    }
}

async function updateAppointmentStatus(appointmentId, status, doctorId, doctorName, clinicId) {
    const response = await apiRequest(`appointments/${appointmentId}/status`, 'POST', { status });
    if (response.success) {
        alert('Status updated successfully!');
        viewDoctorAppointments(doctorId, doctorName, clinicId);
    } else {
        alert('Error updating status: ' + response.message);
    }
}


function buildAdminDashboard(container, data) {
    const { admin, clinics, doctors, patients, appointments } = data;
    container.innerHTML = `
        <div class="dashboard-header"><h1>Admin Dashboard</h1><p>Welcome, ${data.admin.name}</p></div>
        <div class="dashboard-grid">
            <div class="card">
                <h3>Clinics</h3>
                <div class="form-block">
                    <h4>Add New Clinic</h4>
                    <form id="add-clinic-form">
                        <div class="form-group"><input type="text" name="name" placeholder="Clinic Name" required></div>
                        <div class="form-group"><input type="text" name="address" placeholder="Address" required></div>
                        <div class="form-group"><input type="text" name="receptionist_name" placeholder="Receptionist Name" required></div>
                        <div class="form-group"><input type="text" name="receptionist_username" placeholder="Receptionist Username" required></div>
                        <div class="form-group"><input type="password" name="receptionist_password" placeholder="Receptionist Password" required></div>
                        <button type="submit" class="btn">Add Clinic</button>
                    </form>
                </div>
                <table>
                    <thead><tr><th>Name</th><th>Address</th><th>Receptionist</th><th>Username</th><th>Password</th></tr></thead>
                    <tbody>
                        ${clinics.map(c => `<tr><td>${c.name}</td><td>${c.address}</td><td>${c.receptionist_name || 'N/A'}</td><td>${c.receptionist_username || 'N/A'}</td><td>${c.receptionist_password || 'N/A'}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="card">
                <h3>Doctors</h3>
                <div class="form-block">
                    <h4>Add New Doctor</h4>
                    <form id="add-doctor-form">
                        <div class="form-group"><input type="text" name="name" placeholder="Doctor Name" required></div>
                        <div class="form-group"><input type="text" name="specialty" placeholder="Specialty" required></div>
                        <div class="form-group"><input type="text" name="username" placeholder="Username" required></div>
                        <div class="form-group"><input type="password" name="password" placeholder="Password" required></div>
                        <div class="form-group"><input type="tel" name="phone" placeholder="Mobile" required></div>
                        <div class="form-group">
                            <label>Assign to Clinic</label>
                            <select name="clinicId" required>
                                ${clinics.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group"><label>Start Time</label><input type="time" name="startTime" required></div>
                        <div class="form-group"><label>End Time</label><input type="time" name="endTime" required></div>
                        <div class="form-group">
                            <label>Select Days</label>
                            <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-top: 5px;">
                                ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => `<label><input type="checkbox" name="days" value="${day}"> ${day}</label>`).join('')}
                            </div>
                        </div>
                        <button type="submit" class="btn">Add Doctor</button>
                    </form>
                </div>
                <table>
                    <thead><tr><th>Name</th><th>Specialty</th><th>Username</th><th>Password</th><th>Mobile</th></tr></thead>
                    <tbody>
                        ${doctors.map(d => `<tr><td>${d.name}</td><td>${d.specialty}</td><td>${d.username}</td><td>${d.password}</td><td>${d.phone}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="card">
                <h3>Patients</h3>
                <div class="form-block">
                    <h4>Add New Patient</h4>
                    <form id="add-patient-form-admin">
                        <div class="form-group"><input type="text" name="name" placeholder="Patient Name" required></div>
                        <div class="form-group"><input type="date" name="dob" placeholder="Date of Birth" required></div>
                        <div class="form-group"><input type="text" name="username" placeholder="Username" required></div>
                        <div class="form-group"><input type="password" name="password" placeholder="Password" required></div>
                        <div class="form-group"><input type="tel" name="mobile" placeholder="Mobile" required></div>
                        <button type="submit" class="btn">Add Patient</button>
                    </form>
                </div>
                <table>
                    <thead><tr><th>Name</th><th>Username</th><th>Password</th><th>Mobile</th></tr></thead>
                    <tbody>
                        ${patients.map(p => `<tr><td>${p.name}</td><td>${p.username}</td><td>${p.password}</td><td>${p.mobile}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="card">
                <h3>All Appointments</h3>
                <table>
                    <thead><tr><th>Patient</th><th>Doctor</th><th>Clinic</th><th>Date</th><th>Status</th></tr></thead>
                    <tbody>
                        ${appointments.map(a => `<tr><td>${a.patient_name}</td><td>${a.doctor_name}</td><td>${a.clinic_name}</td><td>${new Date(a.date).toLocaleDateString()}</td><td>${a.status}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('add-clinic-form').addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const response = await apiRequest('admin/clinics', 'POST', data);
        if(response.success) loadDashboard('admin'); else alert(response.message);
    });
    document.getElementById('add-doctor-form').addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.days = formData.getAll('days');
        const response = await apiRequest('admin/doctors', 'POST', data);
        if(response.success) loadDashboard('admin'); else alert(response.message);
    });
    document.getElementById('add-patient-form-admin').addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const response = await apiRequest('admin/patients', 'POST', data);
        if(response.success) loadDashboard('admin'); else alert(response.message);
    });
}

// --- Global Functions for inline JS ---
window.toggleDoctorForm = () => {
    const option = document.querySelector('input[name="addDoctorOption"]:checked').value;
    document.getElementById('newDoctorForm').style.display = (option === 'new') ? 'block' : 'none';
    document.getElementById('existingDoctorForm').style.display = (option === 'existing') ? 'block' : 'none';
};

window.handleJoinRequest = async (requestId, action) => {
    if (action === 'delete' && !confirm('Are you sure?')) return;
    const response = await apiRequest('receptionist/handle-join-request', 'POST', { requestId, action });
    if (response.success) {
        loadDashboard('receptionist');
    } else {
        alert('Error: ' + response.message);
    }
};

window.deleteDoctorFromClinic = async (doctorId, clinicId) => {
    if (!confirm('Are you sure you want to remove this doctor from the clinic?')) return;
    const response = await apiRequest('receptionist/delete-doctor', 'POST', { doctorId, clinicId });
    if (response.success) {
        loadDashboard('receptionist');
    } else {
        alert('Error: ' + response.message);
    }
};


// --- Utilities ---
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}
function calculateAge(dob) {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}
async function apiRequest(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, options);
        if (!response.ok) {
            const error = await response.json();
            return { success: false, message: error.message || `Error: ${response.status}` };
        }
        return await response.json();
    } catch (error) {
        return { success: false, message: 'Could not connect to the server.' };
    }
}

function displayError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}
window.deleteAppointment = async (appointmentId) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) {
        return;
    }
    const response = await apiRequest(`appointments/${appointmentId}`, 'DELETE');
    if (response.success) {
        alert('Appointment cancelled successfully.');
        loadDashboard('patient');
    } else {
        alert('Error: ' + response.message);
    }
};