// Homepage.jsx
import "../styles/Homepage.css";
import "../styles/Homepageoffersanddiscount.css";
import HomepageNavBar from "../components/Homepagenav.jsx";
import HomepageOfferandDiscount from "../components/Homepageofferanddiscount.jsx";
import { useEffect, useState } from "react";
import Homepagedetailsservicable from "../components/Homepagedetailsservicable.jsx";

export default function Homepage() {
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
            console.log("homepage:", cityName);
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
  return (
    <div className="roothome">
      <div className="home">
        <HomepageNavBar />
      </div>
      {!city.includes("Bhubaneswar") ? <HomepageOfferandDiscount /> : <Homepagedetailsservicable />}
    </div>
  );
}