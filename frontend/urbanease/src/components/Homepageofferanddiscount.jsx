import "../styles/Homepageoffersanddiscount.css";

export default function HomepageOfferandDiscount() {
  return (
    <div className="offertabs">
      <div className="offerssections">
        <h2>Offers & discounts</h2>

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
        </div>
      </div>
    </div>
  );
}