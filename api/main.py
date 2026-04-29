from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import psycopg2
from psycopg2 import pool as psycopg2_pool
import os
import httpx
import asyncio
import time
from datetime import datetime
from typing import Any, Optional
from functools import wraps

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY")


# ─────────────────────────────────────────────
#  CONNECTION POOL
# ─────────────────────────────────────────────
_db_pool: Optional[psycopg2_pool.ThreadedConnectionPool] = None

def get_pool() -> psycopg2_pool.ThreadedConnectionPool:
    global _db_pool
    if _db_pool is None:
        _db_pool = psycopg2_pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,
            dsn=DATABASE_URL,
        )
    return _db_pool

def get_conn():
    return get_pool().getconn()

def release_conn(conn):
    get_pool().putconn(conn)


# ─────────────────────────────────────────────
#  IN-PROCESS TTL CACHE
# ─────────────────────────────────────────────
_cache_store: dict[str, tuple[Any, float]] = {}

def cache_get(key: str) -> Optional[Any]:
    entry = _cache_store.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.monotonic() > expires_at:
        del _cache_store[key]
        return None
    return value

def cache_set(key: str, value: Any, ttl: int):
    _cache_store[key] = (value, time.monotonic() + ttl)

def cache_delete_prefix(prefix: str):
    for key in list(_cache_store.keys()):
        if key.startswith(prefix):
            del _cache_store[key]

def cached(key_fn, ttl: int = 600):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = key_fn(*args, **kwargs)
            hit = cache_get(key)
            if hit is not None:
                return hit
            result = fn(*args, **kwargs)
            cache_set(key, result, ttl)
            return result
        return wrapper
    return decorator


# ─────────────────────────────────────────────
#  Firebase token verification
# ─────────────────────────────────────────────
async def verify_firebase_token(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    id_token = auth_header.split(" ", 1)[1].strip()
    if not id_token:
        raise HTTPException(status_code=401, detail="Empty token")

    if not FIREBASE_API_KEY:
        raise HTTPException(status_code=500, detail="Server misconfiguration: FIREBASE_API_KEY not set")

    url = f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_API_KEY}"

    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.post(url, json={"idToken": id_token})

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token")

    data = resp.json()
    users = data.get("users")
    if not users:
        raise HTTPException(status_code=401, detail="Token valid but no user found")

    firebase_user = users[0]
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
# ─────────────────────────────────────────────
def ensure_sessions_table():
    conn = get_conn()
    try:
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
    finally:
        release_conn(conn)

try:
    ensure_sessions_table()
except Exception as e:
    print(f"[WARN] Could not create sessions table: {e}")


