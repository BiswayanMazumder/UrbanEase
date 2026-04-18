import "../styles/Homepage.css";
export default function HomepageNavBar() {
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
                <div className="locationtext">
                    <span className="locationtext1">Select your city</span>
                </div>
                <div className="drowndownlocation">
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
            </div>
            <div className="loginandcart">
                <div className="cartsvg">

                </div>
                <div className="profilesvg">
                    
                </div>
            </div>
        </div>
    );
}
