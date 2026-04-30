import "../styles/Homepage.css";
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// ─── Trending searches shown when search bar is empty ───────────────────────
const TRENDING = [
    "Professional bathroom cleaning",
    "Salon",
    "Professional kitchen cleaning",
    "Refrigerator repair",
    "Washing machine repair",
    "Massage for men",
    "Ro repair",
    "Tv repair",
    "Electricians",
    "Microwave repair",
];

// ─── Flatten all searchable products from bootstrap data ────────────────────
function flattenProducts(bootstrapData) {
    if (!bootstrapData) return [];

    const products = [];

    const addItems = (items, category) => {
        if (!Array.isArray(items)) return;
        items.forEach((item) => {
            if (item && item.title) {
                products.push({
                    id: item.id,
                    title: item.title,
                    price: item.price,
                    rating: item.rating,
                    reviews: item.reviews,
                    image: item.image || item.bannerImg || null,
                    category,
                });
            }
        });
    };

    // Flat arrays
    addItems(bootstrapData.most_booked, "Most Booked");
    addItems(bootstrapData.new_and_noteworthy, "New & Noteworthy");
    addItems(bootstrapData.salon_women, "Salon for Women");
    addItems(bootstrapData.spa_women, "Spa for Women");
    addItems(bootstrapData.cleaning, "Cleaning");
    addItems(bootstrapData.appliances, "Large Appliances");
    addItems(bootstrapData.salon_prime, "Salon Prime");
    addItems(bootstrapData.men_salon_prime, "Men's Salon Prime");
    addItems(bootstrapData.packages, "Salon Prime");
    addItems(bootstrapData.men_packages, "Men's Salon Prime");

    // Grouped by category objects
    const addGrouped = (grouped, fallbackCat) => {
        if (!grouped || typeof grouped !== "object") return;
        Object.entries(grouped).forEach(([cat, items]) => {
            addItems(items, cat || fallbackCat);
        });
    };

    addGrouped(bootstrapData.services, "Services");
    addGrouped(bootstrapData.men_services, "Men's Services");
    addGrouped(bootstrapData.bathroom_cleaning_services, "Bathroom Cleaning");

    // Deduplicate by id
    const seen = new Set();
    return products.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
    });
}

// ─── Format review count ─────────────────────────────────────────────────────
function formatReviews(reviews) {
    if (!reviews && reviews !== 0) return null;
    if (typeof reviews === "string") return reviews;
    if (reviews >= 1_000_000) return `${(reviews / 1_000_000).toFixed(1)}M`;
    if (reviews >= 1_000) return `${(reviews / 1_000).toFixed(0)}K`;
    return String(reviews);
}

// ─── Highlight matched text ──────────────────────────────────────────────────
function HighlightedTitle({ title, query }) {
    if (!query) return <span>{title}</span>;
    const idx = title.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{title}</span>;
    return (
        <span>
            {title.slice(0, idx)}
            <strong>{title.slice(idx, idx + query.length)}</strong>
            {title.slice(idx + query.length)}
        </span>
    );
}

