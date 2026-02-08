import { Component } from "react";
import { toast } from "./toastStore";
import "./ErrorBoundary.css";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    toast.error("Something went wrong", {
      description: error?.message || "An unexpected error occurred.",
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-card">
            <h1>Something went wrong</h1>
            <p>
              The app hit an unexpected issue. You can refresh to recover or
              continue after fixing the problem.
            </p>
            {this.state.error?.message && (
              <div className="error-details">{this.state.error.message}</div>
            )}
            <button type="button" className="error-button" onClick={this.handleReset}>
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
