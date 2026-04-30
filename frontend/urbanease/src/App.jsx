import { BrowserRouter, Routes, Route } from "react-router-dom";
import Homepage from "./pages/Homepage";
import WomenSalonandSpa from "./pages/WomenSalonandSpa";
import MenSalonAndSpa from "./pages/MenSalonPrime";
import BathroomCleaning from "./pages/BathroomCleaning";
import ViewCartPage from "./pages/ViewCartPage";
import BookingPage from "./pages/BookingPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/women-salon" element={<WomenSalonandSpa />} />
        <Route path="/salon-prime" element={<MenSalonAndSpa />} />
        <Route path="/bathroom-cleaning" element={<BathroomCleaning />} />
        <Route path="/checkout" element={<ViewCartPage />} />
        <Route path="/bookings" element={<BookingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;