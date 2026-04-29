import React from 'react'
import { useEffect, useRef, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "../styles/ViewCart.css";
const ViewCartComponent = () => {
  const BASE = "https://urban-ease-theta.vercel.app";

  function getUser() {
  return getAuth().currentUser;
}
  useEffect(() => {
  async function testCartDetailsAPI() {
    try {
      const user = getUser();

      if (!user) {
        console.log("❌ No user logged in");
        return;
      }

      const token = await user.getIdToken();

      const res = await fetch(`${BASE}/api/cart/details`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      console.log("✅ Cart Details API Response:", data);

    } catch (err) {
      console.error("❌ API Test Failed:", err);
    }
  }

  testCartDetailsAPI();
}, []);
  return (
    <div className='ehfbhnbfejfn'>
      
    </div>
  )
}

export default ViewCartComponent
