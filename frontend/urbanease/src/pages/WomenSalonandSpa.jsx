import "../styles/Womensalonservice.css";
import { useEffect, useRef, useState } from "react";
import HomepageNavBar from "../components/Homepagenav.jsx";
import Hls from "hls.js";

// ── helpers ──────────────────────────────────────────────────────────────────
const CART_KEY = "urbanease_cart";

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
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
      saveCart(next);
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
          <h3 className="svc-banner-heading">{service.bannerHeading}</h3>
          {/* <div className="svc-banner-price-row">
            <span className="svc-banner-price">₹{service.price.toLocaleString()}</span>
            {service.oldPrice && (
              <span className="svc-banner-old-price">₹{service.oldPrice.toLocaleString()}</span>
            )}
          </div> */}
          {/* {service.bannerSub && <p className="svc-banner-sub">{service.bannerSub}</p>} */}
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

// ── main ──────────────────────────────────────────────────────────────────────
export default function WomenSalonandSpa() {
  const videoRef = useRef(null);
  const fillRef = useRef(null);

  const [cart, setCart] = useState(loadCart);
  const [activeTab, setActiveTab] = useState(null);
  const [WomenService, SetWomenService] = useState([]);

  const total = Object.values(cart).reduce((sum, { qty, price }) => sum + qty * price, 0);
  const itemCount = Object.values(cart).reduce((sum, { qty }) => sum + qty, 0);

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
    const fill = fillRef.current;
    if (!video || !fill) return;
    const updateProgress = () => {
      if (!video.duration) return;
      fill.style.width = (video.currentTime / video.duration) * 100 + "%";
    };
    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, []);

  useEffect(() => {
    fetch("https://urban-ease-theta.vercel.app/api/salon-prime")
      .then((res) => res.json())
      .then((data) => {
        const tabs = data.data || [];
        SetWomenService(tabs);
        if (tabs.length > 0) setActiveTab(tabs[0].id);
      })
      .catch((err) => console.error(err));
  }, []);

  const packages = [
    {
      id: "pkg-myop", title: "Make your own package", reviews: "8.2M",
      price: 3192, oldPrice: 4256, duration: "3 hrs 35 mins", discount: 25,
      includes: [
        { label: "Waxing", desc: "Full arms (including underarms) - Chocolate roll-on wax, Full legs - Chocolate roll-o…" },
        { label: "Facial & cleanup", desc: "Glass skin hydration facial" },
        { label: "Pedicure", desc: "Candle Spa pedicure" },
      ],
    },
    {
      id: "pkg-monthly", title: "Monthly maintenance package", reviews: "6.3M",
      price: 1975, oldPrice: 2324, duration: "2 hrs 10 mins", discount: 15,
      badgeClass: "discount-badge--green",
      includes: [
        { label: "Waxing", desc: "Full arms (including underarms) - Chocolate Roll on, Full legs - Chocolate Roll on" },
        { label: "Cleanup", desc: "Sara fruit cleanup" },
        { label: "Manicure", desc: "Cut, file & polish - feet" },
      ],
    },
    {
      id: "pkg-waxglow", title: "Wax and glow", reviews: "8.2M",
      price: 3192, oldPrice: 4256, duration: "3 hrs 35 mins", discount: 20,
      includes: [
        { label: "Waxing", desc: "Full arms (including underarms) - Chocolate roll-on wax, Full legs - Chocolate roll-o…" },
        { label: "Facial & cleanup", desc: "Glass skin hydration facial" },
        { label: "Facial hair removal", desc: "Eyebrow, Upper lip - Threading" },
      ],
    },
    {
      id: "pkg-myop2", title: "Make your own package", reviews: "8.2M",
      price: 3192, oldPrice: 4256, duration: "3 hrs 35 mins", discount: 25,
      includes: [
        { label: "Waxing", desc: "Full arms (including underarms) - Chocolate roll-on wax, Full legs - Chocolate roll-o…" },
        { label: "Facial & cleanup", desc: "Glass skin hydration facial" },
        { label: "Pedicure", desc: "Candle Spa pedicure" },
      ],
    },
  ];

  const waxingServices = [
    {
      id: "svc-rollon-full", badge: "Price drop",
      bannerImg: "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1767956363016-ba4f36.jpeg",
      bannerHeading: null, price: 899, oldPrice: 1198,
      bannerSub: "Full arms, legs & underarms",
      title: "Roll-on waxing (Full arms, legs & underarms)",
      rating: "4.87", reviews: "149K", options: 2,
      bullets: ["Hygienic & single-use with no risk of burns", "Two wax types for you to pick from: RICA or white chocolate"],
    },
    {
      id: "svc-spatula", badge: "Price drop",
      bannerImg: "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1767955136930-22342b.jpeg",
      bannerHeading: null, price: 699, oldPrice: 748,
      bannerSub: "Full arms, legs & underarms",
      title: "Spatula waxing (Full arms, legs & underarms)",
      rating: "4.85", reviews: "98K", options: 2,
      bullets: ["Classic wax application using a spatula", "Available in chocolate and fruit flavour"],
    },
    {
      id: "svc-threading", badge: null,
      bannerImg: "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1767956045252-189708.jpeg",
      bannerHeading: null, price: 1299, oldPrice: 1548,
      bannerSub: "Precise, quick & painless",
      title: "Eyebrow threading + Upper lip threading",
      rating: "4.82", reviews: "210K", options: null,
      bullets: ["Defines your brow shape perfectly", "Trained beauticians with 4.5+ ratings"],
    },
  ];

  const koreanfacial = [
    {
      id: "svc-rollon-full", badge: "Best Seller",
      bannerImg: "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1772003052492-592413.jpeg",
      bannerHeading: null, price: 1749, oldPrice: 1000,
      bannerSub: "Korean Glass Hydration Facial",
      title: "Korean Glass Hydration Facial",
      rating: "4.87", reviews: "149K", options: null,
      bullets: ["Delivers long-lasting hydration for a dewy, glass-skin glow", "Suitable for normal to dry skin"],
    },
    {
      id: "svc-spatula", badge: "Price drop",
      bannerImg: "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1767955136930-22342b.jpeg",
      bannerHeading: null, price: 699, oldPrice: 748,
      bannerSub: "Full arms, legs & underarms",
      title: "Spatula waxing (Full arms, legs & underarms)",
      rating: "4.85", reviews: "98K", options: 2,
      bullets: ["Classic wax application using a spatula", "Available in chocolate and fruit flavour"],
    },
    {
      id: "svc-threading", badge: null,
      bannerImg: "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1767956045252-189708.jpeg",
      bannerHeading: null, price: 1299, oldPrice: 1548,
      bannerSub: "Precise, quick & painless",
      title: "Eyebrow threading + Upper lip threading",
      rating: "4.82", reviews: "210K", options: null,
      bullets: ["Defines your brow shape perfectly", "Trained beauticians with 4.5+ ratings"],
    },
  ];

  return (
    <div className="wss-root">
      <HomepageNavBar />

      <div className="wss-body">
        {/* LEFT NAV */}
        <div className="wss-left">
          <h2 className="wss-title">Salon Prime</h2>
          <p className="wss-rating">⭐ 4.85 (17.3 M bookings)</p>
          <div className="wss-tabs-box">
            <p className="wss-select-label">Select a service</p>
            <ul className="wss-tabs">
              {WomenService.map((tab) => (
                <li
                  key={tab.id}
                  className={`wss-tab${activeTab === tab.id ? " wss-tab--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <div className="wss-tab-thumb">
                    <img src={tab.image} alt={tab.title} />
                  </div>
                  <span className="wss-tab-label">{tab.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* RIGHT SCROLL AREA */}
        <div className="wss-right">
          <div className="wss-content">

            {/* VIDEO */}
            <div className="wss-video-wrapper">
              <video ref={videoRef} className="wss-video" autoPlay muted loop playsInline />
              <div className="wss-progress-bar">
                <div ref={fillRef} className="wss-progress-fill" />
              </div>
            </div>

            {/* ── MAIN LAYOUT: content col + single sidebar ── */}
            <div className="main-layout">

              {/* LEFT CONTENT COLUMN — both sections stacked */}
              <div className="main-content-col">

                {/* SUPER SAVER PACKAGES */}
                <div className="package-section">
                  <div className="package-heading">Super saver packages</div>
                  <div className="package-cards-col">
                    {packages.map((pkg) => (
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
                    ))}
                  </div>
                </div>

                {/* WAXING & THREADING */}
                <div className="svc-section">
                  <div className="svc-section-heading">Waxing &amp; threading</div>
                  <div className="package-cards-col">
                    {waxingServices.map((svc) => (
                      <ServiceCard key={svc.id} service={svc} cart={cart} setCart={setCart} />
                    ))}
                  </div>
                </div>
                <div className="svc-section">
                  <div className="svc-section-heading">Korean facial</div>
                  <div className="package-cards-col">
                    {koreanfacial.map((svc) => (
                      <ServiceCard key={svc.id} service={svc} cart={cart} setCart={setCart} />
                    ))}
                  </div>
                </div>
              </div>

              {/* SINGLE STICKY SIDEBAR */}
              <div className="main-sidebar">
                <div className="sidebar-promo">
                  <div className="promo-icon">%</div>
                  <div className="promo-text">
                    <p>Get ₹50 coupon</p>
                    <span>After first service delivery</span>
                  </div>
                </div>

                <div className="uc-promise-card">
                  <div className="uc-promise-header">
                    <h4>UC Promise</h4>
                    <div className="qa-badge-circle">
                      <span className="qa-text">QUALITY<br />ASSURED</span>
                    </div>
                  </div>
                  <ul>
                    <li>✔ 4.5+ Rated Beauticians</li>
                    <li>✔ Luxury Salon Experience</li>
                    <li>✔ Premium Branded Products</li>
                  </ul>
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
                      <button className="view-cart-btn">View Cart</button>
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