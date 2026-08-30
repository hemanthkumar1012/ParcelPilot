const token = localStorage.getItem('token');
if (!token) window.location.href = '/login';

let currentUser = null;
let allShipments = [];
let currentShipmentId = null;

async function init() {
    try {
        const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Unauthenticated');
        currentUser = await res.json();
        
        if(currentUser.role !== 'DRIVER') {
            window.location.href = '/dashboard';
        }
        
        document.getElementById('user-name').innerText = currentUser.name;
        await loadShipments();
    } catch (e) {
        logout();
    }
}

async function loadShipments() {
    const tbody = document.getElementById('shipments-tbody');
    try {
        const res = await fetch(`/api/shipments?skip=0&limit=100`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        allShipments = data.items;
        
        updateStats();
        renderTable();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="state-message error">Unable to load shipments.</td></tr>';
    }
}

function updateStats() {
    let stats = { IN_TRANSIT: 0, OUT_FOR_DELIVERY: 0, DELIVERED: 0 };
    allShipments.forEach(s => {
        if (stats[s.current_status] !== undefined) stats[s.current_status]++;
    });

    document.getElementById('stat-total').innerText = allShipments.length;
    document.getElementById('stat-transit').innerText = stats.IN_TRANSIT;
    document.getElementById('stat-out').innerText = stats.OUT_FOR_DELIVERY;
    document.getElementById('stat-delivered').innerText = stats.DELIVERED;
}

function renderTable() {
    const tbody = document.getElementById('shipments-tbody');
    tbody.innerHTML = '';
    
    if (allShipments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="state-message">No assignments found.</td></tr>';
        return;
    }

    allShipments.forEach(s => {
        const tr = document.createElement('tr');
        const badgeClass = s.current_status.toLowerCase();
        tr.innerHTML = `
            <td><strong>${s.tracking_id}</strong></td>
            <td>${s.sender_name} → ${s.receiver_name}</td>
            <td>${s.origin}</td>
            <td>${s.destination}</td>
            <td><span class="badge ${badgeClass}">${s.current_status.replace(/_/g, ' ')}</span></td>
            <td><button class="action-btn" onclick="openModal(${s.id})">Update</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function openModal(id) {
    currentShipmentId = id;
    const errDiv = document.getElementById('update-err');
    const successDiv = document.getElementById('update-success');
    errDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const timeline = document.getElementById('modal-timeline');
    document.getElementById('modal').style.display = 'flex';

    try {
        const res = await fetch(`/api/shipments/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        document.getElementById('modal-tracking-id').innerText = data.tracking_id;
        document.getElementById('modal-status').innerText = data.current_status.replace(/_/g, ' ');
        document.getElementById('modal-status').className = `badge ${data.current_status.toLowerCase()}`;
        document.getElementById('modal-origin').innerText = data.origin;
        document.getElementById('modal-destination').innerText = data.destination;
        document.getElementById('new-status').value = data.current_status;
        
        timeline.innerHTML = '';
        data.tracking_events.forEach(ev => {
            timeline.innerHTML += `<div class="event">
                <div class="date">${new Date(ev.created_at).toLocaleString()}</div>
                <div class="desc"><strong>${ev.status.replace(/_/g, ' ')}</strong> - ${ev.description}</div>
                ${ev.location ? `<div class="loc">${ev.location}</div>` : ''}
            </div>`;
        });
    } catch (e) {
        timeline.innerHTML = '<div class="state-message error">Unable to load details.</div>';
    }
}

async function updateStatus() {
    const status = document.getElementById('new-status').value;
    const loc = document.getElementById('new-loc').value;
    const desc = document.getElementById('new-desc').value;
    const errDiv = document.getElementById('update-err');
    const successDiv = document.getElementById('update-success');
    
    errDiv.style.display = 'none';
    
    if (!desc) {
        errDiv.innerText = "Description is required.";
        errDiv.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(`/api/shipments/${currentShipmentId}/status`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status, location: loc || null, description: desc })
        });
        
        if (!res.ok) {
            const err = await res.json();
            errDiv.innerText = err.detail || "Update failed.";
            errDiv.style.display = 'block';
        } else {
            successDiv.innerText = "Status updated successfully!";
            successDiv.style.display = 'block';
            document.getElementById('new-loc').value = '';
            document.getElementById('new-desc').value = '';
            await openModal(currentShipmentId);
            await loadShipments();
        }
    } catch (e) {
        errDiv.innerText = "An unexpected error occurred.";
        errDiv.style.display = 'block';
    }
}

function closeModal() { document.getElementById('modal').style.display = 'none'; }
function logout() { localStorage.removeItem('token'); window.location.href = '/login'; }
window.onclick = function(event) { if (event.target == document.getElementById('modal')) closeModal(); }

init();
