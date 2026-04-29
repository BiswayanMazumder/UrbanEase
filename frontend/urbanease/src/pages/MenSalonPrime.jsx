import "../styles/Womensalonservice.css";
import { useEffect, useRef, useState } from "react";
import HomepageNavBar from "../components/Homepagenav.jsx";
import Hls from "hls.js";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
// ── helpers ──────────────────────────────────────────────────────────────────
const CART_KEY = "urbanease_cart";
const BASE = "https://urban-ease-theta.vercel.app";

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function getUser() {
  return getAuth().currentUser;
}
async function handleCartUpdate(cart) {
  const user = getUser();
  if (!user) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    return;
  }
  const token = await user.getIdToken();
  await fetch(`${BASE}/api/cart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items: Object.entries(cart).map(([id, v]) => ({
        id,
        qty: v.qty,
        price: v.price,
      })),
    }),
  });
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// ── Skeleton primitives ───────────────────────────────────────────────────────
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

// ── QuantityBtn ───────────────────────────────────────────────────────────────
function QuantityBtn({ id, price, cart, setCart }) {
  const qty = cart[id]?.qty ?? 0;

  function update(delta) {
    setCart((prev) => {
      const next = { ...prev };
      const newQty = (next[id]?.qty ?? 0) + delta;
      if (newQty <= 0) delete next[id];
      else next[id] = { qty: newQty, price };
      handleCartUpdate(next);
      return next;
    });
  }

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

// ── ServiceCard ───────────────────────────────────────────────────────────────
function ServiceCard({ service, cart, setCart }) {
  return (
    <div className="svc-card">
      <div className="svc-banner">
        {service.badge && <span className="svc-badge">{service.badge}</span>}
        <img src={service.bannerImg} alt={service.title} className="svc-banner-img" />
        <div className="svc-banner-overlay">
          <h3 className="svc-banner-heading">{service.title}</h3>
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
          <p className="svc-starts">
            {service.options ? `Starts at ₹${service.price?.toLocaleString()}` : `₹${service.price?.toLocaleString()}`}
          </p>
          {service.description && (
            <p className="svc-description">{service.description}</p>
          )}
        </div>
        <div className="svc-action-col">
          <QuantityBtn id={service.id} price={service.price} cart={cart} setCart={setCart} />
          {service.options && (
            <span className="svc-options">{service.options} options</span>
          )}
        </div>
      </div>

      {service.bullets && service.bullets.length > 0 && (
        <ul className="svc-bullets">
          {service.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}

      <button className="svc-view-details">View details</button>
    </div>
  );
}

// ── Section config — one source of truth ─────────────────────────────────────
const SECTIONS = [
  { id: "sec-packages",  heading: "Packages",             key: "packages"               },
  { id: "sec-haircut",   heading: "Haircut & Beard",       key: "haircut_beard_styling"  },
  { id: "sec-facial",    heading: "Facial & Cleanup",      key: "facial_cleanup"         },
  { id: "sec-detan",     heading: "Detan",                 key: "detan"                  },
  { id: "sec-mani-pedi", heading: "Manicure & Pedicure",   key: "manicure_pedicure"      },
  { id: "sec-massage",   heading: "Massage",               key: "massage"                },
  { id: "sec-haircolor", heading: "Hair Color",            key: "hair_color"             },
];

// ── main ──────────────────────────────────────────────────────────────────────
export default function MenSalonAndSpa() {
  const videoRef    = useRef(null);
  const fillRef     = useRef(null);
  const rightPaneRef = useRef(null);
  const navigate = useNavigate();
  const [cart, setCart]         = useState(loadCart);
  const [activeTab, setActiveTab] = useState(null);

  // ── data from DB ──────────────────────────────────────────────────────────
  const [tabs, setTabs]         = useState([]);
  const [packages, setPackages] = useState([]);
  const [discounts, setDiscounts] = useState([]);

  // services keyed by category string
  const [servicesMap, setServicesMap] = useState({});

  // ── loading states ────────────────────────────────────────────────────────
  const [loadingTabs, setLoadingTabs]         = useState(true);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [offersExpanded, setOffersExpanded]   = useState(false);

  const total     = Object.values(cart).reduce((sum, { qty, price }) => sum + qty * price, 0);
  const itemCount = Object.values(cart).reduce((sum, { qty }) => sum + qty, 0);

  // ── restore cart from server if logged in ────────────────────────────────
  useEffect(() => {
    async function loadCartData() {
      const user = getUser();
      if (!user) {
        setCart(JSON.parse(localStorage.getItem(CART_KEY) || "{}"));
        return;
      }
      const token = await user.getIdToken();
      const res   = await fetch(`${BASE}/api/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.cart) {
        setCart(data.cart);
        localStorage.setItem(CART_KEY, JSON.stringify(data.cart));
      }
    }
    loadCartData();
  }, []);

  // ── fetch discounts ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BASE}/api/discounts`)
      .then((r) => r.json())
      .then((data) => setDiscounts(data.data || []))
      .catch(console.error);
  }, []);

  // ── HLS video ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const src   = "https://content.urbancompany.com/videos/growth/luminosity/1695886157584-762198/1695886157584-762198.m3u8";
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
    const update = () => {
      if (!video.duration) return;
      fill.style.width = (video.currentTime / video.duration) * 100 + "%";
    };
    video.addEventListener("timeupdate", update);
    return () => video.removeEventListener("timeupdate", update);
  }, []);

  // ── fetch all men's data ──────────────────────────────────────────────────
  useEffect(() => {
    // 1. nav tabs
    fetch(`${BASE}/api/men-salon-prime`)
      .then((r) => r.json())
      .then((data) => {
        const t = data.data || [];
        setTabs(t);
        if (t.length > 0) setActiveTab(t[0].id);
      })
      .catch(console.error)
      .finally(() => setLoadingTabs(false));

    // 2. men packages  ← new endpoint
    fetch(`${BASE}/api/men/packages`)
      .then((r) => r.json())
      .then((data) => setPackages(data.data || []))
      .catch(console.error)
      .finally(() => setLoadingPackages(false));

    // 3. men services — all categories in parallel  ← new endpoint
    const cats = SECTIONS.filter((s) => s.key !== "packages").map((s) => s.key);
    Promise.all(
      cats.map((cat) =>
        fetch(`${BASE}/api/men/services/${cat}`)
          .then((r) => r.json())
          .then((data) => ({ cat, items: data.data || [] }))
          .catch(() => ({ cat, items: [] }))
      )
    )
      .then((results) => {
        const map = {};
        results.forEach(({ cat, items }) => { map[cat] = items; });
        setServicesMap(map);
      })
      .finally(() => setLoadingServices(false));
  }, []);

  // ── tab click → smooth scroll to section ─────────────────────────────────
  function handleTabClick(tab, index) {
    setActiveTab(tab.id);
    const sectionId = SECTIONS[index]?.id;
    if (!sectionId) return;
    const sectionEl = document.getElementById(sectionId);
    const paneEl    = rightPaneRef.current;
    if (!sectionEl || !paneEl) return;
    const paneTop    = paneEl.getBoundingClientRect().top;
    const sectionTop = sectionEl.getBoundingClientRect().top;
    const offset     = sectionTop - paneTop + paneEl.scrollTop - 16;
    paneEl.scrollTo({ top: offset, behavior: "smooth" });
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="wss-root">
      <HomepageNavBar />

      <div className="wss-body">
        {/* LEFT NAV */}
        <div className="wss-left">
          <h2 className="wss-title">Men Salon Prime</h2>
          <p className="wss-rating">⭐ 4.86 (12.5 M bookings)</p>

          {loadingTabs ? (
            <SkeletonTabs />
          ) : (
            <div className="wss-tabs-box">
              <p className="wss-select-label">Select a service</p>
              <ul className="wss-tabs">
                {tabs.map((tab, index) => (
                  <li
                    key={tab.id}
                    className={`wss-tab${activeTab === tab.id ? " wss-tab--active" : ""}`}
                    onClick={() => handleTabClick(tab, index)}
                  >
                    <div className="wss-tab-thumb">
                      <img src={tab.image} alt={tab.title} />
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

            {/* ── MAIN LAYOUT ── */}
            <div className="main-layout">
              <div className="main-content-col">

                {/* PACKAGES */}
                <div className="package-section" id="sec-packages">
                  <div className="package-heading">Packages</div>
                  <div className="package-cards-col">
                    {loadingPackages ? (
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
                              <span className="star-icon">★</span> 4.86 ({pkg.reviews} reviews)
                            </p>
                            <div className="package-pricing">
                              <span className="price">₹{pkg.price?.toLocaleString()}</span>
                              {pkg.oldPrice && (
                                <span className="old-price">₹{pkg.oldPrice.toLocaleString()}</span>
                              )}
                              <span className="duration">• {pkg.duration}</span>
                            </div>
                            <hr className="divider" />
                            <ul className="package-includes">
                              {(pkg.includes || []).map((inc, i) => (
                                <li key={i}><strong>{inc.label}:</strong> {inc.desc}</li>
                              ))}
                            </ul>
                            <button className="edit-btn">Edit your package</button>
                          </div>
                          <div className="package-action">
                            {pkg.discount && (
                              <div className={`discount-badge ${pkg.badge ?? ""}`}>
                                <span className="discount-val">{pkg.discount}%</span>
                                <span className="discount-label">OFF</span>
                              </div>
                            )}
                            <QuantityBtn id={pkg.id} price={pkg.price} cart={cart} setCart={setCart} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* SERVICE SECTIONS — rendered from SECTIONS config */}
                {SECTIONS.filter((s) => s.key !== "packages").map((section) => (
                  <div className="svc-section" id={section.id} key={section.id}>
                    <div className="svc-section-heading">{section.heading}</div>
                    <div className="package-cards-col">
                      {loadingServices ? (
                        <><SkeletonServiceCard /><SkeletonServiceCard /></>
                      ) : (
                        (servicesMap[section.key] || []).map((svc) => (
                          <ServiceCard
                            key={svc.id + svc.category}
                            service={svc}
                            cart={cart}
                            setCart={setCart}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}

              </div>

              {/* STICKY SIDEBAR */}
              <div className="main-sidebar">
                <div className="sidebar-offers-box">
                  {discounts
                    .slice(0, offersExpanded ? discounts.length : 1)
                    .map((d, i) => (
                      <div
                        key={d.id}
                        className={`sidebar-promo${i > 0 ? " sidebar-promo--extra" : ""}`}
                      >
                        <div className="promo-icon">%</div>
                        <div className="promo-text">
                          <p>{d.title}</p>
                          <span>{d.description}</span>
                        </div>
                      </div>
                    ))}
                  {discounts.length > 1 && (
                    <button
                      className="offers-toggle-btn"
                      onClick={() => setOffersExpanded((v) => !v)}
                    >
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