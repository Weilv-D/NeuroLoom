import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            padding: "2rem",
            margin: "1rem",
            borderRadius: "8px",
            background: "rgba(255, 60, 60, 0.08)",
            border: "1px solid rgba(255, 60, 60, 0.25)",
            color: "#f5f8ff",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem", color: "#ff6b6b" }}>Rendering Error</h3>
          <p style={{ margin: "0 0 1rem", opacity: 0.8, fontSize: "0.9rem" }}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "4px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              background: "rgba(255, 255, 255, 0.06)",
              color: "#f5f8ff",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
