import { BrowserRouter, Routes, Route } from "react-router-dom";
import Homepage from "./pages/Homepage";
import WomenSalonandSpa from "./pages/WomenSalonandSpa";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/women-salon" element={<WomenSalonandSpa />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;