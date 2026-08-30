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
        
        document.getElementById('user-name').innerText = currentUser.name;
        document.getElementById('user-role').innerText = currentUser.role;
        
        if (currentUser.role === 'CUSTOMER') {
            document.getElementById('dashboard-title').innerText = "My Shipments";
            document.getElementById('create-shipment-btn').style.display = 'block';
        }
        
        await loadShipments();
    } catch (e) {
        logout();
    }
}

async function loadShipments() {
    const tbody = document.getElementById('shipments-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="state-message">Loading shipments...</td></tr>';
    
    try {
        const res = await fetch(`/api/shipments?skip=0&limit=100`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to load shipments');
        
        const data = await res.json();
        allShipments = data.items;
        
        updateStats();
        renderTable();
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="7" class="state-message error">Unable to load shipments. Please try again.</td></tr>';
    }
}

function updateStats() {
    let stats = {
        CREATED: 0, PICKED_UP: 0, IN_TRANSIT: 0, OUT_FOR_DELIVERY: 0,
        DELIVERED: 0, FAILED: 0, CANCELLED: 0, RETURNED: 0
    };
    allShipments.forEach(s => {
        if (stats[s.current_status] !== undefined) {
            stats[s.current_status]++;
        }
    });

    document.getElementById('stat-total').innerText = allShipments.length;
    document.getElementById('stat-transit').innerText = stats.IN_TRANSIT;
    document.getElementById('stat-out').innerText = stats.OUT_FOR_DELIVERY;
    document.getElementById('stat-delivered').innerText = stats.DELIVERED;
}

function renderTable() {
    const search = document.getElementById('search-box').value.toLowerCase();
    const statusF = document.getElementById('status-filter').value;
    const tbody = document.getElementById('shipments-tbody');
    tbody.innerHTML = '';
    
    let filtered = allShipments.filter(s => {
        const matchSearch = s.tracking_id.toLowerCase().includes(search) || 
                            s.sender_name.toLowerCase().includes(search) || 
                            s.receiver_name.toLowerCase().includes(search);
        const matchStatus = statusF ? s.current_status === statusF : true;
        return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="state-message">No shipments found.</td></tr>';
        return;
    }

    filtered.forEach(s => {
        const tr = document.createElement('tr');
        const badgeClass = s.current_status.toLowerCase();
        tr.innerHTML = `
            <td><strong>${s.tracking_id}</strong></td>
            <td>Cust ID: ${s.customer_id}</td>
            <td>${s.origin}</td>
            <td>${s.destination}</td>
            <td><span class="badge ${badgeClass}">${s.current_status.replace(/_/g, ' ')}</span></td>
            <td>${new Date(s.created_at).toLocaleDateString()}</td>
            <td><button class="action-btn" onclick="openModal(${s.id})">Details</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTable() {
    renderTable();
}

async function openModal(id) {
    currentShipmentId = id;
    const errDiv = document.getElementById('update-err');
    const successDiv = document.getElementById('update-success');
    errDiv.style.display = 'none';
    if(successDiv) successDiv.style.display = 'none';
    
    const timeline = document.getElementById('modal-timeline');
    timeline.innerHTML = '<div class="state-message">Loading details...</div>';
    document.getElementById('modal').style.display = 'flex';

    try {
        const res = await fetch(`/api/shipments/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to load details');
        const data = await res.json();
        
        document.getElementById('modal-tracking-id').innerText = data.tracking_id;
        document.getElementById('modal-status').innerText = data.current_status.replace(/_/g, ' ');
        document.getElementById('modal-status').className = `badge ${data.current_status.toLowerCase()}`;
        document.getElementById('modal-customer').innerText = data.customer_id;
        document.getElementById('modal-origin').innerText = data.origin;
        document.getElementById('modal-destination').innerText = data.destination;
        
        timeline.innerHTML = '';
        if (data.tracking_events.length === 0) {
            timeline.innerHTML = '<div class="state-message">No events found.</div>';
        } else {
            data.tracking_events.forEach(ev => {
                timeline.innerHTML += `<div class="event">
                    <div class="date">${new Date(ev.created_at).toLocaleString()}</div>
                    <div class="desc"><strong>${ev.status.replace(/_/g, ' ')}</strong> - ${ev.description}</div>
                    ${ev.location ? `<div class="loc">${ev.location}</div>` : ''}
                </div>`;
            });
        }
        
        if (currentUser.role === 'ADMIN') {
            document.getElementById('admin-update').style.display = 'block';
            document.getElementById('new-status').value = data.current_status;
        } else {
            document.getElementById('admin-update').style.display = 'none';
        }
        
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
    successDiv.style.display = 'none';
    
    if (!desc) {
        errDiv.innerText = "Description is required.";
        errDiv.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(`/api/shipments/${currentShipmentId}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
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
            
            // Refresh data from backend as the single source of truth
            await openModal(currentShipmentId);
            await loadShipments();
        }
    } catch (e) {
        errDiv.innerText = "An unexpected error occurred.";
        errDiv.style.display = 'block';
    }
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
}

window.onclick = function(event) {
    if (event.target == document.getElementById('modal')) {
        closeModal();
    }
}

init();

function openCreateModal() {
    document.getElementById('create-err').style.display = 'none';
    document.getElementById('create-success').style.display = 'none';
    document.getElementById('create-form').reset();
    document.getElementById('create-modal').style.display = 'flex';
}

function closeCreateModal() {
    document.getElementById('create-modal').style.display = 'none';
}

async function submitCreateShipment(event) {
    event.preventDefault();
    const btn = document.getElementById('create-submit-btn');
    const errDiv = document.getElementById('create-err');
    const successDiv = document.getElementById('create-success');
    
    errDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const payload = {
        sender_name: document.getElementById('create-sender').value.trim(),
        receiver_name: document.getElementById('create-receiver').value.trim(),
        origin: document.getElementById('create-origin').value.trim(),
        destination: document.getElementById('create-dest').value.trim(),
    };
    
    const eta = document.getElementById('create-eta').value;
    if (eta) {
        payload.estimated_delivery = new Date(eta).toISOString();
    }

    btn.innerText = 'Creating shipment...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/shipments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Validation failed or database error.');
        }
        
        const data = await res.json();
        successDiv.innerText = `Shipment created successfully! Tracking ID: ${data.tracking_id}`;
        successDiv.style.display = 'block';
        document.getElementById('create-form').reset();
        
        // Refresh the single source of truth table and stats
        await loadShipments();
        
        // Automatically close after a short delay
        setTimeout(() => closeCreateModal(), 2500);
    } catch (e) {
        errDiv.innerText = e.message;
        errDiv.style.display = 'block';
    } finally {
        btn.innerText = 'Create Shipment';
        btn.disabled = false;
    }
}

// Update the outside click listener
window.onclick = function(event) {
    if (event.target == document.getElementById('modal')) {
        closeModal();
    }
    if (event.target == document.getElementById('create-modal')) {
        closeCreateModal();
    }
}
