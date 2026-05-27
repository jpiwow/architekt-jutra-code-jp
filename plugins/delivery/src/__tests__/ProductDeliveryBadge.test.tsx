import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { PluginSDKType } from '../../../sdk';

// Mock the SDK module
vi.mock('../../../sdk', () => ({
  getSDK: vi.fn(),
}));

// Mock the services module
vi.mock('../services', () => ({
  countAssignments: vi.fn(),
}));

import { getSDK } from '../../../sdk';
import { countAssignments } from '../services';
import { ProductDeliveryBadge } from '../pages/ProductDeliveryBadge';

function createMockSDK(productId?: string) {
  return {
    thisPlugin: {
      productId,
      objects: {
        save: vi.fn(),
        list: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
      },
    },
  } as unknown as PluginSDKType;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProductDeliveryBadge', () => {
  it('displays success style with count for non-zero delivery methods', async () => {
    const mockSDK = createMockSDK('product-1');
    vi.mocked(getSDK).mockReturnValue(mockSDK);
    vi.mocked(countAssignments).mockResolvedValue(3);

    render(<ProductDeliveryBadge />);

    await waitFor(() => {
      const badge = screen.getByText('3 delivery methods');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('tc-badge', 'tc-badge--success');
    });
  });

  it('displays singular form when count is 1', async () => {
    const mockSDK = createMockSDK('product-1');
    vi.mocked(getSDK).mockReturnValue(mockSDK);
    vi.mocked(countAssignments).mockResolvedValue(1);

    render(<ProductDeliveryBadge />);

    await waitFor(() => {
      const badge = screen.getByText('1 delivery method');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('tc-badge', 'tc-badge--success');
    });
  });

  it('displays danger style when count is zero', async () => {
    const mockSDK = createMockSDK('product-1');
    vi.mocked(getSDK).mockReturnValue(mockSDK);
    vi.mocked(countAssignments).mockResolvedValue(0);

    render(<ProductDeliveryBadge />);

    await waitFor(() => {
      const badge = screen.getByText('No delivery methods');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('tc-badge', 'tc-badge--danger');
    });
  });

  it('displays error state when countAssignments throws', async () => {
    const mockSDK = createMockSDK('product-1');
    vi.mocked(getSDK).mockReturnValue(mockSDK);
    vi.mocked(countAssignments).mockRejectedValue(new Error('SDK error'));

    render(<ProductDeliveryBadge />);

    await waitFor(() => {
      const badge = screen.getByText('Delivery info unavailable');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('tc-badge');
      expect(badge).not.toHaveClass('tc-badge--success');
      expect(badge).not.toHaveClass('tc-badge--danger');
    });
  });

  it('displays error state when productId is empty', async () => {
    const mockSDK = createMockSDK('');
    vi.mocked(getSDK).mockReturnValue(mockSDK);

    render(<ProductDeliveryBadge />);

    await waitFor(() => {
      const badge = screen.getByText('Delivery info unavailable');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('tc-badge');
      expect(badge).not.toHaveClass('tc-badge--success');
      expect(badge).not.toHaveClass('tc-badge--danger');
    });
  });

  it('displays error state when productId is undefined', async () => {
    const mockSDK = createMockSDK(undefined);
    vi.mocked(getSDK).mockReturnValue(mockSDK);

    render(<ProductDeliveryBadge />);

    await waitFor(() => {
      const badge = screen.getByText('Delivery info unavailable');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('tc-badge');
      expect(badge).not.toHaveClass('tc-badge--success');
      expect(badge).not.toHaveClass('tc-badge--danger');
    });
  });
});
