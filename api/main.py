from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import psycopg2
import os
import httpx
from datetime import datetime

# ─────────────────────────────────────────────
#  Firebase public-key endpoint (no Admin SDK)
# ─────────────────────────────────────────────
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")   
FIREBASE_VERIFY_URL = (
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup"
    "?key={api_key}"
)
FIREBASE_JWKS_URL = (
    "https://www.googleapis.com/service_accounts/v1/jwk/"
    "securetoken@system.gserviceaccount.com"
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY")   # Web API key from Firebase console


# ─────────────────────────────────────────────
#  DB helper
# ─────────────────────────────────────────────
def get_conn():
    return psycopg2.connect(DATABASE_URL)


# ─────────────────────────────────────────────
#  Firebase token verification
#  We call Firebase's tokeninfo endpoint so we
#  never need the Admin SDK / service-account key.
# ─────────────────────────────────────────────
async def verify_firebase_token(request: Request) -> dict:
    """
    Extracts the Bearer token from the Authorization header,
    verifies it with Firebase REST API, and returns the decoded
    payload dict  { uid, email, name, ... }.
    Raises HTTP 401 on any failure.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    id_token = auth_header.split(" ", 1)[1].strip()
    if not id_token:
        raise HTTPException(status_code=401, detail="Empty token")

    if not FIREBASE_API_KEY:
        raise HTTPException(status_code=500, detail="Server misconfiguration: FIREBASE_API_KEY not set")

    url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_API_KEY}"

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json={"idToken": id_token})

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token")

    data = resp.json()
    users = data.get("users")
    if not users:
        raise HTTPException(status_code=401, detail="Token valid but no user found")

    firebase_user = users[0]

    # Optional: reject email-unverified users (uncomment if needed)
    # if not firebase_user.get("emailVerified", False):
    #     raise HTTPException(status_code=403, detail="Email not verified")

    return {
        "uid":            firebase_user.get("localId"),
        "email":          firebase_user.get("email"),
        "name":           firebase_user.get("displayName", ""),
        "email_verified": firebase_user.get("emailVerified", False),
        "created_at":     firebase_user.get("createdAt"),
        "last_login":     firebase_user.get("lastLoginAt"),
    }


# ─────────────────────────────────────────────
#  Session table bootstrap
#  (run once; idempotent thanks to IF NOT EXISTS)
# ─────────────────────────────────────────────
def ensure_sessions_table():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            id            SERIAL PRIMARY KEY,
            firebase_uid  TEXT NOT NULL,
            email         TEXT NOT NULL,
            created_at    TIMESTAMPTZ DEFAULT NOW(),
            last_seen_at  TIMESTAMPTZ DEFAULT NOW(),
            user_agent    TEXT,
            ip_address    TEXT
        );
    """)
    conn.commit()
    cur.close()
    conn.close()


try:
    ensure_sessions_table()
except Exception as e:
    # Don't crash on cold start if DB isn't ready yet
    print(f"[WARN] Could not create sessions table: {e}")


# ─────────────────────────────────────────────
#  Session helpers
# ─────────────────────────────────────────────
def upsert_session(firebase_uid: str, email: str, user_agent: str, ip: str):
    """
    Creates a new session row or refreshes last_seen_at if one already
    exists for this uid from the same user-agent / IP combo.
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO user_sessions (firebase_uid, email, user_agent, ip_address)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT DO NOTHING;
    """, (firebase_uid, email, user_agent, ip))

    # Always refresh last_seen_at so we can track activity
    cur.execute("""
        UPDATE user_sessions
        SET last_seen_at = NOW()
        WHERE firebase_uid = %s AND user_agent = %s AND ip_address = %s;
    """, (firebase_uid, user_agent, ip))

    conn.commit()
    cur.close()
    conn.close()


