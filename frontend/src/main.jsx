
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"

import App from "./App"
import Login from "./Login"
import Signup from "./Signup"
import PublicLink from "./PublicLink"

import "./index.css"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<App />} />

        <Route path="/login" element={<Login />} />

        <Route path="/signup" element={<Signup />} />

        <Route
          path="/public/:token"
          element={<PublicLink />}
        />

      </Routes>
    </BrowserRouter>
  </StrictMode>
)
