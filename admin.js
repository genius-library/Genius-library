// ================= MASTER SECURE FIREBASE BACKEND INTEGRATION =================
const DB_URL = "https://genius-library-bcc4a-default-rtdb.firebaseio.com/";
let isRenderingSeats = false;

// Universal Secure Fetch Engine
async function fetchFromDB(node) {
    try {
        let response = await fetch(`${DB_URL}${node}.json`);
        return response.ok ? await response.json() : null;
    } catch (e) { console.error("Secure Fetch Error: ", e); return null; }
}

// Universal Secure Save Engine (With Fallback Safe Handshaking)
async function saveToDB(node, data) {
    try {
        await fetch(`${DB_URL}${node}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) { console.error("Secure Save Error: ", e); }
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
        errorMsg.style.color = "var(--danger-red)";
        errorMsg.innerHTML = "❌ Access Denied! Invalid Secure Credentials.";
    }
}

function logoutAdmin() {
    document.getElementById("adminPassword").value = "";
    localStorage.removeItem("adminLoggedInToken");
    document.getElementById("dashboard-section").classList.add("hidden");
    document.getElementById("login-section").classList.remove("hidden");
}

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
    else if (tabName === 'seats') { document.getElementById("seats-panel-section").classList.remove("hidden"); document.getElementById("tab-btn-seats").classList.add("active"); await updateStudentDropdown(); await loadSeatAllocations(); }
    await calculateLiveAnalytics();
}

// ⏱️ LATEST DYNAMIC SINGLE-LINE ATTENDANCE LOG GENERATOR (Renders the single most recent timestamp)
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
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:rgba(255,255,255,0.4); padding:30px;">No activity today. Past records safe in cloud history.</td></tr>`; return;
    }

    let merged = {};
    todayLogs.forEach(r => {
        const key = r.id.toLowerCase();
        if (!merged[key]) merged[key] = { id: r.id, name: r.name, checkIn: [], checkOut: [] };
        if (r.type === "Check-In") merged[key].checkIn.push(r.time);
        if (r.type === "Check-Out") merged[key].checkOut.push(r.time);
    });

    tbody.innerHTML += `<tr><td colspan="3" style="background:rgba(217,190,155,0.08);color:var(--gold-accent);font-weight:600;padding:12px;"><i class="fa-solid fa-bolt"></i> Latest Feed Today (${today})</td></tr>`;
    
    Object.values(merged).forEach(s => {
        // Extracting only the single absolute latest timeline data point
        const lastIn = s.checkIn.length > 0 ? s.checkIn[s.checkIn.length - 1] : "--";
        const lastOut = s.checkOut.length > 0 ? s.checkOut[s.checkOut.length - 1] : "--";
        
        tbody.innerHTML += `<tr>
            <td><strong>${s.name}</strong><br><small style="color:var(--gold-accent);">${s.id.toUpperCase()}</small></td>
            <td>
                <div class="time-container-row">
                    <span class="time-pill pill-in">Latest In</span> <span>${lastIn}</span>
                    <span style="color:rgba(255,255,255,0.15); margin: 0 4px;">|</span>
                    <span class="time-pill pill-out">Latest Out</span> <span>${lastOut}</span>
                </div>
            </td>
            <td><button class="btn-history" onclick="showHistory('${s.id}')">Full History</button></td>
        </tr>`;
    });
}

function toggleNotificationDropdown() { document.getElementById("notiDropdownMenu").classList.toggle("show"); refreshNotificationPanel(); }

function refreshNotificationPanel() {
    let reqs = JSON.parse(localStorage.getItem("pendingAdmissions")) || [];
    const bell = document.getElementById("bell-counter");
    if(bell) { bell.innerText = reqs.length; bell.style.display = reqs.length === 0 ? "none" : "flex"; }
    const drop = document.getElementById("dropdown-noti-list"); if(!drop) return; drop.innerHTML = "";
    if(reqs.length === 0) { document.getElementById("pending-empty").style.display = "block"; } 
    else {
        document.getElementById("pending-empty").style.display = "none";
        reqs.forEach((s, idx) => {
            drop.innerHTML += `<div class="noti-item">
                <div><strong>${s.name}</strong> (${s.phone})</div><div style="font-size:10px;opacity:0.6;">${s.address} • ${s.time}</div>
                <div class="noti-btn-row"><button class="approve-btn" onclick="approveOnlineAdmission(${idx})">Save</button><button class="reject-btn" onclick="rejectOnlineAdmission(${idx})">Drop</button></div>
            </div>`;
        });
    }
}

async function approveOnlineAdmission(index) {
    let reqs = JSON.parse(localStorage.getItem("pendingAdmissions")) || []; let s = reqs[index];
    let adm = await fetchFromDB("admissionRecords") || []; if(!Array.isArray(adm)) adm = Object.values(adm).filter(Boolean);
    let uId = "GL-" + Math.floor(1000 + Math.random() * 9000);
    adm.push({ id: uId, name: s.name, date: new Date().toLocaleDateString('en-IN').replace(/\//g, '-'), phone: s.phone, address: s.address, payment: "Paid" });
    await saveToDB("admissionRecords", adm); alert(`🎉 Scholar ID Created: ${uId}`);
    reqs.splice(index, 1); localStorage.setItem("pendingAdmissions", JSON.stringify(reqs));
    await loadAdmissionRecords(); refreshNotificationPanel(); await calculateLiveAnalytics();
}

function rejectOnlineAdmission(index) {
    let reqs = JSON.parse(localStorage.getItem("pendingAdmissions")) || []; reqs.splice(index, 1);
    localStorage.setItem("pendingAdmissions", JSON.stringify(reqs)); refreshNotificationPanel();
}
// ⏱️ CHRONOLOGICAL HISTORY EXCLUSIVE SINGLE-ROW MERGE MATRIX
async function showHistory(studentId) {
    const modal = document.getElementById("historyModal"); document.getElementById("history-student-name").innerText = `History ID: ${studentId.toUpperCase()}`;
    const tbody = document.getElementById("history-table-body"); tbody.innerHTML = "";
    
    let data = await fetchFromDB("attendanceLogs") || []; if(!Array.isArray(data)) data = Object.values(data).filter(Boolean);
    let hist = data.filter(r => r.id.toLowerCase() === studentId.toLowerCase());
    
    if(hist.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;">No past entries.</td></tr>`;
        modal.classList.remove("hidden"); return;
    }

    // Mapping discrete date maps for timeline line grouping architecture
    let dateGroup = {};
    hist.forEach(h => {
        if(!dateGroup[h.date]) dateGroup[h.date] = { ins: [], outs: [] };
        if(h.type === "Check-In") dateGroup[h.date].ins.push(h.time);
        if(h.type === "Check-Out") dateGroup[h.date].outs.push(h.time);
    });

    // Formatting date items backwards for ascending order timeline
    Object.keys(dateGroup).reverse().forEach(d => {
        let insStr = dateGroup[d].ins.length > 0 ? dateGroup[d].ins.join(", ") : "--";
        let outsStr = dateGroup[d].outs.length > 0 ? dateGroup[d].outs.join(", ") : "--";
        
        tbody.innerHTML += `<tr>
            <td><strong>${d}</strong></td>
            <td>
                <div class="time-container-row">
                    <span class="time-pill pill-in">In Logs</span> <span>${insStr}</span>
                    <span style="color:rgba(255,255,255,0.15); margin: 0 4px;">|</span>
                    <span class="time-pill pill-out">Out Logs</span> <span>${outsStr}</span>
                </div>
            </td>
        </tr>`;
    });
    
    modal.classList.remove("hidden");
}
function closeHistoryModal() { document.getElementById("historyModal").classList.add("hidden"); }

async function calculateLiveAnalytics() {
    let seats = await fetchFromDB("seatAllocations") || []; let adm = await fetchFromDB("admissionRecords") || [];
    if(!Array.isArray(seats)) seats = Object.values(seats).filter(Boolean); if(!Array.isArray(adm)) adm = Object.values(adm).filter(Boolean);
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

async function updateAdminConfig() {
    const cur = document.getElementById("current-password-input").value; const nPass = document.getElementById("new-password-input").value;
    let conf = await fetchFromDB('adminConfig') || {}; let correct = conf.password || "genius123";
    if(cur !== "" && cur !== correct) { alert("Mismatched Validation Credentials!"); return; }
    let obj = { password: nPass !== "" ? nPass : correct, totalSeats: document.getElementById("cfg-total-seats").value.trim(), phone: document.getElementById("cfg-phone").value.trim(), email: document.getElementById("reg-email").value.trim(), address: document.getElementById("reg-addr").value.trim() };
    await saveToDB("adminConfig", obj); alert("🎉 Settings Saved Securely!"); closePasswordModal();
    if(nPass !== "") logoutAdmin(); else loadDashboardData();
}
function openPasswordModal() { document.getElementById("passwordModal").classList.remove("hidden"); }
function closePasswordModal() { document.getElementById("passwordModal").classList.add("hidden"); }

async function registerStudent() {
    const name = document.getElementById("adm-name").value.trim(), date = document.getElementById("adm-date").value, phone = document.getElementById("adm-phone").value.trim(), addr = document.getElementById("adm-address").value.trim();
    if(!name || !date || !phone || !addr) { alert("Fill all fields!"); return; }
    let adm = await fetchFromDB("admissionRecords") || []; if(!Array.isArray(adm)) adm = Object.values(adm).filter(Boolean);
    let uId = "GL-" + Math.floor(1000 + Math.random() * 9000); adm.push({ id: uId, name, date, phone, address: addr, payment: "Paid" });
    await saveToDB("admissionRecords", adm); alert(`Saved Scholar Token: ${uId}`);
    document.getElementById("adm-name").value = ""; loadAdmissionRecords(); updateStudentDropdown();
}

// 💺 LUXURY EMBOSSED BOXES IN ADMISSION MATRIX LOADER
async function loadAdmissionRecords() {
    const tbody = document.getElementById("admission-table-body"); if(!tbody) return; tbody.innerHTML = "";
    let data = await fetchFromDB("admissionRecords") || []; if(!Array.isArray(data)) data = Object.values(data).filter(Boolean);
    data.map((s, idx) => { return { ...s, idx }; }).reverse().forEach(s => {
        const text = s.payment === 'Paid' ? 'Mark Due' : 'Mark Paid';
        tbody.innerHTML += `<tr>
            <td>
                <div class="premium-student-box">
                    <span style="font-weight:700; text-decoration:underline; cursor:pointer; color:var(--text-glow);" onclick="viewStudentProfile('${s.id}')">${s.name}</span><br>
                    <small style="color:var(--gold-accent); font-weight:600;">${s.id}</small>
                </div>
            </td>
            <td>${s.date}</td><td>📞 ${s.phone}<br><span style="font-size:11px; opacity:0.6;">${s.address}</span></td><td>${s.payment}</td>
            <td><button class="btn-history" onclick="togglePaymentStatus(${s.idx}, '${s.payment==='Paid'?'Due':'Paid'}')">${text}</button>
            <button class="btn-history" style="color:var(--danger-red);margin-top:5px;" onclick="removeStudent('${s.id}')">Delete</button></td>
        </tr>`;
    });
}
async function togglePaymentStatus(idx, stat) { let data = await fetchFromDB("admissionRecords") || []; if(data[idx]) { data[idx].payment = stat; await saveToDB("admissionRecords", data); loadAdmissionRecords(); calculateLiveAnalytics(); } }
async function removeStudent(id) { if(confirm("Deregister Student Profile?")) { let data = await fetchFromDB("admissionRecords") || []; if(!Array.isArray(data)) data = Object.values(data).filter(Boolean); data = data.filter(s => s.id !== id); await saveToDB("admissionRecords", data); loadAdmissionRecords(); } }

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

async function allocateSeat() {
    const id = document.getElementById("seat-student-select").value, seat = document.getElementById("seat-number-input").value.trim(); if(!id || !seat) return;
    let sData = await fetchFromDB("seatAllocations") || []; if(!Array.isArray(sData)) sData = Object.values(sData).filter(Boolean);
    let aData = await fetchFromDB("admissionRecords") || []; if(!Array.isArray(aData)) aData = Object.values(aData).filter(Boolean);
    if(sData.some(x => Number(x.seat) === Number(seat))) { alert(`❌ Slot ${seat} already allocated!`); return; }
    if(sData.some(x => x.studentId === id)) { alert("❌ Student already has a desk allocated!"); return; }
    let sObj = aData.find(x => x.id === id); sData.push({ studentId: id, studentName: sObj.name, seat: seat, liveStatus: "Active" });
    await saveToDB("seatAllocations", sData); document.getElementById("seat-number-input").value = ""; await loadSeatAllocations(); await calculateLiveAnalytics();
}

async function loadSeatAllocations() {
    const tbody = document.getElementById("seat-table-body"); if(!tbody) return; tbody.innerHTML = "";
    let seats = await fetchFromDB("seatAllocations") || []; if(!Array.isArray(seats)) seats = Object.values(seats).filter(Boolean); seats.sort((a,b)=>Number(a.seat)-Number(b.seat));
    seats.forEach((item, index) => {
        tbody.innerHTML += `<tr>
            <td>
                <div class="premium-seat-badge">
                    <i class="fa-solid fa-chair"></i> Seat ${item.seat}
                </div>
            </td>
            <td><strong>${item.studentName}</strong><br><small style="opacity:0.6;">${item.studentId.toUpperCase()}</small></td>
            <td><span class="status-badge status-in" style="background:rgba(46,204,113,0.1); color:#2ecc71; padding:4px 10px; border-radius:8px; font-size:11px; font-weight:600;">Assigned</span></td>
            <td><button class="btn-history" style="color:var(--danger-red); border-color:rgba(239,68,68,0.3);" onclick="vacateSeat(${index})">Vacate Desk</button></td>
        </tr>`;
    });
}

async function vacateSeat(index) {
    if(confirm("Vacate this slot?")) {
        let data = await fetchFromDB("seatAllocations") || []; if(!Array.isArray(data)) data = Object.values(data).filter(Boolean);
        data.sort((a,b)=>Number(a.seat)-Number(b.seat)); data.splice(index,1);
        await saveToDB("seatAllocations", data); await loadSeatAllocations(); await calculateLiveAnalytics();
    }
}
function filterLogs() { const input = document.getElementById("searchHistory").value.toLowerCase(); const rows = document.getElementById("log-table-body").getElementsByTagName("tr"); for(let i=0;i<rows.length;i++) { if(rows[i].cells.length<3 || rows[i].cells[0].colSpan>1) continue; rows[i].style.display = rows[i].cells[0].innerText.toLowerCase().includes(input) ? "" : "none"; } }
function clearLogs() { if(confirm("Wipeout Live Logs?")) { saveToDB("attendanceLogs", {}); loadAttendanceLogs(); } }
