// Homepage.jsx
import "../styles/Homepage.css";
import "../styles/Homepageoffersanddiscount.css";
import HomepageNavBar from "../components/Homepagenav.jsx";
import HomepageOfferandDiscount from "../components/Homepageofferanddiscount.jsx";
import { useEffect, useState, useCallback } from "react";
import Homepagedetailsservicable from "../components/Homepagedetailsservicable.jsx";
import LocationLoader from "../components/LocationLoader.jsx";

// 🔥 FIREBASE
import { auth } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const API_BASE = "https://urban-ease-theta.vercel.app";

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/**
 * Returns a fresh Firebase ID token from the currently signed-in user,
 * refreshes localStorage, and returns the token string.
 * Returns null if no user is signed in.
 */
async function getFreshToken() {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  const token = await currentUser.getIdToken(/* forceRefresh= */ true);
  localStorage.setItem("token", token);
  return token;
}

/**
 * Calls GET /api/me with a valid Firebase token.
 * Returns the user object  { firebase_uid, name, email }
 * or throws on auth failure.
 */
async function fetchUserProfile() {
  const token = await getFreshToken();
  if (!token) throw new Error("Not signed in");

  const res = await fetch(`${API_BASE}/api/me`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    throw new Error(`Server error ${res.status}`);
  }

  const data = await res.json();
  return data; // { status, firebase_uid, name, email }
}

/**
 * Upserts the user in Postgres and records a session row.
 * Called after every successful Firebase sign-in / sign-up.
 */
