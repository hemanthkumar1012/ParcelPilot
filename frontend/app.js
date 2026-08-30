/* =========================================================================
   ParcelPilot — app.js
   Vanilla JS application logic: auth, API access, rendering, interactivity.
   No frameworks, no build step.
   ========================================================================= */

(function () {
  'use strict';

  /* ----------------------------- CONFIG ----------------------------- */
  const API_BASE = 'https://parcelpilot-psi.vercel.app';
  const TOKEN_KEY = 'parcelpilot_token';

  const STATUS_COLORS = {
    created: '#667085',
    pending: '#667085',
    picked_up: '#2F6FED',
    in_transit: '#2F6FED',
    out_for_delivery: '#F79009',
    delivered: '#12B76A',
    cancelled: '#F04438',
    failed: '#F04438',
    default: '#667085'
  };

  /* ----------------------------- STATE ----------------------------- */
  const state = {
    token: localStorage.getItem(TOKEN_KEY) || null,
    user: null,
    shipments: [],
    drivers: [],
    notifications: [],
    unreadCount: 0,
    currentPage: 'dashboard'
  };

  /* ============================================================
     UTILITIES
     ============================================================ */

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeStatus(status) {
    if (!status) return 'unknown';
    return String(status).trim().toLowerCase().replace(/\s+/g, '_');
  }

  function statusLabel(status) {
    if (!status) return 'Unknown';
    return String(status).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function statusColor(status) {
    const key = normalizeStatus(status);
    return STATUS_COLORS[key] || STATUS_COLORS.default;
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return escapeHtml(value);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return escapeHtml(value);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function initials(name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* ============================================================
     TOASTS
     ============================================================ */

  function showToast(message, type) {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast' + (type ? ` toast-${type}` : '');
    const icon = type === 'success' ? '✓' : type === 'error' ? '⚠' : '•';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-leaving');
      setTimeout(() => toast.remove(), 220);
    }, 3600);
  }

  /* ============================================================
     API LAYER
     ============================================================ */

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  function buildErrorMessage(status, body) {
    if (body && typeof body === 'object') {
      if (typeof body.detail === 'string') return body.detail;
      if (Array.isArray(body.detail)) {
        return body.detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
      }
      if (body.message) return body.message;
    }
    switch (status) {
      case 400: return 'That request was invalid. Please check the details and try again.';
      case 401: return 'Your session has expired. Please sign in again.';
      case 403: return "You don't have permission to do that.";
      case 404: return 'The requested resource could not be found.';
      case 422: return 'Some fields need attention. Please check the form and try again.';
      case 500: return 'Something went wrong on the server. Please try again shortly.';
      default: return 'Something went wrong. Please try again.';
    }
  }

  /**
   * Core request helper. Never hard-codes credentials; always reads the
   * current token from state/localStorage at call time.
   */
  async function apiRequest(path, options = {}) {
    const { method = 'GET', body = null, formEncoded = false, auth = true } = options;
    const headers = {};

    if (auth && state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    let fetchBody;
    if (body !== null && body !== undefined) {
      if (formEncoded) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        fetchBody = body; // already URLSearchParams
      } else {
        headers['Content-Type'] = 'application/json';
        fetchBody = JSON.stringify(body);
      }
    }

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, { method, headers, body: fetchBody });
    } catch (networkErr) {
      throw new ApiError('Unable to reach the server. Check your connection and try again.', 0);
    }

    let data = null;
    const text = await response.text();
    if (text) {
      try { data = JSON.parse(text); } catch (_) { data = text; }
    }

    if (!response.ok) {
      if (response.status === 401 && auth) {
        handleUnauthorized();
      }
      throw new ApiError(buildErrorMessage(response.status, data), response.status);
    }

    return data;
  }

  function handleUnauthorized() {
    clearSession();
    showLogin();
    showToast('Your session has expired. Please sign in again.', 'error');
  }

  /* ============================================================
     AUTH
     ============================================================ */

  function saveToken(token) {
    state.token = token;
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearSession() {
    state.token = null;
    state.user = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  async function login(email, password) {
    const params = new URLSearchParams();
    params.set('username', email);
    params.set('password', password);
    params.set('grant_type', 'password');

    const data = await apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: params,
      formEncoded: true,
      auth: false
    });

    if (!data || !data.access_token) {
      throw new ApiError('Login succeeded but no access token was returned.', 500);
    }
    saveToken(data.access_token);
  }

  async function fetchCurrentUser() {
    const data = await apiRequest('/api/v1/auth/me', { method: 'GET' });
    state.user = data;
    return data;
  }

  function logout() {
    clearSession();
    showLogin();
    showToast('You have been logged out.', 'info');
  }

  /* ============================================================
     SCREEN SWITCHING
     ============================================================ */

  function showLogin() {
    $('app-screen').hidden = true;
    $('login-screen').hidden = false;
    $('login-form').reset();
    hideLoginError();
  }

  function showApp() {
    $('login-screen').hidden = true;
    $('app-screen').hidden = false;
    populateUserChrome();
    navigateTo('dashboard');
    loadDashboard();
    refreshNotificationBadge();
  }

  function populateUserChrome() {
    if (!state.user) return;
    const name = state.user.full_name || state.user.name || state.user.email || 'Operator';
    const email = state.user.email || '';
    $('sidebar-user-name').textContent = name;
    $('sidebar-user-email').textContent = email;
    $('sidebar-user-avatar').textContent = initials(name);
    $('header-user-avatar').textContent = initials(name);
  }

  /* ============================================================
     NAVIGATION
     ============================================================ */

  const PAGE_META = {
    dashboard: { title: 'Dashboard', subtitle: 'Operational overview across every shipment.' },
    shipments: { title: 'Shipments', subtitle: 'Every shipment in your network, searchable and current.' },
    tracking: { title: 'Tracking', subtitle: 'Look up any shipment by its tracking ID.' },
    drivers: { title: 'Drivers', subtitle: 'Your fleet and their current assignments.' },
    notifications: { title: 'Notifications', subtitle: 'Alerts and updates across the platform.' }
  };

  function navigateTo(page) {
    state.currentPage = page;

    document.querySelectorAll('.page').forEach((el) => el.classList.add('hidden'));
    const target = $(`page-${page}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    const meta = PAGE_META[page] || { title: 'ParcelPilot', subtitle: '' };
    $('page-title').textContent = meta.title;
    $('page-subtitle').textContent = meta.subtitle;

    closeMobileSidebar();

    if (page === 'shipments') loadShipments();
    if (page === 'drivers') loadDrivers();
    if (page === 'notifications') loadNotificationsPage();
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */

  async function loadDashboard() {
    setTableLoading('recent-shipments-body', 'recent-shipments-loading', 'recent-shipments-empty', true);
    try {
      const [shipments, notifications] = await Promise.all([
        apiRequest('/api/v1/shipments', { method: 'GET' }),
        apiRequest('/api/v1/notifications', { method: 'GET' }).catch(() => [])
      ]);

      const shipmentList = Array.isArray(shipments) ? shipments : (shipments.items || []);
      state.shipments = shipmentList;
      state.notifications = Array.isArray(notifications) ? notifications : (notifications.items || []);

      renderStats(shipmentList);
      renderActivityChart(shipmentList);
      renderStatusDistribution(shipmentList);
      renderRecentShipments(shipmentList.slice(0, 6));
      renderAlerts(state.notifications);
    } catch (err) {
      showToast(err.message || 'Could not load the dashboard.', 'error');
      renderRecentShipments([]);
    } finally {
      setTableLoading('recent-shipments-body', 'recent-shipments-loading', 'recent-shipments-empty', false);
      refreshNotificationBadge();
    }
  }

  function renderStats(shipments) {
    const total = shipments.length;
    const inTransit = shipments.filter((s) => ['in_transit', 'picked_up', 'out_for_delivery'].includes(normalizeStatus(s.status))).length;
    const delivered = shipments.filter((s) => normalizeStatus(s.status) === 'delivered').length;

    $('stat-total').textContent = total;
    $('stat-in-transit').textContent = inTransit;
    $('stat-delivered').textContent = delivered;
    $('stat-alerts').textContent = state.unreadCount;
  }

  function renderActivityChart(shipments) {
    const container = $('activity-chart');
    const buckets = ['created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
    const counts = buckets.map((b) => shipments.filter((s) => normalizeStatus(s.status) === b).length);
    const max = Math.max(1, ...counts);

    const width = 640;
    const height = 160;
    const padding = 36;
    const stepX = (width - padding * 2) / (buckets.length - 1);
    const points = counts.map((c, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (c / max) * (height - padding * 2 - 10);
      return { x, y, count: c, label: buckets[i] };
    });

    const pathD = points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ');

    const dots = points
      .map(
        (p) => `
        <circle cx="${p.x}" cy="${p.y}" r="5" fill="${statusColor(p.label)}" stroke="#fff" stroke-width="2"></circle>
        <text x="${p.x}" y="${height - 10}" text-anchor="middle" font-size="10.5" fill="#98A2B3" font-family="Inter, sans-serif">${statusLabel(p.label)}</text>
        <text x="${p.x}" y="${p.y - 12}" text-anchor="middle" font-size="12" font-weight="700" fill="#101828" font-family="Inter, sans-serif">${p.count}</text>
      `
      )
      .join('');

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Shipment activity across statuses">
        <path d="${pathD}" fill="none" stroke="#2F6FED" stroke-width="2.5" class="route-dash"></path>
        ${dots}
      </svg>
      <div class="activity-legend">
        ${buckets
          .map(
            (b) => `<span class="activity-legend-item"><span class="legend-swatch" style="background:${statusColor(b)}"></span>${statusLabel(b)}</span>`
          )
          .join('')}
      </div>
    `;
  }

  function renderStatusDistribution(shipments) {
    const container = $('status-distribution');
    if (!shipments.length) {
      container.innerHTML = `<div class="empty-inline">No shipment data to summarize yet.</div>`;
      return;
    }

    const counts = {};
    shipments.forEach((s) => {
      const key = normalizeStatus(s.status);
      counts[key] = (counts[key] || 0) + 1;
    });

    const total = shipments.length;
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    const track = entries
      .map(([key, count]) => `<span class="dist-bar-segment" style="width:${(count / total) * 100}%;background:${statusColor(key)}"></span>`)
      .join('');

    const legend = entries
      .map(
        ([key, count]) => `
        <div class="dist-legend-row">
          <span class="legend-swatch" style="background:${statusColor(key)}"></span>
          <span class="dist-legend-label">${statusLabel(key)}</span>
          <span class="dist-legend-value">${count} · ${Math.round((count / total) * 100)}%</span>
        </div>`
      )
      .join('');

    container.innerHTML = `<div class="dist-bar-track">${track}</div><div class="dist-legend">${legend}</div>`;
  }

  function renderRecentShipments(shipments) {
    const body = $('recent-shipments-body');
    body.innerHTML = shipments.map(shipmentRow).join('');
    $('recent-shipments-empty').hidden = shipments.length !== 0;
    attachTrackButtonListeners(body);
  }

  function renderAlerts(notifications) {
    const list = $('alerts-list');
    const relevant = notifications.slice(0, 5);
    list.innerHTML = relevant.map(alertItem).join('');
    $('alerts-empty').hidden = relevant.length !== 0;
  }

  function alertItem(n) {
    const type = (n.type || 'info').toLowerCase();
    const iconClass = type.includes('error') || type.includes('fail') ? 'alert-icon-danger'
      : type.includes('warn') ? 'alert-icon-warning' : 'alert-icon-info';
    const icon = iconClass === 'alert-icon-danger' ? '⚠' : iconClass === 'alert-icon-warning' ? '⚠' : '◈';
    return `
      <li class="alert-item">
        <span class="alert-icon ${iconClass}">${icon}</span>
        <div class="alert-body">
          <span class="alert-message">${escapeHtml(n.message || n.title || 'Notification')}</span>
          <span class="alert-time">${formatDateTime(n.created_at || n.timestamp)}</span>
        </div>
      </li>`;
  }

  /* ============================================================
     SHIPMENTS PAGE
     ============================================================ */

  let shipmentSearchTerm = '';

  async function loadShipments() {
    setTableLoading('shipments-table-body', 'shipments-loading', 'shipments-empty', true);
    $('shipments-error').hidden = true;
    try {
      const data = await apiRequest('/api/v1/shipments', { method: 'GET' });
      state.shipments = Array.isArray(data) ? data : (data.items || []);
      renderShipmentsTable();
    } catch (err) {
      $('shipments-error').hidden = false;
      $('shipments-error-text').textContent = err.message || 'Something went wrong.';
      $('shipments-table-body').innerHTML = '';
      $('shipments-empty').hidden = true;
    } finally {
      setTableLoading('shipments-table-body', 'shipments-loading', 'shipments-empty', false, true);
    }
  }

  function renderShipmentsTable() {
    const term = shipmentSearchTerm.trim().toLowerCase();
    const filtered = !term
      ? state.shipments
      : state.shipments.filter((s) => {
          const haystack = [s.tracking_id, s.receiver_name, s.receiver, s.origin, s.destination]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(term);
        });

    const body = $('shipments-table-body');
    body.innerHTML = filtered.map(shipmentRow).join('');
    $('shipments-empty').hidden = filtered.length !== 0;
    attachTrackButtonListeners(body);
  }

  function shipmentRow(s) {
    const trackingId = s.tracking_id || s.id || '—';
    const receiver = s.receiver_name || s.receiver || '—';
    const eta = s.estimated_delivery || s.eta || null;
    const status = s.status || 'unknown';
    return `
      <tr>
        <td class="tracking-id-cell">${escapeHtml(trackingId)}</td>
        <td>${escapeHtml(s.origin || '—')}</td>
        <td>${escapeHtml(s.destination || '—')}</td>
        <td>${escapeHtml(receiver)}</td>
        <td><span class="status-badge badge-${normalizeStatus(status)}">${escapeHtml(statusLabel(status))}</span></td>
        <td>${formatDate(eta)}</td>
        <td><button class="table-action-btn" data-track-id="${escapeHtml(trackingId)}" type="button">Track</button></td>
      </tr>`;
  }

  function attachTrackButtonListeners(scope) {
    scope.querySelectorAll('[data-track-id]').forEach((btn) => {
      btn.addEventListener('click', () => openTrackingModal(btn.dataset.trackId));
    });
  }

  function setTableLoading(bodyId, loadingId, emptyId, isLoading, keepBody) {
    if (isLoading) {
      $(loadingId).hidden = false;
      $(emptyId).hidden = true;
      if (!keepBody) $(bodyId).innerHTML = '';
    } else {
      $(loadingId).hidden = true;
    }
  }

  /* ============================================================
     TRACKING
     ============================================================ */

  async function trackShipmentById(trackingId) {
    const id = String(trackingId || '').trim();
    if (!id) throw new ApiError('Enter a tracking ID to continue.', 400);
    return apiRequest(`/api/v1/shipments/track/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  function buildTrackingTimeline(shipment) {
    const events = shipment.tracking_events || shipment.timeline || shipment.history || [];
    if (Array.isArray(events) && events.length) {
      return events
        .map((e, i) => timelineItem(
          e.status || e.event || e.description || 'Update',
          e.location,
          e.timestamp || e.created_at,
          i === events.length - 1
        ))
        .join('');
    }
    // Fall back to a single-point timeline built from the shipment's current status.
    return timelineItem(statusLabel(shipment.status), shipment.origin, shipment.updated_at || shipment.created_at, true);
  }

  function timelineItem(eventLabel, location, timestamp, isFirst) {
    return `
      <div class="timeline-item ${isFirst ? 'is-first' : ''}">
        <div class="timeline-marker">
          <span class="timeline-dot"></span>
          <span class="timeline-line"></span>
        </div>
        <div class="timeline-content">
          <div class="timeline-event">${escapeHtml(eventLabel || 'Update')}</div>
          <div class="timeline-meta">${location ? escapeHtml(location) + ' · ' : ''}${formatDateTime(timestamp)}</div>
        </div>
      </div>`;
  }

  function trackingResultMarkup(shipment) {
    const trackingId = shipment.tracking_id || shipment.id || '—';
    return `
      <div class="tracking-result-card">
        <div class="tracking-route-summary">
          <div class="tracking-route-point">
            <span class="label">Origin</span>
            <span class="value">${escapeHtml(shipment.origin || '—')}</span>
          </div>
          <span class="tracking-route-arrow">→</span>
          <div class="tracking-route-point">
            <span class="label">Destination</span>
            <span class="value">${escapeHtml(shipment.destination || '—')}</span>
          </div>
          <div class="tracking-route-point">
            <span class="label">Tracking ID</span>
            <span class="value" style="font-family:var(--font-mono);font-size:13px;">${escapeHtml(trackingId)}</span>
          </div>
          <div class="tracking-route-point">
            <span class="label">Status</span>
            <span class="status-badge badge-${normalizeStatus(shipment.status)}">${escapeHtml(statusLabel(shipment.status))}</span>
          </div>
        </div>
        <div class="tracking-timeline">
          ${buildTrackingTimeline(shipment)}
        </div>
      </div>`;
  }

  async function openTrackingModal(trackingId) {
    openModal('tracking-modal');
    const body = $('tracking-modal-body');
    body.innerHTML = `<div class="table-state"><div class="spinner"></div><span>Fetching tracking details…</span></div>`;
    try {
      const shipment = await trackShipmentById(trackingId);
      body.innerHTML = trackingResultMarkup(shipment);
    } catch (err) {
      body.innerHTML = `<div class="table-state"><span class="empty-icon">⚠</span><p>Couldn't find that shipment</p><span>${escapeHtml(err.message || 'Please check the tracking ID and try again.')}</span></div>`;
    }
  }

  async function runQuickTrack(trackingId) {
    const result = $('quick-track-result');
    result.innerHTML = `<div class="table-state" style="padding:20px 0;"><div class="spinner"></div><span>Looking up shipment…</span></div>`;
    try {
      const shipment = await trackShipmentById(trackingId);
      result.innerHTML = trackingResultMarkup(shipment);
    } catch (err) {
      result.innerHTML = `<div class="form-error">${escapeHtml(err.message || 'Shipment not found.')}</div>`;
    }
  }

  async function runPageTrack(trackingId) {
    const result = $('tracking-page-result');
    result.innerHTML = `<div class="panel" style="margin-top:16px;"><div class="table-state"><div class="spinner"></div><span>Looking up shipment…</span></div></div>`;
    try {
      const shipment = await trackShipmentById(trackingId);
      result.innerHTML = `<div class="panel" style="margin-top:16px;">${trackingResultMarkup(shipment)}</div>`;
    } catch (err) {
      result.innerHTML = `<div class="panel" style="margin-top:16px;"><div class="table-state"><span class="empty-icon">⚠</span><p>Couldn't find that shipment</p><span>${escapeHtml(err.message || 'Please check the tracking ID and try again.')}</span></div></div>`;
    }
  }

  /* ============================================================
     CREATE SHIPMENT
     ============================================================ */

  async function submitCreateShipment(formData) {
    const payload = {
      sender_name: formData.get('sender_name'),
      receiver_name: formData.get('receiver_name'),
      origin: formData.get('origin'),
      destination: formData.get('destination'),
      estimated_delivery: formData.get('estimated_delivery')
    };
    return apiRequest('/api/v1/shipments', { method: 'POST', body: payload });
  }

  /* ============================================================
     DRIVERS PAGE
     ============================================================ */

  let driverSearchTerm = '';

  async function loadDrivers() {
    $('drivers-grid').innerHTML = '';
    $('drivers-loading').hidden = false;
    $('drivers-empty').hidden = true;
    $('drivers-error').hidden = true;
    try {
      const data = await apiRequest('/api/v1/drivers', { method: 'GET' });
      state.drivers = Array.isArray(data) ? data : (data.items || []);
      renderDrivers();
    } catch (err) {
      $('drivers-error').hidden = false;
      $('drivers-error-text').textContent = err.message || 'Something went wrong.';
    } finally {
      $('drivers-loading').hidden = true;
    }
  }

  function renderDrivers() {
    const term = driverSearchTerm.trim().toLowerCase();
    const filtered = !term
      ? state.drivers
      : state.drivers.filter((d) => String(d.name || '').toLowerCase().includes(term));

    $('drivers-grid').innerHTML = filtered.map(driverCard).join('');
    $('drivers-empty').hidden = filtered.length !== 0;
  }

  function driverCard(d) {
    const name = d.name || 'Unnamed driver';
    const status = d.status || 'available';
    const assignedCount = d.assigned_shipments_count ?? (Array.isArray(d.assigned_shipments) ? d.assigned_shipments.length : (d.active_shipments ?? '—'));
    return `
      <div class="driver-card">
        <div class="driver-card-top">
          <div class="driver-avatar">${escapeHtml(initials(name))}</div>
          <div>
            <div class="driver-name">${escapeHtml(name)}</div>
            <div class="driver-phone">${escapeHtml(d.phone || 'No phone on file')}</div>
          </div>
        </div>
        <div class="driver-meta-row">
          <span>Status</span>
          <span class="status-badge badge-${normalizeStatus(status)}">${escapeHtml(statusLabel(status))}</span>
        </div>
        <div class="driver-meta-row">
          <span>Assigned shipments</span>
          <strong>${escapeHtml(String(assignedCount))}</strong>
        </div>
      </div>`;
  }

  async function submitCreateDriver(formData) {
    const payload = {
      name: formData.get('name'),
      phone: formData.get('phone') || undefined,
      vehicle_number: formData.get('vehicle_number') || undefined
    };
    return apiRequest('/api/v1/drivers', { method: 'POST', body: payload });
  }

  /* ============================================================
     NOTIFICATIONS
     ============================================================ */

  async function refreshNotificationBadge() {
    try {
      const data = await apiRequest('/api/v1/notifications/unread-count', { method: 'GET' });
      const count = typeof data === 'number' ? data : (data.unread_count ?? data.count ?? 0);
      state.unreadCount = count;
      updateNotificationBadges(count);
    } catch (_) {
      // Silently ignore — badge simply won't update this cycle.
    }
  }

  function updateNotificationBadges(count) {
    [$('sidebar-notif-badge'), $('header-notif-badge')].forEach((el) => {
      if (!el) return;
      el.textContent = count > 99 ? '99+' : String(count);
      el.hidden = !count;
    });
    const statValue = $('stat-alerts');
    if (statValue) statValue.textContent = count;
  }

  async function loadNotificationsPage() {
    $('notifications-page-list').innerHTML = '';
    $('notifications-loading').hidden = false;
    $('notifications-empty').hidden = true;
    $('notifications-error').hidden = true;
    try {
      const data = await apiRequest('/api/v1/notifications', { method: 'GET' });
      const notifications = Array.isArray(data) ? data : (data.items || []);
      state.notifications = notifications;
      $('notifications-page-list').innerHTML = notifications.map(notificationRow).join('');
      $('notifications-empty').hidden = notifications.length !== 0;
    } catch (err) {
      $('notifications-error').hidden = false;
      $('notifications-error-text').textContent = err.message || 'Something went wrong.';
    } finally {
      $('notifications-loading').hidden = true;
    }
  }

  function notificationRow(n) {
    const isUnread = n.is_read === false || n.read === false || n.status === 'unread';
    return `
      <li class="notification-row ${isUnread ? 'is-unread' : ''}">
        <div class="notification-icon">◈</div>
        <div class="notification-content">
          <div class="notification-top-row">
            <span class="notification-type">${escapeHtml(n.type || 'Update')}</span>
            <span class="notification-time">${formatDateTime(n.created_at || n.timestamp)}</span>
          </div>
          <div class="notification-message">${escapeHtml(n.message || n.title || 'Notification')}</div>
        </div>
        ${isUnread ? '<span class="unread-dot" aria-label="Unread"></span>' : ''}
      </li>`;
  }

  /* ============================================================
     MODALS
     ============================================================ */

  function openModal(id) {
    $(id).hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    $(id).hidden = true;
    document.body.style.overflow = '';
  }

  function setupModalCloseHandlers() {
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay:not([hidden])').forEach((overlay) => closeModal(overlay.id));
      }
    });
  }

  /* ============================================================
     FORM ERROR HELPERS
     ============================================================ */

  function showFieldError(id, message) {
    const el = $(id);
    el.textContent = message;
    el.hidden = false;
  }

  function hideFieldError(id) {
    const el = $(id);
    el.hidden = true;
    el.textContent = '';
  }

  function hideLoginError() {
    hideFieldError('login-error');
  }

  function setButtonLoading(btn, isLoading) {
    btn.disabled = isLoading;
    btn.querySelector('.btn-label').style.visibility = isLoading ? 'hidden' : 'visible';
    const spinner = btn.querySelector('.btn-spinner');
    if (spinner) spinner.hidden = !isLoading;
  }

  /* ============================================================
     MOBILE SIDEBAR
     ============================================================ */

  function openMobileSidebar() {
    $('sidebar').classList.add('is-open');
    $('sidebar-backdrop').hidden = false;
  }

  function closeMobileSidebar() {
    $('sidebar').classList.remove('is-open');
    $('sidebar-backdrop').hidden = true;
  }

  /* ============================================================
     EVENT WIRING
     ============================================================ */

  function setupEventListeners() {
    // Login
    $('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideLoginError();
      const email = $('login-email').value.trim();
      const password = $('login-password').value;
      const submitBtn = $('login-submit-btn');
      setButtonLoading(submitBtn, true);
      try {
        await login(email, password);
        await fetchCurrentUser();
        showApp();
      } catch (err) {
        if (err.status === 401 || err.status === 400) {
          showFieldError('login-error', 'Incorrect email or password.');
        } else {
          showFieldError('login-error', err.message || 'Unable to sign in right now.');
        }
        clearSession();
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    $('toggle-password-btn').addEventListener('click', () => {
      const input = $('login-password');
      const btn = $('toggle-password-btn');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? 'Hide' : 'Show';
    });

    // Logout
    $('logout-btn').addEventListener('click', logout);

    // Sidebar navigation
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });

    // Mobile sidebar
    $('mobile-menu-btn').addEventListener('click', openMobileSidebar);
    $('sidebar-close-btn').addEventListener('click', closeMobileSidebar);
    $('sidebar-backdrop').addEventListener('click', closeMobileSidebar);

    // Global search — jumps to the shipments page filtered by the query
    $('global-search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const term = $('global-search-input').value.trim();
      shipmentSearchTerm = term;
      $('shipment-search-input').value = term;
      navigateTo('shipments');
    });

    // Header notification button -> notifications page
    $('header-notif-btn').addEventListener('click', () => navigateTo('notifications'));

    // Shipments page
    $('shipment-search-input').addEventListener('input', debounce((e) => {
      shipmentSearchTerm = e.target.value;
      renderShipmentsTable();
    }, 200));
    $('shipments-refresh-btn').addEventListener('click', loadShipments);
    $('shipments-retry-btn').addEventListener('click', loadShipments);
    $('new-shipment-btn').addEventListener('click', () => openModal('create-shipment-modal'));

    // Create shipment form
    $('create-shipment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideFieldError('create-shipment-error');
      const form = e.target;
      const submitBtn = $('create-shipment-submit-btn');
      setButtonLoading(submitBtn, true);
      try {
        await submitCreateShipment(new FormData(form));
        closeModal('create-shipment-modal');
        form.reset();
        showToast('Shipment created successfully.', 'success');
        if (state.currentPage === 'shipments') loadShipments();
        loadDashboard();
      } catch (err) {
        showFieldError('create-shipment-error', err.message || 'Could not create the shipment.');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    // Tracking page
    $('tracking-form').addEventListener('submit', (e) => {
      e.preventDefault();
      runPageTrack($('tracking-input').value.trim());
    });

    // Quick track (dashboard)
    $('quick-track-form').addEventListener('submit', (e) => {
      e.preventDefault();
      runQuickTrack($('quick-track-input').value.trim());
    });

    // Drivers page
    $('driver-search-input').addEventListener('input', debounce((e) => {
      driverSearchTerm = e.target.value;
      renderDrivers();
    }, 200));
    $('drivers-refresh-btn').addEventListener('click', loadDrivers);
    $('drivers-retry-btn').addEventListener('click', loadDrivers);
    $('new-driver-btn').addEventListener('click', () => openModal('create-driver-modal'));

    // Create driver form
    $('create-driver-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideFieldError('create-driver-error');
      const form = e.target;
      const submitBtn = $('create-driver-submit-btn');
      setButtonLoading(submitBtn, true);
      try {
        await submitCreateDriver(new FormData(form));
        closeModal('create-driver-modal');
        form.reset();
        showToast('Driver added successfully.', 'success');
        loadDrivers();
      } catch (err) {
        showFieldError('create-driver-error', err.message || 'Could not add the driver.');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    // Notifications page
    $('notifications-refresh-btn').addEventListener('click', () => {
      loadNotificationsPage();
      refreshNotificationBadge();
    });
    $('notifications-retry-btn').addEventListener('click', loadNotificationsPage);

    setupModalCloseHandlers();
  }

  /* ============================================================
     BOOTSTRAP
     ============================================================ */

  async function init() {
    setupEventListeners();

    if (!state.token) {
      showLogin();
      return;
    }

    try {
      await fetchCurrentUser();
      showApp();
    } catch (err) {
      clearSession();
      showLogin();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();