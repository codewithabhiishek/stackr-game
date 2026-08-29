import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import App from "./App.tsx";

class BootBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            background: "#05080f",
            color: "#cfe6ff",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "'Bungee', sans-serif",
              fontSize: 40,
              color: "#ffc857",
              textShadow: "4px 4px 0 #ff5e5b",
            }}
          >
            STACKR
          </div>
          <div style={{ fontWeight: 700, letterSpacing: "0.2em", fontSize: 12 }}>
            THE TOWER GLITCHED — RELOAD TO STACK AGAIN
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              fontFamily: "'Bungee', sans-serif",
              background: "#ffc857",
              color: "#231a02",
              border: "3px solid #05080f",
              boxShadow: "5px 5px 0 #05080f",
              padding: "12px 28px",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            RELOAD
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BootBoundary>
    <App />
    <Analytics />
  </BootBoundary>,
);
