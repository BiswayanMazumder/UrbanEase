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

DATABASE_URL = os.getenv("DATABASE_URL")

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

@app.get("/api/salon-for-women")
def salon_for_women():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, title, price, rating, image FROM "salon for women";
    """)
    rows = cur.fetchall()
    data = [
        {
            "id": r[0],
            "title": r[1],
            "price": r[2],
            "rating": r[3],
            "image": r[4],
        }
        for r in rows
    ]
    print("data", data)
    cur.close()
    conn.close()

    return {"status": "success", "data": data}

@app.get("/api/spa-for-women")
def salon_for_women():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, title, price, rating, image FROM "spa for women";
    """)
    rows = cur.fetchall()
    data = [
        {
            "id": r[0],
            "title": r[1],
            "price": r[2],
            "rating": r[3],
            "image": r[4],
        }
        for r in rows
    ]
    print("data", data)
    cur.close()
    conn.close()

    return {"status": "success", "data": data}
@app.get("/api/spa-for-women")
def salon_for_women():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, title, price, rating, image FROM "cleaning services";
    """)
    rows = cur.fetchall()
    data = [
        {
            "id": r[0],
            "title": r[1],
            "price": r[2],
            "rating": r[3],
            "image": r[4],
        }
        for r in rows
    ]
    print("data", data)
    cur.close()
    conn.close()

    return {"status": "success", "data": data}
# Vercel handler
handler = Mangum(app)