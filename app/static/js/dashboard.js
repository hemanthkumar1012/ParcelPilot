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

        if (currentUser.role === 'ADMIN') { document.getElementById('nav-drivers').style.display = 'block'; loadDrivers(); }
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
        const canonicalStates = ['CREATED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];
        let reachedCurrent = false;

        canonicalStates.forEach((state, index) => {
            const ev = data.tracking_events.slice().reverse().find(e => e.status === state);
            let icon = '○';
            let extra = '';

            if (ev) {
                icon = (state === data.current_status) ? '●' : '✓';
                if (state === data.current_status) reachedCurrent = true;
                if (!reachedCurrent && state !== data.current_status) icon = '✓';
                extra = `<div style="font-size: 0.8rem; color: #94a3b8;">${new Date(ev.created_at).toLocaleString()} - ${ev.description}</div>`;
            } else if (!reachedCurrent && canonicalStates.indexOf(data.current_status) > index) {
                icon = '✓'; // It was skipped but we are past it
            }

            timeline.innerHTML += `<div style="margin-bottom: 0.5rem; font-family: monospace; font-size: 1.1rem;">
                ${icon} ${state.replace(/_/g, ' ')}
                ${extra}
            </div>`;
            if (index < canonicalStates.length - 1) {
                timeline.innerHTML += `<div style="margin-left: 0.4rem; color: #475569;">|</div>`;
            }
        });

        // Render any events not in canonical (e.g. FAILED, CANCELLED) at the bottom
        const nonCanonical = data.tracking_events.filter(e => !canonicalStates.includes(e.status));
        if (nonCanonical.length > 0) {
            timeline.innerHTML += `<div style="margin-top: 1rem; border-top: 1px solid #334155; padding-top: 0.5rem;"><strong>Other Events</strong></div>`;
            nonCanonical.forEach(ev => {
                timeline.innerHTML += `<div style="margin-bottom: 0.5rem; font-family: monospace; font-size: 1rem; color: #ef4444;">
                    ⚠ ${ev.status.replace(/_/g, ' ')}
                    <div style="font-size: 0.8rem; color: #94a3b8;">${new Date(ev.created_at).toLocaleString()} - ${ev.description}</div>
                </div>`;
            });
        }

        if (currentUser.role === 'ADMIN') {
            document.getElementById('admin-update').style.display = 'block'; document.getElementById('admin-assign').style.display = 'block';
            document.getElementById('new-status').value = data.current_status;
        } else {
            document.getElementById('admin-update').style.display = 'none'; document.getElementById('admin-assign').style.display = 'none';
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
            errDiv.innerText = (err.error && err.error.message) ? err.error.message : (err.detail || "Update failed.");
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
    if (event.target == document.getElementById('driver-modal')) {
        closeDriverModal();
    }
        closeCreateModal();
    }
}

let allDrivers = [];

function showSection(section) {
    document.getElementById('section-overview').style.display = section === 'overview' ? 'block' : 'none';
    document.getElementById('section-drivers').style.display = section === 'drivers' ? 'block' : 'none';
    document.getElementById('nav-overview').className = section === 'overview' ? 'active' : '';
    document.getElementById('nav-drivers').className = section === 'drivers' ? 'active' : '';
    if(section === 'drivers') loadDrivers();
}

