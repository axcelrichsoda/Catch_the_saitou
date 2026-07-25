import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { startHeartbeat } from "./socket";
import "./styles.css";

startHeartbeat();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
