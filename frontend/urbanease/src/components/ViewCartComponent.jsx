import React, { useEffect, useState, useRef, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
/* ═══════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════ */
const BASE = "https://urban-ease-theta.vercel.app";
const MAPS_API_KEY = "AIzaSyApzKC2nq9OCuaVQV2Jbm9cJoOHPy9kzvM";

/* ═══════════════════════════════════════════════════════════
   GOOGLE MAPS LOADER
═══════════════════════════════════════════════════════════ */
let _mapsPromise = null;
function loadGoogleMaps() {
  if (_mapsPromise) return _mapsPromise;
  _mapsPromise = new Promise((resolve) => {
    if (window.google?.maps?.places) { resolve(); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = resolve;
    document.head.appendChild(script);
  });
  return _mapsPromise;
}

/* ═══════════════════════════════════════════════════════════
   AUTH HELPERS
═══════════════════════════════════════════════════════════ */
async function authFetch(path, options = {}) {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not logged in");
  const token = await user.getIdToken();
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

async function getToken() {
  const user = getAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const fmt = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const parseBullets = (bullets) => {
  if (!bullets) return [];
  if (typeof bullets === "string") {
    try { return parseBullets(JSON.parse(bullets)); }
    catch { return bullets.split(",").map((s) => s.trim()).filter(Boolean); }
  }
  if (!Array.isArray(bullets)) return [];
  return bullets.map((b) => {
    if (!b) return null;
    if (typeof b === "string") return b.trim() || null;
    if (typeof b === "number") return String(b);
    if (typeof b === "object") {
      for (const k of ["text", "name", "label", "title", "value", "description", "item"]) {
        if (typeof b[k] === "string" && b[k].trim()) return b[k].trim();
      }
      for (const v of Object.values(b)) { if (typeof v === "string" && v.trim()) return v.trim(); }
    }
    return null;
  }).filter(Boolean);
};

const GROUP_LABELS = {
  packages: "Salon Prime", men_packages: "Salon Prime", salon_prime: "Salon Prime",
  men_salon_prime: "Men's Salon Prime", bathroom_cleaning: "Bathroom Cleaning",
  services: "Services", men_services: "Men's Services", most_booked: "Most Booked",
  spa_women: "Spa", salon_women: "Salon for Women",
  cleaning: "Cleaning Services", appliances: "Large Appliances",
};
const BATHROOM_SOURCES = new Set(["bathroom_cleaning"]);

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtSlotLabel(dateStr, timeStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = DAY_ABBR[d.getDay() === 0 ? 6 : d.getDay() - 1];
  const mon = MONTH_ABBR[d.getMonth()];
  return `${day}, ${mon} ${d.getDate()} at ${timeStr}`;
}

/**
 * Parse a time string like "09:00 AM" / "01:00 PM" into total minutes since midnight.
 */
function parseTimeToMins(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return -1;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

/* ═══════════════════════════════════════════════════════════
   ANIMATION CSS (injected once)
═══════════════════════════════════════════════════════════ */
if (!document.getElementById("uc-anim")) {
  const st = document.createElement("style");
  st.id = "uc-anim";
  st.textContent = `
    @keyframes uc-fadeIn   { from{opacity:0}                                       to{opacity:1} }
    @keyframes uc-fadeOut  { from{opacity:1}                                       to{opacity:0} }
    @keyframes uc-slideUp  { from{opacity:0;transform:translateY(32px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes uc-slideDown{ from{opacity:1;transform:translateY(0) scale(1)}      to{opacity:0;transform:translateY(32px) scale(.97)} }
    @keyframes spin { to { transform: rotate(360deg) } }
  `;
  document.head.appendChild(st);
}

/* ═══════════════════════════════════════════════════════════
   ANIMATED OVERLAY
═══════════════════════════════════════════════════════════ */
function AnimatedModal({ open, onClose, children, wide = false }) {
  const [visible, setVisible] = useState(false);
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (open) { setVisible(true); setOut(false); }
    else if (visible) {
      setOut(true);
      const t = setTimeout(() => { setVisible(false); setOut(false); }, 280);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: out ? "uc-fadeOut .28s forwards" : "uc-fadeIn .28s forwards",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: out ? "uc-slideDown .28s forwards" : "uc-slideUp .28s forwards",
          width: wide ? "min(900px,95vw)" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════ */
const PinIcon = ({ c = "#555", s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>;
const ClockIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
const CardIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
const ChevR = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6a4de8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>;
const CloseIcon = ({ c = "#333" }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const SearchIcon = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const HistIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" /></svg>;
const LocIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6a4de8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>;
const TickIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;

const GoogleBadge = () => (
  <span style={{ fontSize: 11 }}>
    <span style={{ color: "#aaa" }}>powered by </span>
    <b>
      <span style={{ color: "#4285F4" }}>G</span><span style={{ color: "#EA4335" }}>o</span>
      <span style={{ color: "#FBBC05" }}>o</span><span style={{ color: "#4285F4" }}>g</span>
      <span style={{ color: "#34A853" }}>l</span><span style={{ color: "#EA4335" }}>e</span>
    </b>
  </span>
);

/* ═══════════════════════════════════════════════════════════
   GOOGLE PLACES SEARCH MODAL
═══════════════════════════════════════════════════════════ */
function SearchModal({ open, onClose, onSelect, recents = [] }) {
  const [query, setQuery] = useState("");
  const [preds, setPreds] = useState([]);
  const [ready, setReady] = useState(false);
  const svcRef = useRef(null);
  const debRef = useRef(null);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      svcRef.current = new window.google.maps.places.AutocompleteService();
      setReady(true);
    });
  }, []);

  useEffect(() => { if (open) { setQuery(""); setPreds([]); } }, [open]);

  useEffect(() => {
    if (!ready || !query.trim()) { setPreds([]); return; }
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      svcRef.current.getPlacePredictions(
        { input: query, componentRestrictions: { country: "in" } },
        (res, st) => {
          if (st === window.google.maps.places.PlacesServiceStatus.OK) setPreds(res || []);
          else setPreds([]);
        }
      );
    }, 280);
    return () => clearTimeout(debRef.current);
  }, [query, ready]);

  const pick = (desc, lat, lng) => onSelect({ address: desc, lat, lng });

  const geocodePred = (p) => {
    new window.google.maps.Geocoder().geocode({ placeId: p.place_id }, (results, status) => {
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        pick(p.description, loc.lat(), loc.lng());
      } else pick(p.description, null, null);
    });
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (res, st) => {
        if (st === "OK" && res[0]) pick(res[0].formatted_address, lat, lng);
      });
    });
  };

  return (
    <AnimatedModal open={open} onClose={onClose}>
      <div style={{ background: "white", borderRadius: 14, width: 490, maxWidth: "93vw", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.35)", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: -46, right: 0, width: 36, height: 36, borderRadius: "50%", border: "2px solid #fff", background: "rgba(0,0,0,.65)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CloseIcon c="white" />
        </button>
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid #eee" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1.5px solid #ddd", borderRadius: 8, padding: "10px 12px" }}>
            <SearchIcon />
            <input
              autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for your location/society/apartment"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: "#333", background: "transparent" }}
            />
            {query && (
              <button onClick={() => { setQuery(""); setPreds([]); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <CloseIcon c="#999" />
              </button>
            )}
          </div>
        </div>
        <div onClick={handleCurrentLocation} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", cursor: "pointer", borderBottom: "1px solid #eee" }}>
          <LocIcon /><span style={{ fontSize: 14, fontWeight: 600, color: "#6a4de8" }}>Use current location</span>
        </div>
        {preds.length > 0 && (
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {preds.map((p) => (
              <div key={p.place_id} onClick={() => geocodePred(p)}
                style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "13px 20px", cursor: "pointer", borderBottom: "1px solid #f2f2f2" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f8f8f8"}
                onMouseLeave={(e) => e.currentTarget.style.background = "white"}
              >
                <div style={{ marginTop: 3 }}><PinIcon c="#aaa" s={16} /></div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{p.structured_formatting.main_text}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#777" }}>{p.structured_formatting.secondary_text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {!query && recents.length > 0 && (
          <div>
            <p style={{ margin: "14px 20px 6px", fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>Recents</p>
            {recents.map((r, i) => (
              <div key={i} onClick={() => pick(r.full_address, r.lat, r.lng)}
                style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "11px 20px", cursor: "pointer", borderTop: "1px solid #f2f2f2" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f8f8f8"}
                onMouseLeave={(e) => e.currentTarget.style.background = "white"}
              >
                <div style={{ marginTop: 3 }}><HistIcon /></div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{r.label || "Home"}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#777" }}>{r.full_address}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign: "center", padding: "12px 0 14px", borderTop: "1px solid #f2f2f2" }}><GoogleBadge /></div>
      </div>
    </AnimatedModal>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAP + CONFIRM MODAL
═══════════════════════════════════════════════════════════ */
function MapModal({ open, onClose, initial, onSaved }) {
  const mapRef = useRef(null);
  const gMapRef = useRef(null);
  const markerRef = useRef(null);

  const [displayAddr, setDisplayAddr] = useState("");
  const [shortAddr, setShortAddr] = useState("");
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [house, setHouse] = useState("");
  const [landmark, setLandmark] = useState("");
  const [saveAs, setSaveAs] = useState("Home");
  const [saving, setSaving] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const reverseGeocode = useCallback((lat, lng) => {
    new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (res, st) => {
      if (st === "OK" && res[0]) {
        const full = res[0].formatted_address;
        const short = res[0].address_components?.[0]?.long_name || full.split(",")[0];
        setDisplayAddr(full); setShortAddr(short);
      }
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    loadGoogleMaps().then(() => {
      if (!mapRef.current) return;
      const sLat = initial?.lat || 22.5726, sLng = initial?.lng || 88.3639;
      if (!gMapRef.current) {
        gMapRef.current = new window.google.maps.Map(mapRef.current, { center: { lat: sLat, lng: sLng }, zoom: 16, disableDefaultUI: true, zoomControl: true });
        markerRef.current = new window.google.maps.Marker({ position: { lat: sLat, lng: sLng }, map: gMapRef.current, draggable: true, icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#4285F4", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 } });
        markerRef.current.addListener("dragend", (e) => { const nLat = e.latLng.lat(), nLng = e.latLng.lng(); setLat(nLat); setLng(nLng); reverseGeocode(nLat, nLng); });
        gMapRef.current.addListener("click", (e) => { const nLat = e.latLng.lat(), nLng = e.latLng.lng(); markerRef.current.setPosition({ lat: nLat, lng: nLng }); setLat(nLat); setLng(nLng); reverseGeocode(nLat, nLng); });
      } else {
        gMapRef.current.setCenter({ lat: sLat, lng: sLng });
        markerRef.current.setPosition({ lat: sLat, lng: sLng });
      }
      setLat(sLat); setLng(sLng);
      if (initial?.address) { setDisplayAddr(initial.address); setShortAddr(initial.address.split(",")[0]); }
      else reverseGeocode(sLat, sLng);
    });
  }, [open]);

  const handleSearchSelect = ({ address, lat: nLat, lng: nLng }) => {
    setShowSearch(false);
    if (nLat && nLng && gMapRef.current && markerRef.current) { gMapRef.current.setCenter({ lat: nLat, lng: nLng }); markerRef.current.setPosition({ lat: nLat, lng: nLng }); setLat(nLat); setLng(nLng); }
    setDisplayAddr(address); setShortAddr(address.split(",")[0]);
  };

  const handleSave = async () => {
    if (!displayAddr || saving) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/addresses", { method: "POST", body: JSON.stringify({ full_address: displayAddr, house_flat: house, landmark, label: saveAs, lat, lng, is_default: true }) });
      const data = await res.json();
      if (data.status === "address saved") { onSaved({ id: data.id, label: saveAs, full_address: displayAddr, house_flat: house, landmark, lat, lng, is_default: true }); onClose(); }
    } catch (err) { console.error("Save address failed:", err); }
    finally { setSaving(false); }
  };

  return (
    <>
      <AnimatedModal open={open} onClose={onClose} wide>
        <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", background: "white", boxShadow: "0 24px 64px rgba(0,0,0,.4)", width: "min(900px,95vw)", height: "min(580px,85vh)" }}>
          <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
            <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
            <div style={{ position: "absolute", bottom: "38%", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,.75)", color: "white", borderRadius: 6, padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap", pointerEvents: "none" }}>Place the pin accurately on map</div>
            <button onClick={() => { navigator.geolocation?.getCurrentPosition((pos) => { const { latitude: la, longitude: lo } = pos.coords; if (gMapRef.current && markerRef.current) { gMapRef.current.setCenter({ lat: la, lng: lo }); markerRef.current.setPosition({ lat: la, lng: lo }); setLat(la); setLng(lo); reverseGeocode(la, lo); } }); }} style={{ position: "absolute", bottom: 70, right: 12, width: 36, height: 36, borderRadius: "50%", background: "white", border: "none", boxShadow: "0 2px 8px rgba(0,0,0,.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><LocIcon /></button>
          </div>
          <div style={{ width: 340, flexShrink: 0, display: "flex", flexDirection: "column", padding: "22px 22px 18px", gap: 14, overflowY: "auto" }}>
            <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: "50%", border: "1px solid #ddd", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><CloseIcon /></button>
            <button onClick={() => setShowSearch(true)} style={{ alignSelf: "flex-start", border: "1.5px solid #6a4de8", borderRadius: 8, padding: "6px 18px", fontSize: 13, fontWeight: 600, color: "#6a4de8", background: "white", cursor: "pointer" }}>Change</button>
            <div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>{shortAddr || "Locating…"}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555", lineHeight: 1.5 }}>{displayAddr}</p>
            </div>
            <input value={house} onChange={(e) => setHouse(e.target.value)} placeholder="House/Flat Number*" style={{ border: "1px solid #ddd", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Landmark (Optional)" style={{ border: "1px solid #ddd", borderRadius: 8, padding: "11px 14px", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            <div>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 500, color: "#333" }}>Save as</p>
              <div style={{ display: "flex", gap: 10 }}>
                {["Home", "Other"].map((opt) => (
                  <button key={opt} onClick={() => setSaveAs(opt)} style={{ padding: "8px 22px", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer", border: saveAs === opt ? "1.5px solid #6a4de8" : "1.5px solid #ddd", background: saveAs === opt ? "#f3f0ff" : "white", color: saveAs === opt ? "#6a4de8" : "#555" }}>{opt}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={handleSave} disabled={!displayAddr || saving} style={{ width: "100%", padding: "14px 0", border: "none", borderRadius: 8, background: displayAddr && !saving ? "linear-gradient(90deg,#6a4de8,#7b5cfa)" : "#ccc", color: "white", fontWeight: 600, fontSize: 15, cursor: displayAddr && !saving ? "pointer" : "not-allowed" }}>{saving ? "Saving…" : "Save and proceed to slots"}</button>
          </div>
        </div>
      </AnimatedModal>
      <SearchModal open={showSearch} onClose={() => setShowSearch(false)} onSelect={handleSearchSelect} recents={[]} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   SAVED ADDRESS MODAL
═══════════════════════════════════════════════════════════ */
function SavedAddressModal({ open, onClose, addresses, loading, onAddNew, onSelectAddress, onDelete }) {
  return (
    <AnimatedModal open={open} onClose={onClose}>
      <div style={{ background: "white", borderRadius: 14, width: 480, maxWidth: "92vw", padding: "24px 24px 20px", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: "50%", border: "1px solid #ddd", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><CloseIcon /></button>
        <p style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a", margin: "0 0 16px" }}>Saved address</p>
        <div style={{ height: 1, background: "#eee", marginBottom: 16 }} />
        <div onClick={onAddNew} style={{ display: "flex", alignItems: "center", gap: 8, color: "#6a4de8", fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: 16 }}>
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>+</span><span>Add another address</span>
        </div>
        <div style={{ height: 1, background: "#eee", marginBottom: 4 }} />
        {loading ? (
          <p style={{ textAlign: "center", color: "#aaa", padding: "16px 0", fontSize: 14 }}>Loading…</p>
        ) : addresses.length === 0 ? (
          <p style={{ textAlign: "center", color: "#aaa", padding: "16px 0", fontSize: 14 }}>No saved addresses yet.</p>
        ) : (
          addresses.map((addr) => (
            <div key={addr.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 0", gap: 12, borderBottom: "1px solid #f5f5f5" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1, cursor: "pointer" }} onClick={() => onSelectAddress(addr)}>
                <input type="radio" readOnly checked={addr.is_default} style={{ marginTop: 3, accentColor: "#6a4de8", width: 18, height: 18, flexShrink: 0, cursor: "pointer" }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" }}>{addr.label}</p>
                  <p style={{ fontSize: 13, color: "#555", margin: 0, lineHeight: 1.5 }}>{addr.house_flat ? `${addr.house_flat}, ` : ""}{addr.full_address}{addr.landmark ? ` (${addr.landmark})` : ""}</p>
                </div>
              </div>
              <button onClick={() => onDelete(addr.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", flexShrink: 0, opacity: 0.5 }}><CloseIcon c="#666" /></button>
            </div>
          ))
        )}
        <button onClick={onClose} style={{ width: "100%", padding: "14px 0", border: "none", borderRadius: 8, background: "linear-gradient(90deg,#6a4de8,#7b5cfa)", color: "white", fontWeight: 600, fontSize: 15, cursor: "pointer", marginTop: 16 }}>Proceed</button>
      </div>
    </AnimatedModal>
  );
}

/* ═══════════════════════════════════════════════════════════
   SLOT PICKER MODAL
   ✅ Filters out past dates
   ✅ Filters out past time slots (with 1-hour buffer) for today
═══════════════════════════════════════════════════════════ */
function SlotPickerModal({ open, onClose, groupLabel, onConfirm }) {
  const [dates, setDates] = useState([]);
  const [allTimes, setAllTimes] = useState([]); // full list from API
  const [times, setTimes] = useState([]);        // filtered list shown to user
  const [services, setServices] = useState([]);
  const [durationLabel, setDurationLabel] = useState("");
  const [selectedDate, setSelectedDate] = useState(0);
  const [selectedTime, setSelectedTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Helper: given the selected date index and all times, return only valid times
  const filterTimes = (dateIndex, dateList, timeList) => {
    if (!dateList.length) return timeList;
    const selectedDateStr = dateList[dateIndex]?.date;
    if (!selectedDateStr) return timeList;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (selectedDateStr !== todayStr) {
      // Future date — show all slots
      return timeList;
    }

    // Today — filter out slots within the next 60 minutes
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return timeList.filter((t) => {
      const slotMins = parseTimeToMins(t);
      return slotMins !== -1 && slotMins > nowMins + 60;
    });
  };

  useEffect(() => {
    if (!open || !groupLabel) return;
    setLoading(true);
    setError("");
    setSelectedDate(0);
    setSelectedTime(null);
    setServices([]);
    setDates([]);
    setAllTimes([]);
    setTimes([]);

    (async () => {
      try {
        const token = await getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${BASE}/api/slots?group=${encodeURIComponent(groupLabel)}`, { headers });
        const data = await res.json();

        if (data.status === "success") {
          const now = new Date();
          const todayStr = now.toISOString().split("T")[0];

          // ✅ Filter out past dates
          const futureDates = (data.dates || []).filter((d) => d.date >= todayStr);

          const rawTimes = data.slots || [];
          setAllTimes(rawTimes);
          setDates(futureDates);
          setDurationLabel(data.duration_label || "");
          setServices(data.services || []);

          // ✅ Filter times for first available date (which may be today)
          setTimes(filterTimes(0, futureDates, rawTimes));
        } else {
          setError("Could not load slots. Please try again.");
        }
      } catch (e) {
        console.error(e);
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, groupLabel]);

  // ✅ When user switches date, re-filter times and clear selected time
  const handleSelectDate = (index) => {
    setSelectedDate(index);
    setSelectedTime(null);
    setTimes(filterTimes(index, dates, allTimes));
  };

  const handleConfirm = () => {
    if (!selectedTime || !dates[selectedDate]) return;
    onConfirm({
      group: groupLabel,
      date: dates[selectedDate].date,
      day: dates[selectedDate].day,
      num: dates[selectedDate].num,
      month: dates[selectedDate].month,
      time: selectedTime,
      label: fmtSlotLabel(dates[selectedDate].date, selectedTime),
    });
    onClose();
  };

  return (
    <AnimatedModal open={open} onClose={onClose}>
      <div style={{ background: "white", borderRadius: 14, width: 520, maxWidth: "93vw", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.35)" }}>

        {/* Header */}
        <div style={{ padding: "24px 28px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>{groupLabel}</p>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #ddd", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><CloseIcon /></button>
          </div>
          <div style={{ height: 1, background: "#eee", margin: "18px 0 0" }} />
        </div>

        <div style={{ padding: "20px 28px 24px", maxHeight: "70vh", overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#aaa" }}>
              <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#6a4de8", borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
              Loading slots…
            </div>
          ) : error ? (
            <p style={{ textAlign: "center", color: "#e53935", padding: "24px 0" }}>{error}</p>
          ) : dates.length === 0 ? (
            <p style={{ textAlign: "center", color: "#aaa", padding: "24px 0" }}>No available slots at this time.</p>
          ) : (
            <>
              {/* Services from cart */}
              {services.length > 0 && (
                <div style={{ background: "#f9f7ff", borderRadius: 10, padding: "14px 16px", marginBottom: 20, border: "1px solid #e8e2ff" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#6a4de8", textTransform: "uppercase", letterSpacing: 0.6 }}>
                    Services included
                  </p>
                  {services.map((svc, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderTop: i > 0 ? "1px solid #ede8ff" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <TickIcon />
                        <span style={{ fontSize: 14, color: "#1a1a1a", fontWeight: 500 }}>{svc.title}</span>
                      </div>
                      {svc.duration && (
                        <span style={{ fontSize: 12, color: "#888", flexShrink: 0, marginLeft: 8 }}>{svc.duration}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Arrival question */}
              <p style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>
                When should the professional arrive?
              </p>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: "#666" }}>
                Service will take approx.{" "}
                <strong style={{ color: "#1a1a1a" }}>{durationLabel || "60 mins"}</strong>
              </p>

              {/* Date strip */}
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, marginBottom: 24 }}>
                {dates.map((d, i) => (
                  <button
                    key={d.date}
                    onClick={() => handleSelectDate(i)}
                    style={{
                      flexShrink: 0, minWidth: 64, paddingTop: 10, paddingBottom: 10,
                      borderRadius: 10, border: "1.5px solid",
                      borderColor: i === selectedDate ? "#6a4de8" : "#ddd",
                      background: i === selectedDate ? "#f3f0ff" : "white",
                      cursor: "pointer", textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 12, color: i === selectedDate ? "#6a4de8" : "#888", fontWeight: 500, marginBottom: 4 }}>{d.day}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: i === selectedDate ? "#6a4de8" : "#1a1a1a" }}>{d.num}</div>
                  </button>
                ))}
              </div>

              {/* Time grid */}
              <p style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>
                Select start time of service
              </p>
              {times.length === 0 ? (
                <p style={{ fontSize: 14, color: "#aaa", textAlign: "center", padding: "12px 0" }}>
                  No more slots available for today. Please select another date.
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {times.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      style={{
                        padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: "pointer",
                        border: "1.5px solid",
                        borderColor: t === selectedTime ? "#6a4de8" : "#ddd",
                        background: t === selectedTime ? "#f3f0ff" : "white",
                        color: t === selectedTime ? "#6a4de8" : "#1a1a1a",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={!selectedTime || loading}
          style={{
            display: "block", width: "100%", padding: "16px 0", border: "none",
            background: selectedTime && !loading ? "linear-gradient(90deg,#6a4de8,#7b5cfa)" : "#e0e0e0",
            color: selectedTime && !loading ? "white" : "#aaa",
            fontWeight: 700, fontSize: 16,
            cursor: selectedTime && !loading ? "pointer" : "not-allowed",
            transition: "background 0.2s",
          }}
        >
          Confirm
        </button>
      </div>
    </AnimatedModal>
  );
}

/* ═══════════════════════════════════════════════════════════
   SELECT SLOTS MODAL
═══════════════════════════════════════════════════════════ */
function SelectSlotsModal({ open, onClose, groups, slotSelections, onOpenPicker, onConfirmAll }) {
  const allSelected = groups.length > 0 && groups.every((g) => slotSelections[g]);

  return (
    <AnimatedModal open={open} onClose={onClose}>
      <div style={{ background: "white", borderRadius: 14, width: 500, maxWidth: "92vw", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.35)", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", zIndex: 10, top: -46, right: 0, width: 36, height: 36, borderRadius: "50%", border: "2px solid #fff", background: "rgba(0,0,0,.65)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><CloseIcon c="white" /></button>

        <div style={{ padding: "26px 28px 0" }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>Select slots</p>
        </div>

        <div style={{ padding: "16px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map((g) => {
            const sel = slotSelections[g];
            return (
              <div key={g} style={{ border: "1.5px solid #e5e5e5", borderRadius: 10, padding: "16px 18px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>{g}</p>
                  {sel ? (
                    <>
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>Professional will arrive by</p>
                      <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: "#2e7d32" }}>{sel.label}</p>
                    </>
                  ) : (
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#aaa" }}>No slot selected yet</p>
                  )}
                </div>
                <button
                  onClick={() => onOpenPicker(g)}
                  style={{ flexShrink: 0, padding: "8px 20px", borderRadius: 8, border: "1.5px solid #ddd", background: "white", fontSize: 14, fontWeight: 600, color: "#1a1a1a", cursor: "pointer" }}
                >
                  {sel ? "Edit" : "Select"}
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => { if (allSelected) { onConfirmAll(); onClose(); } }}
          disabled={!allSelected}
          style={{
            display: "block", width: "100%", padding: "16px 0", border: "none",
            background: allSelected ? "linear-gradient(90deg,#6a4de8,#7b5cfa)" : "#e0e0e0",
            color: allSelected ? "white" : "#aaa",
            fontWeight: 700, fontSize: 16,
            cursor: allSelected ? "pointer" : "not-allowed",
          }}
        >
          Confirm
        </button>
      </div>
    </AnimatedModal>
  );
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */
const S = {
  page: { background: "#f5f5f5", minHeight: "100vh", paddingTop: 30, fontFamily: "'Roboto',sans-serif" },
  container: { display: "flex", gap: 30, maxWidth: 1100, margin: "0 auto", padding: "0 20px" },
  left: { flex: 2, display: "flex", flexDirection: "column", gap: 16 },
  right: { flex: 1, display: "flex", flexDirection: "column", gap: 16 },
  card: { background: "white", padding: "18px 20px", borderRadius: 10, border: "1px solid #e5e5e5" },
  cardRow: { display: "flex", alignItems: "center", gap: 14 },
  iconCircle: { width: 36, height: 36, borderRadius: "50%", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardLabel: { fontSize: 15, fontWeight: 500, color: "#1a1a1a", margin: 0 },
  cardSub: { fontSize: 13, color: "#555", margin: "3px 0 0" },
  editBtn: { marginLeft: "auto", border: "1px solid #ccc", borderRadius: 6, padding: "5px 14px", fontSize: 13, background: "white", cursor: "pointer", color: "#1a1a1a", fontWeight: 500 },
  slotBtn: { width: "100%", padding: "13px 0", border: "none", borderRadius: 8, background: "linear-gradient(90deg,#6a4de8,#7b5cfa)", color: "white", fontWeight: 600, fontSize: 15, cursor: "pointer", marginTop: 12 },
  policyBox: { padding: "4px 0 10px" },
  policyTitle: { fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" },
  policyDesc: { fontSize: 13, color: "#555", margin: 0 },
  policyLink: { fontSize: 13, color: "#1a1a1a", textDecoration: "underline", cursor: "pointer", display: "inline-block", marginTop: 4 },
  serviceSection: { background: "white", borderRadius: 10, border: "1px solid #e5e5e5", padding: "18px 20px" },
  serviceTitle: { fontSize: 17, fontWeight: 600, color: "#1a1a1a", margin: "0 0 12px" },
  divider: { height: 1, background: "#e5e5e5", margin: "12px 0" },
  serviceItem: { marginBottom: 14 },
  qtyPriceRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 8 },
  qtyBox: { display: "flex", alignItems: "center", border: "1px solid #c8b8ff", borderRadius: 6, overflow: "hidden" },
  qtyBtn: { width: 30, height: 30, border: "none", background: "white", color: "#6a4de8", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 },
  qtyNum: { width: 30, textAlign: "center", fontSize: 14, fontWeight: 500, color: "#1a1a1a" },
  itemPrice: { marginLeft: "auto", fontSize: 14, fontWeight: 500, color: "#1a1a1a" },
  bullets: { margin: "8px 0 0 4px", padding: 0, listStyle: "disc", paddingLeft: 18 },
  bulletItem: { fontSize: 12, color: "#555", marginBottom: 2 },
  editPkg: { fontSize: 13, color: "#1a1a1a", textDecoration: "underline", cursor: "pointer", display: "inline-block", marginTop: 8 },
  checkboxRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTop: "1px solid #e5e5e5" },
  checkboxLabel: { fontSize: 13, color: "#333" },
  couponsRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "white", borderRadius: 10, border: "1px solid #e5e5e5", cursor: "pointer" },
  couponsLeft: { display: "flex", alignItems: "center", gap: 10 },
  couponsIcon: { width: 30, height: 30, borderRadius: "50%", background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 },
  couponsText: { fontSize: 14, fontWeight: 500, color: "#1a1a1a" },
  couponsRight: { fontSize: 13, color: "#6a4de8", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 },
  amountCard: { background: "white", borderRadius: 10, border: "1px solid #e5e5e5", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  amountLabel: { fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0 },
  amountValue: { fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  viewBreakup: { fontSize: 13, color: "#1a1a1a", textDecoration: "underline", cursor: "pointer", display: "block", textAlign: "right", marginTop: 6 },
  loading: { textAlign: "center", padding: 40, color: "#888", fontSize: 15 },
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
const ViewCartComponent = () => {
  const [cartItems, setCartItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [cartLoading, setCartLoading] = useState(true);
  const [avoidCall, setAvoidCall] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [addresses, setAddresses] = useState([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [activeAddr, setActiveAddr] = useState(null);

  const [showSaved, setShowSaved] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapInitial, setMapInitial] = useState(null);

  // Slot state
  const [showSelectSlots, setShowSelectSlots] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerGroup, setPickerGroup] = useState("");
  const [slotSelections, setSlotSelections] = useState({});

  /* Fetch cart */
  useEffect(() => {
    (async () => {
      try {
        const user = getAuth().currentUser;
        if (!user) { setCartLoading(false); return; }
        setUserEmail(user.email || "");
        const token = await user.getIdToken();
        const res = await fetch(`${BASE}/api/cart/details`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.status === "success") {
          setCartItems(data.data);
          const q = {};
          data.data.forEach((item) => { q[item.id] = item.qty; });
          setQuantities(q);
        }
      } catch (err) { console.error(err); }
      finally { setCartLoading(false); }
    })();
  }, []);

  /* Fetch addresses */
  const fetchAddresses = useCallback(async () => {
    setAddrLoading(true);
    try {
      const res = await authFetch("/api/addresses");
      const data = await res.json();
      if (data.status === "success") {
        setAddresses(data.data);
        const def = data.data.find((a) => a.is_default) || data.data[0] || null;
        if (def) setActiveAddr(def);
      }
    } catch (err) { console.error(err); }
    finally { setAddrLoading(false); }
  }, []);

  useEffect(() => { fetchAddresses(); }, []);

  const addrShort = activeAddr
    ? `${activeAddr.label} – ${activeAddr.house_flat ? activeAddr.house_flat + ", " : ""}${activeAddr.full_address}`.slice(0, 48) + "…"
    : "Select address";

  const handleSelectAddress = async (addr) => {
    setActiveAddr(addr);
    try {
      await authFetch(`/api/addresses/${addr.id}/default`, { method: "PATCH" });
      setAddresses((p) => p.map((a) => ({ ...a, is_default: a.id === addr.id })));
    } catch { }
    setShowSaved(false);
  };

  const handleDeleteAddress = async (id) => {
    try {
      await authFetch(`/api/addresses/${id}`, { method: "DELETE" });
      setAddresses((prev) => {
        const next = prev.filter((a) => a.id !== id);
        if (activeAddr?.id === id) setActiveAddr(next[0] || null);
        return next;
      });
    } catch (err) { console.error(err); }
  };
  const navigate = useNavigate();
  const handleAddressSaved = (newAddr) => {
    setAddresses((prev) => [newAddr, ...prev.map((a) => ({ ...a, is_default: false }))]);
    setActiveAddr(newAddr);
  };

  const openMap = () => {
    setShowSaved(false);
    setTimeout(() => {
      setMapInitial(activeAddr ? { address: activeAddr.full_address, lat: activeAddr.lat, lng: activeAddr.lng } : null);
      setShowMap(true);
    }, 300);
  };

  const adjustQty = (id, delta) => setQuantities((q) => ({ ...q, [id]: Math.max(1, (q[id] ?? 1) + delta) }));

  const groups = cartItems.reduce((acc, item) => {
    const label = GROUP_LABELS[item.source] || item.source;
    if (!acc[label]) acc[label] = [];
    acc[label].push(item);
    return acc;
  }, {});

  const groupLabels = Object.keys(groups);

  const total = cartItems.reduce((sum, item) => sum + item.actual_price * (quantities[item.id] ?? item.qty), 0);

  // 🔥 ADD HERE
  const handlePayment = async () => {
    const token = await getToken();

    const res = await fetch(`${BASE}/api/payment/create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount: total * 100 }),
    });

    const data = await res.json();
    const order = data.order;

    const options = {
      key: "rzp_test_SjdYfXttqUz1tz",
      amount: order.amount,
      currency: "INR",
      order_id: order.id,
      prefill: {
        email: userEmail,
      },

      handler: async function (response) {
        await fetch(`${BASE}/api/payment/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...response,
            amount: order.amount,
            address: activeAddr,
            slots: slotSelections,
            cart: cartItems,
            quantities: quantities
          }),
        });

        // 🧹 CLEAR FRONTEND STATE
        setCartItems([]);
        setQuantities({});
        setSlotSelections({});

        navigate("/");
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const openPickerFor = (groupLabel) => { setPickerGroup(groupLabel); setShowPicker(true); };

  const handleSlotConfirmed = (sel) => {
    const updatedSelections = { ...slotSelections, [sel.group]: sel };
    setSlotSelections(updatedSelections);
    setShowPicker(false);
    setShowSelectSlots(true);
  };

  // ✅ All slots selected check
  const allSlotsSelected = groupLabels.length > 0 && groupLabels.every((g) => slotSelections[g]);

  // Slot summary for the left card
  const slotSummary = allSlotsSelected
    ? groupLabels.map((g) => `${g} – ${slotSelections[g].label}`).join("  •  ")
    : null;

  return (
    <>
      <div style={S.page}>
        <div style={S.container}>

          {/* ── LEFT COLUMN ── */}
          <div style={S.left}>

            {/* Email card */}
            <div style={S.card}>
              <div style={S.cardRow}>
                <div style={S.iconCircle}><PinIcon /></div>
                <div>
                  <p style={S.cardLabel}>Send booking details to</p>
                  <p style={S.cardSub}>{userEmail || "Loading…"}</p>
                </div>
              </div>
            </div>

            {/* Address card */}
            <div style={S.card}>
              <div style={S.cardRow}>
                <div style={S.iconCircle}><PinIcon /></div>
                <div style={{ flex: 1 }}>
                  <p style={S.cardLabel}>Address</p>
                  <p style={S.cardSub}>{addrLoading ? "Loading…" : addrShort}</p>
                </div>
                <button style={S.editBtn} onClick={() => setShowSaved(true)}>Edit</button>
              </div>
            </div>

            {/* Slot card */}
            <div style={S.card}>
              <div style={S.cardRow}>
                <div style={S.iconCircle}><ClockIcon /></div>
                <div style={{ flex: 1 }}>
                  <p style={S.cardLabel}>Slot</p>
                  {slotSummary && (
                    <p style={{ fontSize: 13, color: "#2e7d32", margin: "3px 0 0", fontWeight: 500 }}>
                      {groupLabels.map((g) => slotSelections[g]?.label).join("  •  ")}
                    </p>
                  )}
                </div>
                {slotSummary && (
                  <button style={S.editBtn} onClick={() => setShowSelectSlots(true)}>Edit</button>
                )}
              </div>
              {!slotSummary && (
                <button style={S.slotBtn} onClick={() => setShowSelectSlots(true)}>
                  Select time &amp; date
                </button>
              )}
            </div>

            {/* ✅ Payment Method card — always visible, Proceed to Pay inside */}
            <div style={S.card}>
              <div style={S.cardRow}>
                <div style={{ ...S.iconCircle, background: "#f8f8f8" }}>
                  <CardIcon />
                </div>
                <p style={{ ...S.cardLabel, color: allSlotsSelected ? "#1a1a1a" : "#aaa" }}>
                  Payment Method
                </p>
              </div>

              {/* ✅ Proceed to Pay button — always rendered, enabled only when slots selected */}
              <button
                onClick={() => {
                  if (allSlotsSelected) {
                    handlePayment();   // 🔥 THIS LINE
                  }
                }}
                disabled={!allSlotsSelected}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  border: "none",
                  borderRadius: 8,
                  marginTop: 14,
                  background: allSlotsSelected
                    ? "linear-gradient(90deg,#6a4de8,#7b5cfa)"
                    : "#e0e0e0",
                  color: allSlotsSelected ? "white" : "#aaa",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: allSlotsSelected ? "pointer" : "not-allowed",
                  transition: "background 0.25s",
                }}
              >
                Proceed to pay
              </button>

              {/* T&C notice shown when ready to pay */}
              {allSlotsSelected && (
                <p style={{ textAlign: "center", fontSize: 12, color: "#888", margin: "10px 0 0" }}>
                  By proceeding, you agree to our{" "}
                  <span style={{ textDecoration: "underline", cursor: "pointer", color: "#555" }}>T&amp;C</span>,{" "}
                  <span style={{ textDecoration: "underline", cursor: "pointer", color: "#555" }}>Privacy</span> and{" "}
                  <span style={{ textDecoration: "underline", cursor: "pointer", color: "#555" }}>Cancellation Policy</span>
                </p>
              )}
            </div>

            {/* Cancellation policy */}
            <div style={S.policyBox}>
              <p style={S.policyTitle}>Cancellation &amp; reschedule policy</p>
              <p style={S.policyDesc}>A small fee may apply depending on the service if you cancel or reschedule after a certain time</p>
              <span style={S.policyLink}>Read full policy</span>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={S.right}>
            {cartLoading ? (
              <div style={S.loading}>Loading cart…</div>
            ) : (
              <>
                {Object.entries(groups).map(([groupLabel, items]) => {
                  const isBathroom = items.some((i) => BATHROOM_SOURCES.has(i.source));
                  return (
                    <div key={groupLabel} style={S.serviceSection}>
                      <p style={S.serviceTitle}>{groupLabel}</p>
                      {items.map((item, idx) => {
                        const bulletList = parseBullets(item.bullets);
                        const qty = quantities[item.id] ?? item.qty;
                        return (
                          <React.Fragment key={item.id}>
                            {idx > 0 && <div style={S.divider} />}
                            <div style={S.serviceItem}>
                              {isBathroom && (
                                <div style={{ marginBottom: 8 }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 0.8, margin: 0, textTransform: "uppercase" }}>Bathroom Maintenance Pack</p>
                                  <p style={{ fontSize: 13, color: "#333", margin: "2px 0 0" }}>{qty} visit{qty !== 1 ? "s" : ""}: {item.title}</p>
                                  <p style={{ fontSize: 12, color: "#888", margin: "1px 0 0" }}>{qty} visit{qty !== 1 ? "s" : ""}</p>
                                </div>
                              )}
                              <div style={S.qtyPriceRow}>
                                <p style={{ ...S.cardLabel, flex: 1, margin: 0 }}>{item.title}</p>
                                <div style={S.qtyBox}>
                                  <button style={S.qtyBtn} onClick={() => adjustQty(item.id, -1)}>−</button>
                                  <span style={S.qtyNum}>{qty}</span>
                                  <button style={S.qtyBtn} onClick={() => adjustQty(item.id, +1)}>+</button>
                                </div>
                                <span style={S.itemPrice}>{fmt(item.actual_price * qty)}</span>
                              </div>
                              {bulletList.length > 0 && (
                                <ul style={S.bullets}>{bulletList.map((b, i) => <li key={i} style={S.bulletItem}>{b}</li>)}</ul>
                              )}
                              {!isBathroom && <span style={S.editPkg}>Edit package</span>}
                            </div>
                          </React.Fragment>
                        );
                      })}
                      {isBathroom && (
                        <div style={S.checkboxRow}>
                          <input type="checkbox" id="avoid-call" checked={avoidCall} onChange={(e) => setAvoidCall(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#6a4de8", cursor: "pointer" }} />
                          <label htmlFor="avoid-call" style={S.checkboxLabel}>Avoid calling before reaching the location</label>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Coupons */}
                <div style={S.couponsRow}>
                  <div style={S.couponsLeft}>
                    <div style={S.couponsIcon}>%</div>
                    <span style={S.couponsText}>Coupons and offers</span>
                  </div>
                  <span style={S.couponsRight}>7 offers <ChevR /></span>
                </div>

                {/* Amount */}
                <div>
                  <div style={S.amountCard}>
                    <p style={S.amountLabel}>Amount to pay</p>
                    <p style={S.amountValue}>{fmt(total)}</p>
                  </div>
                  {/* <span style={S.viewBreakup}>View breakup</span> */}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <SavedAddressModal
        open={showSaved}
        onClose={() => setShowSaved(false)}
        addresses={addresses}
        loading={addrLoading}
        onAddNew={openMap}
        onSelectAddress={handleSelectAddress}
        onDelete={handleDeleteAddress}
      />
      <MapModal
        open={showMap}
        onClose={() => setShowMap(false)}
        initial={mapInitial}
        onSaved={handleAddressSaved}
      />
      <SelectSlotsModal
        open={showSelectSlots}
        onClose={() => setShowSelectSlots(false)}
        groups={groupLabels}
        slotSelections={slotSelections}
        onOpenPicker={(g) => { setShowSelectSlots(false); setTimeout(() => openPickerFor(g), 320); }}
        onConfirmAll={() => { }}
      />
      <SlotPickerModal
        open={showPicker}
        onClose={() => { setShowPicker(false); setShowSelectSlots(true); }}
        groupLabel={pickerGroup}
        onConfirm={handleSlotConfirmed}
      />
    </>
  );
};

export default ViewCartComponent;