import "../styles/Womensalonservice.css";
import { use, useEffect, useState } from "react";
import HomepageNavBar from "../components/Homepagenav.jsx";
export default function WomenSalonandSpa() {
    const [services, setServices] = useState([]);
    const [newAndNoteworthy, setNewAndNoteworthy] = useState([]);
    const [offers, setOffers] = useState([]);
    const [salonForWomen, setSalonForWomen] = useState([]);
    const [spaforwomen,setSpaforWomen]=useState([]);
    const [cleaningservices,setCleaningServices ]= useState([]);
    const [largecleaningservices,setLargeCleaningServices ]= useState([]);
return (
    <div className="gvmdbv">
        <HomepageNavBar/>
    </div>
)}