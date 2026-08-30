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


  /* ----------------------------- STATE ----------------------------- */

  const state = {
    token: localStorage.getItem(TOKEN_KEY) || null,
    user: null,
    shipments: [],
    drivers: [],
    notifications: [],
    unreadCount: 0,
    currentPage: "dashboard"
  };


  /* ============================================================
     UTILITIES
     ============================================================ */

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
      .replace(/'/g, "&#39;");
  }


  function normalizeStatus(status) {
    if (!status) {
      return "unknown";
    }

    return String(status)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }


  function statusLabel(status) {
    if (!status) {
      return "Unknown";
    }

    return String(status)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }


  function statusColor(status) {
    const key = normalizeStatus(status);

    return STATUS_COLORS[key] ||
      STATUS_COLORS.default;
  }


  function getShipmentStatus(shipment) {
    /*
     * IMPORTANT:
     * ParcelPilot API returns current_status,
     * not status.
     */
    return shipment?.current_status ||
      shipment?.status ||
      "UNKNOWN";
  }


  function getTrackingId(shipment) {
    return shipment?.tracking_id ||
      shipment?.trackingId ||
      shipment?.id ||
      "—";
  }


  function getReceiverName(shipment) {
    return shipment?.receiver_name ||
      shipment?.receiver ||
      "—";
  }


  function getEstimatedDelivery(shipment) {
    return shipment?.estimated_delivery ||
      shipment?.eta ||
      null;
  }


  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return escapeHtml(value);
    }

    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }


  function formatDateTime(value) {
    if (!value) {
      return "—";
    }

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return escapeHtml(value);
    }

    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }


  function debounce(fn, wait) {
    let timer;

    return function (...args) {
      clearTimeout(timer);

      timer = setTimeout(() => {
        fn.apply(this, args);
      }, wait);
    };
  }


  function initials(name) {
    if (!name) {
      return "?";
    }

    const parts =
      String(name)
        .trim()
        .split(/\s+/);

    if (parts.length === 1) {
      return parts[0]
        .slice(0, 2)
        .toUpperCase();
    }

    return (
      parts[0][0] +
      parts[parts.length - 1][0]
    ).toUpperCase();
  }


  /* ============================================================
     TOASTS
     ============================================================ */

  function showToast(message, type) {
    const container =
      $("toast-container");

    if (!container) {
      return;
    }

    const toast =
      document.createElement("div");

    toast.className =
      "toast" +
      (type ? ` toast-${type}` : "");

    const icon =
      type === "success"
        ? "✓"
        : type === "error"
          ? "⚠"
          : "•";

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add(
        "toast-leaving"
      );

      setTimeout(() => {
        toast.remove();
      }, 220);

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

    if (body && typeof body === "object") {

      /*
       * ParcelPilot FastAPI error shape:
       * {
       *   "error": {
       *     "code": "...",
       *     "message": "..."
       *   }
       * }
       */

      if (
        body.error &&
        typeof body.error.message === "string"
      ) {
        return body.error.message;
      }


      if (
        body.error &&
        typeof body.error.detail === "string"
      ) {
        return body.error.detail;
      }


      if (
        typeof body.detail === "string"
      ) {
        return body.detail;
      }


      if (
        Array.isArray(body.detail)
      ) {
        return body.detail
          .map(
            (d) =>
              d.msg ||
              JSON.stringify(d)
          )
          .join("; ");
      }


      if (
        typeof body.message === "string"
      ) {
        return body.message;
      }
    }


    switch (status) {

      case 400:
        return "That request was invalid. Please check the details and try again.";

      case 401:
        return "Your session has expired. Please sign in again.";

      case 403:
        return "You don't have permission to do that.";

      case 404:
        return "The requested resource could not be found.";

      case 422:
        return "Some fields need attention. Please check the form and try again.";

      case 500:
        return "Something went wrong on the server. Please try again shortly.";

      default:
        return "Something went wrong. Please try again.";
    }
  }


  async function apiRequest(
    path,
    options = {}
  ) {

    const {
      method = "GET",
      body = null,
      formEncoded = false,
      auth = true
    } = options;


    const headers = {
      Accept: "application/json"
    };


    if (
      auth &&
      state.token
    ) {
      headers.Authorization =
        `Bearer ${state.token}`;
    }


    let fetchBody;


    if (
      body !== null &&
      body !== undefined
    ) {

      if (formEncoded) {

        headers["Content-Type"] =
          "application/x-www-form-urlencoded";

        fetchBody = body;

      } else {

        headers["Content-Type"] =
          "application/json";

        fetchBody =
          JSON.stringify(body);
      }
    }


    let response;


    try {

      response = await fetch(
        `${API_BASE}${path}`,
        {
          method,
          headers,
          body: fetchBody
        }
      );

    } catch (networkError) {

      throw new ApiError(
        "Unable to reach the server. Check your connection and try again.",
        0
      );
    }


    let data = null;

    const text =
      await response.text();


    if (text) {

      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }


    if (!response.ok) {

      if (
        response.status === 401 &&
        auth
      ) {
        handleUnauthorized();
      }


      throw new ApiError(
        buildErrorMessage(
          response.status,
          data
        ),
        response.status
      );
    }


    return data;
  }


  function handleUnauthorized() {
    clearSession();
    showLogin();

    showToast(
      "Your session has expired. Please sign in again.",
      "error"
    );
  }


  /* ============================================================
     AUTH
     ============================================================ */

  function saveToken(token) {
    state.token = token;

    localStorage.setItem(
      TOKEN_KEY,
      token
    );
  }


  function clearSession() {
    state.token = null;
    state.user = null;
    state.shipments = [];
    state.drivers = [];
    state.notifications = [];
    state.unreadCount = 0;

    localStorage.removeItem(
      TOKEN_KEY
    );
  }


  async function login(
    email,
    password
  ) {

    const params =
      new URLSearchParams();

    params.set(
      "username",
      email
    );

    params.set(
      "password",
      password
    );

    params.set(
      "grant_type",
      "password"
    );


    const data =
      await apiRequest(
        "/api/v1/auth/login",
        {
          method: "POST",
          body: params,
          formEncoded: true,
          auth: false
        }
      );


    if (
      !data ||
      !data.access_token
    ) {
      throw new ApiError(
        "Login succeeded but no access token was returned.",
        500
      );
    }


    saveToken(
      data.access_token
    );
  }


  async function fetchCurrentUser() {

    const data =
      await apiRequest(
        "/api/v1/auth/me",
        {
          method: "GET"
        }
      );

    state.user = data;

    return data;
  }


  function logout() {
    clearSession();

    showLogin();

    showToast(
      "You have been logged out.",
      "info"
    );
  }


  /* ============================================================
     SCREEN SWITCHING
     ============================================================ */

  function showLogin() {

    $("app-screen").hidden = true;
    $("login-screen").hidden = false;

    const form =
      $("login-form");

    if (form) {
      form.reset();
    }

    hideLoginError();
  }


  function showApp() {

    $("login-screen").hidden = true;
    $("app-screen").hidden = false;

    populateUserChrome();

    navigateTo(
      "dashboard"
    );

    loadDashboard();

    refreshNotificationBadge();
  }


  function populateUserChrome() {

    if (!state.user) {
      return;
    }


    const name =
      state.user.full_name ||
      state.user.name ||
      state.user.email ||
      "Operator";


    const email =
      state.user.email ||
      "";


    $("sidebar-user-name").textContent =
      name;

    $("sidebar-user-email").textContent =
      email;

    $("sidebar-user-avatar").textContent =
      initials(name);

    $("header-user-avatar").textContent =
      initials(name);
  }


  /* ============================================================
     NAVIGATION
     ============================================================ */

  const PAGE_META = {

    dashboard: {
      title: "Dashboard",
      subtitle:
        "Operational overview across every shipment."
    },

    shipments: {
      title: "Shipments",
      subtitle:
        "Every shipment in your network, searchable and current."
    },

    tracking: {
      title: "Tracking",
      subtitle:
        "Look up any shipment by its tracking ID."
    },

    drivers: {
      title: "Drivers",
      subtitle:
        "Your fleet and their current assignments."
    },

    notifications: {
      title: "Notifications",
      subtitle:
        "Alerts and updates across the platform."
    }
  };


  function navigateTo(page) {

    state.currentPage =
      page;


    document
      .querySelectorAll(".page")
      .forEach(
        (element) => {
          element.classList.add(
            "hidden"
          );
        }
      );


    const target =
      $(`page-${page}`);


    if (target) {
      target.classList.remove(
        "hidden"
      );
    }


    document
      .querySelectorAll(".nav-item")
      .forEach(
        (button) => {

          button.classList.toggle(
            "active",
            button.dataset.page === page
          );

        }
      );


    const meta =
      PAGE_META[page] ||
      {
        title: "ParcelPilot",
        subtitle: ""
      };


    $("page-title").textContent =
      meta.title;

    $("page-subtitle").textContent =
      meta.subtitle;


    closeMobileSidebar();


    if (page === "shipments") {
      loadShipments();
    }


    if (page === "drivers") {
      loadDrivers();
    }


    if (page === "notifications") {
      loadNotificationsPage();
    }
  }


  /* ============================================================
     DASHBOARD
     ============================================================ */

  async function loadDashboard() {

    setTableLoading(
      "recent-shipments-body",
      "recent-shipments-loading",
      "recent-shipments-empty",
      true
    );


    try {

      const [
        shipments,
        notifications
      ] =
        await Promise.all([

          apiRequest(
            "/api/v1/shipments?skip=0&limit=100",
            {
              method: "GET"
            }
          ),

          apiRequest(
            "/api/v1/notifications",
            {
              method: "GET"
            }
          ).catch(
            () => []
          )
        ]);


      const shipmentList =
        Array.isArray(shipments)
          ? shipments
          : (
              shipments?.items ||
              []
            );


      state.shipments =
        shipmentList;


      state.notifications =
        Array.isArray(notifications)
          ? notifications
          : (
              notifications?.items ||
              []
            );


      renderStats(
        shipmentList
      );


      renderActivityChart(
        shipmentList
      );


      renderStatusDistribution(
        shipmentList
      );


      renderRecentShipments(
        shipmentList.slice(0, 6)
      );


      renderAlerts(
        state.notifications
      );


    } catch (err) {

      showToast(
        err.message ||
        "Could not load the dashboard.",
        "error"
      );


      renderRecentShipments(
        []
      );


    } finally {

      setTableLoading(
        "recent-shipments-body",
        "recent-shipments-loading",
        "recent-shipments-empty",
        false
      );


      refreshNotificationBadge();
    }
  }


  function renderStats(
    shipments
  ) {

    const total =
      shipments.length;


    const inTransit =
      shipments.filter(
        (shipment) => {

          const status =
            normalizeStatus(
              getShipmentStatus(
                shipment
              )
            );

          return [
            "in_transit",
            "picked_up",
            "out_for_delivery"
          ].includes(status);

        }
      ).length;


    const delivered =
      shipments.filter(
        (shipment) =>
          normalizeStatus(
            getShipmentStatus(
              shipment
            )
          ) === "delivered"
      ).length;


    $("stat-total").textContent =
      total;

    $("stat-in-transit").textContent =
      inTransit;

    $("stat-delivered").textContent =
      delivered;

    $("stat-alerts").textContent =
      state.unreadCount;
  }


  function renderActivityChart(
    shipments
  ) {

    const container =
      $("activity-chart");


    if (!container) {
      return;
    }


    const buckets = [
      "created",
      "picked_up",
      "in_transit",
      "out_for_delivery",
      "delivered"
    ];


    const counts =
      buckets.map(
        (bucket) =>
          shipments.filter(
            (shipment) =>
              normalizeStatus(
                getShipmentStatus(
                  shipment
                )
              ) === bucket
          ).length
      );


    const max =
      Math.max(
        1,
        ...counts
      );


    const width = 640;
    const height = 160;
    const padding = 36;


    const stepX =
      (
        width -
        padding * 2
      ) /
      (
        buckets.length - 1
      );


    const points =
      counts.map(
        (count, index) => {

          const x =
            padding +
            index * stepX;


          const y =
            height -
            padding -
            (
              count / max
            ) *
            (
              height -
              padding * 2 -
              10
            );


          return {
            x,
            y,
            count,
            label: buckets[index]
          };
        }
      );


    const pathD =
      points
        .map(
          (point, index) =>
            index === 0
              ? `M ${point.x} ${point.y}`
              : `L ${point.x} ${point.y}`
        )
        .join(" ");


    const dots =
      points.map(
        (point) => `

          <circle
            cx="${point.x}"
            cy="${point.y}"
            r="5"
            fill="${statusColor(point.label)}"
            stroke="#fff"
            stroke-width="2"
          ></circle>

          <text
            x="${point.x}"
            y="${height - 10}"
            text-anchor="middle"
            font-size="10.5"
            fill="#98A2B3"
            font-family="Inter, sans-serif"
          >
            ${escapeHtml(
              statusLabel(point.label)
            )}
          </text>

          <text
            x="${point.x}"
            y="${point.y - 12}"
            text-anchor="middle"
            font-size="12"
            font-weight="700"
            fill="#101828"
            font-family="Inter, sans-serif"
          >
            ${point.count}
          </text>

        `
      ).join("");


    container.innerHTML = `

      <svg
        viewBox="0 0 ${width} ${height}"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Shipment activity across statuses"
      >

        <path
          d="${pathD}"
          fill="none"
          stroke="#2F6FED"
          stroke-width="2.5"
          class="route-dash"
        ></path>

        ${dots}

      </svg>


      <div class="activity-legend">

        ${buckets.map(
          (bucket) => `

            <span
              class="activity-legend-item"
            >

              <span
                class="legend-swatch"
                style="
                  background:${statusColor(
                    bucket
                  )}
                "
              ></span>

              ${escapeHtml(
                statusLabel(bucket)
              )}

            </span>

          `
        ).join("")}

      </div>
    `;
  }


  function renderStatusDistribution(
    shipments
  ) {

    const container =
      $("status-distribution");


    if (!container) {
      return;
    }


    if (!shipments.length) {

      container.innerHTML =
        `
          <div class="empty-inline">
            No shipment data to summarize yet.
          </div>
        `;

      return;
    }


    const counts = {};


    shipments.forEach(
      (shipment) => {

        const key =
          normalizeStatus(
            getShipmentStatus(
              shipment
            )
          );


        counts[key] =
          (
            counts[key] ||
            0
          ) + 1;
      }
    );


    const total =
      shipments.length;


    const entries =
      Object.entries(
        counts
      ).sort(
        (a, b) => b[1] - a[1]
      );


    const track =
      entries.map(
        ([key, count]) => `

          <span
            class="dist-bar-segment"
            style="
              width:${(
                count / total
              ) * 100}%;

              background:${statusColor(
                key
              )}
            "
          ></span>

        `
      ).join("");


    const legend =
      entries.map(
        ([key, count]) => `

          <div class="dist-legend-row">

            <span
              class="legend-swatch"
              style="
                background:${statusColor(
                  key
                )}
              "
            ></span>

            <span class="dist-legend-label">

              ${escapeHtml(
                statusLabel(key)
              )}

            </span>

            <span class="dist-legend-value">

              ${count}
              ·
              ${Math.round(
                (count / total) *
                100
              )}%

            </span>

          </div>

        `
      ).join("");


    container.innerHTML = `

      <div class="dist-bar-track">
        ${track}
      </div>

      <div class="dist-legend">
        ${legend}
      </div>

    `;
  }


  function renderRecentShipments(
    shipments
  ) {

    const body =
      $("recent-shipments-body");


    if (!body) {
      return;
    }


    body.innerHTML =
      shipments
        .map(shipmentRow)
        .join("");


    $("recent-shipments-empty").hidden =
      shipments.length !== 0;


    attachTrackButtonListeners(
      body
    );
  }


  function renderAlerts(
    notifications
  ) {

    const list =
      $("alerts-list");


    if (!list) {
      return;
    }


    const relevant =
      notifications.slice(0, 5);


    list.innerHTML =
      relevant
        .map(alertItem)
        .join("");


    $("alerts-empty").hidden =
      relevant.length !== 0;
  }


  function alertItem(notification) {

    const type =
      (
        notification.type ||
        "info"
      ).toLowerCase();


    const iconClass =
      type.includes("error") ||
      type.includes("fail")
        ? "alert-icon-danger"
        : type.includes("warn")
          ? "alert-icon-warning"
          : "alert-icon-info";


    const icon =
      iconClass ===
      "alert-icon-danger"
        ? "⚠"
        : iconClass ===
            "alert-icon-warning"
          ? "⚠"
          : "◈";


    return `

      <li class="alert-item">

        <span
          class="alert-icon ${iconClass}"
        >
          ${icon}
        </span>

        <div class="alert-body">

          <span class="alert-message">

            ${escapeHtml(
              notification.message ||
              notification.title ||
              "Notification"
            )}

          </span>

          <span class="alert-time">

            ${formatDateTime(
              notification.created_at ||
              notification.timestamp
            )}

          </span>

        </div>

      </li>

    `;
  }


  /* ============================================================
     SHIPMENTS PAGE
     ============================================================ */

  let shipmentSearchTerm = "";


  async function loadShipments() {

    setTableLoading(
      "shipments-table-body",
      "shipments-loading",
      "shipments-empty",
      true
    );


    $("shipments-error").hidden =
      true;


    try {

      const data =
        await apiRequest(
          "/api/v1/shipments?skip=0&limit=100",
          {
            method: "GET"
          }
        );


      state.shipments =
        Array.isArray(data)
          ? data
          : (
              data?.items ||
              []
            );


      renderShipmentsTable();


    } catch (err) {

      $("shipments-error").hidden =
        false;


      $("shipments-error-text").textContent =
        err.message ||
        "Something went wrong.";


      $("shipments-table-body")
        .innerHTML = "";


      $("shipments-empty").hidden =
        true;


    } finally {

      setTableLoading(
        "shipments-table-body",
        "shipments-loading",
        "shipments-empty",
        false,
        true
      );
    }
  }


  function renderShipmentsTable() {

    const term =
      shipmentSearchTerm
        .trim()
        .toLowerCase();


    const filtered =
      !term
        ? state.shipments
        : state.shipments.filter(
            (shipment) => {

              const haystack = [

                getTrackingId(
                  shipment
                ),

                getReceiverName(
                  shipment
                ),

                shipment.sender_name,

                shipment.origin,

                shipment.destination,

                getShipmentStatus(
                  shipment
                )

              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


              return haystack.includes(
                term
              );
            }
          );


    const body =
      $("shipments-table-body");


    body.innerHTML =
      filtered
        .map(shipmentRow)
        .join("");


    $("shipments-empty").hidden =
      filtered.length !== 0;


    attachTrackButtonListeners(
      body
    );
  }


  function shipmentRow(
    shipment
  ) {

    const trackingId =
      getTrackingId(
        shipment
      );


    const receiver =
      getReceiverName(
        shipment
      );


    const eta =
      getEstimatedDelivery(
        shipment
      );


    const status =
      getShipmentStatus(
        shipment
      );


    return `

      <tr>

        <td class="tracking-id-cell">

          ${escapeHtml(
            trackingId
          )}

        </td>


        <td>

          ${escapeHtml(
            shipment.origin ||
            "—"
          )}

        </td>


        <td>

          ${escapeHtml(
            shipment.destination ||
            "—"
          )}

        </td>


        <td>

          ${escapeHtml(
            receiver
          )}

        </td>


        <td>

          <span
            class="
              status-badge
              badge-${normalizeStatus(
                status
              )}
            "
          >

            ${escapeHtml(
              statusLabel(
                status
              )
            )}

          </span>

        </td>


        <td>

          ${formatDate(
            eta
          )}

        </td>


        <td>

          <button
            class="table-action-btn"
            data-track-id="${escapeHtml(
              trackingId
            )}"
            type="button"
          >
            Track
          </button>

        </td>

      </tr>

    `;
  }


  function attachTrackButtonListeners(
    scope
  ) {

    if (!scope) {
      return;
    }


    scope
      .querySelectorAll(
        "[data-track-id]"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            () =>
              openTrackingModal(
                button.dataset.trackId
              )
          );

        }
      );
  }


  function setTableLoading(
    bodyId,
    loadingId,
    emptyId,
    isLoading,
    keepBody = false
  ) {

    if (isLoading) {

      $(loadingId).hidden =
        false;

      $(emptyId).hidden =
        true;


      if (!keepBody) {
        $(bodyId).innerHTML =
          "";
      }

    } else {

      $(loadingId).hidden =
        true;
    }
  }


  /* ============================================================
     TRACKING
     ============================================================ */

  async function trackShipmentById(
    trackingId
  ) {

    const id =
      String(
        trackingId || ""
      ).trim();


    if (!id) {

      throw new ApiError(
        "Enter a tracking ID to continue.",
        400
      );
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


  function buildTrackingTimeline(
    shipment
  ) {

    const events =
      shipment.tracking_events ||
      shipment.timeline ||
      shipment.history ||
      [];


    if (
      Array.isArray(events) &&
      events.length
    ) {

      return events
        .map(
          (event, index) => {

            const eventStatus =
              event.status ||
              event.event ||
              event.current_status ||
              event.description ||
              "Update";


            return timelineItem(
              eventStatus,
              event.location,
              event.timestamp ||
                event.created_at,
              index ===
                events.length - 1
            );
          }
        )
        .join("");

    }


    /*
     * Fallback to the shipment's actual current_status.
     */

    return timelineItem(
      getShipmentStatus(
        shipment
      ),
      shipment.origin,
      shipment.updated_at ||
        shipment.created_at,
      true
    );
  }


  function timelineItem(
    eventLabel,
    location,
    timestamp,
    isFirst
  ) {

    return `

      <div
        class="
          timeline-item
          ${isFirst ? "is-first" : ""}
        "
      >

        <div class="timeline-marker">

          <span
            class="timeline-dot"
          ></span>

          <span
            class="timeline-line"
          ></span>

        </div>


        <div class="timeline-content">

          <div class="timeline-event">

            ${escapeHtml(
              statusLabel(
                eventLabel
              )
            )}

          </div>


          <div class="timeline-meta">

            ${
              location
                ? `${escapeHtml(
                    location
                  )} · `
                : ""
            }

            ${formatDateTime(
              timestamp
            )}

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


    return `

      <div class="tracking-result-card">

        <div
          class="tracking-route-summary"
        >


          <div
            class="
              tracking-route-point
            "
          >

            <span class="label">
              Origin
            </span>

            <span class="value">

              ${escapeHtml(
                shipment.origin ||
                "—"
              )}

            </span>

          </div>


          <span
            class="tracking-route-arrow"
          >
            →
          </span>


          <div
            class="
              tracking-route-point
            "
          >

            <span class="label">
              Destination
            </span>

            <span class="value">

              ${escapeHtml(
                shipment.destination ||
                "—"
              )}

            </span>

          </div>


          <div
            class="
              tracking-route-point
            "
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
            class="
              tracking-route-point
            "
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
                statusLabel(
                  status
                )
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

    openModal(
      "tracking-modal"
    );


    const body =
      $("tracking-modal-body");


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


    } catch (err) {

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
              err.message ||
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
          trackingId
        );


      result.innerHTML =
        trackingResultMarkup(
          shipment
        );


    } catch (err) {

      result.innerHTML = `

        <div class="form-error">

          ${escapeHtml(
            err.message ||
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
          trackingId
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


    } catch (err) {

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
                err.message ||
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

    $("drivers-grid").innerHTML =
      "";


    $("drivers-loading").hidden =
      false;


    $("drivers-empty").hidden =
      true;


    $("drivers-error").hidden =
      true;


    try {

      const data =
        await apiRequest(
          "/api/v1/drivers",
          {
            method: "GET"
          }
        );


      state.drivers =
        Array.isArray(data)
          ? data
          : (
              data?.items ||
              []
            );


      renderDrivers();


    } catch (err) {

      $("drivers-error").hidden =
        false;


      $("drivers-error-text").textContent =
        err.message ||
        "Something went wrong.";


    } finally {

      $("drivers-loading").hidden =
        true;
    }
  }


  function renderDrivers() {

    const term =
      driverSearchTerm
        .trim()
        .toLowerCase();


    const filtered =
      !term
        ? state.drivers
        : state.drivers.filter(
            (driver) =>
              String(
                driver.name ||
                ""
              )
              .toLowerCase()
              .includes(term)
          );


    $("drivers-grid").innerHTML =
      filtered
        .map(driverCard)
        .join("");


    $("drivers-empty").hidden =
      filtered.length !== 0;
  }


  function driverCard(
    driver
  ) {

    const name =
      driver.name ||
      "Unnamed driver";


    const status =
      driver.status ||
      "available";


    const assignedCount =
      driver.assigned_shipments_count ??
      (
        Array.isArray(
          driver.assigned_shipments
        )
          ? driver.assigned_shipments.length
          : (
              driver.active_shipments ??
              "—"
            )
      );


    return `

      <div class="driver-card">

        <div class="driver-card-top">

          <div class="driver-avatar">

            ${escapeHtml(
              initials(name)
            )}

          </div>


          <div>

            <div class="driver-name">

              ${escapeHtml(
                name
              )}

            </div>


            <div class="driver-phone">

              ${escapeHtml(
                driver.phone ||
                "No phone on file"
              )}

            </div>

          </div>

        </div>


        <div class="driver-meta-row">

          <span>
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
              statusLabel(
                status
              )
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

    `;
  }


  async function submitCreateDriver(
    formData
  ) {

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


    } catch {

      /* Badge update is optional. */

    }
  }


  function updateNotificationBadges(
    count
  ) {

    [
      $("sidebar-notif-badge"),
      $("header-notif-badge")
    ].forEach(
      (element) => {

        if (!element) {
          return;
        }


        element.textContent =
          count > 99
            ? "99+"
            : String(count);


        element.hidden =
          !count;
      }
    );


    const statValue =
      $("stat-alerts");


    if (statValue) {
      statValue.textContent =
        count;
    }
  }


  async function loadNotificationsPage() {

    $("notifications-page-list")
      .innerHTML = "";


    $("notifications-loading").hidden =
      false;


    $("notifications-empty").hidden =
      true;


    $("notifications-error").hidden =
      true;


    try {

      const data =
        await apiRequest(
          "/api/v1/notifications",
          {
            method: "GET"
          }
        );


      const notifications =
        Array.isArray(data)
          ? data
          : (
              data?.items ||
              []
            );


      state.notifications =
        notifications;


      $("notifications-page-list")
        .innerHTML =
        notifications
          .map(
            notificationRow
          )
          .join("");


      $("notifications-empty").hidden =
        notifications.length !== 0;


    } catch (err) {

      $("notifications-error").hidden =
        false;


      $("notifications-error-text")
        .textContent =
        err.message ||
        "Something went wrong.";


    } finally {

      $("notifications-loading").hidden =
        true;
    }
  }


  function notificationRow(
    notification
  ) {

    const isUnread =
      notification.is_read === false ||
      notification.read === false ||
      notification.status === "unread";


    return `

      <li
        class="
          notification-row
          ${isUnread ? "is-unread" : ""}
        "
      >

        <div class="notification-icon">
          ◈
        </div>


        <div class="notification-content">

          <div
            class="notification-top-row"
          >

            <span
              class="notification-type"
            >

              ${escapeHtml(
                notification.type ||
                "Update"
              )}

            </span>


            <span
              class="notification-time"
            >

              ${formatDateTime(
                notification.created_at ||
                notification.timestamp
              )}

            </span>

          </div>


          <div
            class="notification-message"
          >

            ${escapeHtml(
              notification.message ||
              notification.title ||
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
     MODALS
     ============================================================ */

  function openModal(id) {

    const modal =
      $(id);


    if (!modal) {
      return;
    }


    modal.hidden =
      false;


    document.body.style.overflow =
      "hidden";
  }


  function closeModal(id) {

    const modal =
      $(id);


    if (!modal) {
      return;
    }


    modal.hidden =
      true;


    document.body.style.overflow =
      "";
  }


  function setupModalCloseHandlers() {

    document
      .querySelectorAll(
        "[data-close-modal]"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            () =>
              closeModal(
                button.dataset.closeModal
              )
          );
        }
      );


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


    document.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key ===
          "Escape"
        ) {

          document
            .querySelectorAll(
              ".modal-overlay:not([hidden])"
            )
            .forEach(
              (overlay) =>
                closeModal(
                  overlay.id
                )
            );
        }
      }
    );
  }


  /* ============================================================
     FORM ERROR HELPERS
     ============================================================ */

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
      message;


    element.hidden =
      false;
  }


  function hideFieldError(
    id
  ) {

    const element =
      $(id);


    if (!element) {
      return;
    }


    element.hidden =
      true;


    element.textContent =
      "";
  }


  function hideLoginError() {
    hideFieldError(
      "login-error"
    );
  }


  function setButtonLoading(
    button,
    isLoading
  ) {

    if (!button) {
      return;
    }


    button.disabled =
      isLoading;


    const label =
      button.querySelector(
        ".btn-label"
      );


    if (label) {

      label.style.visibility =
        isLoading
          ? "hidden"
          : "visible";
    }


    const spinner =
      button.querySelector(
        ".btn-spinner"
      );


    if (spinner) {
      spinner.hidden =
        !isLoading;
    }
  }


  /* ============================================================
     MOBILE SIDEBAR
     ============================================================ */

  function openMobileSidebar() {

    $("sidebar").classList.add(
      "is-open"
    );


    $("sidebar-backdrop").hidden =
      false;
  }


  function closeMobileSidebar() {

    $("sidebar").classList.remove(
      "is-open"
    );


    $("sidebar-backdrop").hidden =
      true;
  }


  /* ============================================================
     EVENT WIRING
     ============================================================ */

  function setupEventListeners() {

    /* LOGIN */

    $("login-form")
      .addEventListener(
        "submit",
        async (event) => {

          event.preventDefault();


          hideLoginError();


          const email =
            $("login-email")
              .value
              .trim();


          const password =
            $("login-password")
              .value;


          const submitButton =
            $("login-submit-btn");


          setButtonLoading(
            submitButton,
            true
          );


          try {

            await login(
              email,
              password
            );


            await fetchCurrentUser();


            showApp();


          } catch (error) {

            if (
              error.status === 401 ||
              error.status === 400
            ) {

              showFieldError(
                "login-error",
                "Incorrect email or password."
              );

            } else {

              showFieldError(
                "login-error",
                error.message ||
                "Unable to sign in right now."
              );
            }


            clearSession();


          } finally {

            setButtonLoading(
              submitButton,
              false
            );
          }
        }
      );


    /* PASSWORD TOGGLE */

    $("toggle-password-btn")
      .addEventListener(
        "click",
        () => {

          const input =
            $("login-password");


          const button =
            $("toggle-password-btn");


          const isPassword =
            input.type ===
            "password";


          input.type =
            isPassword
              ? "text"
              : "password";


          button.textContent =
            isPassword
              ? "Hide"
              : "Show";
        }
      );


    /* LOGOUT */

    $("logout-btn")
      .addEventListener(
        "click",
        logout
      );


    /* SIDEBAR */

    document
      .querySelectorAll(
        ".nav-item"
      )
      .forEach(
        (button) => {

          button.addEventListener(
            "click",
            () =>
              navigateTo(
                button.dataset.page
              )
          );
        }
      );


    /* MOBILE */

    $("mobile-menu-btn")
      .addEventListener(
        "click",
        openMobileSidebar
      );


    $("sidebar-close-btn")
      .addEventListener(
        "click",
        closeMobileSidebar
      );


    $("sidebar-backdrop")
      .addEventListener(
        "click",
        closeMobileSidebar
      );


    /* GLOBAL SEARCH */

    $("global-search-form")
      .addEventListener(
        "submit",
        (event) => {

          event.preventDefault();


          const term =
            $("global-search-input")
              .value
              .trim();


          shipmentSearchTerm =
            term;


          $("shipment-search-input")
            .value =
            term;


          navigateTo(
            "shipments"
          );
        }
      );


    /* NOTIFICATIONS */

    $("header-notif-btn")
      .addEventListener(
        "click",
        () =>
          navigateTo(
            "notifications"
          )
      );


    /* SHIPMENTS SEARCH */

    $("shipment-search-input")
      .addEventListener(
        "input",
        debounce(
          (event) => {

            shipmentSearchTerm =
              event.target.value;


            renderShipmentsTable();

          },
          200
        )
      );


    $("shipments-refresh-btn")
      .addEventListener(
        "click",
        loadShipments
      );


    $("shipments-retry-btn")
      .addEventListener(
        "click",
        loadShipments
      );


    $("new-shipment-btn")
      .addEventListener(
        "click",
        () =>
          openModal(
            "create-shipment-modal"
          )
      );


    /* CREATE SHIPMENT */

    $("create-shipment-form")
      .addEventListener(
        "submit",
        async (event) => {

          event.preventDefault();


          hideFieldError(
            "create-shipment-error"
          );


          const form =
            event.target;


          const submitButton =
            $("create-shipment-submit-btn");


          setButtonLoading(
            submitButton,
            true
          );


          try {

            await submitCreateShipment(
              new FormData(form)
            );


            closeModal(
              "create-shipment-modal"
            );


            form.reset();


            showToast(
              "Shipment created successfully.",
              "success"
            );


            if (
              state.currentPage ===
              "shipments"
            ) {

              await loadShipments();
            }


            await loadDashboard();


          } catch (error) {

            showFieldError(
              "create-shipment-error",
              error.message ||
              "Could not create the shipment."
            );


          } finally {

            setButtonLoading(
              submitButton,
              false
            );
          }
        }
      );


    /* TRACKING PAGE */

    $("tracking-form")
      .addEventListener(
        "submit",
        (event) => {

          event.preventDefault();


          runPageTrack(
            $("tracking-input")
              .value
              .trim()
          );
        }
      );


    /* QUICK TRACK */

    $("quick-track-form")
      .addEventListener(
        "submit",
        (event) => {

          event.preventDefault();


          runQuickTrack(
            $("quick-track-input")
              .value
              .trim()
          );
        }
      );


    /* DRIVERS */

    $("driver-search-input")
      .addEventListener(
        "input",
        debounce(
          (event) => {

            driverSearchTerm =
              event.target.value;


            renderDrivers();

          },
          200
        )
      );


    $("drivers-refresh-btn")
      .addEventListener(
        "click",
        loadDrivers
      );


    $("drivers-retry-btn")
      .addEventListener(
        "click",
        loadDrivers
      );


    $("new-driver-btn")
      .addEventListener(
        "click",
        () =>
          openModal(
            "create-driver-modal"
          )
      );


    /* CREATE DRIVER */

    $("create-driver-form")
      .addEventListener(
        "submit",
        async (event) => {

          event.preventDefault();


          hideFieldError(
            "create-driver-error"
          );


          const form =
            event.target;


          const submitButton =
            $("create-driver-submit-btn");


          setButtonLoading(
            submitButton,
            true
          );


          try {

            await submitCreateDriver(
              new FormData(form)
            );


            closeModal(
              "create-driver-modal"
            );


            form.reset();


            showToast(
              "Driver added successfully.",
              "success"
            );


            await loadDrivers();


          } catch (error) {

            showFieldError(
              "create-driver-error",
              error.message ||
              "Could not add the driver."
            );


          } finally {

            setButtonLoading(
              submitButton,
              false
            );
          }
        }
      );


    /* NOTIFICATIONS */

    $("notifications-refresh-btn")
      .addEventListener(
        "click",
        async () => {

          await loadNotificationsPage();

          await refreshNotificationBadge();
        }
      );


    $("notifications-retry-btn")
      .addEventListener(
        "click",
        loadNotificationsPage
      );


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


    } catch {

      clearSession();

      showLogin();
    }
  }


  document.addEventListener(
    "DOMContentLoaded",
    init
  );

})();
