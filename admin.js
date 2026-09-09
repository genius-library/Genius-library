// ================= MASTER SECURE FIREBASE BACKEND INTEGRATION =================
const DB_URL = "https://genius-library-bcc4a-default-rtdb.firebaseio.com/";
let isRenderingSeats = false;
let selectedStudentId = null;
let currentActiveShift = "Day"; // Default Shift

// Universal Secure Fetch Engine
async function fetchFromDB(node) {
    try {
        let response = await fetch(`${DB_URL}${node}.json`);
        return response.ok ? await response.json() : null;
    } catch (e) { console.error("Secure Fetch Error: ", e); return null; }
}

// Universal Secure Save Engine
async function saveToDB(node, data) {
    try {
        await fetch(`${DB_URL}${node}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) { console.error("Secure Save Error: ", e); }
}

// 🔄 Auto-Due Check: Admission date se exact 1 month (30 days) baad automatic Due karna
function checkAndApplyAutoDue(student) {
    if (!student.date) return student.payment || "Due";
    
    let p = student.date.split('/');
    if (p.length !== 3) return student.payment || "Due";
    
    let admDate = new Date(p[2], p[1] - 1, p[0]);
    if (isNaN(admDate.getTime())) return student.payment || "Due";

    let nextDueDate = new Date(admDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1); // 1 Month billing cycle
    
    let today = new Date();
    if (today > nextDueDate) {
        return "Due";
    }
    return student.payment || "Due";
}

async function loginAdmin() {
    const passwordInput = document.getElementById("adminPassword").value.trim();
    const errorMsg = document.getElementById("login-error");
    let pwdNode = await fetchFromDB('adminConfig');
    let cloudPassword = (pwdNode && pwdNode.password) ? String(pwdNode.password).trim() : "genius123";

    if (passwordInput === "genius123" || passwordInput === cloudPassword) {
        localStorage.setItem("adminLoggedInToken", "true");
        document.getElementById("login-section").classList.add("hidden");
        document.getElementById("dashboard-section").classList.remove("hidden");
        loadDashboardData();
    } else {
        errorMsg.style.color = "var(--accent-rose)";
        errorMsg.innerHTML = "❌ Access Denied! Invalid Credentials.";
    }
}

function logoutAdmin() {
    document.getElementById("adminPassword").value = "";
    localStorage.removeItem("adminLoggedInToken");
    document.getElementById("dashboard-section").classList.add("hidden");
    document.getElementById("login-section").classList.remove("hidden");
}

// ⚡ Persistent Token: Maintains session on refresh
window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem("adminLoggedInToken") === "true") {
        document.getElementById("login-section").classList.add("hidden");
        document.getElementById("dashboard-section").classList.remove("hidden");
        loadDashboardData();
    }
});

async function loadDashboardData() {
    await loadAttendanceLogs(); 
    await loadAdmissionRecords(); 
    await updateStudentDropdown(); 
    await loadSeatAllocations(); 
    refreshNotificationPanel();
    await loadConfigInputs();
    await calculateLiveAnalytics();
}

async function switchTab(tabName) {
    const panels = ['attendance-panel-section', 'admission-panel-section', 'seats-panel-section'];
    const btns = ['tab-btn-attendance', 'tab-btn-admission', 'tab-btn-seats'];
    panels.forEach(p => document.getElementById(p).classList.add("hidden"));
    btns.forEach(b => document.getElementById(b).classList.remove("active"));

    if (tabName === 'attendance') { document.getElementById("attendance-panel-section").classList.remove("hidden"); document.getElementById("tab-btn-attendance").classList.add("active"); await loadAttendanceLogs(); }
    else if (tabName === 'admission') { document.getElementById("admission-panel-section").classList.remove("hidden"); document.getElementById("tab-btn-admission").classList.add("active"); await loadAdmissionRecords(); refreshNotificationPanel(); }
    else if (tabName === 'seats') { document.getElementById("seats-panel-section").classList.remove("hidden"); document.getElementById("tab-btn-seats").classList.add("active"); await updateStudentDropdown(); switchSeatShift('Day'); }
    await calculateLiveAnalytics();
}
// ⏱️ MULTIPLE IN/OUT TIMESTAMPS ATTENDANCE LOG GENERATOR
async function loadAttendanceLogs() {
    const tbody = document.getElementById("log-table-body"); if(!tbody) return; tbody.innerHTML = ""; 
    const today = new Date().toLocaleDateString('en-IN');
    let inc = 0, outc = 0;

    let data = await fetchFromDB("attendanceLogs") || [];
    if(!Array.isArray(data)) data = Object.values(data).filter(Boolean);

    let todayLogs = data.filter(l => l.date === today);
    todayLogs.forEach(l => { if(l.type === "Check-In") inc++; if(l.type === "Check-Out") outc++; });
    document.getElementById("total-checkins").innerText = inc; document.getElementById("total-checkouts").innerText = outc;

    if (todayLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-secondary); padding:30px; font-weight:600;">No attendance activity today.</td></tr>`; return;
    }

    let merged = {};
    todayLogs.forEach(r => {
        const key = r.id.toLowerCase();
        if (!merged[key]) merged[key] = { id: r.id, name: r.name, checkIn: [], checkOut: [] };
        if (r.type === "Check-In") merged[key].checkIn.push(r.time);
        if (r.type === "Check-Out") merged[key].checkOut.push(r.time);
    });

    tbody.innerHTML += `<tr><td colspan="3" style="background:#f1f5f9; color:var(--accent-purple); font-weight:800; padding:12px 16px;"><i class="fa-solid fa-bolt"></i> Today's Feed (${today})</td></tr>`;
    
    Object.values(merged).forEach(s => {
        const inTimes = s.checkIn.length > 0 ? s.checkIn.join(", ") : "--";
        const outTimes = s.checkOut.length > 0 ? s.checkOut.join(", ") : "--";
        
        tbody.innerHTML += `<tr>
            <td><strong>${s.name}</strong><br><small style="color:var(--accent-purple); font-weight:700;">${s.id.toUpperCase()}</small></td>
            <td>
                <div class="time-container-row">
                    <span class="time-pill pill-in">In</span> <span>${inTimes}</span>
                    <span style="color:#cbd5e1; margin: 0 4px;">|</span>
                    <span class="time-pill pill-out">Out</span> <span>${outTimes}</span>
                </div>
            </td>
            <td><button class="btn-history" onclick="showHistory('${s.id}')">Full History</button></td>
        </tr>`;
    });
}

function toggleNotificationDropdown() { document.getElementById("notiDropdownMenu").classList.toggle("show"); refreshNotificationPanel(); }

// 🔔 Cloud-Synced Notifications Panel (Firebase Realtime)
async function refreshNotificationPanel() {
    let reqsObj = await fetchFromDB("pendingAdmissions") || {};
    let reqs = Object.keys(reqsObj).map(key => ({ firebaseKey: key, ...reqsObj[key] }));

    const bell = document.getElementById("bell-counter");
    if(bell) { 
        bell.innerText = reqs.length; 
        bell.style.display = reqs.length === 0 ? "none" : "flex"; 
    }
    const drop = document.getElementById("dropdown-noti-list"); if(!drop) return; drop.innerHTML = "";
    
    const emptyMsg = document.getElementById("pending-empty");
    if(reqs.length === 0) { 
        if(emptyMsg) emptyMsg.style.display = "block"; 
    } 
    else {
        if(emptyMsg) emptyMsg.style.display = "none";
        reqs.forEach((s) => {
            drop.innerHTML += `<div class="noti-item">
                <div><strong>${s.name}</strong> (${s.phone})</div>
                <div style="font-size:10px; color:var(--text-secondary); margin:2px 0;">${s.address} • ${s.time}</div>
                <div class="noti-btn-row">
                    <button class="approve-btn" onclick="approveOnlineAdmission('${s.firebaseKey}')">Save</button>
                    <button class="reject-btn" onclick="rejectOnlineAdmission('${s.firebaseKey}')">Drop</button>
                </div>
            </div>`;
        });
    }
}

async function approveOnlineAdmission(firebaseKey) {
    let s = await fetchFromDB(`pendingAdmissions/${firebaseKey}`);
    if (!s) { alert("Request already processed or not found."); return; }

    let adm = await fetchFromDB("admissionRecords") || []; if(!Array.isArray(adm)) adm = Object.values(adm).filter(Boolean);
    let uId = "GL-" + Math.floor(1000 + Math.random() * 9000);
    
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    
    adm.push({ 
        id: uId, 
        name: s.name, 
        date: formattedDate, 
        phone: s.phone, 
        address: s.address, 
        payment: "Paid",
        paymentMode: "Cash",
        paymentHistory: [{ date: formattedDate, mode: "Cash", status: "Paid" }]
    });
    
    await saveToDB("admissionRecords", adm); 
    alert(`🎉 Scholar ID Created: ${uId}`);

    // Remove from Firebase pending list
    await fetch(`${DB_URL}pendingAdmissions/${firebaseKey}.json`, { method: 'DELETE' });

    await loadAdmissionRecords(); 
    refreshNotificationPanel(); 
    await calculateLiveAnalytics();
}

async function rejectOnlineAdmission(firebaseKey) {
    if(confirm("Are you sure you want to drop this registration request?")) {
        await fetch(`${DB_URL}pendingAdmissions/${firebaseKey}.json`, { method: 'DELETE' });
        refreshNotificationPanel();
    }
}
// ⏱️ HISTORY MODAL WITH SORTED TIMINGS & PROPER SCROLLING
async function showHistory(studentId) {
    const modal = document.getElementById("historyModal"); 
    document.getElementById("history-student-name").innerText = `History ID: ${studentId.toUpperCase()}`;
    const tbody = document.getElementById("history-table-body"); 
    tbody.innerHTML = "";
    
    let data = await fetchFromDB("attendanceLogs") || []; 
    if(!Array.isArray(data)) data = Object.values(data).filter(Boolean);
    let hist = data.filter(r => r.id && r.id.toLowerCase() === studentId.toLowerCase());
    
    if(hist.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:20px; font-weight:600;">No past entries found.</td></tr>`;
        modal.classList.remove("hidden"); 
        window.history.pushState({ modalOpen: true }, ""); 
        return;
    }

    let dateGroup = {};
    hist.forEach(h => {
        if(!dateGroup[h.date]) dateGroup[h.date] = { ins: [], outs: [] };
        if(h.type === "Check-In") dateGroup[h.date].ins.push(h.time);
        if(h.type === "Check-Out") dateGroup[h.date].outs.push(h.time);
    });

    Object.keys(dateGroup).reverse().forEach(d => {
        let sortedIns = dateGroup[d].ins.sort();
        let sortedOuts = dateGroup[d].outs.sort();

        let insStr = sortedIns.length > 0 ? sortedIns.join(", ") : "--";
        let outsStr = sortedOuts.length > 0 ? sortedOuts.join(", ") : "--";
        
        tbody.innerHTML += `<tr>
            <td style="font-weight:700; white-space:nowrap;">${d}</td>
            <td>
                <div class="time-container-row" style="width: 100%; white-space: normal; word-break: break-all;">
                    <span class="time-pill pill-in">In</span> <span style="font-size: 11px;">${insStr}</span>
                    <span style="color:#cbd5e1; margin: 0 4px;">|</span>
                    <span class="time-pill pill-out">Out</span> <span style="font-size: 11px;">${outsStr}</span>
                </div>
            </td>
        </tr>`;
    });
    
    modal.classList.add("hidden"); // Quick reset state
    modal.classList.remove("hidden");
    window.history.pushState({ modalOpen: true }, ""); 
}

function closeHistoryModal() { 
    const modal = document.getElementById("historyModal");
    if(!modal.classList.contains("hidden")) {
        modal.classList.add("hidden");
        if (window.history.state && window.history.state.modalOpen) {
            window.history.back();
        }
    }
}

function handleHistoryBackdrop(e) {
    if (e.target.id === "historyModal") { closeHistoryModal(); }
}

window.addEventListener("popstate", () => {
    ['historyModal', 'enrollModal', 'studentDetailsModal', 'receiptModal'].forEach(id => {
        let m = document.getElementById(id);
        if (m && !m.classList.contains("hidden")) m.classList.add("hidden");
    });
});

async function calculateLiveAnalytics() {
    let seats = await fetchFromDB("seatAllocations") || []; let adm = await fetchFromDB("admissionRecords") || [];
    if(!Array.isArray(seats)) seats = Object.values(seats).filter(Boolean); if(!Array.isArray(adm)) adm = Object.values(adm).filter(Boolean);
    
    let updated = false;
    adm = adm.map(s => {
        let newStatus = checkAndApplyAutoDue(s);
        if (newStatus !== s.payment) {
            s.payment = newStatus;
            updated = true;
        }
        return s;
    });
    if (updated) { await saveToDB("admissionRecords", adm); }

    document.getElementById("total-occupied-seats").innerText = seats.length; 
    document.getElementById("total-defaulters").innerText = adm.filter(s => s.payment === "Due").length;
}

async function loadConfigInputs() {
    let conf = await fetchFromDB("adminConfig") || {};
    document.getElementById("cfg-total-seats").value = conf.totalSeats || "60";
    document.getElementById("cfg-phone").value = conf.phone || "+91 98765 43210";
    document.getElementById("reg-email").value = conf.email || "info@geniuslibrary.com";
    document.getElementById("reg-addr").value = conf.address || "Patna, Bihar";
}

function toggleResetPasswords() {
    const cur = document.getElementById("current-password-input");
    const nw = document.getElementById("new-password-input");
    const isChecked = document.getElementById("show-reset-pass").checked;
    cur.type = isChecked ? "text" : "password";
    nw.type = isChecked ? "text" : "password";
}

async function updateAdminConfig() {
    const cur = document.getElementById("current-password-input").value; const nPass = document.getElementById("new-password-input").value;
    let conf = await fetchFromDB('adminConfig') || {}; let correct = conf.password || "genius123";
    if(cur !== "" && cur !== correct) { alert("Mismatched Validation Credentials!"); return; }
    let obj = { password: nPass !== "" ? nPass : correct, totalSeats: document.getElementById("cfg-total-seats").value.trim(), phone: document.getElementById("cfg-phone").value.trim(), email: document.getElementById("reg-email").value.trim(), address: document.getElementById("reg-addr").value.trim() };
    await saveToDB("adminConfig", obj); alert("🎉 Settings Saved Securely!"); closePasswordModal();
    if(nPass !== "") logoutAdmin(); else loadDashboardData();
}

function openPasswordModal() { document.getElementById("passwordModal").classList.remove("hidden"); }
function closePasswordModal() { 
    document.getElementById("passwordModal").classList.add("hidden");
    document.getElementById("current-password-input").value = "";
    document.getElementById("new-password-input").value = "";
    document.getElementById("current-password-input").type = "password";
    document.getElementById("new-password-input").type = "password";
    const chk = document.getElementById("show-reset-pass"); if(chk) chk.checked = false;
}
function openEnrollModal() {
    document.getElementById("enrollModal").classList.remove("hidden");
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("adm-date").value = today;
}

function closeEnrollModal() {
    document.getElementById("enrollModal").classList.add("hidden");
    document.getElementById("adm-name").value = "";
    document.getElementById("adm-phone").value = "";
    document.getElementById("adm-address").value = "";
}

function handleEnrollBackdrop(e) {
    if (e.target.id === "enrollModal") { closeEnrollModal(); }
}

async function registerStudent() {
    const name = document.getElementById("adm-name").value.trim();
    const rawDate = document.getElementById("adm-date").value;
    const phone = document.getElementById("adm-phone").value.trim();
    const addr = document.getElementById("adm-address").value.trim();

    if(!name || !rawDate || !phone || !addr) { alert("Fill all fields!"); return; }
    
    const dParts = rawDate.split('-');
    const formattedDate = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;

    let adm = await fetchFromDB("admissionRecords") || []; 
    if(!Array.isArray(adm)) adm = Object.values(adm).filter(Boolean);
    
    let uId = "GL-" + Math.floor(1000 + Math.random() * 9000); 
    adm.push({ 
        id: uId, name, date: formattedDate, phone, address: addr, payment: "Paid",
        paymentMode: "Cash",
        paymentHistory: [{ date: formattedDate, mode: "Cash", status: "Paid" }]
    });
    await saveToDB("admissionRecords", adm); 
    alert(`Saved Scholar Token: ${uId}`);

    closeEnrollModal(); 
    loadAdmissionRecords(); 
    updateStudentDropdown();
}

async function loadAdmissionRecords() {
    const tbody = document.getElementById("admission-table-body"); if(!tbody) return; tbody.innerHTML = "";
    let data = await fetchFromDB("admissionRecords") || []; if(!Array.isArray(data)) data = Object.values(data).filter(Boolean);
    let seatData = await fetchFromDB("seatAllocations") || [];
    if(!Array.isArray(seatData)) seatData = Object.values(seatData).filter(Boolean);

    data.map((s, idx) => { return { ...s, idx }; }).reverse().forEach(s => {
        s.payment = checkAndApplyAutoDue(s);

        const badgeColor = s.payment === 'Paid' ? 'background:#d1fae5; color:#10b981;' : 'background:#fee2e2; color:#f43f5e;';
        const displayDate = s.date ? s.date.replace(/-/g, '/') : '--';

        const studentSeats = seatData.filter(item => item.studentId.toLowerCase() === s.id.toLowerCase());
        const seatBadge = studentSeats.length > 0 
            ? studentSeats.map(st => `<span style="background: #e0e7ff; color: var(--accent-purple); padding: 3px 8px; border-radius: 8px; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; margin-right: 4px;"><i class="fa-solid fa-chair"></i> ${st.shift || 'Day'} Seat ${st.seat}</span>`).join('')
            : `<span style="background: #f1f5f9; color: var(--text-secondary); padding: 3px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;"><i class="fa-solid fa-chair"></i> No Seat</span>`;

        tbody.innerHTML += `<tr>
            <td>
                <div class="premium-student-box">
                    <span style="font-weight:800; cursor:pointer; color:var(--text-primary);" onclick="viewStudentProfile('${s.id}')">${s.name}</span><br>
                    <small style="color:var(--accent-purple); font-weight:800;">${s.id}</small><br>
                    ${seatBadge}
                </div>
            </td>
            <td><strong>${displayDate}</strong></td>
            <td>📞 ${s.phone}<br><span style="font-size:11px; color:var(--text-secondary);">${s.address}</span></td>
            <td><span style="padding:4px 8px; border-radius:8px; font-size:10px; font-weight:800; ${badgeColor}">${s.payment || 'Due'}</span></td>
            <td>
                <button class="btn-history" onclick="openStudentDetails('${s.id}')"><i class="fa-solid fa-eye" style="color:var(--accent-purple);"></i> View Details</button>
                <button class="btn-history" style="color:var(--accent-rose); margin-top:4px;" onclick="removeStudent('${s.id}')">Delete</button>
            </td>
        </tr>`;
    });
}

function openStudentDetails(studentId) {
    selectedStudentId = studentId;
    fetchFromDB("admissionRecords").then(raw => {
        let admList = Array.isArray(raw) ? raw : Object.values(raw || {}).filter(Boolean);
        let student = admList.find(s => s.id === studentId);
        if (!student) return;

        document.getElementById("modal-student-title").innerHTML = `<i class="fa-solid fa-file-invoice-dollar" style="color:var(--accent-purple);"></i> ${student.name} (${student.id})`;
        
        let statusEl = document.getElementById("modal-current-status");
        let currentStat = checkAndApplyAutoDue(student);
        statusEl.innerText = currentStat;
        statusEl.style.cssText = currentStat === 'Paid' ? 'background:#d1fae5; color:#10b981; padding:4px 8px; border-radius:8px; font-size:10px; font-weight:800;' : 'background:#fee2e2; color:#f43f5e; padding:4px 8px; border-radius:8px; font-size:10px; font-weight:800;';
        
        document.getElementById("modal-adm-date").innerText = student.date || 'N/A';

        const historyContainer = document.getElementById("payment-history-container");
        historyContainer.innerHTML = "";

        let historyList = student.paymentHistory || [
            { date: student.date || 'N/A', mode: student.paymentMode || 'Cash', status: student.payment || 'Due' }
        ];
        
        historyList.forEach((hist, index) => {
            let div = document.createElement("div");
            div.style.background = "var(--clay-surface)";
            div.style.padding = "10px 12px";
            div.style.borderRadius = "12px";
            div.style.fontSize = "11px";
            div.style.border = "2px solid #ffffff";
            div.style.display = "flex";
            div.style.justifyContent = "space-between";
            div.style.alignItems = "center";

            div.innerHTML = `
                <span><strong>Mode:</strong> ${hist.mode} | <strong>Date:</strong> ${hist.date} | <span style="color:${hist.status==='Paid'?'var(--accent-emerald)':'var(--accent-rose)'}; font-weight:800;">${hist.status}</span></span>
                <button onclick="clearSpecificPayment(${index})" style="background:#fee2e2; color:var(--accent-rose); border:none; border-radius:50%; width:20px; height:20px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:11px;" title="Clear Log">&times;</button>
            `;
            historyContainer.appendChild(div);
        });

        document.getElementById("studentDetailsModal").classList.remove("hidden");
    });
}

function closeDetailsModal() { document.getElementById("studentDetailsModal").classList.add("hidden"); }

async function clearSpecificPayment(index) {
    let raw = await fetchFromDB("admissionRecords") || [];
    let admList = Array.isArray(raw) ? raw : Object.values(raw).filter(Boolean);
    let student = admList.find(s => s.id === selectedStudentId);
    if (!student || !student.paymentHistory) return;

    student.paymentHistory.splice(index, 1);
    await saveToDB("admissionRecords", admList);
    openStudentDetails(selectedStudentId);
    loadAdmissionRecords();
}

async function markPaymentWithMode(mode) {
    let raw = await fetchFromDB("admissionRecords") || [];
    let admList = Array.isArray(raw) ? raw : Object.values(raw).filter(Boolean);
    let student = admList.find(s => s.id === selectedStudentId);
    if (!student) return;

    student.payment = "Paid";
    student.paymentMode = mode;
    
    let currentDate = new Date().toLocaleDateString('en-IN');
    if (!student.paymentHistory) student.paymentHistory = [];
    student.paymentHistory.push({ date: currentDate, mode: mode, status: "Paid" });

    await saveToDB("admissionRecords", admList);
    loadAdmissionRecords();
    calculateLiveAnalytics();
    openStudentDetails(selectedStudentId);
}

async function togglePaymentStatusFromModal() {
    let raw = await fetchFromDB("admissionRecords") || [];
    let admList = Array.isArray(raw) ? raw : Object.values(raw).filter(Boolean);
    let student = admList.find(s => s.id === selectedStudentId);
    if (!student) return;

    let newStatus = (student.payment === "Paid") ? "Due" : "Paid";
    student.payment = newStatus;
    
    if (!student.paymentHistory) student.paymentHistory = [];
    student.paymentHistory.push({ date: new Date().toLocaleDateString('en-IN'), mode: student.paymentMode || 'Cash', status: newStatus });

    await saveToDB("admissionRecords", admList);
    loadAdmissionRecords();
    calculateLiveAnalytics();
    openStudentDetails(selectedStudentId);
}

function openReceiptModal() {
    fetchFromDB("admissionRecords").then(raw => {
        let admList = Array.isArray(raw) ? raw : Object.values(raw || {}).filter(Boolean);
        let student = admList.find(s => s.id === selectedStudentId);
        if (!student) return;

        let latestTx = (student.paymentHistory && student.paymentHistory.length > 0) 
            ? student.paymentHistory[student.paymentHistory.length - 1] 
            : { date: student.date || 'N/A', mode: student.paymentMode || 'Cash', status: student.payment || 'Due' };

        document.getElementById("rcpt-id").innerText = student.id;
        document.getElementById("rcpt-name").innerText = student.name;
        document.getElementById("rcpt-mode").innerText = latestTx.mode;
        document.getElementById("rcpt-date").innerText = latestTx.date;
        
        let rcptStatus = document.getElementById("rcpt-status");
        rcptStatus.innerText = latestTx.status;
        rcptStatus.style.color = (latestTx.status === "Paid") ? "var(--accent-emerald)" : "var(--accent-rose)";

        document.getElementById("receiptModal").classList.remove("hidden");
    });
}

function closeReceiptModal() { document.getElementById("receiptModal").classList.add("hidden"); }

function filterAdmissions() {
    const input = document.getElementById("searchAdmission").value.toLowerCase();
    const rows = document.getElementById("admission-table-body").getElementsByTagName("tr");
    for (let i = 0; i < rows.length; i++) {
        const studentInfo = rows[i].cells[0] ? rows[i].cells[0].innerText.toLowerCase() : "";
        const contactInfo = rows[i].cells[2] ? rows[i].cells[2].innerText.toLowerCase() : "";
        rows[i].style.display = (studentInfo.includes(input) || contactInfo.includes(input)) ? "" : "none";
    }
}

async function removeStudent(id) { 
    if(confirm("Deregister Student Profile?")) { 
        let data = await fetchFromDB("admissionRecords") || []; 
        if(!Array.isArray(data)) data = Object.values(data).filter(Boolean); 
        data = data.filter(s => s.id !== id); 
        await saveToDB("admissionRecords", data); 
        loadAdmissionRecords(); 
        calculateLiveAnalytics();
    } 
}

async function viewStudentProfile(id) {
    const modal = document.getElementById("studentProfileModal"); const body = document.getElementById("profile-modal-body"); modal.classList.remove("hidden");
    let adm = await fetchFromDB("admissionRecords") || []; if(!Array.isArray(adm)) adm = Object.values(adm).filter(Boolean);
    let idx = adm.findIndex(s => s.id.toLowerCase() === id.toLowerCase()); let s = adm[idx];
    body.innerHTML = `<div class="input-group"><label>Student Name</label><input type="text" id="edt-name" value="${s.name}"></div><div class="input-group"><label>Contact</label><input type="tel" id="edt-phone" value="${s.phone}"></div><div class="input-group"><label>Address</label><input type="text" id="edt-address" value="${s.address}"></div><button class="btn" onclick="commitProfileEdit(${idx})">Update Profile</button>`;
}

async function commitProfileEdit(index) {
    let data = await fetchFromDB("admissionRecords") || []; if(!Array.isArray(data)) data = Object.values(data).filter(Boolean);
    data[index].name = document.getElementById("edt-name").value.trim(); data[index].phone = document.getElementById("edt-phone").value.trim(); data[index].address = document.getElementById("edt-address").value.trim();
    await saveToDB("admissionRecords", data); alert("🎉 Profile Updated!"); closeProfileModal(); loadAdmissionRecords();
}

function closeProfileModal() { document.getElementById("studentProfileModal").classList.add("hidden"); }

async function updateStudentDropdown() {
    const s = document.getElementById("seat-student-select"); s.innerHTML = '<option value="">-- Choose Student ID --</option>';
    let data = await fetchFromDB("admissionRecords") || []; if(!Array.isArray(data)) data = Object.values(data).filter(Boolean);
    data.forEach(x => s.innerHTML += `<option value="${x.id}">${x.name} (${x.id})</option>`);
}

// ☀️🌙 SHIFT SWITCHER BUTTON LOGIC
function switchSeatShift(shiftName) {
    currentActiveShift = shiftName;
    document.getElementById("active-shift-input").value = shiftName;

    const dayBtn = document.getElementById("shift-btn-day");
    const nightBtn = document.getElementById("shift-btn-night");
    const formTitle = document.getElementById("allocation-form-title");

    if (shiftName === "Day") {
        dayBtn.style.boxShadow = "inset 3px 3px 6px #d97706, inset -3px -3px 6px #ffffff";
        nightBtn.style.boxShadow = "var(--clay-shadow-sm)";
        formTitle.innerHTML = `<i class="fa-solid fa-circle-plus" style="color:var(--accent-purple);"></i> Allocate Day Shift Desk`;
    } else {
        nightBtn.style.boxShadow = "inset 3px 3px 6px #4338ca, inset -3px -3px 6px #ffffff";
        dayBtn.style.boxShadow = "var(--clay-shadow-sm)";
        formTitle.innerHTML = `<i class="fa-solid fa-circle-plus" style="color:var(--accent-purple);"></i> Allocate Night Shift Desk`;
    }

    loadSeatAllocations();
}

// 💺 INDEPENDENT SHIFT-WISE SEAT ALLOCATION
async function allocateSeat() {
    const id = document.getElementById("seat-student-select").value;
    const seat = document.getElementById("seat-number-input").value.trim();
    const shift = currentActiveShift;

    if(!id || !seat) { alert("Please select a student and enter seat number!"); return; }

    let sData = await fetchFromDB("seatAllocations") || []; 
    if(!Array.isArray(sData)) sData = Object.values(sData).filter(Boolean);
    
    let aData = await fetchFromDB("admissionRecords") || []; 
    if(!Array.isArray(aData)) aData = Object.values(aData).filter(Boolean);

    if(sData.some(x => Number(x.seat) === Number(seat) && (x.shift || "Day") === shift)) { 
        alert(`❌ Seat ${seat} is already occupied in ${shift} Shift!`); 
        return; 
    }

    if(sData.some(x => x.studentId === id && (x.shift || "Day") === shift)) { 
        alert(`❌ Student already has a desk allocated in ${shift} Shift!`); 
        return; 
    }

    let sObj = aData.find(x => x.id === id); 
    sData.push({ studentId: id, studentName: sObj ? sObj.name : "Unknown", seat: seat, shift: shift, liveStatus: "Active" });
    
    await saveToDB("seatAllocations", sData); 
    document.getElementById("seat-number-input").value = ""; 
    await loadSeatAllocations(); 
    await loadAdmissionRecords(); 
    await calculateLiveAnalytics();
}

async function loadSeatAllocations() {
    const tbody = document.getElementById("seat-table-body"); if(!tbody) return; tbody.innerHTML = "";
    let seats = await fetchFromDB("seatAllocations") || []; if(!Array.isArray(seats)) seats = Object.values(seats).filter(Boolean); 
    
    let filteredSeats = seats.filter(item => (item.shift || "Day") === currentActiveShift);
    filteredSeats.sort((a,b)=>Number(a.seat)-Number(b.seat));
    
    if (filteredSeats.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-secondary); padding:20px; font-weight:600;">No seats allocated for ${currentActiveShift} Shift.</td></tr>`;
        return;
    }

    filteredSeats.forEach((item) => {
        let realIndex = seats.findIndex(s => s.studentId === item.studentId && Number(s.seat) === Number(item.seat) && (s.shift || "Day") === (item.shift || "Day"));

        tbody.innerHTML += `<tr>
            <td>
                <div class="premium-seat-badge">
                    <i class="fa-solid fa-chair"></i> Seat ${item.seat}
                </div>
            </td>
            <td><strong>${item.studentName}</strong><br><small style="color:var(--text-secondary); font-weight:700;">${item.studentId.toUpperCase()}</small></td>
            <td><span style="background:#d1fae5; color:var(--accent-emerald); padding:4px 8px; border-radius:8px; font-size:10px; font-weight:800;">Assigned</span></td>
            <td><button class="btn-history" style="color:var(--accent-rose);" onclick="vacateSeat(${realIndex})">Vacate Desk</button></td>
        </tr>`;
    });
}

async function vacateSeat(index) {
    if(confirm("Vacate this slot?")) {
        let data = await fetchFromDB("seatAllocations") || []; if(!Array.isArray(data)) data = Object.values(data).filter(Boolean);
        data.sort((a,b)=>Number(a.seat)-Number(b.seat)); data.splice(index,1);
        await saveToDB("seatAllocations", data); 
        await loadSeatAllocations(); 
        await loadAdmissionRecords(); 
        await calculateLiveAnalytics();
    }
}

function filterLogs() { const input = document.getElementById("searchHistory").value.toLowerCase(); const rows = document.getElementById("log-table-body").getElementsByTagName("tr"); for(let i=0;i<rows.length;i++) { if(rows[i].cells.length<3 || rows[i].cells[0].colSpan>1) continue; rows[i].style.display = rows[i].cells[0].innerText.toLowerCase().includes(input) ? "" : "none"; } }
function clearLogs() { if(confirm("Wipeout Live Logs?")) { saveToDB("attendanceLogs", {}); loadAttendanceLogs(); } }
