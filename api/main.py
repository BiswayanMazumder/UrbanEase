from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
import psycopg2
from psycopg2 import pool as psycopg2_pool
import os
import httpx
import json
import hmac
import hashlib
import asyncio
import time
from psycopg2.extras import Json
import razorpay
from datetime import datetime
from typing import Any, Optional
from functools import wraps
import re as _re
from datetime import date, timedelta

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
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
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
##RZP Payment
@app.post("/api/payment/create-order")
async def create_order(request: Request):
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]

    body = await request.json()
    amount = int(body.get("amount"))  # in paise

    order = client.order.create({
        "amount": amount,
        "currency": "INR",
        "payment_capture": 1
    })

    return {
        "status": "success",
        "order": order
    }
@app.post("/api/payment/verify")
async def verify_payment(request: Request):
    # 🔐 Verify user
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]

    body = await request.json()

    # 💳 Razorpay data
    order_id = body.get("razorpay_order_id")
    payment_id = body.get("razorpay_payment_id")
    signature = body.get("razorpay_signature")
    amount = body.get("amount")

    # 🔥 Booking data (NEW)
    address = body.get("address")
    slots = body.get("slots")
    cart = body.get("cart")
    quantities = body.get("quantities")

    # ❌ Basic validation
    if not all([order_id, payment_id, signature, amount]):
        raise HTTPException(status_code=400, detail="Missing payment data")

    # 🔐 Verify signature
    generated_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256
    ).hexdigest()

    if generated_signature != signature:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # 💾 Save full order in Neon DB
    try:
        execute("""
            INSERT INTO orders (
                firebase_uid,
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                amount,
                status,
                address,
                slots,
                cart,
                quantities,
                created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            firebase_uid,
            order_id,
            payment_id,
            signature,
            amount,
            "paid",
            json.dumps(address),
            json.dumps(slots),
            json.dumps(cart),
            json.dumps(quantities)
        ))
        # 🧹 CLEAR CART
        execute("""
            DELETE FROM cart_items
            WHERE firebase_uid = %s
        """, (firebase_uid,))
    except Exception as e:
        print("❌ DB insert failed:", str(e))
        raise HTTPException(status_code=500, detail="Failed to store order")

    return {
        "status": "success",
        "message": "Payment verified and order stored"
    }
@app.get("/api/cron/generate-slots")
def generate_slots():
    conn = get_conn()
    try:
        cur = conn.cursor()

        dates = [(date.today() + timedelta(days=i)) for i in range(0, 14)]
        times = [
            "09:00 AM", "11:00 AM", "01:00 PM",
            "03:00 PM", "05:00 PM", "07:00 PM"
        ]

        for d in dates:
            for t in times:
                cur.execute("""
                    INSERT INTO slot_inventory (date, time, capacity, base_capacity, available)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (date, time) DO NOTHING
                """, (d, t, 5, 5, 5))

        conn.commit()
        cur.close()

        return {"status": "slots generated"}

    finally:
        release_conn(conn)
@app.get("/api/cron/sync-slot-inventory")
def sync_slot_inventory():
    conn = get_conn()
    try:
        cur = conn.cursor()

        # 1️⃣ Reset booked count
        cur.execute("""
            UPDATE slot_inventory
            SET booked = 0
        """)

        # 2️⃣ Recalculate from orders
        orders = query("""
            SELECT slots FROM orders WHERE status != 'cancelled'
        """)

        for o in orders:
            slots_map = _safe_json(o[0], {})

            for slot in slots_map.values():
                if slot.get("_cancelled"):
                    continue

                d = slot.get("date")
                t = slot.get("time")

                cur.execute("""
                    UPDATE slot_inventory
                    SET booked = booked + 1
                    WHERE date = %s AND time = %s
                """, (d, t))

        # 3️⃣ Recompute availability
        cur.execute("""
            UPDATE slot_inventory
            SET 
                available = capacity - booked - locked,
                is_blocked = CASE 
                    WHEN capacity - booked - locked <= 0 THEN TRUE
                    ELSE FALSE
                END
        """)

        conn.commit()
        cur.close()

        return {"status": "slot inventory synced"}

    finally:
        release_conn(conn)
@app.get("/api/cron/block-slots")
def block_slots():
    conn = get_conn()
    try:
        cur = conn.cursor()

        now = datetime.utcnow()

        rows = query("SELECT date, time FROM slot_inventory")

        for r in rows:
            d, t = r

            slot_dt = datetime.fromisoformat(f"{d}T{_convert_to_24(t)}")
            hours = (slot_dt - now).total_seconds() / 3600

            reason = None

            # 🚫 2 hr cutoff
            if hours < 2:
                reason = "cutoff"

            # 🚫 peak overload
            elif hours < 24:
                reason = "high_demand"

            if reason:
                cur.execute("""
                    UPDATE slot_inventory
                    SET is_blocked = TRUE,
                        block_reason = %s
                    WHERE date = %s AND time = %s
                """, (reason, d, t))

            else:
                # ✅ UNBLOCK
                cur.execute("""
                    UPDATE slot_inventory
                    SET is_blocked = FALSE,
                        block_reason = NULL
                    WHERE date = %s AND time = %s
                """, (d, t))

        conn.commit()
        cur.close()

        return {"status": "slots blocked/unblocked"}

    finally:
        release_conn(conn)
@app.get("/api/cron/dynamic-capacity")
def dynamic_capacity():
    conn = get_conn()
    try:
        cur = conn.cursor()

        cur.execute("""
            UPDATE slot_inventory
            SET capacity =
                CASE
                    WHEN booked >= base_capacity * 0.8 THEN base_capacity + 2
                    ELSE base_capacity
                END
        """)

        conn.commit()
        cur.close()

        return {"status": "capacity optimized"}

    finally:
        release_conn(conn)
@app.post("/api/slots/lock")
def lock_slot(date: str, time: str):
    execute("""
        UPDATE slot_inventory
        SET locked = locked + 1
        WHERE date = %s AND time = %s
        AND available > 0
    """, (date, time))
@app.get("/api/cron/unlock-expired")
def unlock_expired():
    execute("""
        UPDATE slot_inventory
        SET locked = 0
    """)
def _convert_to_24(time_str: str) -> str:
    """'07:00 PM' → '19:00'"""
    time, modifier = time_str.strip().split(" ")
    h, m = map(int, time.split(":"))
    if modifier == "PM" and h != 12:
        h += 12
    if modifier == "AM" and h == 12:
        h = 0
    return f"{h:02d}:{m:02d}"
 
 
def _slot_datetime(slot: dict) -> datetime:
    return datetime.fromisoformat(f"{slot['date']}T{_convert_to_24(slot['time'])}")
 
 
def _hours_until(slot: dict) -> float:
    return (_slot_datetime(slot) - datetime.utcnow()).total_seconds() / 3600
 
 
def _safe_json(val, default):
    if val is None:
        return default
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return default
    return default
 
 
# ─────────────────────────────────────────────────────────────────────────────
#  POST /api/orders/{razorpay_order_id}/cancel-slot
#
#  Body:  { "slot_key": "0" }          (the key inside the slots JSON object)
#
#  Rules:
#   • slot must NOT already be cancelled
#   • slot must be > 24 hrs away
#   • issues a proportional Razorpay refund  (order_amount / total_slots)
#   • marks slot as  _cancelled: true  inside the JSONB column
#   • if ALL slots are now cancelled → sets order status = "cancelled"
# ─────────────────────────────────────────────────────────────────────────────
 
@app.post("/api/orders/{razorpay_order_id}/cancel-slot")
async def cancel_slot(razorpay_order_id: str, request: Request):
    payload      = await verify_firebase_token(request)
    firebase_uid = payload["uid"]
 
    body     = await request.json()
    slot_key = str(body.get("slot_key", ""))
    if not slot_key:
        raise HTTPException(status_code=400, detail="slot_key is required")
 
    # ── Fetch order ────────────────────────────────────────────────────────
    rows = query(
        """
        SELECT id, status, slots, razorpay_payment_id, amount, refund_id
        FROM orders
        WHERE razorpay_order_id = %s AND firebase_uid = %s
        """,
        (razorpay_order_id, firebase_uid),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Order not found")
 
    r              = rows[0]
    order_db_id    = r[0]
    status         = r[1]
    slots_raw      = r[2]
    payment_id     = r[3]
    total_amount   = int(r[4])   # paise
    existing_refund = r[5]
 
    if status == "cancelled":
        raise HTTPException(status_code=400, detail="Order is already fully cancelled")
 
    slots_map: dict = _safe_json(slots_raw, {})
 
    if slot_key not in slots_map:
        raise HTTPException(status_code=404, detail=f"Slot '{slot_key}' not found in this order")
 
    slot = slots_map[slot_key]
 
    if slot.get("_cancelled"):
        raise HTTPException(status_code=400, detail="This slot is already cancelled")
 
    if _hours_until(slot) <= 24:
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel a slot within 24 hours of its appointment time",
        )
 
    # ── Proportional refund ────────────────────────────────────────────────
    total_slots   = len(slots_map)
    active_slots  = sum(1 for s in slots_map.values() if not s.get("_cancelled"))
    # Refund = order_amount / total_original_slots  (fair share per slot)
    refund_amount = total_amount // total_slots   # integer paise
 
    new_refund_id = None
    if payment_id and refund_amount > 0:
        try:
            payment = razorpay_client.payment.fetch(payment_id)
            if payment["status"] != "captured":
                raise Exception("Payment not captured")
            refund = razorpay_client.payment.refund(payment_id, {"amount": refund_amount})
            new_refund_id = refund.get("id")
        except Exception as e:
            print(f"[cancel-slot] Refund error (non-blocking): {e}")
 
    # ── Mark slot as cancelled ─────────────────────────────────────────────
    slots_map[slot_key]["_cancelled"] = True
 
    # Determine whether to fully cancel the order
    remaining_active = sum(1 for s in slots_map.values() if not s.get("_cancelled"))
    new_order_status = "cancelled" if remaining_active == 0 else status
 
    new_amount = total_amount - refund_amount

    execute("""
        UPDATE orders
        SET slots        = %s::jsonb,
            status       = %s,
            amount       = %s,
            refund_id    = COALESCE(%s, refund_id),
            cancelled_at = CASE WHEN %s = 'cancelled' THEN NOW() ELSE cancelled_at END
        WHERE id = %s
    """, (
        json.dumps(slots_map),
        new_order_status,
        new_amount,              
        new_refund_id,
        new_order_status,
        order_db_id,
    ))
 
    return {
        "status":       "success",
        "message":      "Slot cancelled",
        "refund_id":    new_refund_id,
        "refund_paise": refund_amount,
        "order_status": new_order_status,
    }
@app.get("/api/cron/assign-providers")
async def assign_providers_cron():
    try:
        now = datetime.utcnow()

        orders = query("""
            SELECT id, slots
            FROM orders
            WHERE status != 'cancelled'
        """)

        for order in orders:
            order_id = order[0]
            slots_map = _safe_json(order[1], {})

            updated = False

            for key, slot in slots_map.items():

                if slot.get("_cancelled"):
                    continue

                if "provider" not in slot:
                    slot["provider"] = {
                        "name": None,
                        "phone": None,
                        "assigned_at": None
                    }

                # ❌ Already assigned
                if slot["provider"]["phone"]:
                    continue

                # ⏱ Time check
                try:
                    slot_dt = _slot_datetime(slot)
                except:
                    continue

                hours = (slot_dt - now).total_seconds() / 3600

                if not (0 < hours <= 24):
                    continue

                # 🧠 SMART PROVIDER SELECTION
                providers = query("""
                    SELECT id, name, phone, rating, total_jobs, last_assigned_at
                    FROM providers
                    WHERE is_active = TRUE
                      AND is_busy = FALSE
                """)

                best_provider = None
                best_score = -1

                for p in providers:
                    pid, name, phone, rating, total_jobs, last_assigned = p

                    idle_hours = 24
                    if last_assigned:
                        idle_hours = (now - last_assigned).total_seconds() / 3600

                    idle_score = min(idle_hours / 24, 1)

                    score = (
                        rating * 0.6 +
                        (1 / (total_jobs + 1)) * 0.2 +
                        idle_score * 0.2
                    )

                    if score > best_score:
                        best_score = score
                        best_provider = p

                if not best_provider:
                    continue

                pid, name, phone, rating, total_jobs, _ = best_provider

                # ✅ Assign provider
                slot["provider"] = {
                    "name": name,
                    "phone": phone,
                    "assigned_at": now.isoformat()
                }

                # ✅ Mark provider busy
                execute("""
                    UPDATE providers
                    SET is_busy = TRUE,
                        last_assigned_at = NOW(),
                        total_jobs = total_jobs + 1,
                        current_job_id = %s
                    WHERE id = %s
                """, (order_id, pid))

                # ✅ Track assignment
                execute("""
                    INSERT INTO provider_assignments (provider_id, order_id, slot_key)
                    VALUES (%s, %s, %s)
                """, (pid, order_id, key))

                updated = True

            if updated:
                execute("""
                    UPDATE orders
                    SET slots = %s
                    WHERE id = %s
                """, (Json(slots_map), order_id))

        return {"status": "success", "message": "Smart providers assigned"}

    except Exception as e:
        print("❌ CRON ERROR:", str(e))
        return {"status": "error", "message": str(e)}
@app.get("/api/cron/release-providers")
async def release_providers():
    try:
        now = datetime.utcnow()

        rows = query("""
            SELECT pa.id, pa.provider_id, pa.order_id, pa.slot_key, o.slots
            FROM provider_assignments pa
            JOIN orders o ON pa.order_id = o.id
            WHERE pa.job_status = 'assigned'
        """)

        for r in rows:
            assign_id, provider_id, order_id, slot_key, slots_raw = r

            slots_map = _safe_json(slots_raw, {})
            slot = slots_map.get(slot_key)

            if not slot:
                continue

            try:
                slot_dt = _slot_datetime(slot)
            except:
                continue

            # ⏱ If job time passed → release
            if now > slot_dt:
                
                # ✅ Mark assignment complete
                execute("""
                    UPDATE provider_assignments
                    SET job_status = 'completed'
                    WHERE id = %s
                """, (assign_id,))

                # ✅ Free provider
                execute("""
                    UPDATE providers
                    SET is_busy = FALSE,
                        current_job_id = NULL
                    WHERE id = %s
                """, (provider_id,))

        return {"status": "success", "message": "Providers released"}

    except Exception as e:
        print("❌ RELEASE ERROR:", str(e))
        return {"status": "error", "message": str(e)}
 
# ─────────────────────────────────────────────────────────────────────────────
#  POST /api/orders/{razorpay_order_id}/reschedule-slot
#
#  Body:  { "slot_key": "0", "new_date": "2025-05-15", "new_time": "05:00 PM" }
#
#  Rules:
#   • slot must NOT be cancelled
#   • new datetime must be in the future
#   • if current slot is within 24 hrs → charge ₹100 rescheduling fee via Razorpay
#   • updates the slot's date & time in the JSONB column
# ─────────────────────────────────────────────────────────────────────────────
 
RESCHEDULE_FEE_PAISE = 10_000   # ₹100 in paise
 
@app.post("/api/orders/{razorpay_order_id}/reschedule-slot")
async def reschedule_slot(razorpay_order_id: str, request: Request):
    payload      = await verify_firebase_token(request)
    firebase_uid = payload["uid"]
 
    body     = await request.json()
    slot_key = str(body.get("slot_key", ""))
    new_date = body.get("new_date", "")   # "YYYY-MM-DD"
    new_time = body.get("new_time", "")   # "HH:MM AM/PM"
 
    if not all([slot_key, new_date, new_time]):
        raise HTTPException(status_code=400, detail="slot_key, new_date, and new_time are required")
 
    # ── Fetch order ────────────────────────────────────────────────────────
    rows = query(
        """
        SELECT id, status, slots, razorpay_payment_id, reschedule_fee_paid
        FROM orders
        WHERE razorpay_order_id = %s AND firebase_uid = %s
        """,
        (razorpay_order_id, firebase_uid),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Order not found")
 
    r                   = rows[0]
    order_db_id         = r[0]
    status              = r[1]
    slots_raw           = r[2]
    payment_id          = r[3]
    fee_already_paid    = r[4] or False
 
    if status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot reschedule a cancelled order")
 
    slots_map: dict = _safe_json(slots_raw, {})
 
    if slot_key not in slots_map:
        raise HTTPException(status_code=404, detail=f"Slot '{slot_key}' not found")
 
    slot = slots_map[slot_key]
 
    if slot.get("_cancelled"):
        raise HTTPException(status_code=400, detail="Cannot reschedule a cancelled slot")
 
    # Validate new datetime is in the future
    try:
        new_dt = datetime.fromisoformat(f"{new_date}T{_convert_to_24(new_time)}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid new_date or new_time format")
 
    if new_dt <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="New appointment time must be in the future")
 
    # ── ₹100 fee if rescheduling within 24 hrs of CURRENT slot ────────────
    hours_until_current = _hours_until(slot)
    needs_fee = 0 < hours_until_current <= 24
 
    fee_charged = False
    if needs_fee and not fee_already_paid and payment_id:
        try:
            # Create a fresh Razorpay order for the fee
            fee_order = razorpay_client.order.create({
                "amount":          RESCHEDULE_FEE_PAISE,
                "currency":        "INR",
                "payment_capture": 1,
                "notes": {
                    "type":              "reschedule_fee",
                    "original_order_id": razorpay_order_id,
                    "slot_key":          slot_key,
                },
            })
            # NOTE: In a real flow you'd return the fee_order to the frontend so the
            # user pays it via Razorpay checkout. For simplicity here we record the
            # intent and let the frontend handle the payment popup separately.
            # We mark reschedule_fee_paid = TRUE only after successful payment webhook.
            # For now we proceed optimistically (remove this if you want strict flow).
            fee_charged = True
            print(f"[reschedule] Fee order created: {fee_order.get('id')}")
        except Exception as e:
            print(f"[reschedule] Fee order creation failed (non-blocking): {e}")
 
    # ── Update slot ────────────────────────────────────────────────────────
    old_date = slot.get("date")
    old_time = slot.get("time")
 
    slots_map[slot_key]["date"] = new_date
    slots_map[slot_key]["time"] = new_time
    # Keep a history trail
    slots_map[slot_key].setdefault("_history", []).append(
        {"date": old_date, "time": old_time, "rescheduled_at": datetime.utcnow().isoformat()}
    )
 
    execute(
        """
        UPDATE orders
        SET slots               = %s::jsonb,
            reschedule_fee_paid = reschedule_fee_paid OR %s
        WHERE id = %s
        """,
        (json.dumps(slots_map), fee_charged, order_db_id),
    )
 
    return {
        "status":      "success",
        "message":     "Slot rescheduled",
        "fee_charged": fee_charged,
        "fee_paise":   RESCHEDULE_FEE_PAISE if fee_charged else 0,
        "new_date":    new_date,
        "new_time":    new_time,
    }
 
 
# ─────────────────────────────────────────────────────────────────────────────
#  DB MIGRATION — run once
# ─────────────────────────────────────────────────────────────────────────────
#
#  ALTER TABLE orders
#    ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
#    ADD COLUMN IF NOT EXISTS refund_id            TEXT,
#    ADD COLUMN IF NOT EXISTS reschedule_fee_paid  BOOLEAN DEFAULT FALSE;
#
#  -- Make sure slots is JSONB (if it was TEXT before):
#  ALTER TABLE orders ALTER COLUMN slots TYPE JSONB USING slots::jsonb;
#
# ─────────────────────────────────────────────────────────────────────────────
 
 
# ─────────────────────────────────────────────────────────────────────────────
#  POST /api/reschedule-fee/create-order
#
#  Creates a Razorpay order for the Rs.100 rescheduling fee.
#  The frontend opens RZP checkout with this order_id, then on success
#  calls POST /api/orders/{id}/reschedule-slot with the payment proof.
# ─────────────────────────────────────────────────────────────────────────────
 
@app.post("/api/reschedule-fee/create-order")
async def create_reschedule_fee_order(request: Request):
    payload      = await verify_firebase_token(request)
    firebase_uid = payload["uid"]
 
    body              = await request.json()
    razorpay_order_id = body.get("razorpay_order_id", "")
    slot_key          = str(body.get("slot_key", ""))
 
    if not razorpay_order_id:
        raise HTTPException(status_code=400, detail="razorpay_order_id is required")
 
    # Confirm order belongs to this user and slot is still within-24-hr window
    rows = query(
        "SELECT id, slots FROM orders WHERE razorpay_order_id = %s AND firebase_uid = %s",
        (razorpay_order_id, firebase_uid),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Order not found")
 
    slots_map = _safe_json(rows[0][1], {})
    slot = slots_map.get(slot_key)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.get("_cancelled"):
        raise HTTPException(status_code=400, detail="Slot is already cancelled")
 
    hours = _hours_until(slot)
    if hours <= 0:
        raise HTTPException(status_code=400, detail="Cannot reschedule a past slot")
    # Fee applies only within 24 hrs — but we create the order regardless,
    # caller already checked chargeability on the frontend.
 
    try:
        fee_order = razorpay_client.order.create({
            "amount":          RESCHEDULE_FEE_PAISE,   # 10000 paise = Rs.100
            "currency":        "INR",
            "payment_capture": 1,
            "notes": {
                "type":              "reschedule_fee",
                "original_order_id": razorpay_order_id,
                "slot_key":          slot_key,
                "firebase_uid":      firebase_uid,
            },
        })
    except Exception as e:
        print(f"[reschedule-fee] Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create fee order")
 
    return {"status": "success", "order": fee_order}
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
                   duration, per_unit, options, starts_at, bullets, image
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
                "startsAt": r[10], "bullets": r[11],"image":r[12]
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

#Fetch cart details before checkout to ensure user has the latest data (e.g. discounts, price changes)
@app.get("/api/cart/details")
async def get_cart_details(request: Request):
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]

    sql = """
        SELECT 
            c.product_id,
            c.quantity,
            c.price AS cart_price,

            p.title,
            p.price AS actual_price,
            p.bullets,
            p.source

        FROM cart_items c

        JOIN (
            SELECT id, title, price, bullets, 'services' AS source FROM services

            UNION ALL

            SELECT id, title, price, bullets, 'men_services' FROM men_services

            UNION ALL

            SELECT id, title, price, includes AS bullets, 'packages' FROM packages

            UNION ALL

            SELECT id, title, price, includes AS bullets, 'men_packages' FROM men_packages

            UNION ALL

            SELECT id, title, price, bullets, 'bathroom_cleaning' FROM bathroom_cleaning_services

            UNION ALL

            SELECT id, title, price, NULL AS bullets, 'most_booked' FROM most_booked_services

        ) p

        ON c.product_id = p.id

        WHERE c.firebase_uid = %s

        ORDER BY c.product_id;
    """

    rows = query(sql, (firebase_uid,))

    result = []
    for r in rows:
        result.append({
            "id": r[0],
            "qty": r[1],
            "cart_price": float(r[2]),
            "title": r[3],
            "actual_price": float(r[4]),
            "bullets": r[5],
            "source": r[6],
        })

    return {
        "status": "success",
        "count": len(result),
        "data": result
    }

# ─────────────────────────────────────────────
#  Fetch Orders
# ─────────────────────────────────────────────
@app.get("/api/orders")
async def get_orders(request: Request):
    try:
        payload = await verify_firebase_token(request)
        firebase_uid = payload["uid"]

        sql = """
            SELECT id, razorpay_order_id, razorpay_payment_id, amount, status, created_at,
                   address, slots, cart, quantities
            FROM orders
            WHERE firebase_uid = %s
            ORDER BY created_at DESC
        """

        rows = query(sql, (firebase_uid,))

        def safe_json(val, default):
            if val is None:
                return default
            # JSONB columns: psycopg2 already parsed into dict/list
            if isinstance(val, (dict, list)):
                return val
            # TEXT columns: still a raw JSON string
            if isinstance(val, str):
                try:
                    return json.loads(val)
                except Exception as e:
                    print("❌ JSON parse error:", repr(val), str(e))
                    return default
            return default

        orders = []
        for r in rows:
            try:
                orders.append({
                    "id": r[0],
                    "razorpay_order_id": r[1],
                    "razorpay_payment_id": r[2],
                    "amount": float(r[3]) / 100 if r[3] else 0,
                    "status": r[4],
                    "created_at": r[5].isoformat() if r[5] else None,
                    "address": safe_json(r[6], {}),
                    "slots": safe_json(r[7], {}),
                    "cart": safe_json(r[8], []),
                    "quantities": safe_json(r[9], {}),
                })
            except Exception as e:
                print("❌ Row processing failed:", r, str(e))
                continue

        return {
            "status": "success",
            "count": len(orders),
            "data": orders
        }

    except Exception as e:
        print("🔥 ORDERS API ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
from fastapi import HTTPException, Request
from datetime import datetime, timedelta
import json
import razorpay
import os

# 🔐 Init Razorpay client
razorpay_client = razorpay.Client(auth=(
    os.getenv("RAZORPAY_KEY_ID"),
    os.getenv("RAZORPAY_KEY_SECRET")
))


@app.post("/api/orders/{razorpay_order_id}/cancel")
async def cancel_order(razorpay_order_id: str, request: Request):
    try:
        # 🔐 Auth
        payload = await verify_firebase_token(request)
        firebase_uid = payload["uid"]

        # 🧾 Fetch order
        sql = """
            SELECT id, status, slots, razorpay_payment_id, amount, refund_id
            FROM orders
            WHERE razorpay_order_id = %s AND firebase_uid = %s
        """
        rows = query(sql, (razorpay_order_id, firebase_uid))

        if not rows:
            raise HTTPException(status_code=404, detail="Order not found")

        r = rows[0]
        order_db_id = r[0]
        status = r[1]
        slots_raw = r[2]
        payment_id = r[3]
        amount = r[4]  # MUST be in paise
        existing_refund = r[5]

        # 🛑 Already cancelled → idempotent safe return
        if status == "cancelled":
            return {
                "status": "success",
                "message": "Order already cancelled"
            }

        # 🔍 Parse slots
        def safe_json(val, default):
            if val is None:
                return default
            if isinstance(val, (dict, list)):
                return val
            if isinstance(val, str):
                try:
                    return json.loads(val)
                except:
                    return default
            return default

        slots_map = safe_json(slots_raw, {})
        slot_list = list(slots_map.values())

        if not slot_list:
            raise HTTPException(status_code=400, detail="No slots found")

        # ⏱ 24 hr rule
        def convert_to_24(time_str):
            time, modifier = time_str.split(" ")
            h, m = map(int, time.split(":"))
            if modifier == "PM" and h != 12:
                h += 12
            if modifier == "AM" and h == 12:
                h = 0
            return f"{h:02d}:{m:02d}"

        now = datetime.utcnow()

        earliest = min([
            datetime.fromisoformat(f"{s['date']}T{convert_to_24(s['time'])}")
            for s in slot_list
        ])

        if earliest - now <= timedelta(hours=24):
            raise HTTPException(
                status_code=400,
                detail="Cannot cancel within 24 hours of appointment"
            )

        # 💸 REFUND
        refund_id = None

        if payment_id and not existing_refund:
            try:
                # ✅ Validate inputs
                if not payment_id.startswith("pay_"):
                    raise Exception(f"Invalid payment_id: {payment_id}")

                if not amount or int(amount) <= 0:
                    raise Exception(f"Invalid amount: {amount}")

                amount = int(amount)

                print("💸 Refunding:", payment_id, amount)

                # 🔍 Optional: verify payment exists
                payment = razorpay_client.payment.fetch(payment_id)
                if payment["status"] != "captured":
                    raise Exception("Payment not captured, cannot refund")

                refund = razorpay_client.payment.refund(
                    payment_id,
                    {
                        "amount": amount
                    }
                )

                refund_id = refund.get("id")

            except Exception as e:
                print("❌ Refund error:", repr(e))

                # 🚨 DO NOT block cancellation
                # Just mark refund failed / pending
                refund_id = None

        # 🧾 Update DB
        update_sql = """
            UPDATE orders
            SET status = 'cancelled',
                refund_id = %s,
                cancelled_at = NOW()
            WHERE id = %s
            RETURNING id
        """
        execute(update_sql, (refund_id, order_db_id))

        return {
            "status": "success",
            "message": "Order cancelled",
            "refund_id": refund_id
        }

    except HTTPException:
        raise
    except Exception as e:
        print("🔥 CANCEL ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
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
_DEFAULT_SLOTS = ["09:00 AM", "11:00 AM", "01:00 PM", "03:00 PM", "05:00 PM"]
 
 
# Maps group label → list of (table_name, has_duration_column)
# Table names with spaces must be quoted when used in SQL (handled below).
GROUP_SOURCE_MAP: dict[str, list[tuple[str, bool]]] = {
    "Salon Prime":       [("packages", True),  ("salon_prime", False)],
    "Men's Salon Prime": [("men_packages", True), ("men_salon_prime", False)],
    "Bathroom Cleaning": [("bathroom_cleaning_services", True)],
    "Services":          [("services", False)],
    "Men's Services":    [("men_services", False)],
    "Cleaning Services": [("cleaning services", False)],
    "Large Appliances":  [("large appliances services", False)],
    "Spa":               [("spa for women", False)],
    "Salon for Women":   [("salon for women", False)],
    "Most Booked":       [("most_booked_services", True)],
}
 
DAY_ABBR   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
 
 
def _to_mins(v) -> int:
    """Convert a duration value (int minutes OR string like '40 mins'/'1 hr') to int minutes."""
    if v is None:
        return 0
    if isinstance(v, (int, float)):
        return max(0, int(v))
    s = str(v).lower()
    total = 0
    for m in _re.finditer(r'(\d+)\s*(hr|hour|min)', s):
        n, unit = int(m.group(1)), m.group(2)
        total += n * 60 if unit.startswith('h') else n
    return total or 60
 
 
def _duration_label(raw) -> str:
    """Return human-readable duration like '40 mins' or '1 hr 30 mins'."""
    if raw is None:
        return ""
    if isinstance(raw, str) and not raw.strip().lstrip('-').isdigit():
        return raw.strip()          # already a label like "40 mins"
    mins = _to_mins(raw)
    if mins <= 0:
        return ""
    h, m = divmod(mins, 60)
    return f"{h} hr" if m == 0 else (f"{h} hr {m} mins" if h else f"{mins} mins")
 
 
def _fetch_cart_services(firebase_uid: str, group: str) -> tuple[list[dict], str]:
    """
    Joins cart_items with the relevant product tables for `group`.
    Returns:
        services      – list of {title, duration} dicts
        best_duration – human-readable label for the longest duration found
    """
    sources = GROUP_SOURCE_MAP.get(group, [])
    if not sources:
        return [], ""
 
    union_parts = []
    for (tbl, has_dur) in sources:
        quoted  = f'"{tbl}"'
        dur_col = "duration" if has_dur else "NULL"
        union_parts.append(
            f"SELECT id, title, {dur_col} AS duration FROM {quoted}"
        )
 
    union_sql = " UNION ALL ".join(union_parts)
 
    sql = f"""
        SELECT p.title, p.duration
        FROM cart_items c
        JOIN ({union_sql}) p ON c.product_id = p.id
        WHERE c.firebase_uid = %s
        ORDER BY p.title
    """
 
    rows  = query(sql, (firebase_uid,))
    items = [{"title": r[0], "duration": _duration_label(r[1])} for r in rows]
 
    # Pick the largest duration across all fetched rows
    best_raw = max(
        (r[1] for r in rows if r[1] is not None),
        key=_to_mins,
        default=None,
    )
    best_label = _duration_label(best_raw) if best_raw is not None else ""
    return items, best_label
def fetch_slots_from_db(group: str) -> list[str]:
    rows = query("""
        SELECT slot_time
        FROM service_slots
        WHERE group_name = %s AND is_active = TRUE
        ORDER BY sort_order ASC
    """, (group,))
    
    return [r[0] for r in rows]
@app.get("/api/slots")
async def get_slots(group: str = "", request: Request = None):

    today = date.today()
    dates = [
        {
            "date":  (d := today + timedelta(days=i)).isoformat(),
            "day":   DAY_ABBR[d.weekday()],
            "num":   d.day,
            "month": MONTH_ABBR[d.month - 1],
        }
        for i in range(7)
    ]

    # ✅ NEW: fetch from DB
    times = fetch_slots_from_db(group)
    if not times:
        times = _DEFAULT_SLOTS

    services = []
    duration_label = ""

    auth_header = request.headers.get("Authorization", "") if request else ""
    if auth_header.startswith("Bearer "):
        try:
            payload = await verify_firebase_token(request)
            firebase_uid = payload["uid"]
            services, duration_label = _fetch_cart_services(firebase_uid, group)
        except Exception as exc:
            print(f"[slots] personalisation skipped: {exc}")

    return {
        "status": "success",
        "group": group,
        "duration_label": duration_label or "60 mins",
        "dates": dates,
        "slots": times,
        "services": services,
    }
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
        "image":r[12],
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
               duration, per_unit, options, starts_at, bullets,image
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

@app.get("/api/addresses")
async def get_addresses(request: Request):
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]
 
    rows = query("""
        SELECT id, label, full_address, house_flat, landmark, lat, lng, is_default, created_at
        FROM user_addresses
        WHERE firebase_uid = %s
        ORDER BY is_default DESC, created_at DESC
    """, (firebase_uid,))
 
    return {
        "status": "success",
        "data": [
            {
                "id":           r[0],
                "label":        r[1],
                "full_address": r[2],
                "house_flat":   r[3],
                "landmark":     r[4],
                "lat":          r[5],
                "lng":          r[6],
                "is_default":   r[7],
                "created_at":   str(r[8]),
            }
            for r in rows
        ]
    }
 
 
# ─────────────────────────────────────────────
#  POST /api/addresses  – save a new address
# ─────────────────────────────────────────────
@app.post("/api/addresses")
async def save_address(request: Request):
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]
    body = await request.json()
 
    full_address = body.get("full_address", "").strip()
    house_flat   = body.get("house_flat", "").strip()
    landmark     = body.get("landmark", "").strip()
    label        = body.get("label", "Home").strip()   # 'Home' | 'Other'
    lat          = body.get("lat")
    lng          = body.get("lng")
    make_default = body.get("is_default", True)
 
    if not full_address:
        raise HTTPException(status_code=400, detail="full_address is required")
 
    conn = get_conn()
    try:
        cur = conn.cursor()
 
        # If making default, unset all others first
        if make_default:
            cur.execute("""
                UPDATE user_addresses SET is_default = FALSE
                WHERE firebase_uid = %s
            """, (firebase_uid,))
 
        cur.execute("""
            INSERT INTO user_addresses
                (firebase_uid, label, full_address, house_flat, landmark, lat, lng, is_default)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (firebase_uid, label, full_address, house_flat, landmark, lat, lng, make_default))
 
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
    finally:
        release_conn(conn)
 
    return {"status": "address saved", "id": new_id}
 
 
