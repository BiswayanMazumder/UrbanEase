import React, { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// IMPORTANT: Load the Razorpay SDK in your index.html BEFORE this component mounts:
//   <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
//
// Expose your Razorpay KEY ID via ONE of these methods:
//   1. window.__RZP_KEY__ = "rzp_test_XXXX"   ← set in main.jsx or index.html
//   2. VITE_RAZORPAY_KEY_ID=rzp_test_XXXX      ← .env file (auto-read via import.meta.env)
//
// The key is read as:
//   window.__RZP_KEY__ || import.meta?.env?.VITE_RAZORPAY_KEY_ID || ""
//
// NOTE: When order_id is omitted (fee API not yet deployed), Razorpay opens
// in "standard checkout" mode — amount is charged but no server-side order tracking.
// Deploy new_endpoints.py to your backend for full order_id support.

const BASE = "https://urban-ease-theta.vercel.app";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function safeParse(val, fallback) {
  if (val === null || val === undefined) return fallback;
  if (Array.isArray(fallback) && Array.isArray(val)) return val;
  if (!Array.isArray(fallback) && typeof val === "object" && !Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val) ?? fallback; } catch { return fallback; }
  }
  return fallback;
}

function formatAmount(amount) {
  return Math.round(Number(amount || 0)).toLocaleString("en-IN");
}

function formatDate(str) {
  if (!str) return "";
  return new Date(str).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function convertTo24(timeStr) {
  if (!timeStr) return "00:00";
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Returns hours until slot (negative if past) */
function hoursUntilSlot(slot) {
  if (!slot?.date || !slot?.time) return Infinity;
  const slotDate = new Date(`${slot.date}T${convertTo24(slot.time)}`);
  return (slotDate - new Date()) / (1000 * 60 * 60);
}

function isSlotCancellable(slot, orderStatus) {
  if (orderStatus === "cancelled") return false;
  if (slot._cancelled) return false;
  return hoursUntilSlot(slot) > 24;
}

function isSlotReschedulable(slot, orderStatus) {
  if (orderStatus === "cancelled") return false;
  if (slot._cancelled) return false;
  return hoursUntilSlot(slot) > 0; // can reschedule any future slot
}

function isRescheduleChargeable(slot) {
  const h = hoursUntilSlot(slot);
  return h > 0 && h <= 24;
}

const STATUS_COLORS = {
  paid: { bg: "#DCFCE7", text: "#15803D" },
  pending: { bg: "#FEF9C3", text: "#A16207" },
  failed: { bg: "#FEE2E2", text: "#B91C1C" },
  cancelled: { bg: "#F3F4F6", text: "#6B7280" },
};
function getStatusStyle(s) {
  return STATUS_COLORS[s?.toLowerCase()] || STATUS_COLORS.cancelled;
}

// ─────────────────────────────────────────────────────────────
// NEXT 7 DATES HELPER
// ─────────────────────────────────────────────────────────────

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DEFAULT_TIMES = ["09:00 AM", "11:00 AM", "01:00 PM", "03:00 PM", "05:00 PM", "07:00 PM"];

function getNext7Dates() {
  // Start from tomorrow — avoids showing today where most/all slots may be past
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return {
      date: d.toISOString().split("T")[0],
      day: DAY_ABBR[d.getDay()],
      num: d.getDate(),
      month: MONTH_ABBR[d.getMonth()],
    };
  });
}

/** Filter time slots to only future ones for the given date (YYYY-MM-DD) */
function filterFutureSlots(slots, selectedDate) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  if (selectedDate !== todayStr) return slots; // future date — all slots valid
  return slots.filter(t => {
    const slotDt = new Date(`${selectedDate}T${convertTo24(t)}`);
    return slotDt > now;
  });
}

// ─────────────────────────────────────────────────────────────
// CANCEL MODAL (whole booking)
// ─────────────────────────────────────────────────────────────

