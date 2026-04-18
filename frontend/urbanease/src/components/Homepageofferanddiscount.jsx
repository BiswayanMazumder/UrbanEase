import "../styles/Homepageoffersanddiscount.css";

export default function HomepageOfferandDiscount() {
  return (
    <div className="offertabs">
      <div className="offerssections">
        <h2>Offers & discounts</h2>
        <div className="notservicable">
          <div className="banneritems">
            <div className="bannercontents">
              <div className="mapobj">
                <svg width="200" height="160" viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
                  {/* <!-- Folded map --> */}
                  <polygon points="10,120 70,90 130,110 70,140" fill="#E5E7EB" />
                  <polygon points="70,90 130,110 130,40 70,20" fill="#D1D5DB" />
                  <polygon points="10,120 70,90 70,20 10,50" fill="#F3F4F6" />

                  {/* <!-- Map grid lines --> */}
                  <line x1="20" y1="60" x2="60" y2="40" stroke="#9CA3AF" stroke-width="1" />
                  <line x1="20" y1="90" x2="60" y2="70" stroke="#9CA3AF" stroke-width="1" />
                  <line x1="80" y1="50" x2="120" y2="70" stroke="#9CA3AF" stroke-width="1" />
                  <line x1="80" y1="80" x2="120" y2="100" stroke="#9CA3AF" stroke-width="1" />

                  {/* <!-- Location pin --> */}
                  <circle cx="90" cy="50" r="18" fill="#F97316" />
                  <circle cx="90" cy="50" r="10" fill="#FDE68A" />
                  <path d="M90 68 C80 90, 100 90, 90 68" fill="#F97316" />
                </svg>
              </div>
              <div className="nonservicabletext">
                <h3>Not serviceable in your area yet?</h3>
                <p style={{ fontSize: "15px",marginTop:"-10px"}}>
                  Currently not servicing in this area
                  We are not yet present in your area.
                  We’ll notify you when we launch here.
                </p>
                {/* <button className="notifybtn">Notify Me</button> */}
              </div>
            </div>
          </div>
        </div>
        <div className="offerbanners">
          <img
            src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_394,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1751349794243-12c84d.jpeg"
            alt="Offer 1"
            width="394"
            height="222"
            className="bannerimg"
          />

          <img
            src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_394,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1751349785134-9a43cd.jpeg"
            alt="Offer 2"
            width="394"
            height="222"
            className="bannerimg"
          />
        </div>
        <div className="bigbanneroffers">
          <img
            src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1776065912040-4ab7aa.jpeg"
            alt="Offer 2"
            // width=""
            height="410"
            className="bannerimg"
          />
          <img
            src="https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_1232,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1776067912293-b1176c.jpeg"
            alt="Offer 2"
            // width=""
            height="410"
            // marginTop="90px"
            className="bannerimg"
          />
        </div>
      </div>
    </div>
  );
}