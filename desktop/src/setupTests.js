import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = IntersectionObserver;

window.HTMLElement.prototype.scrollTo = function() {};

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve([]),
})));

window.ResizeObserver = window.ResizeObserver || class {
  observe() {}
  unobserve() {}
  disconnect() {}
};