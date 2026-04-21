// Homepage.jsx
import "../styles/Homepage.css";
import "../styles/Homepageoffersanddiscount.css";
import HomepageNavBar from "../components/Homepagenav.jsx";
import HomepageOfferandDiscount from "../components/Homepageofferanddiscount.jsx";
import { useEffect, useState } from "react";
import Homepagedetailsservicable from "../components/Homepagedetailsservicable.jsx";
import LocationLoader from "../components/LocationLoader.jsx";

export default function Homepage() {
  const [city, setCity] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔐 AUTH STATE
  const [showLogin, setShowLogin] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ❗ VALIDATION STATE
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // 📍 LOCATION
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await res.json();

            const cityName =
              data?.address?.city ||
              data?.address?.town ||
              data?.address?.village ||
              data?.address?.state ||
              "Your location";

            setCity(cityName);
          } catch {
            setCity("Unknown");
          } finally {
            setLoading(false);
          }
        },
        () => {
          setCity("Unknown");
          setLoading(false);
        }
      );
    } else {
      setCity("Unknown");
      setLoading(false);
    }
  }, []);

  // 🔑 PASSWORD RULES
  const rules = {
    length: password.length >= 7,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const isValid = Object.values(rules).every(Boolean);

  // 🧠 VALIDATION FUNCTION
  const validate = () => {
    let newErrors = {};

    if (isSignup && !name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!email.includes("@")) {
      newErrors.email = "Enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (isSignup && !isValid) {
      newErrors.password = "Password does not meet requirements";
    }

    return newErrors;
  };

  // 🚀 SUBMIT
  const handleSubmit = () => {
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      console.log("Form Submitted ✅", { name, email, password });
    }
  };

  return (
    <div className="roothome">
      {loading ? (
        <LocationLoader />
      ) : (
        <>
          <div className="home">
            <HomepageNavBar onProfileClick={() => setShowLogin(true)} />
          </div>

          {!city.includes("Bhubaneswar") ? (
            <HomepageOfferandDiscount />
          ) : (
            <Homepagedetailsservicable />
          )}

          {/* 🔥 MODAL */}
          {showLogin && (
            <div
              className="modal-overlay"
              onClick={() => setShowLogin(false)}
            >
              <div
                className="modal-box"
                onClick={(e) => e.stopPropagation()}
              >
                <span
                  className="close-icon"
                  onClick={() => setShowLogin(false)}
                >
                  ×
                </span>

                <h2 className="modal-title">
                  {isSignup ? "Create Account 🚀" : "Welcome Back 👋"}
                </h2>

                {/* NAME */}
                {isSignup && (
                  <>
                    <div className="input-group">
                      <input
                        type="text"
                        onBlur={() =>
                          setTouched({ ...touched, name: true })
                        }
                        onChange={(e) => setName(e.target.value)}
                      />
                      <label>Name</label>
                    </div>
                    {touched.name && errors.name && (
                      <span className="error-text">{errors.name}</span>
                    )}
                  </>
                )}

                {/* EMAIL */}
                <div className="input-group">
                  <input
                    type="email"
                    onBlur={() =>
                      setTouched({ ...touched, email: true })
                    }
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <label>Email</label>
                </div>
                {touched.email && errors.email && (
                  <span className="error-text">{errors.email}</span>
                )}

                {/* PASSWORD */}
                <div className="input-group">
                  <input
                    type="password"
                    onBlur={() =>
                      setTouched({ ...touched, password: true })
                    }
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <label>Password</label>
                </div>

                {touched.password && errors.password && (
                  <span className="error-text">{errors.password}</span>
                )}

                {/* RULES */}
                {isSignup && (
                  <div className="password-rules">
                    <p className={rules.length ? "valid" : ""}>
                      ✔ 7+ characters
                    </p>
                    <p className={rules.uppercase ? "valid" : ""}>
                      ✔ Uppercase letter
                    </p>
                    <p className={rules.lowercase ? "valid" : ""}>
                      ✔ Lowercase letter
                    </p>
                    <p className={rules.number ? "valid" : ""}>
                      ✔ Number
                    </p>
                    <p className={rules.special ? "valid" : ""}>
                      ✔ Special character
                    </p>
                  </div>
                )}

                {/* BUTTON */}
                <button
                  className="login-btn"
                  onClick={handleSubmit}
                  disabled={isSignup && !isValid}
                >
                  {isSignup ? "Sign Up" : "Login"}
                </button>

                {/* SWITCH */}
                <p className="switch-text">
                  {isSignup
                    ? "Already have an account?"
                    : "New here?"}
                  <span onClick={() => setIsSignup(!isSignup)}>
                    {isSignup ? " Login" : " Sign up"}
                  </span>
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}