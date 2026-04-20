import "../styles/Homepageservicable.css";
import { use, useEffect, useState } from "react";
export default function Homepagedetailsservicable() {
    const [services, setServices] = useState([]);
    const [newAndNoteworthy, setNewAndNoteworthy] = useState([]);
    const [offers, setOffers] = useState([]);
    const [salonForWomen, setSalonForWomen] = useState([]);
    const [spaforwomen,setSpaforWomen]=useState([]);
    const [cleaningservices,setCleaningServices ]= useState([]);
    useEffect(() => {
        fetch("https://urban-ease-theta.vercel.app/api/most-booked")
            .then((res) => res.json())
            .then((data) => {
                console.log("API response:", data);
                setServices(data.data);
            })
            .catch((err) => console.error(err));

    }, []);

    useEffect(() => {
        fetch("https://urban-ease-theta.vercel.app/api/new-and-noteworthy")
            .then((res) => res.json())
            .then((data) => {
                console.log("API response new and noteworthy:", data);
                setNewAndNoteworthy(data.data);
            })
            .catch((err) => console.error(err));
    }, []);
    useEffect(() => {
        fetch("https://urban-ease-theta.vercel.app/api/offers-and-discounts")
            .then((res) => res.json())
            .then((data) => {
                console.log("API response offers:", data);
                setOffers(data.data);
            })
            .catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        fetch("https://urban-ease-theta.vercel.app/api/salon-for-women")
            .then((res) => res.json())
            .then((data) => {
                console.log("API response for salon women:", data);
                setSalonForWomen(data.data);
            })
            .catch((err) => console.error(err));

    }, []);
    useEffect(() => {
            fetch("https://urban-ease-theta.vercel.app/api/spa-for-women")
                .then((res) => res.json())
                .then((data) => {
                    console.log("API response for spa women:", data);
                    setSpaforWomen(data.data);
                })
                .catch((err) => console.error(err));

        }, []);
        useEffect(() => {
            fetch("https://urban-ease-theta.vercel.app/api/cleaning-services")
                .then((res) => res.json())
                .then((data) => {
                    console.log("API response for cleaning services:", data);
                    setCleaningServices(data.data);
                })
                .catch((err) => console.error(err));

        }, []);
    return (
        <div className="servicablehomepage">
            <div className="werfgfdfdsckfj">
                <div className="vjcghdsbv">
                    <div className="ggddjgndbvds">
                        <h2>Home services at your <br></br> doorstep</h2>
                        <div className="dshfjdhksjdvd">
                            <div className="ehevfhgfjf">
                                <p>What are you looking for?</p>
                                <div className="hegbehdbesf">
                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_56,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1774526047861-554660.jpeg" alt="" />
                                        <p>Women's Salon & Spa</p>
                                    </div>

                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_56,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1774526691081-afedc4.jpeg" alt="" />
                                        <p>Salon Prime</p>
                                    </div>

                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_56,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1681711961404-75dfec.jpeg" alt="" />
                                        <p>Cleaning</p>
                                    </div>

                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_56,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1768544313670-e3f84b.jpeg" alt="" />
                                        <p>AC & Appliance Repair</p>
                                    </div>

                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1752476639421-112dfa.jpeg" alt="" />
                                        <p>Native Water Purifier</p>
                                    </div>

                                    <div className="dhjdbjdnj">
                                        <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_56,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1674120935535-f8d5c8.jpeg" alt="" />
                                        <p>Home Painting</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="ieijfkjdjf">
                            <div className="dknkdmvdv">
                                <img
                                    src="https://www.urbancompany.com/img?quality=90&format=auto/w_48,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1693570188661-dba2e7.jpeg"
                                    alt="star"
                                    className="star-icon"
                                />

                                <div className="hbvjdjv">
                                    <p className="rating">4.8</p>
                                    <p className="label">Service Rating*</p>
                                </div>
                            </div>
                            <div className="dknkdmvdv">
                                <img
                                    src="https://www.urbancompany.com/img?quality=90&format=auto/w_48,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1693491890812-e86755.jpeg"
                                    alt="star"
                                    className="star-icon"
                                />

                                <div className="hbvjdjv" >
                                    <p className="rating">12M+</p>
                                    <p className="label">Customers Globally*</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="ehsdbsd">
                    <img src="https://www.urbancompany.com/img?quality=90&format=auto/dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/home-screen/1696852847761-574450.jpeg" alt="" width="90%" height="100%" />
                </div>
            </div>
            <div className="bvchvcdec">
                <h2 style={{ fontSize: "35px" }}>Offers & discounts</h2>
                <div className="dhgchgdjshd">
                    {offers.map((item) => (
                        <img src={item.image} alt={item.title}></img>
                    ))}
                </div>
            </div>
            <div className="bvchvcdec">
                <h2 style={{ fontSize: "35px" }}>New and noteworthy</h2>
                <div className="dhgchgdjshd">
                    {newAndNoteworthy.map((item) => (
                        <div className="card" key={item.id}>
                            <img src={item.image} alt={item.title} />
                            <p>{item.title}</p>
                            <p style={{ fontWeight: "300", color: item.tag.color == "" ? "black" : item.tag.color }}>{item.tag.text === null ? "" : item.tag.text}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bvchvcdec">
                <h2 style={{ fontSize: "35px" }}>Most booked services</h2>

                <div className="dhgchgdjshd">
                    {services.map((item) => (
                        <div className="card" key={item.id}>
                            <img src={item.image} alt={item.title} />
                            <p>{item.title}</p>
                            <p style={{ fontWeight: "300" }}>₹{item.price}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="edehdhbjedc">
                <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1776176709077-e8858a.jpeg" alt="" />
            </div>
            <div className="bvchvcdec">
                <h2 style={{ fontSize: "35px" }}>Salon for Women</h2>
                <h2 style={{fontWeight:"350",color:"Grey", fontSize:"15px", marginTop:"-10px"}}>Pamper yourself at home</h2>
                <div className="dhgchgdjshd">
                    {salonForWomen.map((item) => (
                        <div className="card" key={item.id}>
                            <img src={item.image} alt={item.title} />
                            <p>{item.title}</p>
                            <p style={{fontWeight:"400",color:"Grey"}}>⭐ {item.rating}</p>
                            <p style={{fontWeight:"400",color:"Grey"}}>₹{item.price}</p>
                        </div>
                    ))}
                </div>
            </div>
             <div className="bvchvcdec">
                <h2 style={{ fontSize: "35px" }}>Spa for Women</h2>
                {/* <h2 style={{fontWeight:"400",color:"Grey", fontSize:"20px", marginTop:"-10px"}}>Pamper yourself at home</h2> */}
                <div className="dhgchgdjshd">
                    {spaforwomen.map((item) => (
                        <div className="card" key={item.id}>
                            <img src={item.image} alt={item.title} />
                            <p>{item.title}</p>
                            <p style={{fontWeight:"400",color:"Grey"}}>⭐ {item.rating}</p>
                            <p style={{fontWeight:"400",color:"Grey"}}>₹{item.price}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bvchvcdec">
                <h2 style={{ fontSize: "35px" }}>Cleaning Essentials</h2>
                <h2 style={{fontWeight:"350",color:"Grey", fontSize:"15px", marginTop:"-10px"}}>Monthly cleaning essential services</h2>
                <div className="dhgchgdjshd">
                    {cleaningservices.map((item) => (
                        <div className="card" key={item.id}>
                            <img src={item.image} alt={item.title} />
                            <p>{item.title}</p>
                            <p style={{fontWeight:"400",color:"Grey"}}>⭐ {item.rating}</p>
                            <p style={{fontWeight:"400",color:"Grey"}}>₹{item.price}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="edehdhbjedc">
                <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1750420814338-49f225.jpeg" alt="" />
            </div>
            <div className="bvchvcdec">
                <h2 style={{ fontSize: "35px" }}>Large Appliances</h2>
                <div className="dhgchgdjshd">
                    {cleaningservices.map((item) => (
                        <div className="card" key={item.id}>
                            <img src={item.image} alt={item.title} />
                            <p>{item.title}</p>
                            <p style={{fontWeight:"400",color:"Grey"}}>⭐ {item.rating}</p>
                            <p style={{fontWeight:"400",color:"Grey"}}>₹{item.price}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="edehdhbjedc">
                <img src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1776496725499-cdc489.jpeg" alt="" />
            </div>
        </div>
    );
}