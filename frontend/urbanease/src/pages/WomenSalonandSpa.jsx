import "../styles/Womensalonservice.css";
import { useEffect, useRef, useState } from "react";
import HomepageNavBar from "../components/Homepagenav.jsx";
import Hls from "hls.js";

export default function WomenSalonandSpa() {
    const videoRef = useRef(null);
    const fillRef = useRef(null);

    useEffect(() => {
        const src =
            "https://content.urbancompany.com/videos/supply/customer-app-supply/1773127761044-5daeb8/1773127761044-5daeb8.m3u8";
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
            const pct = (video.currentTime / video.duration) * 100;
            fill.style.width = pct + "%";
        };

        video.addEventListener("timeupdate", updateProgress);
        return () => video.removeEventListener("timeupdate", updateProgress);
    }, []);

    const [WomenService, SetWomenService] = useState([]);

    useEffect(() => {
        fetch("https://urban-ease-theta.vercel.app/api/salon-prime")
            .then((res) => res.json())
            .then((data) => SetWomenService(data.data))
            .catch((err) => console.error(err));
    }, []);

    return (
        <div className="wss-root">
            <HomepageNavBar />

            <div className="wss-body">
                {/* LEFT */}
                <div className="wss-left">
                    <h2 className="wss-title">Salon Prime</h2>
                    <p className="wss-rating">⭐ 4.85 (17.3 M bookings)</p>

                    <div className="wss-tabs-box">
                        <p className="wss-select-label">Select a service</p>

                        <ul className="wss-tabs">
                            {WomenService.map((tab) => (
                                <li key={tab.id} className="wss-tab">
                                    <div className="wss-tab-thumb">
                                        <img src={tab.image} alt={tab.title} />
                                    </div>
                                    <span className="wss-tab-label">{tab.title}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* RIGHT */}
                <div className="wss-right">
                    <div className="wss-content">
                        <div className="wss-video-wrapper">
                            <video
                                ref={videoRef}
                                className="wss-video"
                                autoPlay
                                muted
                                loop
                                playsInline
                            />
                            <div className="wss-progress-bar">
                                <div ref={fillRef} className="wss-progress-fill" />
                            </div>
                        </div>

                        {/* Dummy content for scroll */}
                        <div className="wss-dummy">
                            
                            <div style={{ height: "800px" }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}