def delete_sessions(firebase_uid: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM user_sessions WHERE firebase_uid = %s;", (firebase_uid,))
    conn.commit()
    cur.close()
    conn.close()


# ─────────────────────────────────────────────
#  PUBLIC DATA ROUTES  (no auth needed)
# ─────────────────────────────────────────────

@app.get("/api/most-booked")
def get_most_booked():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, title, price, duration, rating, image FROM most_booked_services")
    rows = cur.fetchall()
    data = [
        {
            "id": r[0], "title": r[1], "price": r[2],
            "duration": r[3], "rating": float(r[4]) if r[4] else None, "image": r[5],
        }
        for r in rows
    ]
    cur.close(); conn.close()
    return {"status": "success", "data": data}


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
            "id": r[0], "title": r[1], "price": r[2], "duration": r[3],
            "rating": r[4], "image": r[5],
            "tag": {"text": r[6] or "", "color": r[7] or ""},
        }
        for r in rows
    ]
    cur.close(); conn.close()
    return {"status": "success", "data": data}


@app.get("/api/offers-and-discounts")
def get_offers_and_discounts():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, image, title FROM offers_and_discounts")
    rows = cur.fetchall()
    data = [{"id": r[0], "image": r[1], "title": r[2]} for r in rows]
    cur.close(); conn.close()
    return {"status": "success", "data": data}


