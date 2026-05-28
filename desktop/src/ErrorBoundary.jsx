import { Component } from 'react';
import { LuTriangleAlert, LuRefreshCw } from 'react-icons/lu';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '24px',
          padding: '32px',
          background: 'var(--md-sys-color-surface)',
          color: 'var(--md-sys-color-on-surface)',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          textAlign: 'center'
        }}>
          <div style={{
            width: '72px', height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,69,58,0.15), rgba(255,59,48,0.15))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FF453A'
          }}>
            <LuTriangleAlert size={32} />
          </div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--md-sys-color-on-surface-variant)', maxWidth: '400px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button onClick={() => window.location.reload()} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '12px 28px', borderRadius: '24px', border: 'none',
            background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
          }}>
            <LuRefreshCw size={15} /> Reload App
          </button>
          {this.props.fallback || null}
        </div>
      );
    }
    return this.props.children;
  }
}