# ─────────────────────────────────────────────
#  Session helpers
# ─────────────────────────────────────────────
def upsert_session(firebase_uid: str, email: str, user_agent: str, ip: str):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO user_sessions (firebase_uid, email, user_agent, ip_address)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT DO NOTHING;
        """, (firebase_uid, email, user_agent, ip))
        cur.execute("""
            UPDATE user_sessions
            SET last_seen_at = NOW()
            WHERE firebase_uid = %s AND user_agent = %s AND ip_address = %s;
        """, (firebase_uid, user_agent, ip))
        conn.commit()
        cur.close()
    finally:
        release_conn(conn)


def delete_sessions(firebase_uid: str):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM user_sessions WHERE firebase_uid = %s;", (firebase_uid,))
        conn.commit()
        cur.close()
    finally:
        release_conn(conn)


# ─────────────────────────────────────────────
#  DB query helpers
# ─────────────────────────────────────────────
def query(sql: str, params=()) -> list[tuple]:
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        rows = cur.fetchall()
        cur.close()
        return rows
    finally:
        release_conn(conn)

def execute(sql: str, params=()):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()
        cur.close()
    finally:
        release_conn(conn)


# ─────────────────────────────────────────────────────────────────────────────
#  BULK BOOTSTRAP ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/bootstrap")
def bootstrap():
    CACHE_KEY = "bootstrap_v1"
    cached_data = cache_get(CACHE_KEY)
    if cached_data is not None:
        return cached_data

    conn = get_conn()
    try:
        cur = conn.cursor()

        cur.execute("SELECT id, title, price, duration, rating, image FROM most_booked_services")
        most_booked = [
            {"id": r[0], "title": r[1], "price": r[2], "duration": r[3],
             "rating": float(r[4]) if r[4] else None, "image": r[5]}
            for r in cur.fetchall()
        ]

        cur.execute("""
            SELECT id, title, price, duration, rating, image, tag_text, tag_color
            FROM new_and_noteworthy_services
        """)
        new_noteworthy = [
            {"id": r[0], "title": r[1], "price": r[2], "duration": r[3],
             "rating": r[4], "image": r[5],
             "tag": {"text": r[6] or "", "color": r[7] or ""}}
            for r in cur.fetchall()
        ]

        cur.execute("SELECT id, image, title FROM offers_and_discounts")
        offers = [{"id": r[0], "image": r[1], "title": r[2]} for r in cur.fetchall()]

        cur.execute('SELECT id, title, price, rating, image FROM "salon for women"')
        salon_women = [{"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in cur.fetchall()]

        cur.execute('SELECT id, title, price, rating, image FROM "spa for women"')
        spa_women = [{"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in cur.fetchall()]

        cur.execute('SELECT id, title, price, rating, image FROM "cleaning services"')
        cleaning = [{"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in cur.fetchall()]

        cur.execute('SELECT id, title, price, rating, image FROM "large appliances services"')
        appliances = [{"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in cur.fetchall()]

        cur.execute("SELECT id, title, image FROM salon_prime")
        salon_prime = [{"id": r[0], "title": r[1], "image": r[2]} for r in cur.fetchall()]

        cur.execute("SELECT id, title, image FROM men_salon_prime")
        men_salon_prime = [{"id": r[0], "title": r[1], "image": r[2]} for r in cur.fetchall()]

        cur.execute("""
            SELECT id, title, reviews, price, old_price, duration, discount, badge_class, includes
            FROM packages
        """)
        packages = [
            {"id": r[0], "title": r[1], "reviews": r[2], "price": r[3],
             "oldPrice": r[4], "duration": r[5], "discount": r[6],
             "badgeClass": r[7], "includes": r[8]}
            for r in cur.fetchall()
        ]

        cur.execute("""
            SELECT id, title, reviews, price, old_price, duration, discount, badge, includes
            FROM men_packages
        """)
        men_packages = [
            {"id": r[0], "title": r[1], "reviews": r[2], "price": r[3],
             "oldPrice": r[4], "duration": r[5], "discount": r[6],
             "badge": r[7], "includes": r[8]}
            for r in cur.fetchall()
        ]

        cur.execute("""
            SELECT id, category, title, price, old_price, rating, reviews,
                   options, badge, banner_img, banner_heading, banner_sub, bullets
            FROM services
            ORDER BY category
        """)
        services_by_cat: dict[str, list] = {}
        for r in cur.fetchall():
            cat = r[1]
            services_by_cat.setdefault(cat, []).append({
                "id": r[0], "category": r[1], "title": r[2], "price": r[3],
                "oldPrice": r[4], "rating": r[5], "reviews": r[6],
                "options": r[7], "badge": r[8], "bannerImg": r[9],
                "bannerHeading": r[10], "bannerSub": r[11], "bullets": r[12],
            })

        cur.execute("""
            SELECT id, category, title, price, old_price, rating, reviews,
                   options, badge, banner_img, description, bullets
            FROM men_services
            ORDER BY category
        """)
        men_services_by_cat: dict[str, list] = {}
        for r in cur.fetchall():
            cat = r[1]
            men_services_by_cat.setdefault(cat, []).append({
                "id": r[0], "category": r[1], "title": r[2], "price": r[3],
                "oldPrice": r[4], "rating": r[5], "reviews": r[6],
                "options": r[7], "badge": r[8], "bannerImg": r[9],
                "description": r[10], "bullets": r[11],
            })

        cur.execute("""
            SELECT id, code, title, description
            FROM discounts
            WHERE is_active = TRUE
            ORDER BY sort_order ASC
        """)
        discounts = [
            {"id": r[0], "code": r[1], "title": r[2], "description": r[3]}
            for r in cur.fetchall()
        ]

        # ── bathroom cleaning (included in bootstrap for completeness) ────────
        cur.execute("SELECT id, title, image FROM bathroom_cleaning_tabs ORDER BY sort_order")
        bc_tabs = [{"id": r[0], "title": r[1], "image": r[2]} for r in cur.fetchall()]

        cur.execute("""
            SELECT id, category, title, price, old_price, rating, reviews,
                   duration, per_unit, options, starts_at, bullets
            FROM bathroom_cleaning_services
            ORDER BY category, sort_order
        """)
        bc_by_cat: dict[str, list] = {}
        for r in cur.fetchall():
            cat = r[1]
            bc_by_cat.setdefault(cat, []).append({
                "id": r[0], "category": r[1], "title": r[2], "price": r[3],
                "oldPrice": r[4], "rating": r[5], "reviews": r[6],
                "duration": r[7], "perUnit": r[8], "options": r[9],
                "startsAt": r[10], "bullets": r[11],
            })

        cur.close()
    finally:
        release_conn(conn)

    result = {
        "status": "success",
        "data": {
            "most_booked":          most_booked,
            "new_and_noteworthy":   new_noteworthy,
            "offers":               offers,
            "salon_women":          salon_women,
            "spa_women":            spa_women,
            "cleaning":             cleaning,
            "appliances":           appliances,
            "salon_prime":          salon_prime,
            "men_salon_prime":      men_salon_prime,
            "packages":             packages,
            "men_packages":         men_packages,
            "services":             services_by_cat,
            "men_services":         men_services_by_cat,
            "discounts":            discounts,
            "bathroom_cleaning_tabs":     bc_tabs,
            "bathroom_cleaning_services": bc_by_cat,
        }
    }

    cache_set(CACHE_KEY, result, ttl=600)
    return result


# ─────────────────────────────────────────────
#  CACHE INVALIDATION
# ─────────────────────────────────────────────
@app.post("/api/admin/cache/invalidate")
async def invalidate_cache(request: Request):
    cache_delete_prefix("bootstrap")
    cache_delete_prefix("services:")
    cache_delete_prefix("discounts")
    cache_delete_prefix("bathroom_cleaning")
    return {"status": "cache cleared"}


# ─────────────────────────────────────────────
#  PUBLIC CATALOGUE ROUTES (backward compat)
# ─────────────────────────────────────────────

@app.get("/api/most-booked")
@cached(lambda: "most_booked", ttl=600)
def get_most_booked():
    rows = query("SELECT id, title, price, duration, rating, image FROM most_booked_services")
    return {"status": "success", "data": [
        {"id": r[0], "title": r[1], "price": r[2], "duration": r[3],
         "rating": float(r[4]) if r[4] else None, "image": r[5]}
        for r in rows
    ]}


@app.get("/api/new-and-noteworthy")
@cached(lambda: "new_noteworthy", ttl=600)
def get_new_and_noteworthy():
    rows = query("""
        SELECT id, title, price, duration, rating, image, tag_text, tag_color
        FROM new_and_noteworthy_services
    """)
    return {"status": "success", "data": [
        {"id": r[0], "title": r[1], "price": r[2], "duration": r[3],
         "rating": r[4], "image": r[5], "tag": {"text": r[6] or "", "color": r[7] or ""}}
        for r in rows
    ]}


@app.get("/api/offers-and-discounts")
@cached(lambda: "offers_discounts", ttl=600)
def get_offers_and_discounts():
    rows = query("SELECT id, image, title FROM offers_and_discounts")
    return {"status": "success", "data": [{"id": r[0], "image": r[1], "title": r[2]} for r in rows]}


@app.get("/api/salon-for-women")
@cached(lambda: "salon_women", ttl=600)
def get_salon_for_women():
    rows = query('SELECT id, title, price, rating, image FROM "salon for women"')
    return {"status": "success", "data": [
        {"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in rows
    ]}


@app.get("/api/spa-for-women")
@cached(lambda: "spa_women", ttl=600)
def get_spa_for_women():
    rows = query('SELECT id, title, price, rating, image FROM "spa for women"')
    return {"status": "success", "data": [
        {"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in rows
    ]}


@app.get("/api/cleaning-services")
@cached(lambda: "cleaning", ttl=600)
def get_cleaning_services():
    rows = query('SELECT id, title, price, rating, image FROM "cleaning services"')
    return {"status": "success", "data": [
        {"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in rows
    ]}


@app.get("/api/large-appliances-cleaning-services")
@cached(lambda: "appliances", ttl=600)
def get_large_appliances():
    rows = query('SELECT id, title, price, rating, image FROM "large appliances services"')
    return {"status": "success", "data": [
        {"id": r[0], "title": r[1], "price": r[2], "rating": r[3], "image": r[4]} for r in rows
    ]}


@app.get("/api/salon-prime")
@cached(lambda: "salon_prime", ttl=600)
def get_salon_prime():
    rows = query("SELECT id, title, image FROM salon_prime")
    return {"status": "success", "data": [{"id": r[0], "title": r[1], "image": r[2]} for r in rows]}


@app.get("/api/men-salon-prime")
@cached(lambda: "men_salon_prime", ttl=600)
def get_men_salon_prime():
    rows = query("SELECT id, title, image FROM men_salon_prime")
    return {"status": "success", "data": [{"id": r[0], "title": r[1], "image": r[2]} for r in rows]}


@app.get("/api/packages")
@cached(lambda: "packages", ttl=600)
def get_packages():
    rows = query("""
        SELECT id, title, reviews, price, old_price, duration, discount, badge_class, includes
        FROM packages
    """)
    return {"status": "success", "data": [
        {"id": r[0], "title": r[1], "reviews": r[2], "price": r[3],
         "oldPrice": r[4], "duration": r[5], "discount": r[6],
         "badgeClass": r[7], "includes": r[8]}
        for r in rows
    ]}


@app.get("/api/services/{category}")
@cached(lambda category: f"services:{category}", ttl=600)
def get_services_by_category(category: str):
    rows = query("""
        SELECT id, category, title, price, old_price, rating, reviews,
               options, badge, banner_img, banner_heading, banner_sub, bullets
        FROM services WHERE category = %s
    """, (category,))
    return {"status": "success", "data": [
        {"id": r[0], "category": r[1], "title": r[2], "price": r[3],
         "oldPrice": r[4], "rating": r[5], "reviews": r[6], "options": r[7],
         "badge": r[8], "bannerImg": r[9], "bannerHeading": r[10],
         "bannerSub": r[11], "bullets": r[12]}
        for r in rows
    ]}


@app.get("/api/men/packages")
@cached(lambda: "men_packages", ttl=600)
def get_men_packages():
    rows = query("""
        SELECT id, title, reviews, price, old_price, duration, discount, badge, includes
        FROM men_packages
    """)
    return {"status": "success", "data": [
        {"id": r[0], "title": r[1], "reviews": r[2], "price": r[3],
         "oldPrice": r[4], "duration": r[5], "discount": r[6],
         "badge": r[7], "includes": r[8]}
        for r in rows
    ]}


@app.get("/api/men/services/{category}")
@cached(lambda category: f"men_services:{category}", ttl=600)
def get_men_services_by_category(category: str):
    rows = query("""
        SELECT id, category, title, price, old_price, rating, reviews,
               options, badge, banner_img, description, bullets
        FROM men_services WHERE category = %s
    """, (category,))
    return {"status": "success", "data": [
        {"id": r[0], "category": r[1], "title": r[2], "price": r[3],
         "oldPrice": r[4], "rating": r[5], "reviews": r[6], "options": r[7],
         "badge": r[8], "bannerImg": r[9], "description": r[10], "bullets": r[11]}
        for r in rows
    ]}


# ─────────────────────────────────────────────────────────────────────────────
#  BATHROOM CLEANING ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

def _bc_svc_row(r) -> dict:
    """Convert a bathroom_cleaning_services DB row to a dict."""
    return {
        "id":       r[0],
        "category": r[1],
        "title":    r[2],
        "price":    r[3],
        "oldPrice": r[4],
        "rating":   r[5],
        "reviews":  r[6],
        "duration": r[7],
        "perUnit":  r[8],
        "options":  r[9],
        "startsAt": r[10],
        "bullets":  r[11],
    }


@app.get("/api/bathroom-cleaning/tabs")
@cached(lambda: "bathroom_cleaning_tabs", ttl=600)
def get_bathroom_cleaning_tabs():
    """Returns the left-nav category tabs for the bathroom cleaning page."""
    rows = query(
        "SELECT id, title, image FROM bathroom_cleaning_tabs ORDER BY sort_order"
    )
    return {
        "status": "success",
        "data": [{"id": r[0], "title": r[1], "image": r[2]} for r in rows],
    }


@app.get("/api/bathroom-cleaning/services")
@cached(lambda: "bathroom_cleaning_services_all", ttl=600)
def get_all_bathroom_cleaning_services():
    """
    Returns ALL bathroom cleaning services grouped by category.
    Shape: { three_visit_packs: [...], value_deals: [...], ... }
    """
    rows = query("""
        SELECT id, category, title, price, old_price, rating, reviews,
               duration, per_unit, options, starts_at, bullets
        FROM bathroom_cleaning_services
        ORDER BY category, sort_order
    """)
    by_cat: dict[str, list] = {}
    for r in rows:
        by_cat.setdefault(r[1], []).append(_bc_svc_row(r))
    return {"status": "success", "data": by_cat}


@app.get("/api/bathroom-cleaning/services/{category}")
@cached(lambda category: f"bathroom_cleaning_services:{category}", ttl=600)
def get_bathroom_cleaning_services_by_category(category: str):
    """
    Returns services for a single category.
    Valid values: three_visit_packs | value_deals | one_time_deep_clean | mini_services
    """
    rows = query("""
        SELECT id, category, title, price, old_price, rating, reviews,
               duration, per_unit, options, starts_at, bullets
        FROM bathroom_cleaning_services
        WHERE category = %s
        ORDER BY sort_order
    """, (category,))
    if not rows:
        raise HTTPException(status_code=404, detail=f"No services found for category '{category}'")
    return {"status": "success", "data": [_bc_svc_row(r) for r in rows]}


# ─────────────────────────────────────────────
#  PROTECTED ROUTES
# ─────────────────────────────────────────────

@app.post("/api/users")
async def create_user(request: Request):
    payload = await verify_firebase_token(request)
    body = await request.json()

    firebase_uid = payload["uid"]
    email        = payload["email"]
    name         = body.get("name") or payload.get("name") or ""

    if not firebase_uid or not email:
        raise HTTPException(status_code=400, detail="Token missing uid or email")

    execute("""
        INSERT INTO users (firebase_uid, name, email)
        VALUES (%s, %s, %s)
        ON CONFLICT (firebase_uid)
        DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;
    """, (firebase_uid, name, email))

    user_agent = request.headers.get("user-agent", "")
    ip_address = request.client.host if request.client else ""
    upsert_session(firebase_uid, email, user_agent, ip_address)

    return {"status": "user saved", "uid": firebase_uid, "email": email}


@app.get("/api/me")
async def get_me(request: Request):
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]

    rows = query("SELECT firebase_uid, name, email FROM users WHERE firebase_uid = %s;", (firebase_uid,))
    if not rows:
        raise HTTPException(status_code=404, detail="User not found in database")

    row = rows[0]
    user_agent = request.headers.get("user-agent", "")
    ip_address = request.client.host if request.client else ""
    upsert_session(firebase_uid, payload["email"], user_agent, ip_address)

    return {"status": "success", "firebase_uid": row[0], "name": row[1], "email": row[2]}


@app.post("/api/logout")
async def logout(request: Request):
    payload = await verify_firebase_token(request)
    delete_sessions(payload["uid"])
    return {"status": "logged out"}


@app.post("/api/cart")
async def save_cart(request: Request):
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]
    body = await request.json()
    items = body.get("items", [])

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM cart_items WHERE firebase_uid = %s", (firebase_uid,))
        for item in items:
            cur.execute("""
                INSERT INTO cart_items (firebase_uid, product_id, quantity, price)
                VALUES (%s, %s, %s, %s)
            """, (firebase_uid, item["id"], item["qty"], item["price"]))
        conn.commit()
        cur.close()
    finally:
        release_conn(conn)

    return {"status": "cart saved"}


@app.get("/api/cart")
async def get_cart(request: Request):
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]

    rows = query("SELECT product_id, quantity, price FROM cart_items WHERE firebase_uid = %s", (firebase_uid,))
    cart = {r[0]: {"qty": r[1], "price": float(r[2])} for r in rows}
    return {"status": "success", "cart": cart}


@app.get("/api/discounts")
@cached(lambda: "discounts", ttl=120)
def get_discounts():
    rows = query("""
        SELECT id, code, title, description
        FROM discounts
        WHERE is_active = TRUE
        ORDER BY sort_order ASC
    """)
    return {"status": "success", "data": [
        {"id": r[0], "code": r[1], "title": r[2], "description": r[3]} for r in rows
    ]}


# Vercel / AWS Lambda handler
handler = Mangum(app)