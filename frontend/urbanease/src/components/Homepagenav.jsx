import "../styles/Homepage.css";
import { useEffect, useState } from "react";
export default function HomepageNavBar({ onProfileClick }) {
    const words = ["Facial", "Plumber", "Electrician", "AC repair"];
    const [text, setText] = useState("");
    const [wordIndex, setWordIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [city, setCity] = useState("Detecting...");
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
                        console.log("Detected city:", cityName);
                        setCity(cityName);
                    } catch (error) {
                        console.error("Error fetching location:", error);
                    }
                },
                (error) => {
                    console.error("Geolocation error:", error);
                }
            );
        }
    }, []);
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
    return (

        <div className="homenavbar">
            <div className="logoplaceholder">
                <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_144,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/partner-training/1628575858610-5b0ae4.png" alt="UrbanEase Logo" width="144px" height="40px" />
            </div>
            <div className="locationdropdown">
                <span className="locationsvg">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M11.426 22.569L12 21.75l.573.82a1 1 0 01-1.147-.001z"
                            fill="#757575"
                        />
                        <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M12 5.75a4 4 0 100 8 4 4 0 000-8zm-2 4a2 2 0 114 0 2 2 0 01-4 0z"
                            fill="#757575"
                        />
                        <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M11.426 22.569L12 21.75c.573.82.575.818.575.818l.002-.001.006-.004.02-.015.07-.05.257-.192a25.395 25.395 0 003.575-3.368c1.932-2.223 3.995-5.453 3.995-9.188a8.5 8.5 0 10-17 0c0 3.735 2.063 6.965 3.995 9.187a25.4 25.4 0 003.575 3.369 14.361 14.361 0 00.327.242l.02.015.006.004.003.002zM7.404 5.154A6.5 6.5 0 0118.5 9.75c0 3.015-1.687 5.785-3.505 7.875A23.403 23.403 0 0112 20.495a23.4 23.4 0 01-2.995-2.869C7.187 15.534 5.5 12.764 5.5 9.75a6.5 6.5 0 011.904-4.596z"
                            fill="#757575"
                        />
                    </svg>
                </span>
                <div className="locationtext" >
                    <span className="locationtext1">{city}</span>
                </div>
                <div className="drowndownlocation" id="Searchbar">
                    <svg
                        className="arrow"
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M8 9.94L3.53 5.47 2.47 6.53l5 5a.75.75 0 001.06 0l5-5-1.06-1.06L8 9.94z"
                        />
                    </svg>

                </div>
            </div>
            <div className="locationdropdown">
                <span className="locationsvg">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M10.875 2a8.875 8.875 0 105.528 15.818l3.89 3.89 1.414-1.415-3.89-3.889A8.875 8.875 0 0010.875 2zM4 10.875a6.875 6.875 0 1113.75 0 6.875 6.875 0 01-13.75 0z"
                        />
                    </svg>
                </span>
                <div className="searchbartext">
                    Search for '{text}'
                </div>
            </div>
            <div className="loginandcart">
                <div className="cartsvg">
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M3.327 2H1.75v2h1.389l3.339 11.687A2.5 2.5 0 008.88 17.5h8.988a2.5 2.5 0 002.403-1.813l2.475-8.662a1 1 0 00-.961-1.275H5.719l-.71-2.48A1.75 1.75 0 003.328 2zm5.074 13.137L6.29 7.75h14.17l-2.11 7.387a.5.5 0 01-.482.363H8.882a.5.5 0 01-.48-.363z"
                        />
                        <path d="M8.5 21.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.25 21.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                    </svg>
                </div>
                <div className="profilesvg" onClick={onProfileClick}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#0F0F0F" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M18.702 19.422A9.974 9.974 0 0022 12c0-5.523-4.477-10-10-10S2 6.477 2 12a9.975 9.975 0 003.326 7.447A9.963 9.963 0 0012 22a9.963 9.963 0 006.702-2.578zM12 4a8 8 0 00-6.183 13.076 7.752 7.752 0 012.933-2.362 4.75 4.75 0 116.5 0 7.755 7.755 0 012.933 2.362A8 8 0 0012 4zm4.718 14.461a5.753 5.753 0 00-9.436 0A7.964 7.964 0 0012 20a7.964 7.964 0 004.718-1.539zM12 14a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5z" fill="#0F0F0F"></path></svg>
                </div>
            </div>
        </div>
    );
}
