import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { reportClientError } from "./lib/api";

window.addEventListener("error", (e) => reportClientError(e.message, e.error?.stack));
window.addEventListener("unhandledrejection", (e) => {
  if (!e.reason?.isAxiosError) reportClientError(String(e.reason?.message || e.reason), e.reason?.stack);
});

class Boundary extends React.Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { reportClientError(err.message, (err.stack || "") + info.componentStack); }
  render() {
    if (this.state.err) return (
      <div className="flex min-h-screen items-center justify-center p-8" data-testid="error-boundary">
        <div className="max-w-md text-center"><h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">The error has been logged for your administrator. Reload to continue.</p>
          <button className="mt-4 rounded bg-primary px-4 py-2 text-white" onClick={() => location.reload()}>Reload</button></div>
      </div>
    );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(<Boundary><App /></Boundary>);
