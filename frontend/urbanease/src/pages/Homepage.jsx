// Homepage.jsx
import "../styles/Homepage.css";
import "../styles/Homepageoffersanddiscount.css";
import HomepageNavBar from "../components/Homepagenav.jsx";
import HomepageOfferandDiscount from "../components/Homepageofferanddiscount.jsx";
import { useEffect, useState } from "react";
import Homepagedetailsservicable from "../components/Homepagedetailsservicable.jsx";
import LocationLoader from "../components/LocationLoader.jsx";

export default function Homepage() {
  const [city, setCity] = useState(null);
  const [loading, setLoading] = useState(true);
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
          } catch (error) {
            console.error("Error fetching location:", error);
            setCity("Unknown");
          } finally {
            setLoading(false);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setCity("Unknown");
          setLoading(false);
        }
      );
    } else {
      setCity("Unknown");
      setLoading(false);
    }
  }, []);
  return (
  <div className="roothome">
    {loading ? (
      <LocationLoader />
    ) : (
      <>
        <div className="home">
          <HomepageNavBar />
        </div>

        {!city.includes("Bhubaneswar") ? (
          <HomepageOfferandDiscount />
        ) : (
          <Homepagedetailsservicable />
        )}
      </>
    )}
  </div>
);
}