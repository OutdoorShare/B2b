import "@testing-library/jest-dom";
import { vi } from "vitest";

// ResizeObserver must be a proper class (not an arrow fn) because Radix UI
// and our component use `new ResizeObserver(...)`.
class ResizeObserverMock {
  observe   = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// URL object-URL stubs
global.URL.createObjectURL = vi.fn(() => "blob:mock-object-url");
global.URL.revokeObjectURL = vi.fn();

// createImageBitmap stub
global.createImageBitmap = vi.fn().mockResolvedValue({});

// HTMLCanvasElement.toBlob stub
HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb: BlobCallback) {
  cb(new Blob(["fake-image"], { type: "image/jpeg" }));
});

// HTMLCanvasElement.getContext stub
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  clearRect: vi.fn(),
})) as any;
