import { describe, it, expect } from 'vitest';
import {
  getErrorMessage, getCartKey, getItemUnitPrice,
  STATUS_LABELS, STATUS_COLORS,
} from '../utils';

// ── getErrorMessage ──

describe('getErrorMessage', () => {
  it('returns message from Error instance', () => {
    expect(getErrorMessage(new Error('网络错误'))).toBe('网络错误');
  });

  it('returns fallback for non-Error values', () => {
    expect(getErrorMessage('string error')).toBe('操作失败');
    expect(getErrorMessage(42)).toBe('操作失败');
    expect(getErrorMessage(null)).toBe('操作失败');
  });

  it('returns fallback for plain objects', () => {
    expect(getErrorMessage({ message: 'hi' })).toBe('操作失败');
  });
});

// ── getCartKey ──

describe('getCartKey', () => {
  it('returns id-only key for plain items', () => {
    expect(getCartKey({ id: 'p1' })).toBe('p1--');
  });

  it('appends b suffix when brewing selected', () => {
    expect(getCartKey({ id: 'p2', isBrewingSelected: true })).toBe('p2-b-');
  });

  it('appends f suffix when freezing selected', () => {
    expect(getCartKey({ id: 'p3', isFreezingSelected: true })).toBe('p3--f');
  });

  it('appends both suffixes when both selected', () => {
    expect(getCartKey({ id: 'p4', isBrewingSelected: true, isFreezingSelected: true })).toBe('p4-b-f');
  });
});

// ── getItemUnitPrice ──

describe('getItemUnitPrice', () => {
  it('returns base price with no options', () => {
    expect(getItemUnitPrice({ price: 10 })).toBe(10);
  });

  it('adds ¥1 for brewing', () => {
    expect(getItemUnitPrice({ price: 10, isBrewingSelected: true })).toBe(11);
  });

  it('adds ¥0.5 for freezing', () => {
    expect(getItemUnitPrice({ price: 10, isFreezingSelected: true })).toBe(10.5);
  });

  it('adds both fees', () => {
    expect(getItemUnitPrice({ price: 10, isBrewingSelected: true, isFreezingSelected: true })).toBe(11.5);
  });
});

// ── STATUS_LABELS ──

describe('STATUS_LABELS', () => {
  it('maps all statuses to Chinese labels', () => {
    expect(STATUS_LABELS.pending).toBe('待处理');
    expect(STATUS_LABELS.preparing).toBe('备货中');
    expect(STATUS_LABELS.delivered).toBe('已送达');
    expect(STATUS_LABELS.cancelled).toBe('已取消');
  });
});

// ── STATUS_COLORS ──

describe('STATUS_COLORS', () => {
  it('has color classes for all statuses', () => {
    expect(STATUS_COLORS.pending).toContain('orange');
    expect(STATUS_COLORS.preparing).toContain('blue');
    expect(STATUS_COLORS.delivered).toContain('green');
    expect(STATUS_COLORS.cancelled).toContain('slate');
  });
});
