// Homepage.jsx
import "../styles/Homepage.css";
import "../styles/Homepageoffersanddiscount.css";
import HomepageNavBar from "../components/Homepagenav.jsx";
import HomepageOfferandDiscount from "../components/Homepageofferanddiscount.jsx";

export default function Homepage() {
  return (
    <div className="roothome">
      <div className="home">
      <HomepageNavBar/>
    </div>
    <HomepageOfferandDiscount/>
    </div>
  );
}