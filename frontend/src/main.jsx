import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { GoogleOAuthProvider } from "@react-oauth/google"

import App from "./App"
import Login from "./Login"
import Signup from "./Signup"
import PublicLink from "./PublicLink"

import "./index.css"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <GoogleOAuthProvider clientId="829903513386-b8si1jlqkiebufub8k5m560s5i3g8d74.apps.googleusercontent.com">
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
    </GoogleOAuthProvider>
  </StrictMode>
)