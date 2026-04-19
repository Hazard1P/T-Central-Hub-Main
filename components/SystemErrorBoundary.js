'use client';

import React from 'react';

export default class SystemErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown client error' };
  }

  componentDidCatch(error) {
    console.error('System runtime error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="system-runtime-fallback">
          <div className="content-card">
            <p className="eyebrow">Runtime fallback</p>
            <h3>System recovered from a client error</h3>
            <p className="muted">
              The 3D layer hit a client-side error. The route structure is still intact, and you can relaunch the system after updating the package.
            </p>
            <div className="focus-meta">
              <span>{this.state.message || 'Unknown error'}</span>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
