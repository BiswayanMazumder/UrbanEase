import "../styles/Homepageservicable.css";
import { useEffect, useRef, useState } from "react";

/* ── Reusable skeleton components ── */

function SkeletonCard() {
    return (
        <div className="skeleton-card">
            <div className="skeleton skeleton-img" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
        </div>
    );
}

function SkeletonOfferImg() {
    return <div className="skeleton skeleton-offer-img" />;
}

/* ── Scroll-reveal hook — fires EVERY time element enters/leaves viewport ── */
function useScrollReveal() {
    useEffect(() => {
        const targets = document.querySelectorAll(
            ".reveal, .reveal-left, .reveal-right, .section-title"
        );

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // entering viewport → animate in
                        entry.target.classList.remove("hidden");
                        // tiny rAF so the browser registers the class removal
                        requestAnimationFrame(() => {
                            entry.target.classList.add("visible");
                        });
                    } else {
                        // leaving viewport → reset for next time
                        entry.target.classList.remove("visible");
                        entry.target.classList.add("hidden");
                    }
                });
            },
            { threshold: 0.12 }
        );

        targets.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    });
    // No dependency array → re-runs after every render so newly loaded
    // async content (cards from API) gets picked up automatically
}

export default function Homepagedetailsservicable() {
    const [services, setServices] = useState([]);
    const [newAndNoteworthy, setNewAndNoteworthy] = useState([]);
    const [offers, setOffers] = useState([]);
    const [salonForWomen, setSalonForWomen] = useState([]);

    const [loadingServices, setLoadingServices]         = useState(true);
    const [loadingNoteworthy, setLoadingNoteworthy]     = useState(true);
    const [loadingOffers, setLoadingOffers]             = useState(true);
    const [loadingSalon, setLoadingSalon]               = useState(true);

    /* activate scroll reveal — re-observes after every render */
    useScrollReveal();

    useEffect(() => {
        fetch("https://urban-ease-theta.vercel.app/api/most-booked")
            .then((res) => res.json())
            .then((data) => { setServices(data.data); setLoadingServices(false); })
            .catch((err) => { console.error(err); setLoadingServices(false); });
    }, []);

    useEffect(() => {
        fetch("https://urban-ease-theta.vercel.app/api/new-and-noteworthy")
            .then((res) => res.json())
            .then((data) => { setNewAndNoteworthy(data.data); setLoadingNoteworthy(false); })
            .catch((err) => { console.error(err); setLoadingNoteworthy(false); });
    }, []);

    useEffect(() => {
        fetch("https://urban-ease-theta.vercel.app/api/offers-and-discounts")
            .then((res) => res.json())
            .then((data) => { setOffers(data.data); setLoadingOffers(false); })
            .catch((err) => { console.error(err); setLoadingOffers(false); });
    }, []);

    useEffect(() => {
        fetch("https://urban-ease-theta.vercel.app/api/salon-for-women")
            .then((res) => res.json())
            .then((data) => { setSalonForWomen(data.data); setLoadingSalon(false); })
            .catch((err) => { console.error(err); setLoadingSalon(false); });
    }, []);

    return (
        <div className="servicablehomepage">

            {/* ── Hero ── */}
            <div className="werfgfdfdsckfj">
                <div className="vjcghdsbv reveal-left">
                    <div className="ggddjgndbvds">
                        <h2>Home services at your <br /> doorstep</h2>
                        <div className="dshfjdhksjdvd">
                            <div className="ehevfhgfjf">
                                <p>What are you looking for?</p>
                                <div className="hegbehdbesf">
                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_56,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1774526047861-554660.jpeg" alt="Women's Salon & Spa" />
                                        <p>Women's Salon & Spa</p>
                                    </div>
                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_56,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1774526691081-afedc4.jpeg" alt="Salon Prime" />
                                        <p>Salon Prime</p>
                                    </div>
                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_56,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1681711961404-75dfec.jpeg" alt="Cleaning" />
                                        <p>Cleaning</p>
                                    </div>
                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_56,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1768544313670-e3f84b.jpeg" alt="AC & Appliance Repair" />
                                        <p>AC & Appliance Repair</p>
                                    </div>
                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1752476639421-112dfa.jpeg" alt="Native Water Purifier" />
                                        <p>Native Water Purifier</p>
                                    </div>
                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_56,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1674120935535-f8d5c8.jpeg" alt="Home Painting" />
                                        <p>Home Painting</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="ieijfkjdjf">
                            <div className="dknkdmvdv">
                                <img src="https://www.urbancompany.com/img?quality=90&format=auto/w_48,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1693570188661-dba2e7.jpeg" alt="star" className="star-icon" />
                                <div className="hbvjdjv">
                                    <p className="rating">4.8</p>
                                    <p className="label">Service Rating*</p>
                                </div>
                            </div>
                            <div className="dknkdmvdv">
                                <img src="https://www.urbancompany.com/img?quality=90&format=auto/w_48,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1693491890812-e86755.jpeg" alt="customers" className="star-icon" />
                                <div className="hbvjdjv">
                                    <p className="rating">12M+</p>
                                    <p className="label">Customers Globally*</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="ehsdbsd reveal-right">
                    <img
                        src="https://www.urbancompany.com/img?quality=90&format=auto/dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1696852847761-574450.jpeg"
                        alt="Hero"
                        width="90%"
                        height="100%"
                    />
                </div>
            </div>

            {/* ── Offers & Discounts ── */}
            <div className="bvchvcdec">
                <div className="section-title reveal">
                    <h2 style={{ fontSize: "35px" }}>Offers & discounts</h2>
                </div>
                <div className="dhgchgdjshd reveal">
                    {loadingOffers
                        ? Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonOfferImg key={i} />
                          ))
                        : offers.map((item) => (
                            <img key={item.id} src={item.image} alt={item.title} />
                          ))
                    }
                </div>
            </div>

            {/* ── New and Noteworthy ── */}
            <div className="bvchvcdec">
                <div className="section-title reveal">
                    <h2 style={{ fontSize: "35px" }}>New and noteworthy</h2>
                </div>
                <div className="dhgchgdjshd reveal">
                    {loadingNoteworthy
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <SkeletonCard key={i} />
                          ))
                        : newAndNoteworthy.map((item) => (
                            <div className="card" key={item.id}>
                                <img src={item.image} alt={item.title} />
                                <p>{item.title}</p>
                                <p style={{
                                    fontWeight: "300",
                                    color: item.tag.color === "" ? "black" : item.tag.color,
                                }}>
                                    {item.tag.text === null ? "" : item.tag.text}
                                </p>
                            </div>
                          ))
                    }
                </div>
            </div>

            {/* ── Most Booked Services ── */}
            <div className="bvchvcdec">
                <div className="section-title reveal">
                    <h2 style={{ fontSize: "35px" }}>Most booked services</h2>
                </div>
                <div className="dhgchgdjshd reveal">
                    {loadingServices
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <SkeletonCard key={i} />
                          ))
                        : services.map((item) => (
                            <div className="card" key={item.id}>
                                <img src={item.image} alt={item.title} />
                                <p>{item.title}</p>
                                <p style={{ fontWeight: "300" }}>₹{item.price}</p>
                            </div>
                          ))
                    }
                </div>
            </div>

            {/* ── Banner Image ── */}
            <div className="edehdhbjedc reveal">
                <img
                    src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1776176709077-e8858a.jpeg"
                    alt="Banner"
                />
            </div>

            {/* ── Salon for Women ── */}
            <div className="bvchvcdec">
                <div className="section-title reveal">
                    <h2 style={{ fontSize: "35px" }}>Salon for Women</h2>
                </div>
                <h2 style={{ fontWeight: "400", color: "Grey", fontSize: "20px", marginTop: "-10px" }}
                    className="reveal">
                    Pamper yourself at home
                </h2>
                <div className="dhgchgdjshd reveal">
                    {loadingSalon
                        ? Array.from({ length: 5 }).map((_, i) => (
                            <SkeletonCard key={i} />
                          ))
                        : salonForWomen.map((item) => (
                            <div className="card" key={item.id}>
                                <img src={item.image} alt={item.title} />
                                <p>{item.title}</p>
                                <p style={{ fontWeight: "400", color: "Grey" }}>⭐ {item.rating}</p>
                                <p style={{ fontWeight: "400", color: "Grey" }}>₹{item.price}</p>
                            </div>
                          ))
                    }
                </div>
            </div>

        </div>
    );
}