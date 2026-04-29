import "../styles/Womensalonservice.css";
import { useEffect, useRef, useState, useCallback } from "react";
import HomepageNavBar from "../components/Homepagenav.jsx";
import Hls from "hls.js";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
const BASE = "https://urban-ease-theta.vercel.app";

// Stale-while-revalidate: show cached data immediately, refresh silently in bg
const BOOTSTRAP_CACHE_KEY = "urbanease_bootstrap_v1";
const BOOTSTRAP_CACHE_TTL = 5 * 60 * 1000; // 5 min (matches half the server TTL)

// ─────────────────────────────────────────────
//  BOOTSTRAP CACHE  (localStorage as L1 cache)
//  Server cache is L2; DB is L3.
// ─────────────────────────────────────────────
function readBootstrapCache() {
  try {
    const raw = localStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    const age = Date.now() - ts;
    return { data, stale: age > BOOTSTRAP_CACHE_TTL };
  } catch {
    return null;
  }
}

function writeBootstrapCache(data) {
  try {
    localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota exceeded — ignore */ }
}

// ─────────────────────────────────────────────
//  CART HELPERS
// ─────────────────────────────────────────────
const CART_KEY = "urbanease_cart";

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "{}");
  } catch {
    return {};
  }
}

function getUser() {
  return getAuth().currentUser;
}

