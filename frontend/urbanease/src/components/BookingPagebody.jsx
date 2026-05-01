import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const BASE = "https://urban-ease-theta.vercel.app";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function safeParse(val, fallback) {
  if (val === null || val === undefined) return fallback;
  if (Array.isArray(fallback) && Array.isArray(val)) return val;
  if (!Array.isArray(fallback) && typeof val === "object" && !Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function formatAmount(amount) {
  return Number(amount || 0).toLocaleString("en-IN");
}

function formatDate(str) {
  if (!str) return "";
  return new Date(str).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Convert "07:00 PM" → "19:00"
function convertTo24(timeStr) {
  if (!timeStr) return "00:00";
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Cancellable if:
 *  - status is not already "cancelled"
 *  - earliest slot is MORE than 24 hrs from now
 */
function isCancellable(slots, status) {
  if (status === "cancelled") return false;
  const slotsMap = safeParse(slots, {});
  const slotList = Object.values(slotsMap);
  if (slotList.length === 0) return false;

  const now = new Date();
  const earliest = slotList.reduce((min, s) => {
    const d = new Date(`${s.date}T${convertTo24(s.time)}`);
    return d < min ? d : min;
  }, new Date("9999-12-31"));

  const hoursUntil = (earliest - now) / (1000 * 60 * 60);
  return hoursUntil > 24;
}

const STATUS_COLORS = {
  paid:      { bg: "#DCFCE7", text: "#15803D" },
  pending:   { bg: "#FEF9C3", text: "#A16207" },
  failed:    { bg: "#FEE2E2", text: "#B91C1C" },
  cancelled: { bg: "#F3F4F6", text: "#6B7280" },
};

function getStatusStyle(status) {
  return STATUS_COLORS[status?.toLowerCase()] || STATUS_COLORS.cancelled;
}

// ─────────────────────────────────────────────────────────────
// CANCEL MODAL
// ─────────────────────────────────────────────────────────────

function CancelModal({ order, onConfirm, onClose, loading }) {
  return (
    <div style={styles.modalOverlay} onClick={() => !loading && onClose()}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalIcon}>⚠️</div>
        <div style={styles.modalTitle}>Cancel Booking?</div>
        <div style={styles.modalBody}>
          Are you sure you want to cancel booking{" "}
          <b style={{ fontFamily: "monospace", fontSize: 12 }}>
            {order.razorpay_order_id}
          </b>
          ?
          <span style={styles.modalNote}>
            This action cannot be undone. Refunds (if applicable) are subject
            to our cancellation policy.
          </span>
        </div>

        <div style={styles.modalActions}>
          <button
            style={styles.btnGhost}
            onClick={onClose}
            disabled={loading}
          >
            Keep Booking
          </button>
          <button
            style={{ ...styles.btnDanger, opacity: loading ? 0.65 : 1 }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Cancelling…" : "Yes, Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BOOKING CARD
// ─────────────────────────────────────────────────────────────

function BookingCard({ order, onCancelRequest }) {
  const address  = safeParse(order.address, {});
  const slotsMap = safeParse(order.slots, {});
  const cart     = safeParse(order.cart, []);
  const slots    = Object.values(slotsMap);

  const fullAddress = [address.house_flat, address.landmark, address.full_address]
    .filter(Boolean)
    .join(", ");

  const statusStyle = getStatusStyle(order.status);
  const cancellable = isCancellable(order.slots, order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <div style={{ ...styles.card, opacity: isCancelled ? 0.6 : 1 }}>

      {/* ── HEADER ── */}
      <div style={styles.cardHeader}>
        <span style={styles.orderId}>{order.razorpay_order_id}</span>
        <span style={{ ...styles.statusBadge, background: statusStyle.bg, color: statusStyle.text }}>
          {order.status?.toUpperCase()}
        </span>
      </div>

      {/* ── AMOUNT ── */}
      <div style={styles.amount}>₹{formatAmount(order.amount)}</div>

      {/* ── META ── */}
      <div style={styles.metaRow}>
        <span style={styles.metaIcon}>🕐</span>
        <span style={styles.metaText}>{formatDate(order.created_at)}</span>
      </div>
      <div style={styles.metaRow}>
        <span style={styles.metaIcon}>📍</span>
        <span style={styles.metaText}>{fullAddress || "No address available"}</span>
      </div>

      <div style={styles.divider} />

      {/* ── SLOTS ── */}
      {slots.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>SCHEDULED FOR</div>
          {slots.map((s, i) => (
            <div key={i} style={styles.slotRow}>
              <span style={styles.slotDot} />
              <div>
                <div style={styles.slotGroup}>{s.group}</div>
                <div style={styles.slotLabel}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CART ── */}
      {cart.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>SERVICES</div>
          {cart.map((item, idx) => {
            const bullets   = safeParse(item.bullets, []);
            const lineTotal = (item.cart_price || 0) * (item.qty || 1);
            return (
              <div key={item.id || idx} style={styles.itemCard}>
                <div style={styles.itemRow}>
                  <div style={styles.itemLeft}>
                    {item.qty > 1 && <span style={styles.qtyBadge}>{item.qty}×</span>}
                    <span style={styles.itemTitle}>{item.title}</span>
                  </div>
                  <div style={styles.itemPrice}>₹{lineTotal.toLocaleString("en-IN")}</div>
                </div>
                {bullets.length > 0 && (
                  <ul style={styles.bulletList}>
                    {bullets.map((b, i) => {
                      const text = typeof b === "string" ? b : b?.label || b?.desc || "";
                      return <li key={i} style={styles.bulletItem}>{text}</li>;
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CANCEL BUTTON ── */}
      {cancellable && (
        <button style={styles.cancelBtn} onClick={() => onCancelRequest(order)}>
          Cancel Booking
        </button>
      )}

      {/* ── WINDOW PASSED NOTE ── */}
      {!isCancelled && !cancellable && slots.length > 0 && (
        <div style={styles.noCancelNote}>
          ⏳ Cannot cancel — within 24 hrs of appointment
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{ ...styles.card }}>
      <div style={{ ...styles.skeletonLine, width: "55%", height: 12, marginBottom: 16 }} />
      <div style={{ ...styles.skeletonLine, width: "30%", height: 28, marginBottom: 10 }} />
      <div style={{ ...styles.skeletonLine, width: "80%", height: 11, marginBottom: 6  }} />
      <div style={{ ...styles.skeletonLine, width: "65%", height: 11, marginBottom: 18 }} />
      <div style={{ ...styles.skeletonLine, width: "100%", height: 1,  marginBottom: 14 }} />
      <div style={{ ...styles.skeletonLine, width: "40%", height: 11, marginBottom: 8  }} />
      <div style={{ ...styles.skeletonLine, width: "70%", height: 14 }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function BookingPageBody() {
  const [orders,        setOrders]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [cancelTarget,  setCancelTarget]  = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [authUser,      setAuthUser]      = useState(null);

  useEffect(() => {
    const auth  = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }
      setAuthUser(user);
      try {
        const token = await user.getIdToken();
        const res   = await fetch(`${BASE}/api/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setOrders(json.data || []);
      } catch (err) {
        console.error("Failed to fetch orders:", err);
        setError("Could not load your bookings. Please try again.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  async function handleConfirmCancel() {
    if (!cancelTarget || !authUser) return;
    setCancelLoading(true);
    try {
      const token = await authUser.getIdToken();
      const res   = await fetch(`${BASE}/api/orders/${cancelTarget.razorpay_order_id}/cancel`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${res.status}`);
      }
      // Optimistically update UI
      setOrders((prev) =>
        prev.map((o) => o.id === cancelTarget.id ? { ...o, status: "cancelled" } : o)
      );
      setCancelTarget(null);
    } catch (err) {
      console.error("Cancel failed:", err);
      alert(`Cancellation failed: ${err.message}`);
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>
        My Bookings
        {!loading && <span style={styles.headingCount}>{orders.length}</span>}
      </h2>

      {loading && <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>}

      {!loading && error && <div style={styles.errorBox}>{error}</div>}

      {!loading && !error && orders.length === 0 && (
        <div style={styles.emptyBox}>
          <div style={styles.emptyIcon}>📋</div>
          <div style={styles.emptyText}>No bookings yet</div>
          <div style={styles.emptySubtext}>Your completed bookings will appear here.</div>
        </div>
      )}

      {!loading && !error && orders.map((o) => (
        <BookingCard key={o.id} order={o} onCancelRequest={setCancelTarget} />
      ))}

      {cancelTarget && (
        <CancelModal
          order={cancelTarget}
          onConfirm={handleConfirmCancel}
          onClose={() => !cancelLoading && setCancelTarget(null)}
          loading={cancelLoading}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = {
  page: {
    padding: "20px 16px 40px",
    background: "#F5F5F3",
    minHeight: "100vh",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    maxWidth: 600,
    margin: "0 auto",
  },
  heading: {
    fontSize: 22, fontWeight: 700, color: "#111",
    marginBottom: 18, display: "flex", alignItems: "center", gap: 10,
  },
  headingCount: {
    fontSize: 13, fontWeight: 600, background: "#E0E0E0",
    color: "#555", borderRadius: 20, padding: "2px 10px",
  },
  card: {
    background: "#fff", borderRadius: 16, padding: "16px 16px 18px",
    marginBottom: 14, border: "1px solid #EBEBEB",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "opacity 0.3s",
  },
  cardHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  orderId: { fontSize: 10, color: "#B0B0B0", fontFamily: "monospace", letterSpacing: "0.02em" },
  statusBadge: { fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", padding: "4px 10px", borderRadius: 20 },
  amount: { fontSize: 28, fontWeight: 800, color: "#111", marginBottom: 10, letterSpacing: "-0.5px" },
  metaRow: { display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 5 },
  metaIcon: { fontSize: 12, flexShrink: 0, marginTop: 1 },
  metaText: { fontSize: 12, color: "#666", lineHeight: 1.4 },
  divider: { height: 1, background: "#F0F0F0", margin: "14px 0" },
  section: { marginBottom: 14 },
  sectionLabel: { fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "#AAAAAA", marginBottom: 8 },
  slotRow: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  slotDot: { width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", flexShrink: 0, marginTop: 4 },
  slotGroup: { fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 1 },
  slotLabel: { fontSize: 12, color: "#777" },
  itemCard: { background: "#F9F9F8", borderRadius: 10, padding: "10px 12px", marginBottom: 8 },
  itemRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  itemLeft: { display: "flex", alignItems: "flex-start", gap: 6, flex: 1 },
  qtyBadge: {
    fontSize: 11, fontWeight: 700, background: "#E8E8E8", color: "#555",
    borderRadius: 6, padding: "1px 5px", flexShrink: 0, marginTop: 1,
  },
  itemTitle: { fontSize: 13, fontWeight: 600, color: "#222", lineHeight: 1.35 },
  itemPrice: { fontSize: 13, fontWeight: 700, color: "#111", flexShrink: 0 },
  bulletList: { margin: "6px 0 0 0", padding: "0 0 0 4px", listStyle: "none" },
  bulletItem: { fontSize: 11, color: "#888", marginBottom: 2, paddingLeft: 10, position: "relative", lineHeight: 1.4 },

  // Cancel
  cancelBtn: {
    marginTop: 12, width: "100%", padding: "10px 0",
    border: "1.5px solid #FCA5A5", borderRadius: 10,
    background: "#FFF5F5", color: "#DC2626",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    letterSpacing: "0.01em",
  },
  noCancelNote: {
    marginTop: 12, fontSize: 11, color: "#BBB",
    textAlign: "center", padding: "8px 0 2px",
  },

  // Skeleton
  skeletonLine: {
    background: "linear-gradient(90deg, #F0F0F0 25%, #E8E8E8 50%, #F0F0F0 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite",
    borderRadius: 6,
    display: "block",
  },

  // Empty / Error
  emptyBox: { textAlign: "center", padding: "60px 20px", color: "#999" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: 600, color: "#555", marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: "#AAA" },
  errorBox: {
    background: "#FFF0F0", border: "1px solid #FED7D7", color: "#C53030",
    borderRadius: 12, padding: "16px 20px", fontSize: 13, textAlign: "center",
  },

  // Modal
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  modal: {
    background: "#fff", borderRadius: 20, padding: "28px 24px 24px",
    maxWidth: 360, width: "100%",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center",
  },
  modalIcon: { fontSize: 36, marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 10 },
  modalBody: { fontSize: 13, color: "#555", lineHeight: 1.6, marginBottom: 22 },
  modalNote: { display: "block", marginTop: 8, fontSize: 11, color: "#AAA" },
  modalActions: { display: "flex", gap: 10 },
  btnGhost: {
    flex: 1, padding: "11px 0", border: "1.5px solid #E5E5E5",
    borderRadius: 10, background: "#fff", color: "#555",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  btnDanger: {
    flex: 1, padding: "11px 0", border: "none",
    borderRadius: 10, background: "#DC2626", color: "#fff",
    fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "opacity 0.2s",
  },
};