@app.get("/api/salon-for-women")
def get_salon_for_women():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, title, price, rating, image FROM "salon for women"')
    rows = cur.fetchall()
    data = [{"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in rows]
    cur.close(); conn.close()
    return {"status": "success", "data": data}


@app.get("/api/spa-for-women")
def get_spa_for_women():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, title, price, rating, image FROM "spa for women"')
    rows = cur.fetchall()
    data = [{"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in rows]
    cur.close(); conn.close()
    return {"status": "success", "data": data}


@app.get("/api/cleaning-services")
def get_cleaning_services():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, title, price, rating, image FROM "cleaning services"')
    rows = cur.fetchall()
    data = [{"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in rows]
    cur.close(); conn.close()
    return {"status": "success", "data": data}


@app.get("/api/large-appliances-cleaning-services")
def get_large_appliances():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, title, price, rating, image FROM "large appliances services"')
    rows = cur.fetchall()
    data = [{"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in rows]
    cur.close(); conn.close()
    return {"status": "success", "data": data}
@app.get("/api/salon-prime")
def get_salon_prime():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT id, title, image FROM salon_prime")
    rows = cur.fetchall()

    data = [
        {
            "id": r[0],
            "title": r[1],
            "image": r[2],
        }
        for r in rows
    ]

    cur.close()
    conn.close()

    return {"status": "success", "data": data}
@app.get("/api/men-salon-prime")
def get_salon_prime():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT id, title, image FROM men_salon_prime")
    rows = cur.fetchall()

    data = [
        {
            "id": r[0],
            "title": r[1],
            "image": r[2],
        }
        for r in rows
    ]

    cur.close()
    conn.close()

    return {"status": "success", "data": data}
# ─────────────────────────────────────────────
#  PROTECTED ROUTES  (Firebase token required)
# ─────────────────────────────────────────────

@app.post("/api/users")
async def create_user(request: Request):
    """
    Called after signup / login from the frontend.
    Verifies the Firebase ID token, upserts the user in Postgres,
    and records a session row.
    """
    payload = await verify_firebase_token(request)

    body = await request.json()

    firebase_uid = payload["uid"]
    email        = payload["email"]
    name         = body.get("name") or payload.get("name") or ""

    if not firebase_uid or not email:
        raise HTTPException(status_code=400, detail="Token missing uid or email")

    conn = get_conn()
    cur  = conn.cursor()

    # Upsert user row — update name if it changed
    cur.execute("""
        INSERT INTO users (firebase_uid, name, email)
        VALUES (%s, %s, %s)
        ON CONFLICT (firebase_uid)
        DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;
    """, (firebase_uid, name, email))

    conn.commit()
    cur.close()
    conn.close()

    # Record / refresh session
    user_agent = request.headers.get("user-agent", "")
    ip_address = request.client.host if request.client else ""
    upsert_session(firebase_uid, email, user_agent, ip_address)

    return {"status": "user saved", "uid": firebase_uid, "email": email}


@app.get("/api/me")
async def get_me(request: Request):
    """
    Returns the currently authenticated user's profile from the DB.
    Frontend calls this on app load to restore the session UI.
    """
    payload = await verify_firebase_token(request)

    firebase_uid = payload["uid"]

    conn = get_conn()
    cur  = conn.cursor()

    cur.execute("""
        SELECT firebase_uid, name, email
        FROM users
        WHERE firebase_uid = %s;
    """, (firebase_uid,))

    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="User not found in database")

    # Refresh last_seen_at in sessions
    user_agent = request.headers.get("user-agent", "")
    ip_address = request.client.host if request.client else ""
    upsert_session(firebase_uid, payload["email"], user_agent, ip_address)

    return {
        "status":       "success",
        "firebase_uid": row[0],
        "name":         row[1],
        "email":        row[2],
    }


@app.post("/api/logout")
async def logout(request: Request):
    """
    Deletes all server-side sessions for this user.
    The frontend is responsible for calling Firebase signOut() as well.
    """
    payload = await verify_firebase_token(request)
    delete_sessions(payload["uid"])
    return {"status": "logged out"}
@app.get("/api/packages")
def get_packages():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, title, reviews, price, old_price, duration, discount, badge_class, includes
        FROM packages
    """)
    rows = cur.fetchall()
    data = [
        {
            "id":         r[0],
            "title":      r[1],
            "reviews":    r[2],
            "price":      r[3],
            "oldPrice":   r[4],
            "duration":   r[5],
            "discount":   r[6],
            "badgeClass": r[7],
            "includes":   r[8],   # already a list — psycopg2 parses JSONB
        }
        for r in rows
    ]
    cur.close(); conn.close()
    return {"status": "success", "data": data}
@app.post("/api/cart")
async def save_cart(request: Request):
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]

    body = await request.json()
    items = body.get("items", [])

    conn = get_conn()
    cur = conn.cursor()

    # Clear old cart
    cur.execute("DELETE FROM cart_items WHERE firebase_uid = %s", (firebase_uid,))

    # Insert new cart
    for item in items:
        cur.execute("""
            INSERT INTO cart_items (firebase_uid, product_id, quantity, price)
            VALUES (%s, %s, %s, %s)
        """, (firebase_uid, item["id"], item["qty"], item["price"]))

    conn.commit()
    cur.close()
    conn.close()

    return {"status": "cart saved"}
@app.get("/api/cart")
async def get_cart(request: Request):
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT product_id, quantity, price
        FROM cart_items
        WHERE firebase_uid = %s
    """, (firebase_uid,))

    rows = cur.fetchall()

    cart = {
        r[0]: {"qty": r[1], "price": float(r[2])}
        for r in rows
    }

    cur.close()
    conn.close()

    return {"status": "success", "cart": cart}

@app.get("/api/services/{category}")
def get_services_by_category(category: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, category, title, price, old_price, rating, reviews,
               options, badge, banner_img, banner_heading, banner_sub, bullets
        FROM services
        WHERE category = %s
    """, (category,))
    rows = cur.fetchall()
    data = [
        {
            "id":            r[0],
            "category":      r[1],
            "title":         r[2],
            "price":         r[3],
            "oldPrice":      r[4],
            "rating":        r[5],
            "reviews":       r[6],
            "options":       r[7],
            "badge":         r[8],
            "bannerImg":     r[9],
            "bannerHeading": r[10],
            "bannerSub":     r[11],
            "bullets":       r[12],  # JSONB → list
        }
        for r in rows
    ]
    cur.close(); conn.close()
    return {"status": "success", "data": data}
@app.get("/api/discounts")
def get_discounts():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, code, title, description
        FROM discounts
        WHERE is_active = TRUE
        ORDER BY sort_order ASC
    """)
    rows = cur.fetchall()
    data = [
        {
            "id":          r[0],
            "code":        r[1],
            "title":       r[2],
            "description": r[3],
        }
        for r in rows
    ]
    cur.close()
    conn.close()
    return {"status": "success", "data": data}
# ─────────────────────────────────────────────
#  LEGACY /api/login removed —
#  authentication is now done entirely through
#  Firebase on the frontend; the backend only
#  validates Firebase ID tokens.
# ─────────────────────────────────────────────

# Vercel / AWS Lambda handler
handler = Mangum(app)