function CancelModal({ order, onConfirm, onClose, loading }) {
  return (
    <div style={styles.modalOverlay} onClick={() => !loading && onClose()}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalIcon}>⚠️</div>
        <div style={styles.modalTitle}>Cancel Booking?</div>
        <div style={styles.modalBody}>
          Are you sure you want to cancel booking{" "}
          <b style={{ fontFamily: "monospace", fontSize: 12 }}>{order.razorpay_order_id}</b>?
          <span style={styles.modalNote}>
            This action cannot be undone. Refunds (if applicable) are subject to our cancellation policy.
          </span>
        </div>
        <div style={styles.modalActions}>
          <button style={styles.btnGhost} onClick={onClose} disabled={loading}>Keep Booking</button>
          <button style={{ ...styles.btnDanger, opacity: loading ? 0.65 : 1 }} onClick={onConfirm} disabled={loading}>
            {loading ? "Cancelling…" : "Yes, Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CANCEL SLOT MODAL
// ─────────────────────────────────────────────────────────────

function CancelSlotModal({ slot, slotKey, order, onConfirm, onClose, loading }) {
  return (
    <div style={styles.modalOverlay} onClick={() => !loading && onClose()}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalIcon}>🗓️</div>
        <div style={styles.modalTitle}>Cancel This Service?</div>
        <div style={styles.modalBody}>
          <div style={styles.slotPreviewBox}>
            <div style={styles.slotPreviewGroup}>{slot.group}</div>
            <div style={styles.slotPreviewDetail}>{slot.label}</div>
            <div style={styles.slotPreviewDetail}>📅 {slot.date} &nbsp;⏰ {slot.time}</div>
          </div>
          <span style={styles.modalNote}>
            Only this service slot will be cancelled. A proportional refund will be processed.
          </span>
        </div>
        <div style={styles.modalActions}>
          <button style={styles.btnGhost} onClick={onClose} disabled={loading}>Keep It</button>
          <button style={{ ...styles.btnDanger, opacity: loading ? 0.65 : 1 }} onClick={onConfirm} disabled={loading}>
            {loading ? "Cancelling…" : "Cancel Service"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RESCHEDULE MODAL
// ─────────────────────────────────────────────────────────────

function RescheduleModal({ slot, slotKey, order, onConfirm, onClose, loading, availableSlots }) {
  const chargeable = isRescheduleChargeable(slot);
  const dates = getNext7Dates();

  const [selectedDate, setSelectedDate] = useState(dates[0].date);

  // Compute visible time slots — filter out past times if date is today
  const visibleSlots = filterFutureSlots(availableSlots, selectedDate);

  const [selectedTime, setSelectedTime] = useState(visibleSlots[0] || DEFAULT_TIMES[0]);

  // When date changes, reset time to first valid slot for that date
  function handleDateSelect(date) {
    setSelectedDate(date);
    const filtered = filterFutureSlots(availableSlots, date);
    setSelectedTime(filtered[0] || "");
  }

  return (
    <div style={styles.modalOverlay} onClick={() => !loading && onClose()}>
      <div style={{ ...styles.modal, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalIcon}>📅</div>
        <div style={styles.modalTitle}>Reschedule Service</div>

        {/* Current slot info */}
        <div style={styles.slotPreviewBox}>
          <div style={styles.slotPreviewGroup}>{slot.group}</div>
          <div style={styles.slotPreviewDetail}>{slot.label}</div>
          <div style={{ ...styles.slotPreviewDetail, color: "#888" }}>
            Current: {slot.date} @ {slot.time}
          </div>
        </div>

        {/* ₹100 charge warning */}
        {chargeable && (
          <div style={styles.chargeWarning}>
            ⚡ Rescheduling within 24 hrs of appointment incurs a <b>₹100 fee</b>.
          </div>
        )}

        {/* Date picker */}
        <div style={styles.rescheduleLabel}>Select New Date</div>
        <div style={styles.dateScroll}>
          {dates.map(d => (
            <button
              key={d.date}
              style={{
                ...styles.dateChip,
                ...(selectedDate === d.date ? styles.dateChipActive : {}),
              }}
              onClick={() => handleDateSelect(d.date)}
            >
              <span style={styles.dateChipDay}>{d.day}</span>
              <span style={styles.dateChipNum}>{d.num}</span>
              <span style={styles.dateChipMonth}>{d.month}</span>
            </button>
          ))}
        </div>

        {/* Time picker */}
        <div style={styles.rescheduleLabel}>Select New Time</div>
        {visibleSlots.length === 0 ? (
          <div style={styles.noSlotsNote}>No available slots for this date.</div>
        ) : (
          <div style={styles.timeGrid}>
            {visibleSlots.map(t => (
              <button
                key={t}
                style={{
                  ...styles.timeChip,
                  ...(selectedTime === t ? styles.timeChipActive : {}),
                }}
                onClick={() => setSelectedTime(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div style={styles.modalActions}>
          <button style={styles.btnGhost} onClick={onClose} disabled={loading}>Cancel</button>
          <button
            style={{ ...styles.btnPrimary, opacity: (loading || !selectedTime) ? 0.5 : 1 }}
            onClick={() => onConfirm(slotKey, selectedDate, selectedTime, chargeable)}
            disabled={loading || !selectedTime}
          >
            {loading ? "Saving…" : chargeable ? "Confirm (₹100 fee)" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SLOT ROW — single slot with its own actions
// ─────────────────────────────────────────────────────────────

function SlotRow({ slotKey, slot, orderStatus, onCancelSlot, onRescheduleSlot }) {
  const cancellable = isSlotCancellable(slot, orderStatus);
  const reschedulable = isSlotReschedulable(slot, orderStatus);
  const chargeable = isRescheduleChargeable(slot);
  const isCancelled = slot._cancelled;
  const hours = hoursUntilSlot(slot);
  const isPast = hours <= 0;

  return (
    <div style={{
      ...styles.slotRowContainer,
      opacity: isCancelled ? 0.45 : 1,
    }}>
      <div style={styles.slotRowLeft}>
        <span style={{
          ...styles.slotDot,
          background: isCancelled ? "#D1D5DB" : isPast ? "#9CA3AF" : "#3B82F6",
        }} />
        <div>
          <div style={styles.slotGroup}>{slot.group}</div>
          <div style={styles.slotLabel}>{slot.label}</div>
          <div style={styles.slotDateTime}>
            📅 {slot.date} &nbsp;⏰ {slot.time}
          </div>
          {isCancelled && (
            <span style={styles.slotCancelledBadge}>Cancelled</span>
          )}
          {!isCancelled && isPast && (
            <span style={styles.slotCompletedBadge}>Service Availed</span>
          )}
          {!isCancelled && !cancellable && !isPast && hours > 0 && hours <= 24 && (
            <span style={styles.slotWithin24Badge}>⏳ Within 24 hrs</span>
          )}
          {!isCancelled && chargeable && (
            <span style={styles.slotChargeBadge}>₹100 reschedule fee applies</span>
          )}
        </div>
      </div>

      {/* Per-slot action buttons */}
      {!isCancelled && !isPast && (
        <div style={styles.slotActions}>

          {/* ✅ NEW: Contact button (within 24 hrs) */}
          {hours > 0 && hours <= 24 && slot.provider?.phone && (
            <button
              style={styles.btnContact}
              onClick={() => window.open(`tel:${slot.provider.phone}`)}
            >
              Call {slot.provider.name || "Provider"}
            </button>
          )}

          {reschedulable && (
            <button style={styles.btnReschedule} onClick={() => onRescheduleSlot(slotKey, slot)}>
              Reschedule
            </button>
          )}

          {cancellable && (
            <button style={styles.btnCancelSlot} onClick={() => onCancelSlot(slotKey, slot)}>
              Cancel
            </button>
          )}

        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BOOKING CARD
// ─────────────────────────────────────────────────────────────

function BookingCard({ order, onCancelRequest, onCancelSlotRequest, onRescheduleSlotRequest }) {
  const address = safeParse(order.address, {});
  const slotsMap = safeParse(order.slots, {});
  const cart = safeParse(order.cart, []);
  const cancelledSlots = Object.values(slotsMap).filter(s => s._cancelled);
  const slots = Object.entries(slotsMap); // [[key, slot], ...]

  const fullAddress = [address.house_flat, address.landmark, address.full_address]
    .filter(Boolean).join(", ");

  const statusStyle = getStatusStyle(order.status);
  const isCancelled = order.status === "cancelled";

  // Whole-booking cancel: at least one slot is individually cancellable
  const hasAnyCancellable = slots.some(([, s]) => isSlotCancellable(s, order.status));

  return (
    <div style={{ ...styles.card, opacity: isCancelled ? 0.6 : 1 }}>

      {/* HEADER */}
      <div style={styles.cardHeader}>
        <span style={styles.orderId}>{order.razorpay_order_id}</span>
        <span style={{ ...styles.statusBadge, background: statusStyle.bg, color: statusStyle.text }}>
          {order.status?.toUpperCase()}
        </span>
      </div>

      {/* AMOUNT */}
      <div style={styles.amount}>₹{formatAmount(order.amount)}</div>

      {/* META */}
      <div style={styles.metaRow}>
        <span style={styles.metaIcon}>🕐</span>
        <span style={styles.metaText}>{formatDate(order.created_at)}</span>
      </div>
      <div style={styles.metaRow}>
        <span style={styles.metaIcon}>📍</span>
        <span style={styles.metaText}>{fullAddress || "No address available"}</span>
      </div>

      <div style={styles.divider} />

      {/* SLOTS — each with its own actions */}
      {slots.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>SCHEDULED SERVICES</div>
          {slots.map(([key, slot]) => (
            <SlotRow
              key={key}
              slotKey={key}
              slot={slot}
              orderStatus={order.status}
              onCancelSlot={(k, s) => onCancelSlotRequest(order, k, s)}
              onRescheduleSlot={(k, s) => onRescheduleSlotRequest(order, k, s)}
            />
          ))}
        </div>
      )}

      {/* CART */}
      {cart.length > 0 && (
        <div style={styles.section}>
          {cancelledSlots.length > 0 && (
            <div style={{
              background: "#FEF2F2",
              color: "#B91C1C",
              padding: 8,
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 10
            }}>
              {cancelledSlots.length} service(s) cancelled
            </div>
          )}
          <div style={styles.sectionLabel}>SERVICES SUMMARY</div>
          {cart.map((item, idx) => {
            const bullets = safeParse(item.bullets, []);
            const lineTotal = (item.cart_price || 0) * (item.qty || 1);

            // 🔥 Check if this item is cancelled
            const isCancelled = cancelledSlots.some(slot =>
              item.title.toLowerCase().includes((slot.group || "").toLowerCase())
            );

            return (
              <div
                key={item.id || idx}
                style={{
                  ...styles.itemCard,
                  opacity: isCancelled ? 0.5 : 1,
                  background: isCancelled ? "#FEF2F2" : undefined,
                  border: isCancelled ? "1px solid #FCA5A5" : undefined
                }}
              >
                <div style={styles.itemRow}>
                  <div style={styles.itemLeft}>
                    {item.qty > 1 && <span style={styles.qtyBadge}>{item.qty}×</span>}

                    <span
                      style={{
                        ...styles.itemTitle,
                        textDecoration: isCancelled ? "line-through" : "none"
                      }}
                    >
                      {item.title}
                    </span>

                    {isCancelled && (
                      <span style={{
                        marginLeft: 8,
                        fontSize: 12,
                        color: "#DC2626",
                        fontWeight: 600
                      }}>
                        CANCELLED
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      ...styles.itemPrice,
                      textDecoration: isCancelled ? "line-through" : "none",
                      color: isCancelled ? "#9CA3AF" : undefined
                    }}
                  >
                    ₹{lineTotal.toLocaleString("en-IN")}
                  </div>
                </div>

                {!isCancelled && bullets.length > 0 && (
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

      {/* WHOLE BOOKING CANCEL */}
      {!isCancelled && hasAnyCancellable && (
        <button style={styles.cancelBtn} onClick={() => onCancelRequest(order)}>
          Cancel Entire Booking
        </button>
      )}

      {!isCancelled && !hasAnyCancellable && slots.length > 0 && (
        <div style={styles.noCancelNote}>
          ⏳ No services can be cancelled — all within 24 hrs of appointment
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
    <div style={styles.card}>
      <div style={{ ...styles.skeletonLine, width: "55%", height: 12, marginBottom: 16 }} />
      <div style={{ ...styles.skeletonLine, width: "30%", height: 28, marginBottom: 10 }} />
      <div style={{ ...styles.skeletonLine, width: "80%", height: 11, marginBottom: 6 }} />
      <div style={{ ...styles.skeletonLine, width: "65%", height: 11, marginBottom: 18 }} />
      <div style={{ ...styles.skeletonLine, width: "100%", height: 1, marginBottom: 14 }} />
      <div style={{ ...styles.skeletonLine, width: "40%", height: 11, marginBottom: 8 }} />
      <div style={{ ...styles.skeletonLine, width: "70%", height: 14 }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function BookingPageBody() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [availableSlots, setAvailableSlots] = useState(DEFAULT_TIMES);

  // Whole-booking cancel
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Single-slot cancel
  const [cancelSlotTarget, setCancelSlotTarget] = useState(null); // { order, slotKey, slot }
  const [cancelSlotLoading, setCancelSlotLoading] = useState(false);

  // Reschedule
  const [rescheduleTarget, setRescheduleTarget] = useState(null); // { order, slotKey, slot }
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // ── Auth + initial load ────────────────────────────────────
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }
      setAuthUser(user);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`${BASE}/api/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setOrders(json.data || []);
      } catch (err) {
        setError("Could not load your bookings. Please try again.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Fetch available time slots when reschedule modal opens
  useEffect(() => {
    if (!rescheduleTarget) return;
    const group = rescheduleTarget.slot.group || "";
    fetch(`${BASE}/api/slots?group=${encodeURIComponent(group)}`)
      .then(r => r.json())
      .then(d => {
        if (d?.slots?.length) setAvailableSlots(d.slots);
      })
      .catch(() => { });
  }, [rescheduleTarget]);

  // ── Whole booking cancel ───────────────────────────────────
  async function handleConfirmCancel() {
    if (!cancelTarget || !authUser) return;
    setCancelLoading(true);
    try {
      const token = await authUser.getIdToken();
      const res = await fetch(`${BASE}/api/orders/${cancelTarget.razorpay_order_id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${res.status}`);
      }
      setOrders(prev =>
        prev.map(o => o.id === cancelTarget.id ? { ...o, status: "cancelled" } : o)
      );
      setCancelTarget(null);
    } catch (err) {
      // alert(`Cancellation failed: ${err.message}`);
    } finally {
      setCancelLoading(false);
    }
  }

  // ── Single slot cancel ─────────────────────────────────────
  async function handleConfirmSlotCancel() {
    if (!cancelSlotTarget || !authUser) return;
    const { order, slotKey, slot } = cancelSlotTarget;
    setCancelSlotLoading(true);
    try {
      const token = await authUser.getIdToken();
      const res = await fetch(`${BASE}/api/orders/${order.razorpay_order_id}/cancel-slot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slot_key: slotKey }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${res.status}`);
      }
      // Optimistically mark slot as cancelled in local state
      setOrders(prev => prev.map(o => {
        if (o.id !== order.id) return o;

        const newSlots = { ...safeParse(o.slots, {}) };
        newSlots[slotKey] = { ...newSlots[slotKey], _cancelled: true };

        // 🔥 get cancelled slot
        const cancelledSlot = newSlots[slotKey];

        // 🔥 find matching cart item
        const matchedItem = safeParse(o.cart, []).find(item =>
          (item.title || "").toLowerCase().includes((cancelledSlot.group || "").toLowerCase())
        );

        // 🔥 calculate actual refund
        const refundAmount = matchedItem
          ? (matchedItem.cart_price || 0) * (matchedItem.qty || 1)
          : 0;

        return {
          ...o,
          slots: newSlots,
          amount: o.amount - refundAmount
        };
      }));
      setCancelSlotTarget(null);
    } catch (err) {
      // alert(`Slot cancellation failed: ${err.message}`);
    } finally {
      setCancelSlotLoading(false);
    }
  }

  // ── Reschedule ─────────────────────────────────────────────
  async function handleConfirmReschedule(slotKey, newDate, newTime, chargeable) {
    if (!rescheduleTarget || !authUser) return;
    const { order } = rescheduleTarget;

    // Guard: never allow rescheduling to a past datetime
    const newDt = new Date(`${newDate}T${convertTo24(newTime)}`);
    if (newDt <= new Date()) {
      alert("Please select a future date and time.");
      return;
    }

    // If fee applies, open Razorpay checkout first then call API
    if (chargeable) {
      setRescheduleLoading(true);

      // Try to get a server-side order_id for the fee (recommended).
      // If the endpoint isn't deployed yet, falls back to amount-only mode (test mode only).
      let feeOrderId = null;
      try {
        const token = await authUser.getIdToken();
        const feeRes = await fetch(`${BASE}/api/reschedule-fee/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ razorpay_order_id: order.razorpay_order_id, slot_key: slotKey }),
        });
        if (feeRes.ok) {
          const feeJson = await feeRes.json();
          feeOrderId = feeJson.order?.id || null;
        }
        // If endpoint missing / error — feeOrderId stays null, RZP opens in amount-only mode
      } catch (_) { }

      setRescheduleLoading(false);

      // Build RZP config — only pass order_id when we have one
      const rzpConfig = {
        key: "rzp_test_SjzsGim4szJZ5y", // placeholder, overridden by window.__RZP_KEY__ or env var
        amount: 10000,
        currency: "INR",
        name: "UrbanEase",
        description: "Rescheduling fee (within 24 hrs)",
        prefill: {
          name: authUser.displayName || "",
          email: authUser.email || "",
        },
        handler: async (response) => {
          setRescheduleLoading(true);
          try {
            const token = await authUser.getIdToken();
            const res = await fetch(`${BASE}/api/orders/${order.razorpay_order_id}/reschedule-slot`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                slot_key: slotKey,
                new_date: newDate,
                new_time: newTime,
                fee_payment_id: response.razorpay_payment_id || null,
                fee_order_id: response.razorpay_order_id || null,
                fee_signature: response.razorpay_signature || null,
              }),
            });
            if (!res.ok) {
              const errJson = await res.json().catch(() => ({}));
              throw new Error(errJson.detail || `HTTP ${res.status}`);
            }
            setOrders(prev => prev.map(o => {
              if (o.id !== order.id) return o;
              const s = { ...safeParse(o.slots, {}) };
              s[slotKey] = { ...s[slotKey], date: newDate, time: newTime };
              return { ...o, slots: s };
            }));
            setRescheduleTarget(null);
          } catch (err) {
            // alert(`Reschedule failed after payment: ${err.message}`);
          } finally {
            setRescheduleLoading(false);
          }
        },
        modal: {
          ondismiss: () => { setRescheduleLoading(false); },
        },
        theme: { color: "#1D4ED8" },
      };

      // Only attach order_id if we successfully got one from the server
      if (feeOrderId) rzpConfig.order_id = feeOrderId;

      if (!rzpConfig.key) {
        alert("Razorpay key not configured. Set window.__RZP_KEY__ or VITE_RAZORPAY_KEY_ID.");
        return;
      }

      const rzp = new window.Razorpay(rzpConfig);
      rzp.on("payment.failed", () => {
        setRescheduleLoading(false);
        // alert("Payment failed. Please try again.");
      });
      rzp.open();
      return;
    }

    // No fee — call reschedule API directly
    setRescheduleLoading(true);
    try {
      const token = await authUser.getIdToken();
      const res = await fetch(`${BASE}/api/orders/${order.razorpay_order_id}/reschedule-slot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slot_key: slotKey, new_date: newDate, new_time: newTime }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${res.status}`);
      }
      setOrders(prev => prev.map(o => {
        if (o.id !== order.id) return o;
        const s = { ...safeParse(o.slots, {}) };
        s[slotKey] = { ...s[slotKey], date: newDate, time: newTime };
        return { ...o, slots: s };
      }));
      setRescheduleTarget(null);
    } catch (err) {
      // alert(`Reschedule failed: ${err.message}`);
    } finally {
      setRescheduleLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────
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

      {!loading && !error && orders.map(o => (
        <BookingCard
          key={o.id}
          order={o}
          onCancelRequest={setCancelTarget}
          onCancelSlotRequest={(order, key, slot) => setCancelSlotTarget({ order, slotKey: key, slot })}
          onRescheduleSlotRequest={(order, key, slot) => setRescheduleTarget({ order, slotKey: key, slot })}
        />
      ))}

      {/* Whole-booking cancel modal */}
      {cancelTarget && (
        <CancelModal
          order={cancelTarget}
          onConfirm={handleConfirmCancel}
          onClose={() => !cancelLoading && setCancelTarget(null)}
          loading={cancelLoading}
        />
      )}

      {/* Single-slot cancel modal */}
      {cancelSlotTarget && (
        <CancelSlotModal
          slot={cancelSlotTarget.slot}
          slotKey={cancelSlotTarget.slotKey}
          order={cancelSlotTarget.order}
          onConfirm={handleConfirmSlotCancel}
          onClose={() => !cancelSlotLoading && setCancelSlotTarget(null)}
          loading={cancelSlotLoading}
        />
      )}

      {/* Reschedule modal */}
      {rescheduleTarget && (
        <RescheduleModal
          slot={rescheduleTarget.slot}
          slotKey={rescheduleTarget.slotKey}
          order={rescheduleTarget.order}
          onConfirm={handleConfirmReschedule}
          onClose={() => !rescheduleLoading && setRescheduleTarget(null)}
          loading={rescheduleLoading}
          availableSlots={availableSlots}
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

  // Slot row container
  slotRowContainer: {
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    gap: 10, marginBottom: 12, padding: "10px 12px",
    background: "#F9F9F8", borderRadius: 10,
    transition: "opacity 0.3s",
  },
  slotRowLeft: { display: "flex", alignItems: "flex-start", gap: 10, flex: 1 },
  slotDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 5 },
  slotGroup: { fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 1 },
  slotLabel: { fontSize: 12, color: "#777", marginBottom: 2 },
  slotDateTime: { fontSize: 11, color: "#AAA", marginTop: 2 },
  slotActions: { display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 },

  slotCancelledBadge: {
    display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 700,
    background: "#F3F4F6", color: "#9CA3AF", borderRadius: 6, padding: "2px 7px",
  },
  slotCompletedBadge: {
    display: "inline-block",
    marginTop: 4,
    fontSize: 10,
    fontWeight: 700,
    background: "#E6F9F0",
    color: "#059669",
    borderRadius: 6,
    padding: "2px 7px",
  },
  slotWithin24Badge: {
    display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 600,
    background: "#FEF9C3", color: "#A16207", borderRadius: 6, padding: "2px 7px",
  },
  slotChargeBadge: {
    display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 600,
    background: "#FFF7ED", color: "#C2410C", borderRadius: 6, padding: "2px 7px",
  },

  // Per-slot action buttons
  btnReschedule: {
    fontSize: 11, fontWeight: 600, cursor: "pointer",
    border: "1.5px solid #BFDBFE", borderRadius: 8,
    background: "#EFF6FF", color: "#1D4ED8",
    padding: "5px 10px", whiteSpace: "nowrap",
  },
  btnCancelSlot: {
    fontSize: 11, fontWeight: 600, cursor: "pointer",
    border: "1.5px solid #FECACA", borderRadius: 8,
    background: "#FFF5F5", color: "#DC2626",
    padding: "5px 10px", whiteSpace: "nowrap",
  },
  btnContact: {
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    border: "1.5px solid #BBF7D0",
    borderRadius: 8,
    background: "#F0FDF4",
    color: "#059669",
    padding: "5px 10px",
    whiteSpace: "nowrap",
  },
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
  bulletItem: { fontSize: 11, color: "#888", marginBottom: 2, paddingLeft: 10, lineHeight: 1.4 },

  cancelBtn: {
    marginTop: 12, width: "100%", padding: "10px 0",
    border: "1.5px solid #FCA5A5", borderRadius: 10,
    background: "#FFF5F5", color: "#DC2626",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  noCancelNote: {
    marginTop: 12, fontSize: 11, color: "#BBB",
    textAlign: "center", padding: "8px 0 2px",
  },

  skeletonLine: {
    background: "linear-gradient(90deg,#F0F0F0 25%,#E8E8E8 50%,#F0F0F0 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite",
    borderRadius: 6, display: "block",
  },

  emptyBox: { textAlign: "center", padding: "60px 20px", color: "#999" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: 600, color: "#555", marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: "#AAA" },
  errorBox: {
    background: "#FFF0F0", border: "1px solid #FED7D7", color: "#C53030",
    borderRadius: 12, padding: "16px 20px", fontSize: 13, textAlign: "center",
  },

  // Modals
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
  modalActions: { display: "flex", gap: 10, marginTop: 16 },
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
  btnPrimary: {
    flex: 1, padding: "11px 0", border: "none",
    borderRadius: 10, background: "#1D4ED8", color: "#fff",
    fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "opacity 0.2s",
  },

  // Slot preview in modal
  slotPreviewBox: {
    background: "#F9F9F8", borderRadius: 10, padding: "10px 14px",
    marginBottom: 14, textAlign: "left",
  },
  slotPreviewGroup: { fontSize: 13, fontWeight: 700, color: "#222", marginBottom: 2 },
  slotPreviewDetail: { fontSize: 12, color: "#666", marginBottom: 2 },

  // ₹100 charge warning
  chargeWarning: {
    background: "#FFF7ED", border: "1px solid #FED7AA", color: "#C2410C",
    borderRadius: 10, padding: "10px 14px", fontSize: 12, marginBottom: 14,
    textAlign: "left",
  },

  // Reschedule date/time pickers
  rescheduleLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#AAA",
    marginBottom: 8, textAlign: "left",
  },
  dateScroll: {
    display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 14,
  },
  dateChip: {
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "8px 10px", borderRadius: 10, border: "1.5px solid #E5E5E5",
    background: "#fff", cursor: "pointer", flexShrink: 0, gap: 2,
  },
  dateChipActive: {
    border: "1.5px solid #1D4ED8", background: "#EFF6FF",
  },
  dateChipDay: { fontSize: 9, fontWeight: 600, color: "#888", letterSpacing: "0.06em" },
  dateChipNum: { fontSize: 16, fontWeight: 800, color: "#111" },
  dateChipMonth: { fontSize: 9, fontWeight: 600, color: "#888" },
  noSlotsNote: {
    fontSize: 12, color: "#AAA", textAlign: "center",
    padding: "10px 0 6px", marginBottom: 6,
  },
  timeGrid: {
    display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6,
  },
  timeChip: {
    padding: "7px 12px", borderRadius: 8, border: "1.5px solid #E5E5E5",
    background: "#fff", fontSize: 12, fontWeight: 500, color: "#444", cursor: "pointer",
  },
  timeChipActive: {
    border: "1.5px solid #1D4ED8", background: "#EFF6FF", color: "#1D4ED8", fontWeight: 700,
  },
};