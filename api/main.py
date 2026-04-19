from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

most_booked_services = [
    {
        "id": "svc_101",
        "title": "Intense cleaning (2 bathrooms)",
        "price": 913,
        "duration": 90,
        "rating": 4.6,
        "image": "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1760379653090-ffc4af.jpeg"
    },
    {
        "id": "svc_102",
        "title": "Haircut for men",
        "price": 259,
        "duration": 30,
        "rating": 4.7,
        "image": "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1753178331803-9c6a1f.jpeg"
    },
    {
        "id": "svc_103",
        "title": "Foam-jet service (2 ACs)",
        "price": 1098,
        "duration": 120,
        "rating": 4.5,
        "image": "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1763038566737-752b42.jpeg"
    },
    {
        "id": "svc_104",
        "title": "Crystal rose pedicure",
        "price": 759,
        "duration": 60,
        "rating": 4.8,
        "image": "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1763038614950-13e09b.jpeg"
    },
    {
        "id": "svc_105",
        "title": "Roll-on waxing (Full arms, legs & underarms)",
        "price": 889,
        "duration": 75,
        "rating": 4.6,
        "image": "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1770203489779-b131f8.jpeg"
    }
]

new_and_noteworthy_services = [
    {
        "id": "svc_201",
        "title": "Home Painting",
        "price": None,
        "duration": None,
        "rating": None,
        "image": "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/luminosity/1651040419628-022a2b.jpeg",
        "tag": {"text": "", "color": ""}
    },
    {
        "id": "svc_202",
        "title": "Native Water Purifier",
        "price": None,
        "duration": None,
        "rating": None,
        "image": "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1752476639421-112dfa.jpeg",
        "tag": {"text": "", "color": ""}
    },
    {
        "id": "svc_203",
        "title": "Stove",
        "price": None,
        "duration": None,
        "rating": None,
        "image": "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1752218400674-e79bd2.jpeg",
        "tag": {"text": "", "color": ""}
    },
    {
        "id": "svc_204",
        "title": "Hair Studio for Women",
        "price": None,
        "duration": None,
        "rating": None,
        "image": "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/growth/luminosity/1651040420198-fe6d1d.jpeg",
        "tag": {"text": "", "color": ""}
    },
    {
        "id": "svc_205",
        "title": "AC",
        "price": None,
        "duration": None,
        "rating": None,
        "image": "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1752218375028-354111.jpeg",
        "tag": {"text": "⚡ In 44 mins", "color": "green"}
    }
]

@app.get("/api/most-booked")
def get_most_booked():
    return {"status": "success", "data": most_booked_services}

@app.get("/api/new-and-noteworthy")
def get_new_and_noteworthy():
    return {"status": "success", "data": new_and_noteworthy_services}

# This is what Vercel needs — wraps the ASGI app for serverless
handler = Mangum(app)