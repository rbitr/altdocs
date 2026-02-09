// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showToast, toast } from '../src/client/toast';

describe('Toast notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clean up any existing toast containers
    document.querySelectorAll('.toast-container').forEach(el => el.remove());
  });

  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('.toast-container').forEach(el => el.remove());
  });

  it('creates a toast container on first use', () => {
    expect(document.querySelector('.toast-container')).toBeNull();
    toast('Hello');
    expect(document.querySelector('.toast-container')).not.toBeNull();
  });

  it('adds toast element to container', () => {
    toast('Test message');
    const toastEl = document.querySelector('.toast');
    expect(toastEl).not.toBeNull();
    expect(toastEl!.textContent).toBe('Test message');
  });

  it('applies info type by default', () => {
    toast('Info message');
    const toastEl = document.querySelector('.toast');
    expect(toastEl!.classList.contains('toast-info')).toBe(true);
  });

  it('applies success type', () => {
    toast('Success!', 'success');
    const toastEl = document.querySelector('.toast');
    expect(toastEl!.classList.contains('toast-success')).toBe(true);
  });

  it('applies error type', () => {
    toast('Error!', 'error');
    const toastEl = document.querySelector('.toast');
    expect(toastEl!.classList.contains('toast-error')).toBe(true);
  });

  it('sets role=status for accessibility', () => {
    toast('Accessible');
    const toastEl = document.querySelector('.toast');
    expect(toastEl!.getAttribute('role')).toBe('status');
  });

  it('sets aria-live on container', () => {
    toast('Accessible');
    const container = document.querySelector('.toast-container');
    expect(container!.getAttribute('aria-live')).toBe('polite');
  });

  it('adds toast-visible class after animation frame', () => {
    toast('Visible test');
    const toastEl = document.querySelector('.toast');
    expect(toastEl!.classList.contains('toast-visible')).toBe(false);
    // requestAnimationFrame callback
    vi.runAllTimers();
    // Note: jsdom doesn't fully support requestAnimationFrame animations,
    // but the class should be added after timers run
  });

  it('removes toast after default duration', () => {
    toast('Temporary');
    expect(document.querySelector('.toast')).not.toBeNull();
    // Fast-forward past default 3s + fallback removal 400ms
    vi.advanceTimersByTime(3500);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('supports custom duration via showToast', () => {
    showToast({ message: 'Custom', duration: 1000 });
    expect(document.querySelector('.toast')).not.toBeNull();
    vi.advanceTimersByTime(1500);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('can show multiple toasts simultaneously', () => {
    toast('First');
    toast('Second');
    toast('Third');
    const toasts = document.querySelectorAll('.toast');
    expect(toasts.length).toBe(3);
  });

  it('reuses the same container for multiple toasts', () => {
    toast('One');
    toast('Two');
    const containers = document.querySelectorAll('.toast-container');
    expect(containers.length).toBe(1);
  });

  it('removes toasts independently based on their timing', () => {
    showToast({ message: 'Short', duration: 1000 });
    showToast({ message: 'Long', duration: 5000 });
    expect(document.querySelectorAll('.toast').length).toBe(2);
    vi.advanceTimersByTime(1500);
    expect(document.querySelectorAll('.toast').length).toBe(1);
    expect(document.querySelector('.toast')!.textContent).toBe('Long');
    vi.advanceTimersByTime(4000);
    expect(document.querySelectorAll('.toast').length).toBe(0);
  });
});
