// ================= FIREBASE REALTIME BACKEND INTEGRATION =================
const DB_URL = "https://genius-library-bcc4a-default-rtdb.firebaseio.com/";

// डेटाबेस से डेटा फेच करने का कोर फंक्शन
async function fetchFromDB(node) {
    try {
        let response = await fetch(`${DB_URL}${node}.json`);
        let data = await response.json();
        return data ? data : null;
    } catch (e) {
        console.error("Firebase Fetch Error: ", e);
        return null;
    }
}

// डेटाबेस में डेटा सेव करने का कोर फंक्शन
async function saveToDB(node, data) {
    try {
        await fetch(`${DB_URL}${node}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error("Firebase Save Error: ", e);
    }
}

// डिफ़ॉल्ट बैकअप पासवर्ड सेटिंग (यहाँ केस सेंसिटिव स्पेलिंग बिल्कुल सही कर दी है)
async function getAdminPassword() {
    let pwdNode = await fetchFromDB('adminConfig');
    return (pwdNode && pwdNode.password) ? pwdNode.password : "genius123";
}

// मुख्य लॉगिन फंक्शन (यह आपके admin.html के पासवर्ड लॉजिक को संभालेगा)
async function loginAdmin() {
    const passwordInput = document.getElementById("adminPassword").value;
    const errorMsg = document.getElementById("login-error");
    const correctPassword = await getAdminPassword();

    if (passwordInput === correctPassword) {
        document.getElementById("login-section").classList.add("hidden");
        document.getElementById("dashboard-section").classList.remove("hidden");
        loadDashboardData();
    } else {
        errorMsg.innerHTML = "<i class='fa-solid fa-triangle-exclamation'></i> Access Denied! Invalid credentials.";
    }
}

function logoutAdmin() {
    document.getElementById("adminPassword").value = "";
    document.getElementById("login-error").innerText = "";
    document.getElementById("dashboard-section").classList.add("hidden");
    document.getElementById("login-section").classList.remove("hidden");
}

// क्लाउड डेटा को एक साथ लोड करने का कम्बाइंड फंक्शन
async function loadDashboardData() {
    await loadAttendanceLogs(); 
    await loadAdmissionRecords(); 
    await updateStudentDropdown(); 
    await loadSeatAllocations(); 
    await calculateLiveAnalytics();
}

async function switchTab(tabName) {
    const attPanel = document.getElementById("attendance-panel-section");
    const admPanel = document.getElementById("admission-panel-section");
    const seatsPanel = document.getElementById("seats-panel-section");
    const attBtn = document.getElementById("tab-btn-attendance");
    const admBtn = document.getElementById("tab-btn-admission");
    const seatsBtn = document.getElementById("tab-btn-seats");

    attPanel.classList.add("hidden"); admPanel.classList.add("hidden"); seatsPanel.classList.add("hidden");
    attBtn.classList.remove("active"); admBtn.classList.remove("active"); seatsBtn.classList.remove("active");

    if (tabName === 'attendance') { attPanel.classList.remove("hidden"); attBtn.classList.add("active"); await loadAttendanceLogs(); }
    else if (tabName === 'admission') { admPanel.classList.remove("hidden"); admBtn.classList.add("active"); await loadAdmissionRecords(); }
    else if (tabName === 'seats') { seatsPanel.classList.remove("hidden"); seatsBtn.classList.add("active"); await updateStudentDropdown(); await loadSeatAllocations(); }
    
    await calculateLiveAnalytics();
}

async function calculateLiveAnalytics() {
    let seatData = await fetchFromDB("seatAllocations") || [];
    let admissionData = await fetchFromDB("admissionRecords") || [];
    
    if(!Array.isArray(seatData)) seatData = Object.values(seatData).filter(Boolean);
    if(!Array.isArray(admissionData)) admissionData = Object.values(admissionData).filter(Boolean);

    document.getElementById("total-occupied-seats").innerText = seatData.length;
    let pendingCount = admissionData.filter(student => student.payment === "Due" || !student.payment).length;
    document.getElementById("total-defaulters").innerText = pendingCount;
}

// ================= ATTENDANCE TRACKING SYSTEM (DATE-WISE GROUPED) =================
async function loadAttendanceLogs() {
    const tableBody = document.getElementById("log-table-body"); 
    tableBody.innerHTML = ""; 
    const tableHeader = document.querySelector(".log-table thead");
    tableHeader.innerHTML = `<tr><th>Student ID & Name</th><th>Time Log</th><th>Status</th><th>Operation</th></tr>`;

    let attendanceData = await fetchFromDB("attendanceLogs") || [];
    if(!Array.isArray(attendanceData)) attendanceData = Object.values(attendanceData).filter(Boolean);

    const todayDate = new Date().toLocaleDateString('en-IN');
    let checkInCount = 0; let checkOutCount = 0;

    if (attendanceData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:30px;">No logs found.</td></tr>`;
        document.getElementById("total-checkins").innerText = 0; document.getElementById("total-checkouts").innerText = 0; return;
    }
    
    attendanceData.forEach(r => { if (r.date === todayDate) { if(r.type === "Check-In") checkInCount++; if(r.type === "Check-Out") checkOutCount++; } });
    document.getElementById("total-checkins").innerText = checkInCount; document.getElementById("total-checkouts").innerText = checkOutCount;

    // तारीख के हिसाब से रीवर्स क्रोनोलॉजिकल ऑर्डर (लेटेस्ट सबसे ऊपर) में डेटा अरेंज करना
    let sortedData = [...attendanceData].reverse();
    let grouped = {};
    sortedData.forEach(log => {
        if (!grouped[log.date]) grouped[log.date] = [];
        grouped[log.date].push(log);
    });

    Object.keys(grouped).forEach(date => {
        // तारीख की सेपरेटर हेडर रो
        const dateHeader = document.createElement("tr");
        dateHeader.innerHTML = `<td colspan="4" style="background: rgba(79, 70, 229, 0.15); color: var(--primary); font-weight: 700; padding: 10px; text-align: left; border-left: 4px solid var(--primary);"><i class="fa-solid fa-calendar-day"></i> Attendance Date: ${date}</td>`;
        tableBody.appendChild(dateHeader);

        grouped[date].forEach(record => {
            const row = document.createElement("tr"); 
            const safeId = record.id.replace(/'/g, "\\'");
            const badgeClass = record.type === "Check-In" ? "status-in" : "status-out";
            const borderCol = record.type === "Check-In" ? "var(--primary)" : "var(--danger)";
            
            row.innerHTML = `
                <td>
                    <span class="student-avatar" style="background:var(--primary); font-size:10px; font-weight:700;">ID</span> 
                    <strong>${record.id.toUpperCase()}</strong><br>
                    <small style="color:var(--text-muted); font-weight:600; margin-left:33px;">${record.name}</small>
                </td>
                <td><span class="time-tag" style="border-left: 3px solid ${borderCol};">${record.time}</span></td>
                <td><span class="status-badge ${badgeClass}">${record.type}</span></td>
                <td><button class="btn-history" onclick="showHistory('${safeId}')"><i class="fa-solid fa-eye"></i> View Logs</button></td>
            `;
            tableBody.appendChild(row);
        });
    });
}

// 🕒 छात्र का पूरा इतिहास देखने के लिए History Modal
async function showHistory(studentId) {
    const modal = document.getElementById("historyModal"); 
    const nameHeader = document.getElementById("history-student-name"); 
    const historyTableBody = document.getElementById("history-table-body");
    
    nameHeader.innerText = `Logs for ID: ${studentId.toUpperCase()}`; 
    historyTableBody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Loading Logs...</td></tr>";
    
    let attendanceData = await fetchFromDB("attendanceLogs") || [];
    if(!Array.isArray(attendanceData)) attendanceData = Object.values(attendanceData).filter(Boolean);

    let studentHistory = attendanceData.filter(r => r.id.toLowerCase() === studentId.toLowerCase());
    historyTableBody.innerHTML = "";
    
    if(studentHistory.length === 0) {
        historyTableBody.innerHTML = "<tr><td colspan='3' style='text-align:center; color:var(--text-muted);'>No historical records.</td></tr>";
    } else {
        studentHistory.reverse().forEach(h => {
            const row = document.createElement("tr"); 
            const badgeClass = h.type === "Check-In" ? "status-in" : "status-out";
            row.innerHTML = `<td>${h.date}</td><td><span class="time-tag">${h.time}</span></td><td><span class="status-badge ${badgeClass}">${h.type}</span></td>`;
            historyTableBody.appendChild(row);
        });
    }
    modal.classList.remove("hidden");
}

function closeHistoryModal() { document.getElementById("historyModal").classList.add("hidden"); }
function openPasswordModal() { document.getElementById("passwordModal").classList.remove("hidden"); }
function closePasswordModal() {
    document.getElementById("passwordModal").classList.add("hidden");
    document.getElementById("current-password-input").value = "";
    document.getElementById("new-password-input").value = "";
    document.getElementById("confirm-password-input").value = "";
}

async function updateAdminPassword() {
    const currentPass = document.getElementById("current-password-input").value;
    const newPass = document.getElementById("new-password-input").value;
    const confirmPass = document.getElementById("confirm-password-input").value;
    const correctPassword = await getAdminPassword();

    if (!currentPass || !newPass || !confirmPass) { alert("All fields are required!"); return; }
    if (currentPass !== correctPassword) { alert("Current password is incorrect!"); return; }
    if (newPass !== confirmPass) { alert("New passwords do not match!"); return; }
    if (newPass.length < 4) { alert("New password must be at least 4 characters long!"); return; }

    await saveToDB('adminConfig', { password: newPass });
    alert("Password changed successfully! Please login again.");
    closePasswordModal(); logoutAdmin();
}

window.onclick = function(e) { 
    if (e.target == document.getElementById("historyModal")) closeHistoryModal();
    if (e.target == document.getElementById("passwordModal")) closePasswordModal();
}

async function clearLogs() { 
    if (confirm("Clear all attendance logs from Cloud?")) { 
        await saveToDB("attendanceLogs", {}); 
        await loadAttendanceLogs(); 
    } 
}

function filterLogs() {
    const searchInput = document.getElementById("searchHistory").value.toLowerCase();
    const tableBody = document.getElementById("log-table-body"); const rows = tableBody.getElementsByTagName("tr");
    for (let i = 0; i < rows.length; i++) { if(rows[i].cells.length < 4 || rows[i].cells[0].colSpan > 1) continue; const content = rows[i].cells[0].innerText.toLowerCase(); rows[i].style.display = content.includes(searchInput) ? "" : "none"; }
}

// ================= ADMISSION SYSTEM WITH CLOUD UNIQUE ID =================
async function registerStudent() {
    const name = document.getElementById("adm-name").value.trim(); 
    const date = document.getElementById("adm-date").value; 
    const phone = document.getElementById("adm-phone").value.trim(); 
    const address = document.getElementById("adm-address").value.trim();
    
    if (!name || !date || !phone || !address) { alert("Please fill all fields!"); return; }
    
    let admissionData = await fetchFromDB("admissionRecords") || [];
    if(!Array.isArray(admissionData)) admissionData = Object.values(admissionData).filter(Boolean);
    
    let nextIdNumber = 1001;
    if (admissionData.length > 0) {
        let idNumbers = admissionData.map(s => {
            let match = s.id ? s.id.match(/\d+/) : null;
            return match ? parseInt(match[0]) : 1000;
        });
        nextIdNumber = Math.max(...idNumbers) + 1;
    }
    const uniqueId = "GL-" + nextIdNumber;
    
    admissionData.push({ id: uniqueId, name, date, phone, address, payment: "Due" }); 
    await saveToDB("admissionRecords", admissionData);
    
    document.getElementById("adm-name").value = ""; document.getElementById("adm-date").value = ""; document.getElementById("adm-phone").value = ""; document.getElementById("adm-address").value = "";
    
    alert(`🎉 Success!\nUnique ID Generated: ${uniqueId}\nAssign this ID to ${name}.`); 
    await loadAdmissionRecords(); 
    await updateStudentDropdown();
    await calculateLiveAnalytics();
}

async function loadAdmissionRecords() {
    const tableBody = document.getElementById("admission-table-body"); tableBody.innerHTML = "";
    let admissionData = await fetchFromDB("admissionRecords") || [];
    if(!Array.isArray(admissionData)) admissionData = Object.values(admissionData).filter(Boolean);

    if (admissionData.length === 0) { tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">No records found.</td></tr>`; return; }
    
    const tableHeader = document.querySelector("#admission-panel-section .log-table thead");
    tableHeader.innerHTML = `<tr><th>ID & Student</th><th>Adm Date</th><th>Contact / Address</th><th>Fees</th><th>Action</th></tr>`;

    admissionData.map((student, originalIndex) => {
        return { ...student, originalIndex };
    }).reverse().forEach((student) => {
        const row = document.createElement("tr"); 
        const safeId = student.id.replace(/'/g, "\\'");
        
        let paymentBadge = ""; let actionPaymentBtn = "";
        if (student.payment === "Paid") {
            paymentBadge = `<span class="status-badge status-in"><i class="fa-solid fa-circle-check"></i> Paid</span>`;
            actionPaymentBtn = `<button class="btn-history" style="color:var(--danger); border-color:var(--danger); margin-right:5px;" onclick="togglePaymentStatus(${student.originalIndex}, 'Due')"><i class="fa-solid fa-xmark"></i> Mark Due</button>`;
        } else {
            paymentBadge = `<span class="status-badge status-out"><i class="fa-solid fa-circle-exclamation"></i> Due</span>`;
            actionPaymentBtn = `<button class="btn-history" style="color:var(--success); border-color:var(--success); margin-right:5px;" onclick="togglePaymentStatus(${student.originalIndex}, 'Paid')"><i class="fa-solid fa-check"></i> Mark Paid</button>`;
        }

        row.innerHTML = `
            <td><span style="background:#4f46e5; color:white; padding:2px 6px; border-radius:6px; font-size:11px; font-weight:700; display:inline-block; margin-bottom:4px;">${student.id}</span><br><strong>${student.name}</strong></td>
            <td>${student.date}</td>
            <td><i class="fa-solid fa-phone"></i> ${student.phone}<br><small style="color:var(--text-muted);"><i class="fa-solid fa-location-dot"></i> ${student.address}</small></td>
            <td>${paymentBadge}</td>
            <td style="white-space: nowrap;">
                ${actionPaymentBtn}
                <button class="btn-history" style="color:var(--danger); border-color:var(--danger);" onclick="removeStudent('${safeId}')"><i class="fa-solid fa-user-minus"></i> Remove</button>
            </td>`;
        tableBody.appendChild(row);
    });
}

async function togglePaymentStatus(index, newStatus) {
    let admissionData = await fetchFromDB("admissionRecords") || [];
    if(!Array.isArray(admissionData)) admissionData = Object.values(admissionData).filter(Boolean);

    if(admissionData[index]) {
        admissionData[index].payment = newStatus;
        await saveToDB("admissionRecords", admissionData);
        await loadAdmissionRecords(); await calculateLiveAnalytics();
    }
}

async function removeStudent(studentId) {
    if(confirm(`Remove ID: ${studentId.toUpperCase()} from Cloud Server?\nThis will also vacate their seat.`)) {
        let admissionData = await fetchFromDB("admissionRecords") || [];
        if(!Array.isArray(admissionData)) admissionData = Object.values(admissionData).filter(Boolean);
        admissionData = admissionData.filter(s => s.id.toLowerCase() !== studentId.toLowerCase());
        await saveToDB("admissionRecords", admissionData);
        
        let seatData = await fetchFromDB("seatAllocations") || [];
        if(!Array.isArray(seatData)) seatData = Object.values(seatData).filter(Boolean);
        seatData = seatData.filter(item => item.studentId.toLowerCase() !== studentId.toLowerCase());
        await saveToDB("seatAllocations", seatData);
        
        await loadAdmissionRecords(); await updateStudentDropdown(); await loadSeatAllocations(); await calculateLiveAnalytics();
    }
}

async function exportAdmissions() {
    let admissionData = await fetchFromDB("admissionRecords") || [];
    if(!Array.isArray(admissionData)) admissionData = Object.values(admissionData).filter(Boolean);
    if (admissionData.length === 0) { alert("No data found!"); return; }
    
    let csvContent = "data:text/csv;charset=utf-8,ID,Student Name,Admission Date,Contact No,Address,Payment Status\n";
    admissionData.forEach(s => { csvContent += `"${s.id}","${s.name}","${s.date}","${s.phone}","${s.address}","${s.payment || 'Due'}"\n`; });
    const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `Admission_Report.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ================= SEAT ALLOTMENT SYSTEM BY CLOUD ID =================
async function updateStudentDropdown() {
    const select = document.getElementById("seat-student-select"); select.innerHTML = '<option value="">-- Choose Student ID --</option>';
    let admissionData = await fetchFromDB("admissionRecords") || [];
    if(!Array.isArray(admissionData)) admissionData = Object.values(admissionData).filter(Boolean);

    admissionData.forEach(student => { 
        const option = document.createElement("option"); 
        option.value = student.id; 
        option.innerText = `${student.id} - ${student.name}`; 
        select.appendChild(option); 
    });
}

async function allocateSeat() {
    const studentId = document.getElementById("seat-student-select").value; const seatNumber = document.getElementById("seat-number-input").value.trim();
    if (!studentId || !seatNumber) { alert("Select student ID and seat number!"); return; }
    
    let seatData = await fetchFromDB("seatAllocations") || [];
    if(!Array.isArray(seatData)) seatData = Object.values(seatData).filter(Boolean);

    let admissionData = await fetchFromDB("admissionRecords") || [];
    if(!Array.isArray(admissionData)) admissionData = Object.values(admissionData).filter(Boolean);

    let studentObj = admissionData.find(s => s.id.toLowerCase() === studentId.toLowerCase());

    if (seatData.some(s => s.seat.toLowerCase() === seatNumber.toLowerCase())) { alert(`Error: ${seatNumber} occupied!`); return; }
    if (seatData.some(s => s.studentId.toLowerCase() === studentId.toLowerCase())) { alert(`Error: This student already has a seat!`); return; }

    seatData.push({ studentId: studentId, studentName: studentObj.name, seat: seatNumber }); 
    await saveToDB("seatAllocations", seatData);
    
    document.getElementById("seat-number-input").value = ""; alert(`Assigned ${seatNumber} to ID: ${studentId}!`); 
    await loadSeatAllocations(); await calculateLiveAnalytics();
}

async function loadSeatAllocations() {
    const tableBody = document.getElementById("seat-table-body"); tableBody.innerHTML = "";
    let seatData = await fetchFromDB("seatAllocations") || [];
    if(!Array.isArray(seatData)) seatData = Object.values(seatData).filter(Boolean);

    if (seatData.length === 0) { tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">No seats allocated yet.</td></tr>`; return; }
    seatData.sort((a, b) => a.seat.localeCompare(b.seat, unde