async function loadDrivers() {
    try {
        const res = await fetch('/api/drivers', { headers: { 'Authorization': `Bearer ${token}` } });
        allDrivers = await res.json();
        const tbody = document.getElementById('drivers-tbody');
        tbody.innerHTML = '';
        allDrivers.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${d.name}</td><td>${d.email}</td><td>${d.phone}</td><td>${d.vehicle_number} (${d.vehicle_type})</td>
                            <td><span class="badge ${d.is_available ? 'delivered' : 'failed'}">${d.is_available ? 'Available' : 'Busy'}</span></td>
                            <td>${d.assigned_shipments_count}</td>`;
            tbody.appendChild(tr);
        });

        // Populate assignment dropdown
        const sel = document.getElementById('assign-driver-select');
        sel.innerHTML = '<option value="">Select Driver</option>';
        allDrivers.forEach(d => {
            sel.innerHTML += `<option value="${d.id}" ${!d.is_available ? 'disabled' : ''}>${d.name} (${d.is_available ? 'Available' : 'Busy'})</option>`;
        });
    } catch (e) {}
}

function openDriverModal() {
    document.getElementById('driver-err').style.display = 'none';
    document.getElementById('driver-modal').style.display = 'flex';
}
function closeDriverModal() { document.getElementById('driver-modal').style.display = 'none'; }

async function submitDriver(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('drv-name').value, email: document.getElementById('drv-email').value,
        password: document.getElementById('drv-pwd').value, phone: document.getElementById('drv-phone').value,
        vehicle_number: document.getElementById('drv-veh-num').value, vehicle_type: document.getElementById('drv-veh-type').value
    };
    try {
        const res = await fetch('/api/drivers', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if(!res.ok) throw new Error((await res.json()).detail);
        closeDriverModal();
        loadDrivers();
    } catch(err) {
        document.getElementById('driver-err').innerText = err.message;
        document.getElementById('driver-err').style.display = 'block';
    }
}

async function assignDriver() {
    const drvId = document.getElementById('assign-driver-select').value;
    if(!drvId) return;
    await fetch(`/api/shipments/${currentShipmentId}/driver`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({driver_id: parseInt(drvId)}) });
    openModal(currentShipmentId);
    loadDrivers();
}

async function unassignDriver() {
    await fetch(`/api/shipments/${currentShipmentId}/driver`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({driver_id: null}) });
    openModal(currentShipmentId);
    loadDrivers();
}

// ---------------- Notification System ---------------- //

async function fetchUnreadCount() {
    try {
        const res = await fetch('/api/v1/notifications/unread-count', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const badge = document.getElementById('notif-badge');
            if (badge) {
                if (data.unread_count > 0) {
                    badge.innerText = data.unread_count;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (e) {
        console.error("Failed to fetch unread count", e);
    }
}

async function fetchNotifications() {
    try {
        const res = await fetch('/api/v1/notifications', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const listDiv = document.getElementById('notification-list');
            if (!listDiv) return;

            listDiv.innerHTML = '';
            if (data.items.length === 0) {
                listDiv.innerHTML = '<div style="color:gray;">No notifications.</div>';
                return;
            }

            data.items.forEach(n => {
                const item = document.createElement('div');
                item.style.padding = '10px';
                item.style.borderBottom = '1px solid #eee';
                item.style.background = n.is_read ? 'white' : '#f0f9ff';

                let html = `<strong>${n.title}</strong><div style="font-size:0.85rem; color:#666; margin-top:4px;">${n.message}</div>`;
                html += `<div style="font-size:0.75rem; color:#999; margin-top:4px;">${new Date(n.created_at).toLocaleString()}</div>`;

                if (!n.is_read) {
                    html += `<button onclick="markNotificationRead(${n.id})" style="margin-top:8px; font-size:0.75rem;">Mark as Read</button>`;
                }
                item.innerHTML = html;
                listDiv.appendChild(item);
            });
        }
    } catch (e) {
        console.error("Failed to fetch notifications", e);
    }
}

function openNotificationModal() {
    const modal = document.getElementById('notification-modal');
    if (modal) {
        modal.style.display = 'flex';
        fetchNotifications();
    }
}

function closeNotificationModal() {
    const modal = document.getElementById('notification-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function markNotificationRead(id) {
    try {
        await fetch(`/api/v1/notifications/${id}/read`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchNotifications();
        fetchUnreadCount();
    } catch (e) {
        console.error(e);
    }
}

async function markAllNotificationsRead() {
    try {
        await fetch('/api/v1/notifications/read-all', {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchNotifications();
        fetchUnreadCount();
    } catch (e) {
        console.error(e);
    }
}
