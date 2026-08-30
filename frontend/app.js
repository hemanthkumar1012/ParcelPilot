/*
 =========================================================================
 ParcelPilot — app.js
 Vanilla JS application logic: auth, API access, rendering, interactivity.
 No frameworks, no build step.
 =========================================================================
*/

(function () {
  "use strict";

  /* ----------------------------- CONFIG ----------------------------- */

  const API_BASE = "https://parcelpilot-psi.vercel.app";
  const TOKEN_KEY = "parcelpilot_token";
  const GUEST_KEY = "parcelpilot_guest";

  const STATUS_COLORS = {
    created: "#667085",
    pending: "#667085",
    picked_up: "#2F6FED",
    in_transit: "#2F6FED",
    out_for_delivery: "#F79009",
    delivered: "#12B76A",
    cancelled: "#F04438",
    failed: "#F04438",
    returned: "#F04438",
    default: "#667085"
  };

  const STATUS_LABELS = {
    created: "Created",
    pending: "Pending",
    picked_up: "Picked up",
    in_transit: "In transit",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    failed: "Failed",
    returned: "Returned"
  };


  /* ----------------------------- STATE ----------------------------- */

  const state = {
    token: localStorage.getItem(TOKEN_KEY) || null,
    guest: localStorage.getItem(GUEST_KEY) === "true",

    user: null,

    shipments: [],
    drivers: [],
    notifications: [],

    unreadCount: 0,

    currentPage: "dashboard",

    dashboardLoaded: false,
    shipmentsLoaded: false,
    driversLoaded: false,
    notificationsLoaded: false,

    searchTerm: "",

    mobileSidebarOpen: false
  };


  /* ----------------------------- GUEST DATA ----------------------------- */

  const GUEST_SHIPMENTS = [
    {
      id: "guest-1",
      tracking_id: "PP-DEMO-1001",
      sender_name: "Acme Electronics",
      receiver_name: "Rahul Sharma",
      origin: "Hyderabad",
      destination: "Bangalore",
      status: "in_transit",
      estimated_delivery: "2026-09-02",
      created_at: "2026-08-29T08:30:00Z",

      tracking_events: [
        {
          status: "created",
          location: "Hyderabad",
          description: "Shipment created",
          timestamp: "2026-08-29T08:30:00Z"
        },
        {
          status: "picked_up",
          location: "Hyderabad",
          description: "Shipment picked up",
          timestamp: "2026-08-29T11:15:00Z"
        },
        {
          status: "in_transit",
          location: "Anantapur",
          description: "Shipment is in transit",
          timestamp: "2026-08-30T04:45:00Z"
        }
      ]
    },

    {
      id: "guest-2",
      tracking_id: "PP-DEMO-1002",
      sender_name: "TechNova Solutions",
      receiver_name: "Priya Reddy",
      origin: "Chennai",
      destination: "Hyderabad",
      status: "out_for_delivery",
      estimated_delivery: "2026-08-31",
      created_at: "2026-08-28T09:20:00Z",

      tracking_events: [
        {
          status: "created",
          location: "Chennai",
          description: "Shipment created",
          timestamp: "2026-08-28T09:20:00Z"
        },
        {
          status: "picked_up",
          location: "Chennai",
          description: "Shipment picked up",
          timestamp: "2026-08-28T13:00:00Z"
        },
        {
          status: "in_transit",
          location: "Nellore",
          description: "Shipment reached transit hub",
          timestamp: "2026-08-29T08:40:00Z"
        },
        {
          status: "out_for_delivery",
          location: "Hyderabad",
          description: "Out for delivery",
          timestamp: "2026-08-31T07:10:00Z"
        }
      ]
    },

    {
      id: "guest-3",
      tracking_id: "PP-DEMO-1003",
      sender_name: "FreshMart",
      receiver_name: "Arjun Kumar",
      origin: "Bangalore",
      destination: "Mysore",
      status: "delivered",
      estimated_delivery: "2026-08-30",
      created_at: "2026-08-27T10:10:00Z",

      tracking_events: [
        {
          status: "created",
          location: "Bangalore",
          description: "Shipment created",
          timestamp: "2026-08-27T10:10:00Z"
        },
        {
          status: "picked_up",
          location: "Bangalore",
          description: "Shipment picked up",
          timestamp: "2026-08-27T14:25:00Z"
        },
        {
          status: "in_transit",
          location: "Mandya",
          description: "Shipment is in transit",
          timestamp: "2026-08-28T08:20:00Z"
        },
        {
          status: "delivered",
          location: "Mysore",
          description: "Shipment delivered successfully",
          timestamp: "2026-08-30T12:05:00Z"
        }
      ]
    },

    {
      id: "guest-4",
      tracking_id: "PP-DEMO-1004",
      sender_name: "Global Traders",
      receiver_name: "Sneha Patel",
      origin: "Mumbai",
      destination: "Pune",
      status: "delivered",
      estimated_delivery: "2026-08-29",
      created_at: "2026-08-26T07:45:00Z",

      tracking_events: [
        {
          status: "created",
          location: "Mumbai",
          description: "Shipment created",
          timestamp: "2026-08-26T07:45:00Z"
        },
        {
          status: "picked_up",
          location: "Mumbai",
          description: "Shipment picked up",
          timestamp: "2026-08-26T10:15:00Z"
        },
        {
          status: "delivered",
          location: "Pune",
          description: "Shipment delivered successfully",
          timestamp: "2026-08-29T15:30:00Z"
        }
      ]
    },

    {
      id: "guest-5",
      tracking_id: "PP-DEMO-1005",
      sender_name: "Urban Fashion",
      receiver_name: "Vikram Singh",
      origin: "Delhi",
      destination: "Jaipur",
      status: "pending",
      estimated_delivery: "2026-09-04",
      created_at: "2026-08-31T06:30:00Z",

      tracking_events: [
        {
          status: "created",
          location: "Delhi",
          description: "Shipment created",
          timestamp: "2026-08-31T06:30:00Z"
        }
      ]
    },

    {
      id: "guest-6",
      tracking_id: "PP-DEMO-1006",
      sender_name: "Medico Supplies",
      receiver_name: "Kiran Rao",
      origin: "Vijayawada",
      destination: "Visakhapatnam",
      status: "in_transit",
      estimated_delivery: "2026-09-01",
      created_at: "2026-08-30T09:00:00Z",

      tracking_events: [
        {
          status: "created",
          location: "Vijayawada",
          description: "Shipment created",
          timestamp: "2026-08-30T09:00:00Z"
        },
        {
          status: "picked_up",
          location: "Vijayawada",
          description: "Shipment picked up",
          timestamp: "2026-08-30T13:45:00Z"
        },
        {
          status: "in_transit",
          location: "Rajahmundry",
          description: "Shipment is in transit",
          timestamp: "2026-08-31T05:20:00Z"
        }
      ]
    }
  ];


  const GUEST_DRIVERS = [
    {
      id: "guest-driver-1",
      name: "Ravi Kumar",
      phone: "+91 98765 43210",
      vehicle_number: "TS09AB1234",
      status: "available"
    },

    {
      id: "guest-driver-2",
      name: "Suresh Reddy",
      phone: "+91 98480 12345",
      vehicle_number: "AP16CD5678",
      status: "on_delivery"
    },

    {
      id: "guest-driver-3",
      name: "Anil Sharma",
      phone: "+91 99887 66554",
      vehicle_number: "KA05EF9012",
      status: "available"
    },

    {
      id: "guest-driver-4",
      name: "Mahesh Rao",
      phone: "+91 91234 56789",
      vehicle_number: "MH12GH3456",
      status: "offline"
    }
  ];


  const GUEST_NOTIFICATIONS = [
    {
      id: "guest-notification-1",
      title: "Shipment out for delivery",
      message: "PP-DEMO-1002 is out for delivery in Hyderabad.",
      type: "info",
      is_read: false,
      created_at: "2026-08-31T07:15:00Z"
    },

    {
      id: "guest-notification-2",
      title: "Shipment delivered",
      message: "PP-DEMO-1003 was delivered successfully.",
      type: "success",
      is_read: false,
      created_at: "2026-08-30T12:10:00Z"
    },

    {
      id: "guest-notification-3",
      title: "Shipment in transit",
      message: "PP-DEMO-1006 is moving toward Visakhapatnam.",
      type: "info",
      is_read: true,
      created_at: "2026-08-31T05:30:00Z"
    }
  ];


  /* ----------------------------- HELPERS ----------------------------- */

  function $(id) {
    return document.getElementById(id);
  }


  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function isGuest() {
    return state.guest === true;
  }


  function isAuthenticated() {
    return Boolean(state.token) && !isGuest();
  }


  function getInitials(name) {
    if (!name) {
      return "?";
    }

    const parts = String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) {
      return "?";
    }

    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }

    return (
      parts[0].charAt(0) +
      parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }


  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }


  function formatDateTime(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }


  function normalizeStatus(status) {
    if (!status) {
      return "created";
    }

    return String(status)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
  }


  function getStatusLabel(status) {
    const normalized = normalizeStatus(status);

    return (
      STATUS_LABELS[normalized] ||
      String(status || "Unknown")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        )
    );
  }


  function getStatusColor(status) {
    return (
      STATUS_COLORS[normalizeStatus(status)] ||
      STATUS_COLORS.default
    );
  }


  function cloneGuestData() {
    state.shipments = GUEST_SHIPMENTS.map((shipment) => ({
      ...shipment,
      tracking_events: Array.isArray(
        shipment.tracking_events
      )
        ? shipment.tracking_events.map((event) => ({
            ...event
          }))
        : []
    }));

    state.drivers = GUEST_DRIVERS.map((driver) => ({
      ...driver
    }));

    state.notifications = GUEST_NOTIFICATIONS.map(
      (notification) => ({
        ...notification
      })
    );

    state.unreadCount = state.notifications.filter(
      (notification) =>
        notification.is_read === false
    ).length;
  }


  function clearSession() {
    state.token = null;
    state.user = null;

    localStorage.removeItem(TOKEN_KEY);
  }


  function clearGuestSession() {
    state.guest = false;

    localStorage.removeItem(GUEST_KEY);
  }


  function clearAllSessionData() {
    clearSession();
    clearGuestSession();

    state.shipments = [];
    state.drivers = [];
    state.notifications = [];
    state.unreadCount = 0;
  }


  /* ----------------------------- TOASTS ----------------------------- */

  function showToast(message, type = "info") {
    const container = $("toast-container");

    if (!container) {
      return;
    }

    const toast = document.createElement("div");

    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-message">${escapeHtml(message)}</span>
      </div>
      <button
        type="button"
        class="toast-close"
        aria-label="Close notification">
        ×
      </button>
    `;

    container.appendChild(toast);

    const closeButton =
      toast.querySelector(".toast-close");

    closeButton?.addEventListener("click", () => {
      toast.remove();
    });

    window.setTimeout(() => {
      if (toast.isConnected) {
        toast.remove();
      }
    }, 4500);
  }


  /* ----------------------------- API ----------------------------- */

  async function apiRequest(
    endpoint,
    options = {}
  ) {
    const requestOptions = {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    };

    if (options.body !== undefined) {
      requestOptions.headers["Content-Type"] =
        "application/json";

      requestOptions.body =
        typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body);
    }

    if (state.token) {
      requestOptions.headers.Authorization =
        `Bearer ${state.token}`;
    }

    const response = await fetch(
      `${API_BASE}${endpoint}`,
      requestOptions
    );

    let data = null;

    const contentType =
      response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      try {
        data = await response.text();
      } catch {
        data = null;
      }
    }

    if (response.status === 401) {
      if (!isGuest()) {
        clearSession();
        state.user = null;
        showLogin();
      }

      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    if (!response.ok) {
      let message =
        "The server returned an error.";

      if (data && typeof data === "object") {
        message =
          data.message ||
          data.detail ||
          data.error ||
          message;
      } else if (typeof data === "string" && data) {
        message = data;
      }

      throw new Error(message);
    }

    return data;
  }


  /* ----------------------------- AUTH ----------------------------- */

  async function login(email, password) {
    const response = await apiRequest(
      "/api/v1/auth/login",
      {
        method: "POST",
        body: {
          email,
          password
        }
      }
    );

    const token =
      response?.access_token ||
      response?.token ||
      response?.data?.access_token ||
      response?.data?.token;

    if (!token) {
      throw new Error(
        "Login succeeded but no authentication token was returned."
      );
    }

    state.token = token;
    state.guest = false;

    localStorage.setItem(
      TOKEN_KEY,
      token
    );

    localStorage.removeItem(GUEST_KEY);

    state.user =
      response?.user ||
      response?.data?.user ||
      null;

    await loadCurrentUser();

    showApp();

    await loadInitialApplicationData();
  }


  async function loadCurrentUser() {
    if (isGuest()) {
      state.user = {
        full_name: "Guest Viewer",
        email: "Demo account"
      };

      return state.user;
    }

    if (!state.token) {
      return null;
    }

    const possibleEndpoints = [
      "/api/v1/auth/me",
      "/api/v1/users/me",
      "/api/v1/auth/profile"
    ];

    for (const endpoint of possibleEndpoints) {
      try {
        const response =
          await apiRequest(endpoint);

        if (response) {
          state.user =
            response?.user ||
            response?.data?.user ||
            response;

          return state.user;
        }
      } catch (error) {
        if (
          error?.message?.includes(
            "session has expired"
          )
        ) {
          throw error;
        }
      }
    }

    if (!state.user) {
      state.user = {
        full_name: "Operator",
        email: ""
      };
    }

    return state.user;
  }


  function enterGuestMode() {
    clearSession();

    state.guest = true;

    localStorage.setItem(
      GUEST_KEY,
      "true"
    );

    state.user = {
      full_name: "Guest Viewer",
      email: "Demo account"
    };

    cloneGuestData();

    state.dashboardLoaded = true;
    state.shipmentsLoaded = true;
    state.driversLoaded = true;
    state.notificationsLoaded = true;

    showApp();

    showToast(
      "Guest demo started. Read-only mode enabled.",
      "info"
    );
  }


  function restoreGuestMode() {
    if (
      localStorage.getItem(GUEST_KEY) !== "true"
    ) {
      return false;
    }

    clearSession();

    state.guest = true;

    state.user = {
      full_name: "Guest Viewer",
      email: "Demo account"
    };

    cloneGuestData();

    state.dashboardLoaded = true;
    state.shipmentsLoaded = true;
    state.driversLoaded = true;
    state.notificationsLoaded = true;

    return true;
  }


  function logout() {
    clearAllSessionData();

    state.currentPage = "dashboard";

    showLogin();

    showToast(
      "You have been logged out.",
      "success"
    );
  }


  /* ----------------------------- UI STATE ----------------------------- */

  function showLogin() {
    const loginScreen = $("login-screen");
    const appScreen = $("app-screen");

    if (loginScreen) {
      loginScreen.hidden = false;
    }

    if (appScreen) {
      appScreen.hidden = true;
    }

    document.body.classList.remove(
      "app-active"
    );
  }


 function showApp() {
  const loginScreen = $("login-screen");
  const appScreen = $("app-screen");

  if (loginScreen) {
    loginScreen.hidden = true;
  }

  if (appScreen) {
    appScreen.hidden = false;
  }

  document.body.classList.add(
    "app-active"
  );

  updateUserUI();
  updateGuestUI();

  /*
   * Guest Mode:
   * use the demo data already loaded into state.
   * Do not request protected backend data.
   */
  if (state.guest) {
    const guestBadge =
      $("guest-mode-badge");

    if (guestBadge) {
      guestBadge.hidden = false;
    }

    navigateTo(
      "dashboard"
    );

    renderStats(
      state.shipments
    );

    renderActivityChart(
      state.shipments
    );

    renderStatusDistribution(
      state.shipments
    );

    renderRecentShipments(
      state.shipments.slice(0, 6)
    );

    renderAlerts(
      state.notifications
    );

    return;
  }

  /*
   * Normal authenticated user.
   */
  const guestBadge =
    $("guest-mode-badge");

  if (guestBadge) {
    guestBadge.hidden = true;
  }

  navigateTo(
    "dashboard"
  );

  loadDashboard();

  refreshNotificationBadge();
}
  function updateUserUI() {
    const user =
      state.user || {
        full_name: "Operator",
        email: ""
      };

    const name =
      user.full_name ||
      user.name ||
      user.username ||
      "Operator";

    const email =
      user.email ||
      "";

    const initials =
      getInitials(name);

    const sidebarAvatar =
      $("sidebar-user-avatar");

    const headerAvatar =
      $("header-user-avatar");

    const sidebarName =
      $("sidebar-user-name");

    const sidebarEmail =
      $("sidebar-user-email");

    if (sidebarAvatar) {
      sidebarAvatar.textContent =
        initials;
    }

    if (headerAvatar) {
      headerAvatar.textContent =
        initials;
    }

    if (sidebarName) {
      sidebarName.textContent =
        name;
    }

    if (sidebarEmail) {
      sidebarEmail.textContent =
        email;
    }
  }


  function updateGuestUI() {
    const badge =
      $("guest-mode-badge");

    const newShipmentButton =
      $("new-shipment-btn");

    const newDriverButton =
      $("new-driver-btn");

    const guest =
      isGuest();

    if (badge) {
      badge.hidden = !guest;
    }

    if (newShipmentButton) {
      newShipmentButton.disabled =
        guest;

      newShipmentButton.title = guest
        ? "Creating shipments is disabled in Guest Mode."
        : "";
    }

    if (newDriverButton) {
      newDriverButton.disabled =
        guest;

      newDriverButton.title = guest
        ? "Creating drivers is disabled in Guest Mode."
        : "";
    }
  }


  /* ----------------------------- NAVIGATION ----------------------------- */

  const PAGE_META = {
    dashboard: {
      title: "Dashboard",
      subtitle:
        "Operational overview across every shipment."
    },

    shipments: {
      title: "Shipments",
      subtitle:
        "Search, review, and manage every shipment."
    },

    tracking: {
      title: "Tracking",
      subtitle:
        "Follow a shipment through every stage."
    },

    drivers: {
      title: "Drivers",
      subtitle:
        "Fleet visibility and driver operations."
    },

    notifications: {
      title: "Notifications",
      subtitle:
        "Everything that needs your attention."
    }
  };


  function setActivePage(page) {
    if (!PAGE_META[page]) {
      page = "dashboard";
    }

    state.currentPage = page;

    document
      .querySelectorAll(".page")
      .forEach((section) => {
        const sectionPage =
          section.id.replace(
            "page-",
            ""
          );

        section.classList.toggle(
          "hidden",
          sectionPage !== page
        );
      });


    document
      .querySelectorAll(".nav-item")
      .forEach((item) => {
        item.classList.toggle(
          "active",
          item.dataset.page === page
        );
      });


    const meta =
      PAGE_META[page];

    const title =
      $("page-title");

    const subtitle =
      $("page-subtitle");

    if (title) {
      title.textContent =
        meta.title;
    }

    if (subtitle) {
      subtitle.textContent =
        meta.subtitle;
    }


    if (page === "dashboard") {
      if (isGuest()) {
        renderDashboard();
      } else {
        loadDashboard();
      }
    }

    if (page === "shipments") {
      if (isGuest()) {
        renderShipments();
      } else {
        loadShipments();
      }
    }

    if (page === "tracking") {
      // Tracking is loaded when a tracking ID is submitted.
    }

    if (page === "drivers") {
      if (isGuest()) {
        renderDrivers();
      } else {
        loadDrivers();
      }
    }

    if (page === "notifications") {
      if (isGuest()) {
        renderNotifications();
      } else {
        loadNotifications();
      }
    }

    closeMobileSidebar();
  }


  /* ----------------------------- INITIAL DATA ----------------------------- */

  async function loadInitialApplicationData() {
    if (isGuest()) {
      cloneGuestData();

      renderDashboard();

      return;
    }

    await Promise.allSettled([
      loadDashboard(),
      loadDrivers(),
      loadNotifications()
    ]);
  }


  /* ----------------------------- DASHBOARD ----------------------------- */

  async function loadDashboard() {
    if (isGuest()) {
      cloneGuestData();
      renderDashboard();
      return;
    }

    try {
      await loadShipments();

      state.dashboardLoaded = true;

      renderDashboard();
    } catch (error) {
      console.error(
        "Dashboard load error:",
        error
      );

      showToast(
        error.message ||
          "Unable to load dashboard.",
        "error"
      );
    }
  }


  function renderDashboard() {
    renderDashboardStats();
    renderActivityChart();
    renderStatusDistribution();
    renderRecentShipments();
    renderDashboardAlerts();
  }


  function renderDashboardStats() {
    const shipments =
      Array.isArray(state.shipments)
        ? state.shipments
        : [];

    const total =
      shipments.length;

    const inTransit =
      shipments.filter((shipment) => {
        const status =
          normalizeStatus(
            shipment.status
          );

        return [
          "picked_up",
          "in_transit",
          "out_for_delivery"
        ].includes(status);
      }).length;

    const delivered =
      shipments.filter(
        (shipment) =>
          normalizeStatus(
            shipment.status
          ) === "delivered"
      ).length;

    const alerts =
      state.notifications.filter(
        (notification) =>
          notification.is_read === false
      ).length;


    const totalElement =
      $("stat-total");

    const inTransitElement =
      $("stat-in-transit");

    const deliveredElement =
      $("stat-delivered");

    const alertsElement =
      $("stat-alerts");


    if (totalElement) {
      totalElement.textContent =
        total;
    }

    if (inTransitElement) {
      inTransitElement.textContent =
        inTransit;
    }

    if (deliveredElement) {
      deliveredElement.textContent =
        delivered;
    }

    if (alertsElement) {
      alertsElement.textContent =
        alerts;
    }
  }


  function renderActivityChart() {
    const container =
      $("activity-chart");

    if (!container) {
      return;
    }

    const shipments =
      Array.isArray(state.shipments)
        ? state.shipments
        : [];

    if (!shipments.length) {
      container.innerHTML = `
        <div class="empty-inline">
          No shipment activity available.
        </div>
      `;

      return;
    }


    const counts = {};

    shipments.forEach((shipment) => {
      const status =
        normalizeStatus(
          shipment.status
        );

      counts[status] =
        (counts[status] || 0) + 1;
    });


    const statuses =
      Object.keys(counts);

    const max =
      Math.max(
        ...Object.values(counts),
        1
      );


    container.innerHTML = statuses
      .map((status) => {
        const count =
          counts[status];

        const percentage =
          Math.max(
            8,
            Math.round(
              (count / max) * 100
            )
          );

        return `
          <div class="activity-row">

            <div class="activity-row-label">
              <span
                class="status-dot"
                style="background:${escapeHtml(
                  getStatusColor(status)
                )}">
              </span>

              <span>
                ${escapeHtml(
                  getStatusLabel(status)
                )}
              </span>
            </div>

            <div class="activity-bar-wrap">

              <div
                class="activity-bar"
                style="width:${percentage}%">
              </div>

            </div>

            <span class="activity-count">
              ${count}
            </span>

          </div>
        `;
      })
      .join("");
  }


  function renderStatusDistribution() {
    const container =
      $("status-distribution");

    if (!container) {
      return;
    }

    const shipments =
      Array.isArray(state.shipments)
        ? state.shipments
        : [];

    if (!shipments.length) {
      container.innerHTML = `
        <div class="empty-inline">
          No shipment data available.
        </div>
      `;

      return;
    }


    const counts = {};

    shipments.forEach((shipment) => {
      const status =
        normalizeStatus(
          shipment.status
        );

      counts[status] =
        (counts[status] || 0) + 1;
    });


    const total =
      shipments.length;


    container.innerHTML =
      Object.entries(counts)
        .map(([status, count]) => {
          const percentage =
            Math.round(
              (count / total) * 100
            );

          return `
            <div class="distribution-row">

              <div class="distribution-label">

                <span
                  class="status-dot"
                  style="background:${escapeHtml(
                    getStatusColor(status)
                  )}">
                </span>

                <span>
                  ${escapeHtml(
                    getStatusLabel(status)
                  )}
                </span>

              </div>

              <div class="distribution-value">
                <strong>
                  ${count}
                </strong>

                <span>
                  ${percentage}%
                </span>
              </div>

            </div>
          `;
        })
        .join("");
  }


  function renderRecentShipments() {
    const body =
      $("recent-shipments-body");

    const empty =
      $("recent-shipments-empty");

    if (!body) {
      return;
    }

    const shipments =
      [...state.shipments]
        .sort(
          (a, b) =>
            new Date(
              b.created_at ||
                b.createdAt ||
                0
            ) -
            new Date(
              a.created_at ||
                a.createdAt ||
                0
            )
        )
        .slice(0, 6);


    body.innerHTML = "";


    if (!shipments.length) {
      if (empty) {
        empty.hidden = false;
      }

      return;
    }


    if (empty) {
      empty.hidden = true;
    }


    shipments.forEach((shipment) => {
      body.insertAdjacentHTML(
        "beforeend",
        createShipmentRow(
          shipment
        )
      );
    });
  }


  function createShipmentRow(shipment) {
    const trackingId =
      shipment.tracking_id ||
      shipment.trackingId ||
      shipment.id ||
      "—";

    const origin =
      shipment.origin ||
      shipment.sender_address ||
      shipment.sender_city ||
      "—";

    const destination =
      shipment.destination ||
      shipment.receiver_address ||
      shipment.receiver_city ||
      "—";

    const receiver =
      shipment.receiver_name ||
      shipment.receiver ||
      "—";

    const status =
      normalizeStatus(
        shipment.status
      );

    const eta =
      shipment.estimated_delivery ||
      shipment.estimatedDelivery ||
      shipment.eta ||
      null;


    return `
      <tr>

        <td>
          <button
            type="button"
            class="table-link tracking-action"
            data-tracking-id="${escapeHtml(
              trackingId
            )}">
            ${escapeHtml(trackingId)}
          </button>
        </td>

        <td>
          ${escapeHtml(origin)}
        </td>

        <td>
          ${escapeHtml(destination)}
        </td>

        <td>
          ${escapeHtml(receiver)}
        </td>

        <td>
          <span
            class="status-badge"
            style="--status-color:${escapeHtml(
              getStatusColor(status)
            )}">
            ${escapeHtml(
              getStatusLabel(status)
            )}
          </span>
        </td>

        <td>
          ${escapeHtml(
            formatDate(eta)
          )}
        </td>

        <td>
          <button
            type="button"
            class="btn btn-ghost btn-sm tracking-action"
            data-tracking-id="${escapeHtml(
              trackingId
            )}">
            View
          </button>
        </td>

      </tr>
    `;
  }


  function renderDashboardAlerts() {
    const list =
      $("alerts-list");

    const empty =
      $("alerts-empty");

    if (!list) {
      return;
    }

    const alerts =
      state.notifications
        .filter(
          (notification) =>
            notification.is_read === false
        )
        .slice(0, 5);


    list.innerHTML = "";


    if (!alerts.length) {
      if (empty) {
        empty.hidden = false;
      }

      return;
    }


    if (empty) {
      empty.hidden = true;
    }


    alerts.forEach((notification) => {
      list.insertAdjacentHTML(
        "beforeend",
        `
          <li class="alert-item">

            <span class="alert-icon">
              ${notification.type === "success"
                ? "✓"
                : "!"}
            </span>

            <div class="alert-content">

              <strong>
                ${escapeHtml(
                  notification.title ||
                    "Notification"
                )}
              </strong>

              <p>
                ${escapeHtml(
                  notification.message ||
                    ""
                )}
              </p>

            </div>

          </li>
        `
      );
    });
  }


  /* ----------------------------- SHIPMENTS ----------------------------- */

  let shipmentSearchTerm = "";


  async function loadShipments() {
    if (isGuest()) {
      cloneGuestData();

      state.shipmentsLoaded = true;

      renderShipments();

      return;
    }

    const body =
      $("shipments-table-body");

    const loading =
      $("shipments-loading");

    const empty =
      $("shipments-empty");

    const errorState =
      $("shipments-error");

    if (body) {
      body.innerHTML = "";
    }

    if (loading) {
      loading.hidden = false;
    }

    if (empty) {
      empty.hidden = true;
    }

    if (errorState) {
      errorState.hidden = true;
    }


    try {
      const response =
        await apiRequest(
          "/api/v1/shipments"
        );

      const shipments =
        Array.isArray(response)
          ? response
          : response?.shipments ||
            response?.data ||
            response?.items ||
            [];


      state.shipments =
        Array.isArray(shipments)
          ? shipments
          : [];

      state.shipmentsLoaded = true;

      renderShipments();

      return state.shipments;

    } catch (error) {
      console.error(
        "Load shipments error:",
        error
      );

      if (errorState) {
        errorState.hidden = false;
      }

      const errorText =
        $("shipments-error-text");

      if (errorText) {
        errorText.textContent =
          error.message ||
          "Something went wrong.";
      }

      throw error;

    } finally {
      if (loading) {
        loading.hidden = true;
      }
    }
  }


  function renderShipments() {
    const body =
      $("shipments-table-body");

    const empty =
      $("shipments-empty");

    if (!body) {
      return;
    }


    const term =
      shipmentSearchTerm
        .trim()
        .toLowerCase();


    const shipments =
      state.shipments.filter(
        (shipment) => {
          if (!term) {
            return true;
          }

          const values = [
            shipment.tracking_id,
            shipment.trackingId,
            shipment.receiver_name,
            shipment.receiver,
            shipment.origin,
            shipment.destination,
            shipment.status
          ];

          return values.some(
            (value) =>
              String(value || "")
                .toLowerCase()
                .includes(term)
          );
        }
      );


    body.innerHTML = "";


    if (!shipments.length) {
      if (empty) {
        empty.hidden = false;
      }

      return;
    }


    if (empty) {
      empty.hidden = true;
    }


    shipments.forEach((shipment) => {
      body.insertAdjacentHTML(
        "beforeend",
        createShipmentRow(
          shipment
        )
      );
    });
  }            <span
              class="status-badge"
              style="
                --status-color:${escapeHtml(
                  getStatusColor(status)
                )};
              "
            >
              ${escapeHtml(
                getStatusLabel(status)
              )}
            </span>
          </div>

        </div>

        <div class="tracking-timeline">

          ${buildTrackingTimeline(
            shipment
          )}

        </div>

      </div>
    `;
  }


  async function openTrackingModal(
    trackingId
  ) {

    const modal =
      $("tracking-modal");

    const body =
      $("tracking-modal-body");

    if (!modal || !body) {
      return;
    }

    modal.hidden = false;

    document.body.style.overflow =
      "hidden";

    body.innerHTML = `
      <div class="table-state">

        <div class="spinner"></div>

        <span>
          Fetching tracking details…
        </span>

      </div>
    `;


    try {

      /*
       * Guest users use the local demo
       * shipment dataset.
       */
      if (isGuest()) {

        const shipment =
          state.shipments.find(
            (item) =>
              String(
                getTrackingId(item)
              ).toLowerCase() ===
              String(
                trackingId
              ).toLowerCase()
          );

        if (!shipment) {
          throw new Error(
            "Demo shipment not found."
          );
        }

        body.innerHTML =
          trackingResultMarkup(
            shipment
          );

        return;
      }


      const shipment =
        await trackShipmentById(
          trackingId
        );

      body.innerHTML =
        trackingResultMarkup(
          shipment
        );

    } catch (error) {

      body.innerHTML = `
        <div class="table-state">

          <span class="empty-icon">
            ⚠
          </span>

          <p>
            Couldn't find that shipment
          </p>

          <span>
            ${escapeHtml(
              error.message ||
                "Please check the tracking ID and try again."
            )}
          </span>

        </div>
      `;
    }
  }


  async function runQuickTrack(
    trackingId
  ) {

    const result =
      $("quick-track-result");

    if (!result) {
      return;
    }

    const id =
      String(
        trackingId || ""
      ).trim();

    if (!id) {
      result.innerHTML = `
        <div class="form-error">
          Enter a tracking ID.
        </div>
      `;

      return;
    }


    result.innerHTML = `
      <div
        class="table-state"
        style="padding:20px 0;"
      >
        <div class="spinner"></div>

        <span>
          Looking up shipment…
        </span>
      </div>
    `;


    try {

      /*
       * Guest mode:
       * Search only the local demo data.
       */
      if (isGuest()) {

        const shipment =
          state.shipments.find(
            (item) =>
              String(
                getTrackingId(item)
              ).toLowerCase() ===
              id.toLowerCase()
          );

        if (!shipment) {
          throw new Error(
            "Demo shipment not found. Try PP-2026-169247."
          );
        }

        result.innerHTML =
          trackingResultMarkup(
            shipment
          );

        return;
      }


      const shipment =
        await trackShipmentById(
          id
        );

      result.innerHTML =
        trackingResultMarkup(
          shipment
        );

    } catch (error) {

      result.innerHTML = `
        <div class="form-error">
          ${escapeHtml(
            error.message ||
              "Shipment not found."
          )}
        </div>
      `;
    }
  }


  async function runPageTrack(
    trackingId
  ) {

    const result =
      $("tracking-page-result");

    if (!result) {
      return;
    }

    const id =
      String(
        trackingId || ""
      ).trim();

    if (!id) {

      result.innerHTML = `
        <div
          class="panel"
          style="margin-top:16px;"
        >
          <div class="table-state">

            <span class="empty-icon">
              ⚠
            </span>

            <p>
              Enter a tracking ID
            </p>

            <span>
              Enter a valid ParcelPilot tracking ID to continue.
            </span>

          </div>
        </div>
      `;

      return;
    }


    result.innerHTML = `
      <div
        class="panel"
        style="margin-top:16px;"
      >
        <div class="table-state">

          <div class="spinner"></div>

          <span>
            Looking up shipment…
          </span>

        </div>
      </div>
    `;


    try {

      /*
       * Guest mode uses local demo records.
       */
      if (isGuest()) {

        const shipment =
          state.shipments.find(
            (item) =>
              String(
                getTrackingId(item)
              ).toLowerCase() ===
              id.toLowerCase()
          );

        if (!shipment) {
          throw new Error(
            "Demo shipment not found. Try PP-2026-169247."
          );
        }

        result.innerHTML = `
          <div
            class="panel"
            style="margin-top:16px;"
          >
            ${trackingResultMarkup(
              shipment
            )}
          </div>
        `;

        return;
      }


      const shipment =
        await trackShipmentById(
          id
        );


      result.innerHTML = `
        <div
          class="panel"
          style="margin-top:16px;"
        >
          ${trackingResultMarkup(
            shipment
          )}
        </div>
      `;

    } catch (error) {

      result.innerHTML = `
        <div
          class="panel"
          style="margin-top:16px;"
        >
          <div class="table-state">

            <span class="empty-icon">
              ⚠
            </span>

            <p>
              Couldn't find that shipment
            </p>

            <span>
              ${escapeHtml(
                error.message ||
                  "Please check the tracking ID and try again."
              )}
            </span>

          </div>
        </div>
      `;
    }
  }


  /* ============================================================
     CREATE SHIPMENT
     ============================================================ */


  async function submitCreateShipment(
    formData
  ) {

    /*
     * Guest mode is strictly read-only.
     */
    if (isGuest()) {

      throw new Error(
        "Guest Mode is read-only. Sign in to create a shipment."
      );
    }


    const payload = {

      sender_name:
        formData.get(
          "sender_name"
        ),

      receiver_name:
        formData.get(
          "receiver_name"
        ),

      origin:
        formData.get(
          "origin"
        ),

      destination:
        formData.get(
          "destination"
        ),

      estimated_delivery:
        formData.get(
          "estimated_delivery"
        )
    };


    return apiRequest(
      "/api/v1/shipments",
      {
        method: "POST",
        body: payload
      }
    );
  }


  /* ============================================================
     DRIVERS
     ============================================================ */


  let driverSearchTerm = "";


  async function loadDrivers() {

    /*
     * Guest mode uses demo drivers and never
     * requests protected driver data.
     */
    if (isGuest()) {

      state.drivers =
        GUEST_DRIVERS.map(
          (driver) => ({
            ...driver
          })
        );

      state.driversLoaded =
        true;

      renderDrivers();

      return state.drivers;
    }


    const grid =
      $("drivers-grid");

    const loading =
      $("drivers-loading");

    const empty =
      $("drivers-empty");

    const errorState =
      $("drivers-error");


    if (grid) {
      grid.innerHTML = "";
    }

    if (loading) {
      loading.hidden = false;
    }

    if (empty) {
      empty.hidden = true;
    }

    if (errorState) {
      errorState.hidden = true;
    }


    try {

      const response =
        await apiRequest(
          "/api/v1/drivers",
          {
            method: "GET"
          }
        );


      const drivers =
        Array.isArray(response)
          ? response
          : response?.drivers ||
            response?.items ||
            response?.data ||
            [];


      state.drivers =
        Array.isArray(drivers)
          ? drivers
          : [];

      state.driversLoaded =
        true;

      renderDrivers();

      return state.drivers;

    } catch (error) {

      console.error(
        "Load drivers error:",
        error
      );

      if (errorState) {
        errorState.hidden = false;
      }

      const errorText =
        $("drivers-error-text");

      if (errorText) {
        errorText.textContent =
          error.message ||
          "Something went wrong.";
      }

      throw error;

    } finally {

      if (loading) {
        loading.hidden = true;
      }
    }
  }


  function renderDrivers() {

    const grid =
      $("drivers-grid");

    const empty =
      $("drivers-empty");

    if (!grid) {
      return;
    }


    const term =
      driverSearchTerm
        .trim()
        .toLowerCase();


    const filtered =
      state.drivers.filter(
        (driver) => {

          if (!term) {
            return true;
          }

          const values = [

            driver.name,

            driver.phone,

            driver.vehicle_number,

            driver.vehicleNumber,

            driver.status

          ];

          return values.some(
            (value) =>
              String(
                value || ""
              )
                .toLowerCase()
                .includes(term)
          );
        }
      );


    grid.innerHTML = "";


    if (!filtered.length) {

      if (empty) {
        empty.hidden = false;
      }

      return;
    }


    if (empty) {
      empty.hidden = true;
    }


    filtered.forEach(
      (driver) => {

        grid.insertAdjacentHTML(
          "beforeend",
          driverCard(driver)
        );

      }
    );
  }


  function driverCard(
    driver
  ) {

    const name =
      driver.name ||
      "Unnamed driver";

    const phone =
      driver.phone ||
      "No phone on file";

    const vehicle =
      driver.vehicle_number ||
      driver.vehicleNumber ||
      "No vehicle assigned";

    const rawStatus =
      driver.status ||
      "available";

    const normalizedStatus =
      normalizeStatus(
        rawStatus
      );


    const statusText =
      getStatusLabel(
        normalizedStatus
      );


    const assignedCount =
      driver.assigned_shipments_count ??
      driver.assignedShipmentsCount ??
      driver.active_shipments ??
      (
        Array.isArray(
          driver.assigned_shipments
        )
          ? driver.assigned_shipments.length
          : 0
      );


    return `
      <article class="driver-card">

        <div class="driver-card-top">

          <div class="driver-avatar">
            ${escapeHtml(
              getInitials(name)
            )}
          </div>

          <div class="driver-card-identity">

            <h3 class="driver-name">
              ${escapeHtml(name)}
            </h3>

            <p class="driver-phone">
              ${escapeHtml(phone)}
            </p>

          </div>

        </div>


        <div class="driver-meta">

          <div class="driver-meta-row">

            <span>
              Vehicle
            </span>

            <strong>
              ${escapeHtml(vehicle)}
            </strong>

          </div>


          <div class="driver-meta-row">

            <span>
              Status
            </span>

            <span
              class="status-badge"
              style="--status-color:${escapeHtml(
                getStatusColor(
                  normalizedStatus
                )
              )}"
            >
              ${escapeHtml(
                statusText
              )}
            </span>

          </div>


          <div class="driver-meta-row">

            <span>
              Assigned shipments
            </span>

            <strong>
              ${escapeHtml(
                String(
                  assignedCount
                )
              )}
            </strong>

          </div>

        </div>


        ${
          isGuest()
            ? `
              <div class="guest-readonly-note">
                Demo data · Read only
              </div>
            `
            : ""
        }

      </article>
    `;
  }


  async function submitCreateDriver(
    formData
  ) {

    if (isGuest()) {

      throw new Error(
        "Guest Mode is read-only. Sign in to add a driver."
      );
    }


    const payload = {

      name:
        formData.get(
          "name"
        ),

      phone:
        formData.get(
          "phone"
        ) || undefined,

      vehicle_number:
        formData.get(
          "vehicle_number"
        ) || undefined
    };


    return apiRequest(
      "/api/v1/drivers",
      {
        method: "POST",
        body: payload
      }
    );
  }


  /* ============================================================
     NOTIFICATIONS
     ============================================================ */


  async function refreshNotificationBadge() {

    /*
     * Guest notification counts are local.
     */
    if (isGuest()) {

      state.unreadCount =
        state.notifications.filter(
          (notification) =>
            notification.is_read === false
        ).length;

      updateNotificationBadges(
        state.unreadCount
      );

      return state.unreadCount;
    }


    try {

      const data =
        await apiRequest(
          "/api/v1/notifications/unread-count",
          {
            method: "GET"
          }
        );


      const count =
        typeof data === "number"
          ? data
          : (
              data?.unread_count ??
              data?.count ??
              0
            );


      state.unreadCount =
        Number(count) || 0;


      updateNotificationBadges(
        state.unreadCount
      );


      return state.unreadCount;

    } catch (error) {

      /*
       * Badge failures should not prevent
       * the rest of the application from working.
       */

      if (!isGuest()) {
        console.debug(
          "Notification badge unavailable:",
          error
        );
      }

      return state.unreadCount;
    }
  }


  function updateNotificationBadges(
    count
  ) {

    const badges = [

      $("sidebar-notif-badge"),

      $("header-notif-badge")

    ];


    badges.forEach(
      (element) => {

        if (!element) {
          return;
        }

        const numericCount =
          Number(count) || 0;

        element.textContent =
          numericCount > 99
            ? "99+"
            : String(
                numericCount
              );

        element.hidden =
          numericCount === 0;

      }
    );


    const stat =
      $("stat-alerts");

    if (stat) {
      stat.textContent =
        Number(count) || 0;
    }
  }


  async function loadNotifications() {

    /*
     * Guest mode uses local demo notifications.
     */
    if (isGuest()) {

      state.notifications =
        GUEST_NOTIFICATIONS.map(
          (notification) => ({
            ...notification
          })
        );

      state.unreadCount =
        state.notifications.filter(
          (notification) =>
            notification.is_read === false
        ).length;

      state.notificationsLoaded =
        true;

      renderNotifications();

      updateNotificationBadges(
        state.unreadCount
      );

      return state.notifications;
    }


    try {

      const response =
        await apiRequest(
          "/api/v1/notifications",
          {
            method: "GET"
          }
        );


      const notifications =
        Array.isArray(response)
          ? response
          : response?.notifications ||
            response?.items ||
            response?.data ||
            [];


      state.notifications =
        Array.isArray(
          notifications
        )
          ? notifications
          : [];


      state.notificationsLoaded =
        true;


      state.unreadCount =
        state.notifications.filter(
          (notification) =>
            notification.is_read === false ||
            notification.read === false ||
            notification.status === "unread"
        ).length;


      renderNotifications();

      updateNotificationBadges(
        state.unreadCount
      );


      return state.notifications;

    } catch (error) {

      console.error(
        "Load notifications error:",
        error
      );

      throw error;
    }
  }


  function renderNotifications() {

    const list =
      $("notifications-page-list");

    const empty =
      $("notifications-empty");

    const loading =
      $("notifications-loading");

    const errorState =
      $("notifications-error");


    if (!list) {
      return;
    }


    if (loading) {
      loading.hidden = true;
    }

    if (errorState) {
      errorState.hidden = true;
    }


    const notifications =
      Array.isArray(
        state.notifications
      )
        ? state.notifications
        : [];


    list.innerHTML = "";


    if (!notifications.length) {

      if (empty) {
        empty.hidden = false;
      }

      return;
    }


    if (empty) {
      empty.hidden = true;
    }


    notifications
      .forEach(
        (notification) => {

          list.insertAdjacentHTML(
            "beforeend",
            notificationRow(
              notification
            )
          );

        }
      );
  }


  function notificationRow(
    notification
  ) {

    const isUnread =
      notification.is_read === false ||
      notification.read === false ||
      notification.status === "unread";


    const type =
      notification.type ||
      "info";


    return `
      <li
        class="
          notification-row
          ${isUnread ? "is-unread" : ""}
        "
      >

        <div class="notification-icon">
          ${
            type === "success"
              ? "✓"
              : type === "warning"
                ? "!"
                : "◈"
          }
        </div>


        <div class="notification-content">

          <div class="notification-top-row">

            <span class="notification-type">
              ${escapeHtml(
                notification.title ||
                notification.type ||
                "Update"
              )}
            </span>

            <span class="notification-time">
              ${escapeHtml(
                formatDateTime(
                  notification.created_at ||
                  notification.timestamp
                )
              )}
            </span>

          </div>


          <div class="notification-message">
            ${escapeHtml(
              notification.message ||
              "Notification"
            )}
          </div>

        </div>


        ${
          isUnread
            ? `
              <span
                class="unread-dot"
                aria-label="Unread"
              ></span>
            `
            : ""
        }

      </li>
    `;
  }


  /* ============================================================
     PAGE LOADERS
     ============================================================ */


  async function loadNotificationsPage() {

    if (isGuest()) {

      await loadNotifications();

      return state.notifications;
    }


    const list =
      $("notifications-page-list");

    const loading =
      $("notifications-loading");

    const empty =
      $("notifications-empty");

    const errorState =
      $("notifications-error");


    if (list) {
      list.innerHTML = "";
    }

    if (loading) {
      loading.hidden = false;
    }

    if (empty) {
      empty.hidden = true;
    }

    if (errorState) {
      errorState.hidden = true;
    }


    try {

      await loadNotifications();

      return state.notifications;

    } catch (error) {

      if (errorState) {
        errorState.hidden = false;
      }

      const errorText =
        $("notifications-error-text");

      if (errorText) {
        errorText.textContent =
          error.message ||
          "Something went wrong.";
      }

      throw error;

    } finally {

      if (loading) {
        loading.hidden = true;
      }
    }
  }


  /* ============================================================
     SEARCH
     ============================================================ */


  function performGlobalSearch(
    term
  ) {

    const search =
      String(
        term || ""
      )
        .trim()
        .toLowerCase();


    shipmentSearchTerm =
      search;


    const input =
      $("shipment-search-input");

    if (input) {
      input.value =
        term || "";
    }


    setActivePage(
      "shipments"
    );


    if (isGuest()) {
      renderShipments();
    } else if (
      !state.shipmentsLoaded
    ) {
      loadShipments();
    }
  }


  /* ============================================================
     MODALS
     ============================================================ */


  function openModal(id) {

    const modal =
      $(id);

    if (!modal) {
      return;
    }

    modal.hidden = false;

    document.body.style.overflow =
      "hidden";
  }


  function closeModal(id) {

    const modal =
      $(id);

    if (!modal) {
      return;
    }

    modal.hidden = true;

    document.body.style.overflow =
      "";
  }


  function closeAllModals() {

    document
      .querySelectorAll(
        ".modal-overlay"
      )
      .forEach(
        (modal) => {
          modal.hidden = true;
        }
      );

    document.body.style.overflow =
      "";
  }


  /* ============================================================
     MOBILE SIDEBAR
     ============================================================ */


  function openMobileSidebar() {

    const sidebar =
      $("sidebar");

    const backdrop =
      $("sidebar-backdrop");

    if (sidebar) {
      sidebar.classList.add(
        "is-open"
      );
    }

    if (backdrop) {
      backdrop.hidden = false;
    }

    state.mobileSidebarOpen =
      true;
  }


  function closeMobileSidebar() {

    const sidebar =
      $("sidebar");

    const backdrop =
      $("sidebar-backdrop");

    if (sidebar) {
      sidebar.classList.remove(
        "is-open"
      );
    }

    if (backdrop) {
      backdrop.hidden = true;
    }

    state.mobileSidebarOpen =
      false;
  }


  /* ============================================================
     BUTTON HELPERS
     ============================================================ */


  function setButtonLoading(
    button,
    loading
  ) {

    if (!button) {
      return;
    }

    button.disabled =
      Boolean(loading);


    const label =
      button.querySelector(
        ".btn-label"
      );

    const spinner =
      button.querySelector(
        ".btn-spinner"
      );


    if (label) {
      label.style.visibility =
        loading
          ? "hidden"
          : "visible";
    }


    if (spinner) {
      spinner.hidden =
        !loading;
    }
  }


  function showFieldError(
    id,
    message
  ) {

    const element =
      $(id);

    if (!element) {
      return;
    }

    element.textContent =
      message || "";

    element.hidden =
      !message;
  }


  function hideFieldError(
    id
  ) {
    showFieldError(
      id,
      ""
    );
  }


  function hideLoginError() {
    hideFieldError(
      "login-error"
    );
  }


  /* ============================================================
     END OF PART 2
     ============================================================ */
  /* ============================================================
     TRACKING HELPERS
     ============================================================ */


  function getTrackingId(shipment) {
    return (
      shipment?.tracking_id ||
      shipment?.trackingId ||
      shipment?.id ||
      "—"
    );
  }


  function getShipmentStatus(shipment) {
    return (
      shipment?.current_status ||
      shipment?.status ||
      "created"
    );
  }


  function getReceiverName(shipment) {
    return (
      shipment?.receiver_name ||
      shipment?.receiver ||
      shipment?.recipient_name ||
      "—"
    );
  }


  function getEstimatedDelivery(shipment) {
    return (
      shipment?.estimated_delivery ||
      shipment?.estimatedDelivery ||
      shipment?.eta ||
      null
    );
  }


  function buildTrackingTimeline(
    shipment
  ) {

    const events =
      shipment?.tracking_events ||
      shipment?.timeline ||
      shipment?.history ||
      [];


    if (
      Array.isArray(events) &&
      events.length
    ) {

      return events
        .map(
          (event, index) => {

            const status =
              event?.status ||
              event?.event ||
              event?.current_status ||
              "updated";

            const location =
              event?.location ||
              "";

            const timestamp =
              event?.timestamp ||
              event?.created_at ||
              event?.updated_at ||
              null;


            return `
              <div
                class="
                  timeline-item
                  ${index === events.length - 1
                    ? "is-current"
                    : ""}
                "
              >

                <div class="timeline-marker">

                  <span class="timeline-dot"></span>

                  ${
                    index < events.length - 1
                      ? `
                        <span
                          class="timeline-line"
                        ></span>
                      `
                      : ""
                  }

                </div>


                <div class="timeline-content">

                  <div class="timeline-event">

                    ${escapeHtml(
                      getStatusLabel(
                        status
                      )
                    )}

                  </div>


                  <div class="timeline-meta">

                    ${
                      location
                        ? `
                          <span>
                            ${escapeHtml(
                              location
                            )}
                          </span>
                        `
                        : ""
                    }

                    ${
                      timestamp
                        ? `
                          <span>
                            ${escapeHtml(
                              formatDateTime(
                                timestamp
                              )
                            )}
                          </span>
                        `
                        : ""
                    }

                  </div>

                </div>

              </div>
            `;
          }
        )
        .join("");
    }


    return `
      <div class="timeline-item is-current">

        <div class="timeline-marker">

          <span class="timeline-dot"></span>

        </div>


        <div class="timeline-content">

          <div class="timeline-event">
            ${escapeHtml(
              getStatusLabel(
                getShipmentStatus(
                  shipment
                )
              )
            )}
          </div>

          <div class="timeline-meta">

            ${
              shipment?.origin
                ? escapeHtml(
                    shipment.origin
                  )
                : ""
            }

            ${
              shipment?.updated_at
                ? ` · ${escapeHtml(
                    formatDateTime(
                      shipment.updated_at
                    )
                  )}`
                : ""
            }

          </div>

        </div>

      </div>
    `;
  }


  function trackingResultMarkup(
    shipment
  ) {

    const trackingId =
      getTrackingId(
        shipment
      );

    const status =
      getShipmentStatus(
        shipment
      );

    const origin =
      shipment?.origin ||
      "—";

    const destination =
      shipment?.destination ||
      "—";

    const receiver =
      getReceiverName(
        shipment
      );

    const eta =
      getEstimatedDelivery(
        shipment
      );


    return `
      <div class="tracking-result-card">

        <div class="tracking-route-summary">

          <div
            class="tracking-route-point"
          >

            <span class="label">
              Origin
            </span>

            <span class="value">
              ${escapeHtml(
                origin
              )}
            </span>

          </div>


          <span
            class="tracking-route-arrow"
          >
            →
          </span>


          <div
            class="tracking-route-point"
          >

            <span class="label">
              Destination
            </span>

            <span class="value">
              ${escapeHtml(
                destination
              )}
            </span>

          </div>


          <div
            class="tracking-route-point"
          >

            <span class="label">
              Tracking ID
            </span>

            <span
              class="value"
              style="
                font-family:var(--font-mono);
                font-size:13px;
              "
            >
              ${escapeHtml(
                trackingId
              )}
            </span>

          </div>


          <div
            class="tracking-route-point"
          >

            <span class="label">
              Status
            </span>

            <span
              class="
                status-badge
                badge-${normalizeStatus(
                  status
                )}
              "
            >
              ${escapeHtml(
                getStatusLabel(
                  status
                )
              )}
            </span>

          </div>

        </div>


        <div class="tracking-extra-info">

          <div>

            <span class="label">
              Receiver
            </span>

            <strong>
              ${escapeHtml(
                receiver
              )}
            </strong>

          </div>


          <div>

            <span class="label">
              Estimated delivery
            </span>

            <strong>
              ${escapeHtml(
                formatDate(
                  eta
                )
              )}
            </strong>

          </div>

        </div>


        <div class="tracking-timeline">

          ${buildTrackingTimeline(
            shipment
          )}

        </div>

      </div>
    `;
  }


  async function trackShipmentById(
    trackingId
  ) {

    const id =
      String(
        trackingId || ""
      ).trim();


    if (!id) {

      throw new Error(
        "Enter a tracking ID to continue."
      );
    }


    /*
     * Guest Mode:
     * never call protected APIs.
     */
    if (isGuest()) {

      const shipment =
        state.shipments.find(
          (item) =>
            String(
              getTrackingId(item)
            ).toLowerCase() ===
            id.toLowerCase()
        );


      if (!shipment) {

        throw new Error(
          `Demo shipment "${id}" was not found.`
        );
      }


      return shipment;
    }


    return apiRequest(
      `/api/v1/shipments/track/${encodeURIComponent(
        id
      )}`,
      {
        method: "GET"
      }
    );
  }


  /* ============================================================
     TRACKING MODAL
     ============================================================ */


  async function openTrackingModal(
    trackingId
  ) {

    const modal =
      $("tracking-modal");

    const body =
      $("tracking-modal-body");


    if (!modal || !body) {
      return;
    }


    openModal(
      "tracking-modal"
    );


    body.innerHTML = `
      <div class="table-state">

        <div class="spinner"></div>

        <span>
          Fetching tracking details…
        </span>

      </div>
    `;


    try {

      const shipment =
        await trackShipmentById(
          trackingId
        );


      body.innerHTML =
        trackingResultMarkup(
          shipment
        );

    } catch (error) {

      body.innerHTML = `
        <div class="table-state">

          <span class="empty-icon">
            ⚠
          </span>

          <p>
            Couldn't find that shipment
          </p>

          <span>
            ${escapeHtml(
              error.message ||
                "Please check the tracking ID and try again."
            )}
          </span>

        </div>
      `;
    }
  }


  /* ============================================================
     QUICK TRACK
     ============================================================ */


  async function runQuickTrack(
    trackingId
  ) {

    const result =
      $("quick-track-result");


    if (!result) {
      return;
    }


    const id =
      String(
        trackingId || ""
      ).trim();


    if (!id) {

      result.innerHTML = `
        <div class="form-error">
          Enter a tracking ID.
        </div>
      `;

      return;
    }


    result.innerHTML = `
      <div
        class="table-state"
        style="padding:20px 0;"
      >

        <div class="spinner"></div>

        <span>
          Looking up shipment…
        </span>

      </div>
    `;


    try {

      const shipment =
        await trackShipmentById(
          id
        );


      result.innerHTML =
        trackingResultMarkup(
          shipment
        );

    } catch (error) {

      result.innerHTML = `
        <div class="form-error">
          ${escapeHtml(
            error.message ||
              "Shipment not found."
          )}
        </div>
      `;
    }
  }


  /* ============================================================
     PAGE TRACK
     ============================================================ */


  async function runPageTrack(
    trackingId
  ) {

    const result =
      $("tracking-page-result");


    if (!result) {
      return;
    }


    const id =
      String(
        trackingId || ""
      ).trim();


    if (!id) {

      result.innerHTML = `
        <div
          class="panel"
          style="margin-top:16px;"
        >

          <div class="table-state">

            <span class="empty-icon">
              ⚠
            </span>

            <p>
              Enter a tracking ID
            </p>

            <span>
              Enter a valid tracking ID to continue.
            </span>

          </div>

        </div>
      `;

      return;
    }


    result.innerHTML = `
      <div
        class="panel"
        style="margin-top:16px;"
      >

        <div class="table-state">

          <div class="spinner"></div>

          <span>
            Looking up shipment…
          </span>

        </div>

      </div>
    `;


    try {

      const shipment =
        await trackShipmentById(
          id
        );


      result.innerHTML = `
        <div
          class="panel"
          style="margin-top:16px;"
        >

          ${trackingResultMarkup(
            shipment
          )}

        </div>
      `;

    } catch (error) {

      result.innerHTML = `
        <div
          class="panel"
          style="margin-top:16px;"
        >

          <div class="table-state">

            <span class="empty-icon">
              ⚠
            </span>

            <p>
              Couldn't find that shipment
            </p>

            <span>
              ${escapeHtml(
                error.message ||
                  "Please check the tracking ID and try again."
              )}
            </span>

          </div>

        </div>
      `;
    }
  }


  /* ============================================================
     DRIVER SEARCH
     ============================================================ */


  function filterDrivers() {

    const input =
      $("driver-search-input");


    if (!input) {
      return;
    }


    driverSearchTerm =
      input.value.trim();


    renderDrivers();
  }


  /* ============================================================
     SHIPMENT SEARCH
     ============================================================ */


  function filterShipments() {

    const input =
      $("shipment-search-input");


    if (!input) {
      return;
    }


    shipmentSearchTerm =
      input.value.trim();


    renderShipmentsTable();
  }


  /* ============================================================
     PROTECTED ACTION GUARDS
     ============================================================ */


  function requireAuthenticatedUser(
    action
  ) {

    if (isGuest()) {

      showToast(
        `${action} is unavailable in Guest Mode. Sign in to continue.`,
        "info"
      );

      return false;
    }


    if (!state.token) {

      showToast(
        "Please sign in to continue.",
        "error"
      );

      showLogin();

      return false;
    }


    return true;
  }


  function guardGuestButton(
    button,
    action
  ) {

    if (!button) {
      return false;
    }


    if (!isGuest()) {
      return true;
    }


    showToast(
      `${action} is available after signing in.`,
      "info"
    );


    return false;
  }


  /* ============================================================
     MODAL FORM HELPERS
     ============================================================ */


  function resetCreateShipmentForm() {

    const form =
      $("create-shipment-form");


    if (form) {
      form.reset();
    }


    hideFieldError(
      "create-shipment-error"
    );
  }


  function resetCreateDriverForm() {

    const form =
      $("create-driver-form");


    if (form) {
      form.reset();
    }


    hideFieldError(
      "create-driver-error"
    );
  }


  /* ============================================================
     CREATE SHIPMENT SUBMIT HANDLER
     ============================================================ */


  async function handleCreateShipmentSubmit(
    event
  ) {

    event.preventDefault();


    if (
      !requireAuthenticatedUser(
        "Creating shipments"
      )
    ) {
      return;
    }


    hideFieldError(
      "create-shipment-error"
    );


    const form =
      event.currentTarget;


    const button =
      $("create-shipment-submit-btn");


    const formData =
      new FormData(form);


    setButtonLoading(
      button,
      true
    );


    try {

      await submitCreateShipment(
        formData
      );


      closeModal(
        "create-shipment-modal"
      );


      resetCreateShipmentForm();


      showToast(
        "Shipment created successfully.",
        "success"
      );


      await loadShipments();
      await loadDashboard();


    } catch (error) {

      console.error(
        "Create shipment error:",
        error
      );


      showFieldError(
        "create-shipment-error",
        error.message ||
          "Could not create the shipment."
      );

    } finally {

      setButtonLoading(
        button,
        false
      );
    }
  }


  /* ============================================================
     CREATE DRIVER SUBMIT HANDLER
     ============================================================ */


  async function handleCreateDriverSubmit(
    event
  ) {

    event.preventDefault();


    if (
      !requireAuthenticatedUser(
        "Adding drivers"
      )
    ) {
      return;
    }


    hideFieldError(
      "create-driver-error"
    );


    const form =
      event.currentTarget;


    const button =
      $("create-driver-submit-btn");


    const formData =
      new FormData(form);


    setButtonLoading(
      button,
      true
    );


    try {

      await submitCreateDriver(
        formData
      );


      closeModal(
        "create-driver-modal"
      );


      resetCreateDriverForm();


      showToast(
        "Driver added successfully.",
        "success"
      );


      await loadDrivers();


    } catch (error) {

      console.error(
        "Create driver error:",
        error
      );


      showFieldError(
        "create-driver-error",
        error.message ||
          "Could not add the driver."
      );

    } finally {

      setButtonLoading(
        button,
        false
      );
    }
  }


  /* ============================================================
     NAVIGATION EVENTS
     ============================================================ */


  function handleNavigationClick(
    event
  ) {

    const button =
      event.currentTarget;


    const page =
      button.dataset.page;


    if (!page) {
      return;
    }


    setActivePage(
      page
    );
  }


  /* ============================================================
     LOGIN HANDLER
     ============================================================ */


  async function handleLoginSubmit(
    event
  ) {

    event.preventDefault();


    hideLoginError();


    const emailInput =
      $("login-email");


    const passwordInput =
      $("login-password");


    const submitButton =
      $("login-submit-btn");


    const email =
      emailInput
        ? emailInput.value.trim()
        : "";


    const password =
      passwordInput
        ? passwordInput.value
        : "";


    if (!email) {

      showFieldError(
        "login-error",
        "Enter your email address."
      );

      return;
    }


    if (!password) {

      showFieldError(
        "login-error",
        "Enter your password."
      );

      return;
    }


    setButtonLoading(
      submitButton,
      true
    );


    try {

      await login(
        email,
        password
      );


    } catch (error) {

      console.error(
        "Login error:",
        error
      );


      clearSession();


      showFieldError(
        "login-error",
        error.message ||
          "Unable to sign in right now."
      );

    } finally {

      setButtonLoading(
        submitButton,
        false
      );
    }
  }


  /* ============================================================
     GUEST ENTRY HANDLER
     ============================================================ */


  function handleGuestMode() {

    const button =
      $("guest-mode-btn");


    if (button) {
      setButtonLoading(
        button,
        true
      );
    }


    /*
     * A guest session has no JWT and no
     * database account.
     */
    clearSession();


    state.guest =
      true;


    localStorage.setItem(
      GUEST_KEY,
      "true"
    );


    state.user = {
      full_name: "Guest Viewer",
      email: "Demo Mode"
    };


    cloneGuestData();


    state.currentPage =
      "dashboard";


    showApp();


    if (button) {

      window.setTimeout(
        () => {
          setButtonLoading(
            button,
            false
          );
        },
        250
      );
    }
  }


  /* ============================================================
     PASSWORD VISIBILITY
     ============================================================ */


  function togglePasswordVisibility() {

    const input =
      $("login-password");


    const button =
      $("toggle-password-btn");


    if (!input || !button) {
      return;
    }


    const shouldShow =
      input.type === "password";


    input.type =
      shouldShow
        ? "text"
        : "password";


    button.textContent =
      shouldShow
        ? "Hide"
        : "Show";


    button.setAttribute(
      "aria-label",
      shouldShow
        ? "Hide password"
        : "Show password"
    );
  }


  /* ============================================================
     GLOBAL SEARCH
     ============================================================ */


  function handleGlobalSearchSubmit(
    event
  ) {

    event.preventDefault();


    const input =
      $("global-search-input");


    if (!input) {
      return;
    }


    performGlobalSearch(
      input.value
    );
  }


  /* ============================================================
     QUICK TRACK SUBMIT
     ============================================================ */


  function handleQuickTrackSubmit(
    event
  ) {

    event.preventDefault();


    const input =
      $("quick-track-input");


    if (!input) {
      return;
    }


    runQuickTrack(
      input.value
    );
  }


  /* ============================================================
     TRACKING PAGE SUBMIT
     ============================================================ */


  function handleTrackingSubmit(
    event
  ) {

    event.preventDefault();


    const input =
      $("tracking-input");


    if (!input) {
      return;
    }


    runPageTrack(
      input.value
    );
  }


  /* ============================================================
     LOGOUT / GUEST EXIT
     ============================================================ */


  function handleLogout() {

    if (isGuest()) {

      clearAllSessionData();

      showLogin();

      showToast(
        "Guest demo ended.",
        "info"
      );

      return;
    }


    logout();
  }


  /* ============================================================
     REFRESH BUTTONS
     ============================================================ */


  async function handleShipmentsRefresh() {

    if (isGuest()) {

      cloneGuestData();

      renderShipmentsTable();
      renderDashboard();

      showToast(
        "Demo shipments refreshed.",
        "info"
      );

      return;
    }


    try {

      await loadShipments();

      showToast(
        "Shipments refreshed.",
        "success"
      );

    } catch (error) {

      showToast(
        error.message ||
          "Unable to refresh shipments.",
        "error"
      );
    }
  }


  async function handleDriversRefresh() {

    if (isGuest()) {

      state.drivers =
        GUEST_DRIVERS.map(
          (driver) => ({
            ...driver
          })
        );

      renderDrivers();

      showToast(
        "Demo drivers refreshed.",
        "info"
      );

      return;
    }


    try {

      await loadDrivers();

      showToast(
        "Drivers refreshed.",
        "success"
      );

    } catch (error) {

      showToast(
        error.message ||
          "Unable to refresh drivers.",
        "error"
      );
    }
  }


  async function handleNotificationsRefresh() {

    if (isGuest()) {

      cloneGuestData();

      renderNotifications();

      updateNotificationBadges(
        state.unreadCount
      );

      showToast(
        "Demo notifications refreshed.",
        "info"
      );

      return;
    }


    try {

      await loadNotificationsPage();

      await refreshNotificationBadge();

      showToast(
        "Notifications refreshed.",
        "success"
      );

    } catch (error) {

      showToast(
        error.message ||
          "Unable to refresh notifications.",
        "error"
      );
    }
  }


  /* ============================================================
     MOBILE NAVIGATION
     ============================================================ */


  function toggleMobileSidebar() {

    if (
      state.mobileSidebarOpen
    ) {

      closeMobileSidebar();

    } else {

      openMobileSidebar();

    }
  }


  /* ============================================================
     EVENT DELEGATION
     ============================================================ */


  function handleDocumentClick(
    event
  ) {

    const trackingButton =
      event.target.closest(
        "[data-track-id]"
      );


    if (
      trackingButton
    ) {

      const trackingId =
        trackingButton.dataset.trackId;


      if (trackingId) {

        openTrackingModal(
          trackingId
        );

      }

      return;
    }


    const pageButton =
      event.target.closest(
        "[data-page]"
      );


    if (
      pageButton &&
      pageButton.classList.contains(
        "nav-item"
      )
    ) {

      setActivePage(
        pageButton.dataset.page
      );

    }
  }


  /* ============================================================
     KEYBOARD HANDLING
     ============================================================ */


  function handleKeyboard(
    event
  ) {

    if (
      event.key === "Escape"
    ) {

      closeAllModals();

      closeMobileSidebar();

    }


    if (
      event.key === "/" &&
      document.activeElement?.tagName !==
        "INPUT" &&
      document.activeElement?.tagName !==
        "TEXTAREA"
    ) {

      const search =
        $("global-search-input");


      if (search) {

        event.preventDefault();

        search.focus();

      }
    }
  }


  /* ============================================================
     SETUP EVENT LISTENERS
     ============================================================ */


  function setupEventListeners() {

    const loginForm =
      $("login-form");


    if (loginForm) {

      loginForm.addEventListener(
        "submit",
        handleLoginSubmit
      );

    }


    const guestButton =
      $("guest-mode-btn");


    if (guestButton) {

      guestButton.addEventListener(
        "click",
        handleGuestMode
      );

    }


    const passwordButton =
      $("toggle-password-btn");


    if (passwordButton) {

      passwordButton.addEventListener(
        "click",
        togglePasswordVisibility
      );

    }


    const logoutButton =
      $("logout-btn");


    if (logoutButton) {

      logoutButton.addEventListener(
        "click",
        handleLogout
      );

    }


    /* Navigation */

    document
      .querySelectorAll(
        ".nav-item"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            handleNavigationClick
          );

        }
      );


    /* Global search */

    const globalSearchForm =
      $("global-search-form");


    if (globalSearchForm) {

      globalSearchForm.addEventListener(
        "submit",
        handleGlobalSearchSubmit
      );

    }


    /* Quick tracking */

    const quickTrackForm =
      $("quick-track-form");


    if (quickTrackForm) {

      quickTrackForm.addEventListener(
        "submit",
        handleQuickTrackSubmit
      );

    }


    /* Tracking page */

    const trackingForm =
      $("tracking-form");


    if (trackingForm) {

      trackingForm.addEventListener(
        "submit",
        handleTrackingSubmit
      );

    }


    /* Shipment search */

    const shipmentSearch =
      $("shipment-search-input");


    if (shipmentSearch) {

      shipmentSearch.addEventListener(
        "input",
        debounce(
          filterShipments,
          200
        )
      );

    }


    /* Driver search */

    const driverSearch =
      $("driver-search-input");


    if (driverSearch) {

      driverSearch.addEventListener(
        "input",
        debounce(
          filterDrivers,
          200
        )
      );

    }


    /* Shipment refresh */

    const shipmentRefresh =
      $("shipments-refresh-btn");


    if (shipmentRefresh) {

      shipmentRefresh.addEventListener(
        "click",
        handleShipmentsRefresh
      );

    }


    /* Driver refresh */

    const driverRefresh =
      $("drivers-refresh-btn");


    if (driverRefresh) {

      driverRefresh.addEventListener(
        "click",
        handleDriversRefresh
      );

    }


    /* Notification refresh */

    const notificationRefresh =
      $("notifications-refresh-btn");


    if (notificationRefresh) {

      notificationRefresh.addEventListener(
        "click",
        handleNotificationsRefresh
      );

    }


    /* New shipment */

    const newShipment =
      $("new-shipment-btn");


    if (newShipment) {

      newShipment.addEventListener(
        "click",
        () => {

          if (
            !requireAuthenticatedUser(
              "Creating shipments"
            )
          ) {
            return;
          }

          resetCreateShipmentForm();

          openModal(
            "create-shipment-modal"
          );

        }
      );

    }


    /* New driver */

    const newDriver =
      $("new-driver-btn");


    if (newDriver) {

      newDriver.addEventListener(
        "click",
        () => {

          if (
            !requireAuthenticatedUser(
              "Adding drivers"
            )
          ) {
            return;
          }

          resetCreateDriverForm();

          openModal(
            "create-driver-modal"
          );

        }
      );

    }


    /* Create shipment */

    const createShipmentForm =
      $("create-shipment-form");


    if (createShipmentForm) {

      createShipmentForm.addEventListener(
        "submit",
        handleCreateShipmentSubmit
      );

    }


    /* Create driver */

    const createDriverForm =
      $("create-driver-form");


    if (createDriverForm) {

      createDriverForm.addEventListener(
        "submit",
        handleCreateDriverSubmit
      );

    }


    /* Mobile menu */

    const mobileMenu =
      $("mobile-menu-btn");


    if (mobileMenu) {

      mobileMenu.addEventListener(
        "click",
        toggleMobileSidebar
      );

    }


    const sidebarClose =
      $("sidebar-close-btn");


    if (sidebarClose) {

      sidebarClose.addEventListener(
        "click",
        closeMobileSidebar
      );

    }


    const sidebarBackdrop =
      $("sidebar-backdrop");


    if (sidebarBackdrop) {

      sidebarBackdrop.addEventListener(
        "click",
        closeMobileSidebar
      );

    }


    /* Header notification button */

    const notificationButton =
      $("header-notif-btn");


    if (notificationButton) {

      notificationButton.addEventListener(
        "click",
        () => {

          setActivePage(
            "notifications"
          );

        }
      );

    }


    /* Document delegation */

    document.addEventListener(
      "click",
      handleDocumentClick
    );


    document.addEventListener(
      "keydown",
      handleKeyboard
    );


    setupModalCloseHandlers();
  }


  /* ============================================================
     END OF PART 3
     ============================================================ */  /* ============================================================
     MODAL CLOSE HANDLERS
     ============================================================ */


  function setupModalCloseHandlers() {

    /*
     * Buttons with:
     * data-close-modal="modal-id"
     */

    document
      .querySelectorAll(
        "[data-close-modal]"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            () => {

              const modalId =
                button.dataset.closeModal;

              if (modalId) {
                closeModal(
                  modalId
                );
              }

            }
          );

        }
      );


    /*
     * Clicking outside the modal closes it.
     */

    document
      .querySelectorAll(
        ".modal-overlay"
      )
      .forEach(
        (overlay) => {

          overlay.addEventListener(
            "click",
            (event) => {

              if (
                event.target ===
                overlay
              ) {

                closeModal(
                  overlay.id
                );

              }

            }
          );

        }
      );
  }


  /* ============================================================
     PAGE VISIBILITY HELPERS
     ============================================================ */


  function hideElement(
    id
  ) {

    const element =
      $(id);

    if (element) {
      element.hidden = true;
    }
  }


  function showElement(
    id
  ) {

    const element =
      $(id);

    if (element) {
      element.hidden = false;
    }
  }


  /* ============================================================
     ERROR STATE HELPERS
     ============================================================ */


  function clearApplicationErrors() {

    [
      "login-error",
      "create-shipment-error",
      "create-driver-error",
      "shipments-error",
      "drivers-error",
      "notifications-error"
    ]
      .forEach(
        (id) => {
          const element =
            $(id);

          if (element) {
            element.hidden = true;
            element.textContent = "";
          }
        }
      );
  }


  /* ============================================================
     GUEST INTERFACE
     ============================================================ */


  function prepareGuestInterface() {

    if (!isGuest()) {
      return;
    }


    state.user = {
      full_name: "Guest Viewer",
      email: "Demo Mode"
    };


    cloneGuestData();


    /*
     * Make sure guest controls stay disabled.
     */

    updateGuestUI();


    /*
     * Make guest identity obvious.
     */

    const sidebarName =
      $("sidebar-user-name");

    const sidebarEmail =
      $("sidebar-user-email");

    const sidebarAvatar =
      $("sidebar-user-avatar");

    const headerAvatar =
      $("header-user-avatar");


    if (sidebarName) {
      sidebarName.textContent =
        "Guest Viewer";
    }


    if (sidebarEmail) {
      sidebarEmail.textContent =
        "Read-only demo";
    }


    if (sidebarAvatar) {
      sidebarAvatar.textContent =
        "GV";
    }


    if (headerAvatar) {
      headerAvatar.textContent =
        "GV";
    }


    const badge =
      $("guest-mode-badge");


    if (badge) {

      badge.hidden = false;

      badge.textContent =
        "DEMO MODE · READ ONLY";

    }
  }


  /* ============================================================
     NORMAL USER INTERFACE
     ============================================================ */


  function prepareAuthenticatedInterface() {

    if (isGuest()) {
      return;
    }


    updateUserUI();

    updateGuestUI();

    const badge =
      $("guest-mode-badge");


    if (badge) {
      badge.hidden = true;
    }
  }


  /* ============================================================
     REFRESH CURRENT PAGE
     ============================================================ */


  async function refreshCurrentPage() {

    switch (
      state.currentPage
    ) {

      case "dashboard":

        if (isGuest()) {
          renderDashboard();
        } else {
          await loadDashboard();
        }

        break;


      case "shipments":

        if (isGuest()) {
          renderShipmentsTable();
        } else {
          await loadShipments();
        }

        break;


      case "drivers":

        if (isGuest()) {
          renderDrivers();
        } else {
          await loadDrivers();
        }

        break;


      case "notifications":

        if (isGuest()) {
          renderNotifications();
        } else {
          await loadNotificationsPage();
        }

        break;


      case "tracking":

        /*
         * Tracking is user initiated.
         * Do not automatically run a search.
         */

        break;


      default:

        state.currentPage =
          "dashboard";

        setActivePage(
          "dashboard"
        );

        break;
    }
  }


  /* ============================================================
     APPLICATION INITIALIZATION
     ============================================================ */


  async function init() {

    /*
     * Wire all click, submit, search,
     * keyboard and modal events.
     */

    setupEventListeners();


    /*
     * Clear stale error messages.
     */

    clearApplicationErrors();


    /*
     * Restore Guest Mode first.
     *
     * This prevents a guest user from
     * being redirected to the login page
     * after refreshing the browser.
     */

    if (
      localStorage.getItem(
        GUEST_KEY
      ) === "true"
    ) {

      const restored =
        restoreGuestMode();


      if (restored) {

        prepareGuestInterface();

        state.currentPage =
          "dashboard";

        showApp();

        renderDashboard();

        return;
      }
    }


    /*
     * Restore authenticated session.
     */

    const savedToken =
      localStorage.getItem(
        TOKEN_KEY
      );


    if (!savedToken) {

      state.token = null;

      state.guest = false;

      showLogin();

      return;
    }


    state.token =
      savedToken;

    state.guest = false;


    try {

      /*
       * Validate the saved token
       * against the backend.
       */

      await loadCurrentUser();


      prepareAuthenticatedInterface();


      state.currentPage =
        "dashboard";


      showApp();


      await loadInitialApplicationData();


    } catch (error) {

      console.error(
        "Session restoration failed:",
        error
      );


      clearAllSessionData();

      showLogin();


      showToast(
        "Your session has expired. Please sign in again.",
        "error"
      );
    }
  }


  /* ============================================================
     CONNECTION / API STATUS
     ============================================================ */


  async function checkSystemStatus() {

    const dot =
      $("system-status-dot");

    const text =
      $("system-status-text");


    if (!dot || !text) {
      return;
    }


    /*
     * Guest mode doesn't need a backend
     * request for basic demo functionality.
     */

    if (isGuest()) {

      dot.classList.remove(
        "status-dot-error"
      );

      dot.classList.add(
        "status-dot-ok"
      );

      text.textContent =
        "Demo environment";

      return;
    }


    try {

      /*
       * Use a lightweight authenticated
       * endpoint to verify the API.
       */

      await apiRequest(
        "/api/v1/auth/me",
        {
          method: "GET"
        }
      );


      dot.classList.remove(
        "status-dot-error"
      );

      dot.classList.add(
        "status-dot-ok"
      );

      text.textContent =
        "All systems operational";


    } catch (error) {

      dot.classList.remove(
        "status-dot-ok"
      );

      dot.classList.add(
        "status-dot-error"
      );

      text.textContent =
        "Connection issue";
    }
  }


  /* ============================================================
     SAFE PERIODIC REFRESH
     ============================================================ */


  let refreshTimer = null;


  function startPeriodicRefresh() {

    stopPeriodicRefresh();


    /*
     * Don't continuously call protected
     * endpoints during Guest Mode.
     */

    if (isGuest()) {
      return;
    }


    refreshTimer =
      window.setInterval(
        async () => {

          /*
           * Don't refresh while the user is
           * actively inside a modal.
           */

          const openModalElement =
            document.querySelector(
              ".modal-overlay:not([hidden])"
            );


          if (openModalElement) {
            return;
          }


          try {

            if (
              state.currentPage ===
              "dashboard"
            ) {

              await loadDashboard();

            } else if (
              state.currentPage ===
              "notifications"
            ) {

              await loadNotificationsPage();

              await refreshNotificationBadge();

            }

          } catch (error) {

            console.debug(
              "Periodic refresh skipped:",
              error
            );

          }

        },
        60000
      );
  }


  function stopPeriodicRefresh() {

    if (refreshTimer !== null) {

      window.clearInterval(
        refreshTimer
      );

      refreshTimer =
        null;
    }
  }


  /* ============================================================
     WINDOW VISIBILITY
     ============================================================ */


  document.addEventListener(
    "visibilitychange",
    async () => {

      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }


      if (
        !document.body.classList.contains(
          "app-active"
        )
      ) {
        return;
      }


      try {

        await refreshCurrentPage();

        await checkSystemStatus();

      } catch (error) {

        console.debug(
          "Visibility refresh skipped:",
          error
        );
      }
    }
  );


  /* ============================================================
     STARTUP
     ============================================================ */


  document.addEventListener(
    "DOMContentLoaded",
    async () => {

      try {

        await init();

        await checkSystemStatus();

        startPeriodicRefresh();

      } catch (error) {

        console.error(
          "ParcelPilot initialization error:",
          error
        );

        clearAllSessionData();

        showLogin();

        showToast(
          "ParcelPilot could not initialize correctly.",
          "error"
        );
      }

    }
  );


  /* ============================================================
     CLEANUP
     ============================================================ */


  window.addEventListener(
    "beforeunload",
    () => {

      stopPeriodicRefresh();

      closeAllModals();

    }
  );


  /* ============================================================
     EXPOSE SAFE DEBUG HELPERS
     ============================================================ */


  /*
   * These are intentionally read-only helpers.
   * They are useful during development but do
   * not expose authentication tokens.
   */

  window.ParcelPilot =
    Object.freeze({

      getState: () => ({
        guest: state.guest,

        currentPage:
          state.currentPage,

        shipmentCount:
          state.shipments.length,

        driverCount:
          state.drivers.length,

        notificationCount:
          state.notifications.length

      }),

      enterGuestMode: () => {

        handleGuestMode();

      },

      logout: () => {

        handleLogout();

      },

      track: (trackingId) => {

        if (
          trackingId
        ) {

          openTrackingModal(
            trackingId
          );

        }

      }

    });


  /* ============================================================
     END OF PARCELPILOT APPLICATION
     ============================================================ */

})();
