function getAdminPassword() {
    return localStorage.getItem("adminPasswordKey") || "admin123";
}

function loginAdmin() {
    const passwordInput = document.getElementById("adminPassword").value;
    const errorMsg = document.getElementById("login-error");

    if (passwordInput === getAdminPassword()) {
        document.getElementById("login-section").classList.add("hidden");
        document.getElementById("dashboard-section").classList.remove("hidden");
        loadAttendanceLogs(); 
        loadAdmissionRecords(); 
        updateStudentDropdown(); 
        loadSeatAllocations(); 
        calculateLiveAnalytics();
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

function switchTab(tabName) {
    const attPanel = document.getElementById("attendance-panel-section");
    const admPanel = document.getElementById("admission-panel-section");
    const seatsPanel = document.getElementById("seats-panel-section");
    const attBtn = document.getElementById("tab-btn-attendance");
    const admBtn = document.getElementById("tab-btn-admission");
    const seatsBtn = document.getElementById("tab-btn-seats");

    attPanel.classList.add("hidden"); admPanel.classList.add("hidden"); seatsPanel.classList.add("hidden");
    attBtn.classList.remove("active"); admBtn.classList.remove("active"); seatsBtn.classList.remove("active");

    if (tabName === 'attendance') { attPanel.classList.remove("hidden"); attBtn.classList.add("active"); loadAttendanceLogs(); }
    else if (tabName === 'admission') { admPanel.classList.remove("hidden"); admBtn.classList.add("active"); loadAdmissionRecords(); }
    else if (tabName === 'seats') { seatsPanel.classList.remove("hidden"); seatsBtn.classList.add("active"); updateStudentDropdown(); loadSeatAllocations(); }
    
    calculateLiveAnalytics();
}

function calculateLiveAnalytics() {
    let seatData = JSON.parse(localStorage.getItem("seatAllocations")) || [];
    let admissionData = JSON.parse(localStorage.getItem("admissionRecords")) || [];
    document.getElementById("total-occupied-seats").innerText = seatData.length;
    let pendingCount = admissionData.filter(student => student.payment === "Due" || !student.payment).length;
    document.getElementById("total-defaulters").innerText = pendingCount;
}

function loadAttendanceLogs() {
    const tableBody = document.getElementById("log-table-body"); tableBody.innerHTML = ""; 
    const tableHeader = document.querySelector(".log-table thead");
    tableHeader.innerHTML = `<tr><th>Student ID & Name</th><th>Latest Date</th><th>Check-In</th><th>Check-Out</th><th>History</th></tr>`;

    let attendanceData = JSON.parse(localStorage.getItem("attendanceLogs")) || [];
    const todayDate = new Date().toLocaleDateString('en-IN');
    let checkInCount = 0; let checkOutCount = 0;

    if (attendanceData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">No logs found.</td></tr>`;
        document.getElementById("total-checkins").innerText = 0; document.getElementById("total-checkouts").innerText = 0; return;
    }
    attendanceData.forEach(r => { if (r.date === todayDate) { if(r.type === "Check-In") checkInCount++; if(r.type === "Check-Out") checkOutCount++; } });
    document.getElementById("total-checkins").innerText = checkInCount; document.getElementById("total-checkouts").innerText = checkOutCount;

    let groupedLogs = [];
    attendanceData.forEach(record => {
        let existingRecord = groupedLogs.find(g => g.id.toLowerCase() === record.id.toLowerCase());
        if (!existingRecord) { groupedLogs.push({ id: record.id, name: record.name || "Scholars", date: record.date, checkIn: record.type === "Check-In" ? record.time : "---", checkOut: record.type === "Check-Out" ? record.time : "---" }); }
        else { existingRecord.date = record.date; if (record.type === "Check-In") existingRecord.checkIn = record.time; if (record.type === "Check-Out") existingRecord.checkOut = record.time; }
    });
    groupedLogs.reverse().forEach(record => {
        const row = document.createElement("tr"); const safeId = record.id.replace(/'/g, "\\'");
        row.innerHTML = `<td><span class="student-avatar" style="background:var(--primary); font-size:10px; font-weight:700;">ID</span> <strong>${record.id.toUpperCase()}</strong><br><small style="color:var(--text-muted); font-weight:600; margin-left:33px;">${record.name}</small></td><td>${record.date}</td><td><span class="time-tag" style="border-left: 3px solid var(--primary);">${record.checkIn}</span></td><td><span class="time-tag" style="border-left: 3px solid var(--danger);">${record.checkOut}</span></td><td><button class="btn-history" onclick="showHistory('${safeId}')"><i class="fa-solid fa-eye"></i> View Logs</button></td>`;
        tableBody.appendChild(row);
    });
}

function showHistory(studentId) {
    const modal = document.getElementById("historyModal"); const nameHeader = document.getElementById("history-student-name"); const historyTableBody = document.getElementById("history-table-body");
    nameHeader.innerText = `Logs for ID: ${studentId.toUpperCase()}`; historyTableBody.innerHTML = "";
    let attendanceData = JSON.parse(localStorage.getItem("attendanceLogs")) || [];
    let studentHistory = attendanceData.filter(r => r.id.toLowerCase() === studentId.toLowerCase());
    studentHistory.reverse().forEach(h => {
        const row = document.createElement("tr"); const badgeClass = h.type === "Check-In" ? "status-in" : "status-out";
        row.innerHTML = `<td>${h.date}</td><td><span class="time-tag">${h.time}</span></td><td><span class="status-badge ${badgeClass}">${h.type}</span></td>`;
        historyTableBody.appendChild(row);
    });
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

function updateAdminPassword() {
    const currentPass = document.getElementById("current-password-input").value;
    const newPass = document.getElementById("new-password-input").value;
    const confirmPass = document.getElementById("confirm-password-input").value;

    if (!currentPass || !newPass || !confirmPass) { alert("All fields are required!"); return; }
    if (currentPass !== getAdminPassword()) { alert("Current password is incorrect!"); return; }
    if (newPass !== confirmPass) { alert("New passwords do not match!"); return; }
    if (newPass.length < 4) { alert("New password must be at least 4 characters long!"); return; }

    localStorage.setItem("adminPasswordKey", newPass);
    alert("Password changed successfully! Please login again.");
    closePasswordModal(); logoutAdmin();
}

window.onclick = function(e) { 
    if (e.target == document.getElementById("historyModal")) closeHistoryModal();
    if (e.target == document.getElementById("passwordModal")) closePasswordModal();
}

function clearLogs() { if (confirm("Clear all attendance logs?")) { localStorage.removeItem("attendanceLogs"); loadAttendanceLogs(); } }

function filterLogs() {
    const searchInput = document.getElementById("searchHistory").value.toLowerCase();
    const tableBody = document.getElementById("log-table-body"); const rows = tableBody.getElementsByTagName("tr");
    for (let i = 0; i < rows.length; i++) { if(rows[i].cells.length < 5) continue; const content = rows[i].cells[0].innerText.toLowerCase(); rows[i].style.display = content.includes(searchInput) ? "" : "none"; }
}

// ================= ADMISSION SYSTEM WITH UNIQUE ID =================
function registerStudent() {
    const name = document.getElementById("adm-name").value.trim(); 
    const date = document.getElementById("adm-date").value; 
    const phone = document.getElementById("adm-phone").value.trim(); 
    const address = document.getElementById("adm-address").value.trim();
    
    if (!name || !date || !phone || !address) { alert("Please fill all fields!"); return; }
    
    let admissionData = JSON.parse(localStorage.getItem("admissionRecords")) || [];
    
    // ऑटोमैटिक यूनिक आईडी जनरेशन लॉजिक (GL-1001, GL-1002...)
    let nextIdNumber = 1001;
    if (admissionData.length > 0) {
        // सबसे बड़ी आईडी निकालकर उसमें +1 करेंगे
        let idNumbers = admissionData.map(s => {
            let match = s.id ? s.id.match(/\d+/) : null;
            return match ? parseInt(match[0]) : 1000;
        });
        nextIdNumber = Math.max(...idNumbers) + 1;
    }
    const uniqueId = "GL-" + nextIdNumber;
    
    admissionData.push({ id: uniqueId, name, date, phone, address, payment: "Due" }); 
    localStorage.setItem("admissionRecords", JSON.stringify(admissionData));
    
    document.getElementById("adm-name").value = ""; document.getElementById("adm-date").value = ""; document.getElementById("adm-phone").value = ""; document.getElementById("adm-address").value = "";
    
    alert(`🎉 Success!\nUnique ID Generated: ${uniqueId}\nAssign this ID to ${name}.`); 
    loadAdmissionRecords(); 
    updateStudentDropdown();
    calculateLiveAnalytics();
}

function loadAdmissionRecords() {
    const tableBody = document.getElementById("admission-table-body"); tableBody.innerHTML = "";
    let admissionData = JSON.parse(localStorage.getItem("admissionRecords")) || [];
    if (admissionData.length === 0) { tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:20px;">No records found.</td></tr>`; return; }
    
    // टेबल हेडर अपडेट करें ताकि ID का कॉलम दिखे
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

function togglePaymentStatus(index, newStatus) {
    let admissionData = JSON.parse(localStorage.getItem("admissionRecords")) || [];
    if(admissionData[index]) {
        admissionData[index].payment = newStatus;
        localStorage.setItem("admissionRecords", JSON.stringify(admissionData));
        loadAdmissionRecords(); calculateLiveAnalytics();
    }
}

function removeStudent(studentId) {
    if(confirm(`Remove ID: ${studentId.toUpperCase()} from the system?\nThis will also vacate their seat.`)) {
        let admissionData = JSON.parse(localStorage.getItem("admissionRecords")) || [];
        admissionData = admissionData.filter(s => s.id.toLowerCase() !== studentId.toLowerCase());
        localStorage.setItem("admissionRecords", JSON.stringify(admissionData));
        
        let seatData = JSON.parse(localStorage.getItem("seatAllocations")) || [];
        seatData = seatData.filter(item => item.studentId.toLowerCase() !== studentId.toLowerCase());
        localStorage.setItem("seatAllocations", JSON.stringify(seatData));
        
        loadAdmissionRecords(); updateStudentDropdown(); loadSeatAllocations(); calculateLiveAnalytics();
    }
}

function exportAdmissions() {
    let admissionData = JSON.parse(localStorage.getItem("admissionRecords")) || []; if (admissionData.length === 0) { alert("No data found!"); return; }
    let csvContent = "data:text/csv;charset=utf-8,ID,Student Name,Admission Date,Contact No,Address,Payment Status\n";
    admissionData.forEach(s => { csvContent += `"${s.id}","${s.name}","${s.date}","${s.phone}","${s.address}","${s.payment || 'Due'}"\n`; });
    const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `Admission_Report.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ================= SEAT ALLOTMENT SYSTEM BY ID =================
function updateStudentDropdown() {
    const select = document.getElementById("seat-student-select"); select.innerHTML = '<option value="">-- Choose Student ID --</option>';
    let admissionData = JSON.parse(localStorage.getItem("admissionRecords")) || [];
    admissionData.forEach(student => { 
        const option = document.createElement("option"); 
        option.value = student.id; 
        option.innerText = `${student.id} - ${student.name}`; 
        select.appendChild(option); 
    });
}

function allocateSeat() {
    const studentId = document.getElementById("seat-student-select").value; const seatNumber = document.getElementById("seat-number-input").value.trim();
    if (!studentId || !seatNumber) { alert("Select student ID and seat number!"); return; }
    
    let seatData = JSON.parse(localStorage.getItem("seatAllocations")) || [];
    let admissionData = JSON.parse(localStorage.getItem("admissionRecords")) || [];
    let studentObj = admissionData.find(s => s.id.toLowerCase() === studentId.toLowerCase());

    if (seatData.some(s => s.seat.toLowerCase() === seatNumber.toLowerCase())) { alert(`Error: ${seatNumber} occupied!`); return; }
    if (seatData.some(s => s.studentId.toLowerCase() === studentId.toLowerCase())) { alert(`Error: This student already has a seat!`); return; }

    seatData.push({ studentId: studentId, studentName: studentObj.name, seat: seatNumber }); 
    localStorage.setItem("seatAllocations", JSON.stringify(seatData));
    
    document.getElementById("seat-number-input").value = ""; alert(`Assigned ${seatNumber} to ID: ${studentId}!`); 
    loadSeatAllocations(); calculateLiveAnalytics();
}

function loadSeatAllocations() {
    const tableBody = document.getElementById("seat-table-body"); tableBody.innerHTML = "";
    let seatData = JSON.parse(localStorage.getItem("seatAllocations")) || [];
    if (seatData.length === 0) { tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">No seats allocated yet.</td></tr>`; return; }
    seatData.sort((a, b) => a.seat.localeCompare(b.seat, undefined, {numeric: true, sensitivity: 'base'}));
    seatData.forEach((item, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td><span class="time-tag" style="background:var(--primary-light); color:var(--primary); font-weight:700;">${item.seat}</span></td><td><strong>${item.studentId.toUpperCase()}</strong><br><small style="color:var(--text-muted);">${item.studentName}</small></td><td><span class="status-badge status-in"><i class="fa-solid fa-id-card-clip"></i> Allocated</span></td><td><button class="btn-history" style="color:var(--danger);" onclick="vacateSeat(${index})"><i class="fa-solid fa-xl fa-circle-xmark"></i> Vacate</button></td>`;
        tableBody.appendChild(row);
    });
}

function vacateSeat(index) {
    if (confirm("Vacate this seat?")) {
        let seatData = JSON.parse(localStorage.getItem("seatAllocations")) || [];
        seatData.sort((a, b) => a.seat.localeCompare(b.seat, undefined, {numeric: true, sensitivity: 'base'})).splice(index, 1);
        localStorage.setItem("seatAllocations", JSON.stringify(seatData)); 
        loadSeatAllocations(); calculateLiveAnalytics();
    }
}
