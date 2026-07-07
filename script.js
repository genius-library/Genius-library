function updateTime() {
    const timeElement = document.getElementById("live-time");
    const now = new Date();
    timeElement.innerHTML = `<i class="fa-regular fa-clock"></i> ${now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}`;
}
setInterval(updateTime, 1000);
updateTime();

function recordAttendance(type) {
    const studentId = document.getElementById("studentId").value.trim();
    const statusCard = document.getElementById("status-card");
    const statusMessage = document.getElementById("status-message");
    const statusIcon = document.getElementById("status-icon");

    if (studentId === "") {
        showStatus("#fee2e2", "#991b1b", "fa-solid fa-triangle-exclamation", "Identification is required. Enter name/ID.");
        return;
    }

    let attendanceData = JSON.parse(localStorage.getItem("attendanceLogs")) || [];
    
    // --- फीचर 1: डुप्लिकेट एंट्री रोकने का लॉजिक ---
    // इस स्टूडेंट के सारे पिछले रिकॉर्ड्स ढूंढें
    const studentRecords = attendanceData.filter(r => r.id.toLowerCase() === studentId.toLowerCase());
    
    if (studentRecords.length > 0) {
        const lastRecord = studentRecords[studentRecords.length - 1]; // सबसे आखिरी रिकॉर्ड
        
        if (type === "Check-In" && lastRecord.type === "Check-In") {
            showStatus("#fee2e2", "#991b1b", "fa-solid fa-circle-xmark", `${studentId} is already Checked-In!`);
            return;
        }
        if (type === "Check-Out" && lastRecord.type === "Check-Out") {
            showStatus("#fee2e2", "#991b1b", "fa-solid fa-circle-xmark", `${studentId} is already Checked-Out!`);
            return;
        }
    } else {
        // अगर स्टूडेंट पहली बार आ रहा है और सीधे Check-Out दबा दे
        if (type === "Check-Out") {
            showStatus("#fee2e2", "#991b1b", "fa-solid fa-circle-xmark", `${studentId} has no Check-In record today.`);
            return;
        }
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-IN');
    const dateString = now.toLocaleDateString('en-IN');

    const record = { id: studentId, type: type, time: timeString, date: dateString };
    attendanceData.push(record);
    localStorage.setItem("attendanceLogs", JSON.stringify(attendanceData));

    // सफलता का मैसेज दिखाना
    if(type === 'Check-In') {
        showStatus("#d1fae5", "#065f46", "fa-solid fa-circle-check", `${studentId} logged as Check-In at ${timeString}`);
    } else {
        showStatus("#fef3c7", "#92400e", "fa-solid fa-circle-right", `${studentId} logged as Check-Out at ${timeString}`);
    }
    
    document.getElementById("studentId").value = "";
}

// मैसेज दिखाने के लिए एक कॉमन हेल्पर फंक्शन
function showStatus(bgColor, textColor, iconClass, message) {
    const statusCard = document.getElementById("status-card");
    const statusMessage = document.getElementById("status-message");
    const statusIcon = document.getElementById("status-icon");
    
    statusCard.className = "status-card";
    statusCard.style.background = bgColor;
    statusCard.style.color = textColor;
    statusIcon.className = iconClass;
    statusMessage.innerText = message;
    
    // पुराना टाइमर साफ़ करके नया 4 सेकंड का टाइमर चालू करें
    clearTimeout(window.statusTimer);
    window.statusTimer = setTimeout(() => { statusCard.classList.add("hidden"); }, 4000);
}
