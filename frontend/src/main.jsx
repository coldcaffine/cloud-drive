import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  useLocation,
} from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import Login from "./Login";
import "./index.css";

function Root() {
  const location = useLocation();

  if (location.pathname === "/login") {
    return <Login />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);