async function handleCartUpdate(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));

  const user = getUser();
  if (!user) return;

  const token = await user.getIdToken();
  // fire-and-forget; don't await — keeps UI snappy
  fetch(`${BASE}/api/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      items: Object.entries(cart).map(([id, v]) => ({ id, qty: v.qty, price: v.price })),
    }),
  }).catch(console.error);
}

// ─────────────────────────────────────────────
//  SKELETON PRIMITIVES
// ─────────────────────────────────────────────
function SkeletonBox({ width = "100%", height = "16px", radius = "6px", style = {} }) {
  return (
    <div
      className="skeleton-box"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

function SkeletonTabs() {
  return (
    <div className="wss-tabs-box">
      <SkeletonBox width="80px" height="13px" style={{ marginBottom: "14px" }} />
      <ul className="wss-tabs">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="wss-tab" style={{ cursor: "default" }}>
            <div className="wss-tab-thumb">
              <SkeletonBox width="56px" height="56px" radius="10px" />
            </div>
            <SkeletonBox width="60px" height="11px" style={{ marginTop: "6px" }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonPackageCard() {
  return (
    <div className="package-card skeleton-card">
      <div className="package-details" style={{ flex: 1 }}>
        <SkeletonBox width="70px" height="18px" radius="4px" style={{ marginBottom: "10px" }} />
        <SkeletonBox width="55%" height="20px" style={{ marginBottom: "8px" }} />
        <SkeletonBox width="35%" height="13px" style={{ marginBottom: "12px" }} />
        <SkeletonBox width="45%" height="16px" style={{ marginBottom: "14px" }} />
        <SkeletonBox width="100%" height="1px" style={{ marginBottom: "14px", opacity: 0.3 }} />
        <SkeletonBox width="90%" height="12px" style={{ marginBottom: "7px" }} />
        <SkeletonBox width="80%" height="12px" style={{ marginBottom: "7px" }} />
        <SkeletonBox width="85%" height="12px" style={{ marginBottom: "18px" }} />
        <SkeletonBox width="130px" height="34px" radius="8px" />
      </div>
      <div className="package-action" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        <SkeletonBox width="62px" height="72px" radius="10px" />
        <SkeletonBox width="62px" height="34px" radius="8px" />
      </div>
    </div>
  );
}

function SkeletonServiceCard() {
  return (
    <div className="svc-card skeleton-card">
      <SkeletonBox width="100%" height="160px" radius="10px 10px 0 0" />
      <div className="svc-details-row" style={{ padding: "12px 14px" }}>
        <div className="svc-info" style={{ flex: 1 }}>
          <SkeletonBox width="65%" height="15px" style={{ marginBottom: "8px" }} />
          <SkeletonBox width="45%" height="12px" style={{ marginBottom: "8px" }} />
          <SkeletonBox width="35%" height="13px" />
        </div>
        <div className="svc-action-col">
          <SkeletonBox width="62px" height="34px" radius="8px" />
        </div>
      </div>
      <div style={{ padding: "0 14px 10px" }}>
        <SkeletonBox width="90%" height="11px" style={{ marginBottom: "5px" }} />
        <SkeletonBox width="75%" height="11px" style={{ marginBottom: "5px" }} />
      </div>
      <SkeletonBox width="120px" height="32px" radius="6px" style={{ margin: "0 14px 14px" }} />
    </div>
  );
}

// ─────────────────────────────────────────────
//  QUANTITY BUTTON
// ─────────────────────────────────────────────
function QuantityBtn({ id, price, cart, setCart }) {
  const qty = cart[id]?.qty ?? 0;

  const update = useCallback((delta) => {
    setCart((prev) => {
      const next = { ...prev };
      const newQty = (next[id]?.qty ?? 0) + delta;
      if (newQty <= 0) delete next[id];
      else next[id] = { qty: newQty, price };
      handleCartUpdate(next);
      return next;
    });
  }, [id, price]);

  if (qty === 0) {
    return <button className="add-btn" onClick={() => update(1)}>Add</button>;
  }
  return (
    <div className="qty-stepper">
      <button className="qty-btn" onClick={() => update(-1)}>−</button>
      <span className="qty-value">{qty}</span>
      <button className="qty-btn" onClick={() => update(1)}>+</button>
    </div>
  );
}

// ─────────────────────────────────────────────
//  SERVICE CARD
// ─────────────────────────────────────────────
function ServiceCard({ service, cart, setCart }) {
  return (
    <div className="svc-card">
      <div className="svc-banner">
        {service.badge && <span className="svc-badge">{service.badge}</span>}
        <img src={service.bannerImg} alt={service.title} className="svc-banner-img" loading="lazy" />
        <div className="svc-banner-overlay">
          <h3 className="svc-banner-heading">{service.bannerHeading}</h3>
        </div>
      </div>
      <div className="svc-details-row">
        <div className="svc-info">
          <p className="svc-name">{service.title}</p>
          <div className="svc-meta">
            <span className="svc-rating-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#572AC8" style={{ borderRadius: "50%", flexShrink: 0 }}>
                <circle cx="12" cy="12" r="12" />
              </svg>
              <span className="svc-rating-num">{service.rating}</span>
              <span className="svc-reviews">({service.reviews} reviews)</span>
            </span>
          </div>
          <p className="svc-starts">Starts at ₹{service.price.toLocaleString()}</p>
        </div>
        <div className="svc-action-col">
          <QuantityBtn id={service.id} price={service.price} cart={cart} setCart={setCart} />
          {service.options && <span className="svc-options">{service.options} options</span>}
        </div>
      </div>
      {service.bullets && (
        <ul className="svc-bullets">
          {service.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
      <button className="svc-view-details">View details</button>
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────
export default function WomenSalonandSpa() {
  const videoRef    = useRef(null);
  const fillRef     = useRef(null);
  const rightPaneRef = useRef(null);
  const navigate = useNavigate();
  const [cart, setCart]                   = useState(loadCart);
  const [activeTab, setActiveTab]         = useState(null);
  const [offersExpanded, setOffersExpanded] = useState(false);

  // ── all catalogue data from single bootstrap call ─────────────────────────
  const [catalogue, setCatalogue] = useState(null);  // null = loading
  const [tabSectionMap, setTabSectionMap] = useState({});

  // ── derived slices (zero extra fetches) ──────────────────────────────────
  const WomenService   = catalogue?.salon_prime        ?? [];
  const packages       = catalogue?.packages           ?? [];
  const waxingServices = catalogue?.services?.waxing   ?? [];
  const koreanfacial   = catalogue?.services?.korean_facial   ?? [];
  const signaturefacial = catalogue?.services?.signature_facial ?? [];
  const pedicuremanicure = catalogue?.services?.pedicure_manicure ?? [];
  const discounts      = catalogue?.discounts          ?? [];

  const loading = catalogue === null;

  // ── stale-while-revalidate bootstrap ─────────────────────────────────────
  useEffect(() => {
    const cached = readBootstrapCache();

    // Show stale data immediately so the page renders right away
    if (cached) {
      setCatalogue(cached.data);
      if (!cached.stale) return;   // fresh → no need to re-fetch
    }

    // Fetch fresh data (first load or stale cache)
    fetch(`${BASE}/api/bootstrap`)
      .then((r) => r.json())
      .then(({ data }) => {
        setCatalogue(data);
        writeBootstrapCache(data);
      })
      .catch(console.error);
  }, []);

  // ── cart: hydrate from backend if logged in ───────────────────────────────
  useEffect(() => {
    async function loadCartData() {
      const user = getUser();
      if (!user) {
        setCart(loadCart());
        return;
      }
      const token = await user.getIdToken();
      fetch(`${BASE}/api/cart`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then(({ cart: serverCart }) => {
          if (serverCart) {
            setCart(serverCart);
            localStorage.setItem(CART_KEY, JSON.stringify(serverCart));
          }
        })
        .catch(console.error);
    }
    loadCartData();
  }, []);
  
  // ── build tab → section map ───────────────────────────────────────────────
  useEffect(() => {
    if (!WomenService.length) return;

    const sectionIds = [
      "sec-packages", "sec-waxing", "sec-korean", "sec-signature", "sec-pedicure",
    ];
    const map = {};
    WomenService.forEach((tab, i) => {
      if (sectionIds[i]) map[tab.id] = sectionIds[i];
    });
    setTabSectionMap(map);

    if (!activeTab) setActiveTab(WomenService[0]?.id ?? null);
  }, [WomenService]);
  
  // ── HLS video ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const src = "https://content.urbancompany.com/videos/supply/customer-app-supply/1773127761044-5daeb8/1773127761044-5daeb8.m3u8";
    const video = videoRef.current;
    if (!video) return;
    const tryPlay = () => video.play().catch(() => {});
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", tryPlay, { once: true });
    } else if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
      return () => hls.destroy();
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const fill  = fillRef.current;
    if (!video || !fill) return;
    const updateProgress = () => {
      if (!video.duration) return;
      fill.style.width = (video.currentTime / video.duration) * 100 + "%";
    };
    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, []);

  // ── tab click handler ─────────────────────────────────────────────────────
  function handleTabClick(tab) {
    setActiveTab(tab.id);
    const sectionId = tabSectionMap[tab.id];
    if (!sectionId) return;
    const sectionEl = document.getElementById(sectionId);
    const paneEl    = rightPaneRef.current;
    if (!sectionEl || !paneEl) return;
    const offset = sectionEl.getBoundingClientRect().top - paneEl.getBoundingClientRect().top + paneEl.scrollTop - 16;
    paneEl.scrollTo({ top: offset, behavior: "smooth" });
  }

  const total     = Object.values(cart).reduce((s, { qty, price }) => s + qty * price, 0);
  const itemCount = Object.values(cart).reduce((s, { qty }) => s + qty, 0);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="wss-root">
      <HomepageNavBar />

      <div className="wss-body">
        {/* LEFT NAV */}
        <div className="wss-left">
          <h2 className="wss-title">Salon Prime</h2>
          <p className="wss-rating">⭐ 4.85 (17.3 M bookings)</p>

          {loading ? (
            <SkeletonTabs />
          ) : (
            <div className="wss-tabs-box">
              <p className="wss-select-label">Select a service</p>
              <ul className="wss-tabs">
                {WomenService.map((tab) => (
                  <li
                    key={tab.id}
                    className={`wss-tab${activeTab === tab.id ? " wss-tab--active" : ""}`}
                    onClick={() => handleTabClick(tab)}
                  >
                    <div className="wss-tab-thumb">
                      <img src={tab.image} alt={tab.title} loading="lazy" />
                    </div>
                    <span className="wss-tab-label">{tab.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* RIGHT SCROLL AREA */}
        <div className="wss-right" ref={rightPaneRef}>
          <div className="wss-content">

            {/* VIDEO */}
            <div className="wss-video-wrapper">
              <video ref={videoRef} className="wss-video" autoPlay muted loop playsInline />
              <div className="wss-progress-bar">
                <div ref={fillRef} className="wss-progress-fill" />
              </div>
            </div>

            <div className="main-layout">
              <div className="main-content-col">

                {/* SUPER SAVER PACKAGES */}
                <div className="package-section" id="sec-packages">
                  <div className="package-heading">Super saver packages</div>
                  <div className="package-cards-col">
                    {loading ? (
                      <><SkeletonPackageCard /><SkeletonPackageCard /></>
                    ) : (
                      packages.map((pkg) => (
                        <div key={pkg.id} className="package-card">
                          <div className="package-details">
                            <div className="package-tag">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="#07794C">
                                <path d="M9.3 3H4.8A1.8 1.8 0 003 4.8v14.4A1.8 1.8 0 004.8 21h14.4a1.8 1.8 0 001.8-1.8V4.8A1.8 1.8 0 0019.2 3h-4.5v9L12 10.65 9.3 12V3z" />
                              </svg>
                              <span>PACKAGE</span>
                            </div>
                            <h3 className="package-title">{pkg.title}</h3>
                            <p className="package-rating">
                              <span className="star-icon">★</span> 4.85 ({pkg.reviews} reviews)
                            </p>
                            <div className="package-pricing">
                              <span className="price">₹{pkg.price.toLocaleString()}</span>
                              <span className="old-price">₹{pkg.oldPrice.toLocaleString()}</span>
                              <span className="duration">• {pkg.duration}</span>
                            </div>
                            <hr className="divider" />
                            <ul className="package-includes">
                              {pkg.includes.map((inc, i) => (
                                <li key={i}><strong>{inc.label}:</strong> {inc.desc}</li>
                              ))}
                            </ul>
                            <button className="edit-btn">Edit your package</button>
                          </div>
                          <div className="package-action">
                            <div className={`discount-badge ${pkg.badgeClass ?? ""}`}>
                              <span className="discount-val">{pkg.discount}%</span>
                              <span className="discount-label">OFF</span>
                            </div>
                            <QuantityBtn id={pkg.id} price={pkg.price} cart={cart} setCart={setCart} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* WAXING & THREADING */}
                <div className="svc-section" id="sec-waxing">
                  <div className="svc-section-heading">Waxing &amp; threading</div>
                  <div className="package-cards-col">
                    {loading ? (
                      <><SkeletonServiceCard /><SkeletonServiceCard /><SkeletonServiceCard /></>
                    ) : (
                      waxingServices.map((svc) => (
                        <ServiceCard key={svc.id + svc.category} service={svc} cart={cart} setCart={setCart} />
                      ))
                    )}
                  </div>
                </div>

                {/* KOREAN FACIAL */}
                <div className="svc-section" id="sec-korean">
                  <div className="svc-section-heading">Korean facial</div>
                  <div className="package-cards-col">
                    {loading ? (
                      <><SkeletonServiceCard /><SkeletonServiceCard /></>
                    ) : (
                      koreanfacial.map((svc) => (
                        <ServiceCard key={svc.id + svc.category} service={svc} cart={cart} setCart={setCart} />
                      ))
                    )}
                  </div>
                </div>

                {/* SIGNATURE FACIAL */}
                <div className="svc-section" id="sec-signature">
                  <div className="svc-section-heading">Signature facial</div>
                  <div className="package-cards-col">
                    {loading ? (
                      <><SkeletonServiceCard /><SkeletonServiceCard /></>
                    ) : (
                      signaturefacial.map((svc) => (
                        <ServiceCard key={svc.id + svc.category} service={svc} cart={cart} setCart={setCart} />
                      ))
                    )}
                  </div>
                </div>

                {/* PEDICURE & MANICURE */}
                <div className="svc-section" id="sec-pedicure">
                  <div className="svc-section-heading">Pedicure &amp; manicure</div>
                  <div className="package-cards-col">
                    {loading ? (
                      <><SkeletonServiceCard /><SkeletonServiceCard /><SkeletonServiceCard /></>
                    ) : (
                      pedicuremanicure.map((svc) => (
                        <ServiceCard key={svc.id + svc.category} service={svc} cart={cart} setCart={setCart} />
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* SIDEBAR */}
              <div className="main-sidebar">
                <div className="sidebar-offers-box">
                  {discounts
                    .slice(0, offersExpanded ? discounts.length : 1)
                    .map((d, i) => (
                      <div key={d.id} className={`sidebar-promo${i > 0 ? " sidebar-promo--extra" : ""}`}>
                        <div className="promo-icon">%</div>
                        <div className="promo-text">
                          <p>{d.title}</p>
                          <span>{d.description}</span>
                        </div>
                      </div>
                    ))}
                  {discounts.length > 1 && (
                    <button className="offers-toggle-btn" onClick={() => setOffersExpanded((v) => !v)}>
                      {offersExpanded ? "View Less Offers ▲" : "View More Offers ▼"}
                    </button>
                  )}
                </div>

                {itemCount === 0 ? (
                  <div className="cart-empty">
                    <img src="https://cdn-icons-png.flaticon.com/512/11329/11329961.png" alt="cart" />
                    <p>No items in your cart</p>
                  </div>
                ) : (
                  <div className="cart-summary">
                    <div className="cart-summary-inner">
                      <div className="cart-summary-info">
                        <span className="cart-total">₹{total.toLocaleString()}</span>
                        <span className="cart-items">{itemCount} item{itemCount > 1 ? "s" : ""}</span>
                      </div>
                      <button className="view-cart-btn" onClick={()=>navigate("/checkout")}>View Cart</button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}