# ─────────────────────────────────────────────
#  DELETE /api/addresses/{address_id}
# ─────────────────────────────────────────────
@app.delete("/api/addresses/{address_id}")
async def delete_address(address_id: int, request: Request):
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]
 
    # Only delete if the address belongs to this user
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            DELETE FROM user_addresses
            WHERE id = %s AND firebase_uid = %s
        """, (address_id, firebase_uid))
        deleted = cur.rowcount
        conn.commit()
        cur.close()
    finally:
        release_conn(conn)
 
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Address not found or not yours")
 
    return {"status": "deleted", "id": address_id}
 
 
# ─────────────────────────────────────────────
#  PATCH /api/addresses/{address_id}/default
# ─────────────────────────────────────────────
@app.patch("/api/addresses/{address_id}/default")
async def set_default_address(address_id: int, request: Request):
    payload = await verify_firebase_token(request)
    firebase_uid = payload["uid"]
 
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE user_addresses SET is_default = FALSE WHERE firebase_uid = %s
        """, (firebase_uid,))
        cur.execute("""
            UPDATE user_addresses SET is_default = TRUE
            WHERE id = %s AND firebase_uid = %s
        """, (address_id, firebase_uid))
        conn.commit()
        cur.close()
    finally:
        release_conn(conn)
 
    return {"status": "default updated", "id": address_id}
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