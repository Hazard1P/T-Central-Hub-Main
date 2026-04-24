'use client';

import React from 'react';

export default class SystemErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '', retryKey: 0 };
    this.handleRetry = this.handleRetry.bind(this);
    this.resetBoundary = this.resetBoundary.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown client error' };
  }

  componentDidCatch(error) {
    console.error('System runtime error:', error);
  }

  resetBoundary() {
    this.setState({ hasError: false, message: '' });
  }

  handleRetry() {
    this.setState((prevState) => ({
      hasError: false,
      message: '',
      retryKey: prevState.retryKey + 1,
    }));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="system-runtime-fallback">
          <div className="content-card">
            <p className="eyebrow">Runtime fallback</p>
            <h3>System recovered from a client error</h3>
            <p className="muted">
              The 3D layer hit a client-side error. Click Retry 3D layer to remount the scene and relaunch after updating the package.
            </p>
            <div className="focus-meta">
              <span>{this.state.message || 'Unknown error'}</span>
            </div>
            <button type="button" onClick={this.handleRetry}>
              Retry 3D layer
            </button>
          </div>
        </div>
      );
    }

    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}
