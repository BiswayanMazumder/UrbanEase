from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import psycopg2
import os
from jose import jwt, JWTError
from datetime import datetime, timedelta

SECRET_KEY = "a8f7sd9f87sdf98s7df98s7df98sdf7"
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60
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

def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
def verify_token(request):
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return None

    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
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
@app.get("/api/cleaning-services")
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
@app.get("/api/large-appliances-cleaning-services")
def salon_for_women():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, title, price, rating, image FROM "large appliances services";
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
@app.get("/api/users")
def get_users(request: Request):
    user = verify_token(request)

    if not user:
        return {"status": "error", "message": "Unauthorized"}

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, firebase_uid, name, email FROM users;
    """)

    rows = cur.fetchall()

    data = [
        {
            "id": r[0],
            "firebase_uid": r[1],
            "name": r[2],
            "email": r[3],
        }
        for r in rows
    ]

    cur.close()
    conn.close()

    return {"status": "success", "data": data}
@app.post("/api/login")
def login(user: dict):
    email = user.get("email")
    name = user.get("name", "")

    if not email:
        return {"status": "error", "message": "Email required"}

    token = create_token({
        "email": email,
        "name": name
    })

    return {
        "status": "success",
        "token": token
    }
    
# Vercel handler
handler = Mangum(app)