export default function HomepageNavBar({ onProfileClick }) {
    const navigate = useNavigate();

    // ── Typewriter ──────────────────────────────────────────────────────────
    const words = ["Facial", "Plumber", "Electrician", "AC repair"];
    const [text, setText] = useState("");
    const [wordIndex, setWordIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);

    // ── Location ────────────────────────────────────────────────────────────
    const [city, setCity] = useState("Detecting...");

    // ── Search ──────────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [allProducts, setAllProducts] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [bootstrapLoaded, setBootstrapLoaded] = useState(false);
    const searchRef = useRef(null);
    const inputRef = useRef(null);

    // ── Fetch bootstrap data once ────────────────────────────────────────────
    useEffect(() => {
        if (bootstrapLoaded) return;
        fetch("https://urban-ease-theta.vercel.app/api/bootstrap")
            .then((r) => r.json())
            .then((json) => {
                if (json?.data) {
                    setAllProducts(flattenProducts(json.data));
                    setBootstrapLoaded(true);
                }
            })
            .catch(() => {});
    }, [bootstrapLoaded]);

    // ── Live search filter ───────────────────────────────────────────────────
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        const q = searchQuery.toLowerCase();
        const results = allProducts
            .filter((p) => p.title.toLowerCase().includes(q))
            .slice(0, 8);
        setSearchResults(results);
    }, [searchQuery, allProducts]);
    // const navigate = useNavigate();
    // ── Close dropdown on outside click ─────────────────────────────────────
    useEffect(() => {
        const handleClick = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setSearchOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // ── Location detection ───────────────────────────────────────────────────
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const res = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                        );
                        const data = await res.json();
                        const cityName =
                            data?.address?.city ||
                            data?.address?.town ||
                            data?.address?.village ||
                            data?.address?.state ||
                            "Your location";
                        setCity(cityName);
                    } catch {
                        setCity("Bhubaneswar");
                    }
                },
                () => {}
            );
        }
    }, []);

    // ── Typewriter effect ────────────────────────────────────────────────────
    useEffect(() => {
        const currentWord = words[wordIndex];
        if (charIndex < currentWord.length) {
            const timeout = setTimeout(() => {
                setText((prev) => prev + currentWord[charIndex]);
                setCharIndex(charIndex + 1);
            }, 80);
            return () => clearTimeout(timeout);
        } else {
            const timeout = setTimeout(() => {
                setText("");
                setCharIndex(0);
                setWordIndex((prev) => (prev + 1) % words.length);
            }, 1200);
            return () => clearTimeout(timeout);
        }
    }, [charIndex, wordIndex]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleSearchFocus = () => setSearchOpen(true);

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        setSearchOpen(true);
    };

    const handleClear = () => {
        setSearchQuery("");
        setSearchResults([]);
        inputRef.current?.focus();
    };

    const handleTrendingClick = (term) => {
        setSearchQuery(term);
        inputRef.current?.focus();
    };

    const handleResultClick = (product) => {
        setSearchOpen(false);
        setSearchQuery("");
        // Navigate to the product — adjust route as needed
        navigate(`/service/${product.id}`);
    };

    const showDropdown = searchOpen;
    const showTrending = showDropdown && !searchQuery.trim();
    const showResults = showDropdown && searchQuery.trim() && searchResults.length > 0;
    const showNoResults =
        showDropdown && searchQuery.trim() && searchResults.length === 0 && bootstrapLoaded;

    return (
        <>
            <div className="homenavbar">
                {/* Logo */}
                <div className="logoplaceholder">
                    <img
                        src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_144,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/partner-training/1628575858610-5b0ae4.png"
                        alt="UrbanEase Logo"
                        width="144px"
                        height="40px"
                        onClick={() => navigate("/")}
                        style={{ cursor: "pointer" }}
                    />
                </div>

                {/* Location dropdown */}
                <div className="locationdropdown">
                    <span className="locationsvg">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11.426 22.569L12 21.75l.573.82a1 1 0 01-1.147-.001z" fill="#757575" />
                            <path fillRule="evenodd" clipRule="evenodd" d="M12 5.75a4 4 0 100 8 4 4 0 000-8zm-2 4a2 2 0 114 0 2 2 0 01-4 0z" fill="#757575" />
                            <path fillRule="evenodd" clipRule="evenodd" d="M11.426 22.569L12 21.75c.573.82.575.818.575.818l.002-.001.006-.004.02-.015.07-.05.257-.192a25.395 25.395 0 003.575-3.368c1.932-2.223 3.995-5.453 3.995-9.188a8.5 8.5 0 10-17 0c0 3.735 2.063 6.965 3.995 9.187a25.4 25.4 0 003.575 3.369 14.361 14.361 0 00.327.242l.02.015.006.004.003.002zM7.404 5.154A6.5 6.5 0 0118.5 9.75c0 3.015-1.687 5.785-3.505 7.875A23.403 23.403 0 0112 20.495a23.4 23.4 0 01-2.995-2.869C7.187 15.534 5.5 12.764 5.5 9.75a6.5 6.5 0 011.904-4.596z" fill="#757575" />
                        </svg>
                    </span>
                    <div className="locationtext">
                        <span className="locationtext1">{city}</span>
                    </div>
                    <div className="drowndownlocation" id="Searchbar">
                        <svg className="arrow" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                            <path fillRule="evenodd" clipRule="evenodd" d="M8 9.94L3.53 5.47 2.47 6.53l5 5a.75.75 0 001.06 0l5-5-1.06-1.06L8 9.94z" />
                        </svg>
                    </div>
                </div>

                {/* ── SEARCH BAR with dropdown ── */}
                <div className="locationdropdown search-wrapper" ref={searchRef} style={{ position: "relative" }}>
                    <span className="locationsvg">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M10.875 2a8.875 8.875 0 105.528 15.818l3.89 3.89 1.414-1.415-3.89-3.889A8.875 8.875 0 0010.875 2zM4 10.875a6.875 6.875 0 1113.75 0 6.875 6.875 0 01-13.75 0z" />
                        </svg>
                    </span>

                    {searchOpen ? (
                        <input
                            ref={inputRef}
                            className="search-input"
                            type="text"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onFocus={handleSearchFocus}
                            placeholder="Search for services"
                            autoFocus
                        />
                    ) : (
                        <div className="searchbartext" onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}>
                            Search for '{text}'
                        </div>
                    )}

                    {searchOpen && searchQuery && (
                        <button className="search-clear-btn" onClick={handleClear} aria-label="Clear search">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.3 5.71a1 1 0 00-1.41 0L12 10.59 7.11 5.7A1 1 0 005.7 7.11L10.59 12 5.7 16.89a1 1 0 001.41 1.41L12 13.41l4.89 4.89a1 1 0 001.41-1.41L13.41 12l4.89-4.89a1 1 0 000-1.4z" />
                            </svg>
                        </button>
                    )}

                    {/* ── DROPDOWN ── */}
                    {showDropdown && (showTrending || showResults || showNoResults) && (
                        <div className="search-dropdown">
                            {/* Trending */}
                            {showTrending && (
                                <>
                                    <div className="search-dropdown-heading">Trending searches</div>
                                    <div className="trending-tags">
                                        {TRENDING.map((term) => (
                                            <button
                                                key={term}
                                                className="trending-tag"
                                                onClick={() => handleTrendingClick(term)}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                                    <polyline points="17 6 23 6 23 12" />
                                                </svg>
                                                {term}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Results */}
                            {showResults && (
                                <ul className="search-results-list">
                                    {searchResults.map((product) => (
                                        <li
                                            key={product.id}
                                            className="search-result-item"
                                            onClick={() => handleResultClick(product)}
                                        >
                                            <div className="search-result-img">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.title} />
                                                ) : (
                                                    <div className="search-result-img-placeholder">UC</div>
                                                )}
                                            </div>
                                            <div className="search-result-info">
                                                <div className="search-result-title">
                                                    <HighlightedTitle title={product.title} query={searchQuery} />
                                                </div>
                                                <div className="search-result-meta">
                                                    {product.rating && (
                                                        <span className="search-result-rating">
                                                            ★ {product.rating}
                                                            {product.reviews && (
                                                                <span className="search-result-reviews">
                                                                    ({formatReviews(product.reviews)})
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                    {product.price && (
                                                        <>
                                                            {product.rating && <span className="search-result-dot">•</span>}
                                                            <span className="search-result-price">₹{product.price}</span>
                                                        </>
                                                    )}
                                                    {product.category && (
                                                        <>
                                                            <span className="search-result-dot">•</span>
                                                            <span className="search-result-category">{product.category}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* No results */}
                            {showNoResults && (
                                <div className="search-no-results">No results found for "{searchQuery}"</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Login + Cart */}
                <div className="loginandcart">
                    <div className="cartsvg" onClick={()=>navigate('/checkout')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" >
                            <path fillRule="evenodd" clipRule="evenodd" d="M3.327 2H1.75v2h1.389l3.339 11.687A2.5 2.5 0 008.88 17.5h8.988a2.5 2.5 0 002.403-1.813l2.475-8.662a1 1 0 00-.961-1.275H5.719l-.71-2.48A1.75 1.75 0 003.328 2zm5.074 13.137L6.29 7.75h14.17l-2.11 7.387a.5.5 0 01-.482.363H8.882a.5.5 0 01-.48-.363z" />
                            <path d="M8.5 21.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.25 21.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                        </svg>
                    </div>
                    <div className="profilesvg" onClick={onProfileClick}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#0F0F0F" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M18.702 19.422A9.974 9.974 0 0022 12c0-5.523-4.477-10-10-10S2 6.477 2 12a9.975 9.975 0 003.326 7.447A9.963 9.963 0 0012 22a9.963 9.963 0 006.702-2.578zM12 4a8 8 0 00-6.183 13.076 7.752 7.752 0 012.933-2.362 4.75 4.75 0 116.5 0 7.755 7.755 0 012.933 2.362A8 8 0 0012 4zm4.718 14.461a5.753 5.753 0 00-9.436 0A7.964 7.964 0 0012 20a7.964 7.964 0 004.718-1.539zM12 14a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5z" fill="#0F0F0F" />
                        </svg>
                    </div>
                </div>
            </div>
        </>
    );
}