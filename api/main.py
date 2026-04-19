from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import psycopg2
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

<<<<<<< HEAD
DATABASE_URL = os.getenv("DATABASE_URL")
=======
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
        "price": 900,
        "duration": 75,
        "rating": 4.6,
        "image": "https://www.urbancompany.com/img?bucket=urbanclap-prod&quality=90&format=auto/w_233,dpr_2,fl_progressive:steep,q_auto:low,f_auto,c_limit/images/supply/customer-app-supply/1770203489779-b131f8.jpeg"
    }
]
>>>>>>> 42b5ca1e8d6a254a46910082d608663162c6e62f

def get_conn():
    return psycopg2.connect(DATABASE_URL)


# 🔹 MOST BOOKED
@app.get("/api/most-booked")
def get_most_booked():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT id, title, price, duration, rating, image FROM most_booked_services")
    rows = cur.fetchall()

    data = [
        {
            "id": r[0],
            "title": r[1],
            "price": r[2],
            "duration": r[3],
            "rating": float(r[4]) if r[4] else None,
            "image": r[5],
        }
        for r in rows
    ]

    cur.close()
    conn.close()

    return {"status": "success", "data": data}


# 🔹 NEW & NOTEWORTHY
@app.get("/api/new-and-noteworthy")
def get_new_and_noteworthy():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, title, price, duration, rating, image, tag_text, tag_color
        FROM new_and_noteworthy_services
    """)
    rows = cur.fetchall()

    data = [
        {
            "id": r[0],
            "title": r[1],
            "price": r[2],
            "duration": r[3],
            "rating": r[4],
            "image": r[5],
            "tag": {
                "text": r[6] or "",
                "color": r[7] or ""
            },
        }
        for r in rows
    ]

    cur.close()
    conn.close()

    return {"status": "success", "data": data}


# 🔹 OFFERS & DISCOUNTS
@app.get("/api/offers-and-discounts")
def get_offers_and_discounts():
    conn = get_conn()
    cur = conn.cursor()

<<<<<<< HEAD
    cur.execute("SELECT id, image, title FROM offers_and_discounts")
    rows = cur.fetchall()

    data = [
        {
            "id": r[0],
            "image": r[1],
            "title": r[2],
        }
        for r in rows
    ]

    cur.close()
    conn.close()

    return {"status": "success", "data": data}


# Vercel handler
handler = Mangum(app)
=======
# This is what Vercel needs — wraps the ASGI app for serverless
handler = Mangum(app)
>>>>>>> 42b5ca1e8d6a254a46910082d608663162c6e62f