async function syncUserToBackend(firebaseUser, nameOverride = "") {
  const token = await firebaseUser.getIdToken(true);
  localStorage.setItem("token", token);

  const res = await fetch(`${API_BASE}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: nameOverride || firebaseUser.displayName || "",
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Backend sync failed (${res.status})`);
  }

  return res.json();
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
export default function Homepage() {
  // ── Location state ──────────────────────────
  const [city, setCity]       = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Auth / session state ─────────────────────
  const [user, setUser]             = useState(null);       // Firebase user object
  const [userProfile, setUserProfile] = useState(null);    // { firebase_uid, name, email } from DB
  const [sessionLoading, setSessionLoading] = useState(true); // true while we restore session on load

  // ── Modal state ──────────────────────────────
  const [showLogin, setShowLogin] = useState(false);
  const [isSignup, setIsSignup]   = useState(false);

  // ── Form state ───────────────────────────────
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  // ── Validation state ─────────────────────────
  const [errors, setErrors]   = useState({});
  const [touched, setTouched] = useState({});

  // ── Loading / success feedback ───────────────
  const [submitting, setSubmitting] = useState(false);

  // ─────────────────────────────────────────────
  //  Location detection
  // ─────────────────────────────────────────────
  useEffect(() => {
    const savedCity = localStorage.getItem("city");

    if (savedCity) {
      setCity(savedCity);
      setLoading(false);
      return;
    }

    navigator.geolocation?.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
          );
          const data = await res.json();
          const cityName =
            data?.address?.city || data?.address?.state || "Bhubaneswar";
          setCity(cityName);
          localStorage.setItem("city", cityName);
        } catch {
          setCity("Bhubaneswar");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setCity("Bhubaneswar");
        setLoading(false);
      }
    );
  }, []);

  // ─────────────────────────────────────────────
  //  Session restore on app load
  //  onAuthStateChanged fires immediately with
  //  the persisted Firebase session (or null).
  //  We then call /api/me to get the DB profile.
  // ─────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const profile = await fetchUserProfile();
          setUserProfile(profile);
        } catch (err) {
          console.warn("Session restore failed:", err.message);
          // Token may be stale / user deleted — sign out cleanly
          if (err.message === "Unauthorized") {
            await signOut(auth);
            localStorage.removeItem("token");
            setUser(null);
            setUserProfile(null);
          }
        }
      } else {
        // No Firebase session — clear everything
        setUser(null);
        setUserProfile(null);
        localStorage.removeItem("token");
      }
      setSessionLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─────────────────────────────────────────────
  //  Password strength rules
  // ─────────────────────────────────────────────
  const rules = {
    length:    password.length >= 7,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /[0-9]/.test(password),
    special:   /[^A-Za-z0-9]/.test(password),
  };
  const isPasswordValid = Object.values(rules).every(Boolean);

  // ─────────────────────────────────────────────
  //  Form validation
  // ─────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};
    if (isSignup && !name.trim()) {
      newErrors.name = "Name is required";
    }
    if (!email.includes("@")) {
      newErrors.email = "Enter a valid email";
    }
    if (!password) {
      newErrors.password = "Password is required";
    } else if (isSignup && !isPasswordValid) {
      newErrors.password = "Password does not meet requirements";
    }
    return newErrors;
  };

  // ─────────────────────────────────────────────
  //  Helpers to open / close modal cleanly
  // ─────────────────────────────────────────────
  const openLoginModal = useCallback(() => {
    setName("");
    setEmail("");
    setPassword("");
    setErrors({});
    setTouched({});
    setIsSignup(false);
    setShowLogin(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setShowLogin(false);
    setErrors({});
    setTouched({});
  }, []);

  // ─────────────────────────────────────────────
  //  Submit handler  (sign up OR login)
  // ─────────────────────────────────────────────
  const handleSubmit = async () => {
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);

    try {
      let userCred;

      if (isSignup) {
        userCred = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCred = await signInWithEmailAndPassword(auth, email, password);
      }

      const firebaseUser = userCred.user;

      // Sync to backend — also stores session row
      await syncUserToBackend(firebaseUser, isSignup ? name : "");

      // Fetch full DB profile
      const profile = await fetchUserProfile();
      setUser(firebaseUser);
      setUserProfile(profile);

      closeLoginModal();
    } catch (error) {
      // Map Firebase error codes to friendlier messages
      const code = error.code || "";
      let msg = error.message;

      if (code === "auth/email-already-in-use")  msg = "An account with this email already exists.";
      else if (code === "auth/user-not-found")   msg = "No account found with this email.";
      else if (code === "auth/wrong-password")   msg = "Incorrect password. Please try again.";
      else if (code === "auth/too-many-requests")msg = "Too many attempts. Please wait a moment.";
      else if (code === "auth/invalid-email")    msg = "Please enter a valid email address.";

      setErrors({ firebase: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────
  //  Logout
  // ─────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      // 1️⃣  Tell the backend to clear server-side sessions
      const token = await getFreshToken();
      if (token) {
        await fetch(`${API_BASE}/api/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.warn("Backend logout failed (non-fatal):", err.message);
    } finally {
      // 2️⃣  Always sign out of Firebase and clear local state
      await signOut(auth);
      localStorage.removeItem("token");
      setUser(null);
      setUserProfile(null);
    }
  };

  // ─────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────

  // Show full-screen loader while we check the persisted session
  if (loading || sessionLoading) {
    return <LocationLoader />;
  }

  return (
    <div className="roothome">
      <div className="home">
        <HomepageNavBar
          city={city}
          user={user}
          userProfile={userProfile}
          onProfileClick={() => {
            if (user) {
              // User is logged in — you can open a profile dropdown here
              console.log("Logged in as:", userProfile?.email || user.email);
            } else {
              openLoginModal();
            }
          }}
          onLogout={handleLogout}
        />
      </div>

      {/* Always render the main content — works for both logged-in and guest */}
      <Homepagedetailsservicable />

      {/* ── Login / Signup Modal ─────────────────── */}
      {showLogin && !user && (
        <div className="modal-overlay" onClick={closeLoginModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <span className="close-icon" onClick={closeLoginModal}>×</span>

            <h2 className="modal-title">
              {isSignup ? "Create Account 🚀" : "Welcome Back 👋"}
            </h2>

            {/* ── Name (signup only) ── */}
            {isSignup && (
              <>
                <div className="input-group">
                  <input
                    type="text"
                    value={name}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <label>Name</label>
                </div>
                {touched.name && errors.name && (
                  <span className="error-text">{errors.name}</span>
                )}
              </>
            )}

            {/* ── Email ── */}
            <div className="input-group">
              <input
                type="email"
                value={email}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label>Email</label>
            </div>
            {touched.email && errors.email && (
              <span className="error-text">{errors.email}</span>
            )}

            {/* ── Password ── */}
            <div className="input-group">
              <input
                type="password"
                value={password}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                onChange={(e) => setPassword(e.target.value)}
              />
              <label>Password</label>
            </div>
            {touched.password && errors.password && (
              <span className="error-text">{errors.password}</span>
            )}

            {/* ── Password strength rules (signup only) ── */}
            {isSignup && (
              <div className="password-rules">
                <p className={rules.length    ? "valid" : ""}>✔ 7+ characters</p>
                <p className={rules.uppercase ? "valid" : ""}>✔ Uppercase</p>
                <p className={rules.lowercase ? "valid" : ""}>✔ Lowercase</p>
                <p className={rules.number    ? "valid" : ""}>✔ Number</p>
                <p className={rules.special   ? "valid" : ""}>✔ Special character</p>
              </div>
            )}

            {/* ── Submit button ── */}
            <button
              className="login-btn"
              onClick={handleSubmit}
              disabled={(isSignup && !isPasswordValid) || submitting}
            >
              {submitting
                ? isSignup ? "Creating account…" : "Signing in…"
                : isSignup ? "Sign Up" : "Login"}
            </button>

            {/* ── Firebase / backend error ── */}
            {errors.firebase && (
              <span className="error-text">{errors.firebase}</span>
            )}

            {/* ── Switch between login ↔ signup ── */}
            <p className="switch-text">
              {isSignup ? "Already have an account?" : "New here?"}
              <span
                onClick={() => {
                  setIsSignup((v) => !v);
                  setErrors({});
                  setTouched({});
                }}
              >
                {isSignup ? " Login" : " Sign up"}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}