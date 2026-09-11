import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
  convertFileSrc: vi.fn((url) => url)
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn(() => Promise.resolve('1.0.0'))
}));

describe('App Component', () => {
  it('renders the main shell without crashing', () => {
    render(<App />);
    expect(screen.getByLabelText('Search wallpapers')).toBeInTheDocument();
    expect(screen.getByText('All Wallpapers')).toBeInTheDocument();
  });

  it('shows the splash screen while the catalog is loading', () => {
    render(<App />);
    expect(screen.getAllByText('CozyPixels').length).toBeGreaterThan(0);
  });
});
