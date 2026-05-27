import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { PluginSDKType } from '../../../sdk';

// Mock the SDK module
vi.mock('../../../sdk', () => ({
  getSDK: vi.fn(),
}));

// Mock the services module
vi.mock('../services', () => ({
  listDeliveryMethods: vi.fn(),
  listAssignments: vi.fn(),
  enableDeliveryMethod: vi.fn(),
  disableDeliveryMethod: vi.fn(),
  enableAllDeliveryMethods: vi.fn(),
}));

import { getSDK } from '../../../sdk';
import {
  listDeliveryMethods,
  listAssignments,
  enableDeliveryMethod,
  disableDeliveryMethod,
  enableAllDeliveryMethods,
} from '../services';
import { ProductDeliveryTab } from '../pages/ProductDeliveryTab';
import type { DeliveryMethod, ProductDeliveryAssignment } from '../domain';

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

const mockMethods: DeliveryMethod[] = [
  { objectId: 'dm1', courierId: 'c1', deliveryTypeId: 'dt1', courierName: 'DHL', deliveryTypeName: 'Classic Courier' },
  { objectId: 'dm2', courierId: 'c2', deliveryTypeId: 'dt1', courierName: 'InPost', deliveryTypeName: 'Parcel Locker' },
  { objectId: 'dm3', courierId: 'c1', deliveryTypeId: 'dt2', courierName: 'DHL', deliveryTypeName: 'Express' },
];

beforeEach(() => {
  vi.clearAllMocks();
  const mockSDK = createMockSDK('product-123');
  vi.mocked(getSDK).mockReturnValue(mockSDK);
});

describe('ProductDeliveryTab', () => {
  describe('Empty state', () => {
    it('displays "No delivery methods available" when listDeliveryMethods returns empty array', async () => {
      vi.mocked(listDeliveryMethods).mockResolvedValue([]);
      vi.mocked(listAssignments).mockResolvedValue([]);

      render(<ProductDeliveryTab />);

      await waitFor(() => {
        expect(screen.getByText(/no delivery methods available/i)).toBeInTheDocument();
      });
    });
  });

  describe('All methods disabled', () => {
    it('renders all toggles unchecked when listAssignments returns empty array', async () => {
      vi.mocked(listDeliveryMethods).mockResolvedValue(mockMethods);
      vi.mocked(listAssignments).mockResolvedValue([]);

      render(<ProductDeliveryTab />);

      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(3);
        checkboxes.forEach((checkbox) => {
          expect(checkbox).not.toBeChecked();
        });
      });
    });
  });

  describe('Toggle enable', () => {
    it('calls enableDeliveryMethod and reloads when clicking an unchecked toggle', async () => {
      vi.mocked(listDeliveryMethods).mockResolvedValue(mockMethods);
      vi.mocked(listAssignments).mockResolvedValue([]);
      vi.mocked(enableDeliveryMethod).mockResolvedValue(undefined);

      render(<ProductDeliveryTab />);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')).toHaveLength(3);
      });

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(enableDeliveryMethod).toHaveBeenCalledWith('product-123', 'dm1');
      });

      // loadData is called again after toggle (listDeliveryMethods called twice: initial + reload)
      await waitFor(() => {
        expect(listDeliveryMethods).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Toggle disable', () => {
    it('calls disableDeliveryMethod and reloads when clicking a checked toggle', async () => {
      const assignments: ProductDeliveryAssignment[] = [
        { objectId: 'product-123-dm1', productId: 'product-123', deliveryMethodId: 'dm1' },
      ];

      vi.mocked(listDeliveryMethods).mockResolvedValue(mockMethods);
      vi.mocked(listAssignments).mockResolvedValue(assignments);
      vi.mocked(disableDeliveryMethod).mockResolvedValue(undefined);

      render(<ProductDeliveryTab />);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')).toHaveLength(3);
      });

      // First checkbox should be checked (dm1 is assigned)
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked();

      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(disableDeliveryMethod).toHaveBeenCalledWith('product-123', 'dm1');
      });

      // loadData is called again after toggle
      await waitFor(() => {
        expect(listDeliveryMethods).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Enable All', () => {
    it('calls enableAllDeliveryMethods and reloads when clicking "Enable All"', async () => {
      vi.mocked(listDeliveryMethods).mockResolvedValue(mockMethods);
      vi.mocked(listAssignments).mockResolvedValue([]);
      vi.mocked(enableAllDeliveryMethods).mockResolvedValue(undefined);

      render(<ProductDeliveryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable all/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /enable all/i }));

      await waitFor(() => {
        expect(enableAllDeliveryMethods).toHaveBeenCalledWith('product-123');
      });

      // loadData is called again after enable all
      await waitFor(() => {
        expect(listDeliveryMethods).toHaveBeenCalledTimes(2);
      });
    });

    it('disables "Enable All" button when all methods are already assigned', async () => {
      const allAssigned: ProductDeliveryAssignment[] = mockMethods.map((m) => ({
        objectId: `product-123-${m.objectId}`,
        productId: 'product-123',
        deliveryMethodId: m.objectId,
      }));

      vi.mocked(listDeliveryMethods).mockResolvedValue(mockMethods);
      vi.mocked(listAssignments).mockResolvedValue(allAssigned);

      render(<ProductDeliveryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable all/i })).toBeDisabled();
      });
    });
  });

  describe('Error display', () => {
    it('shows error message with tc-error class when a service call fails', async () => {
      // First load succeeds, then enable all fails
      vi.mocked(listDeliveryMethods).mockResolvedValue(mockMethods);
      vi.mocked(listAssignments).mockResolvedValue([]);
      vi.mocked(enableAllDeliveryMethods).mockRejectedValue(new Error('Network failure'));

      render(<ProductDeliveryTab />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable all/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /enable all/i }));

      await waitFor(() => {
        const errorEl = screen.getByText('Network failure');
        expect(errorEl).toBeInTheDocument();
        expect(errorEl).toHaveClass('tc-error');
      });
    });

    it('shows error message when toggle fails', async () => {
      vi.mocked(listDeliveryMethods).mockResolvedValue(mockMethods);
      vi.mocked(listAssignments).mockResolvedValue([]);
      vi.mocked(enableDeliveryMethod).mockRejectedValue(new Error('Assignment failed'));

      render(<ProductDeliveryTab />);

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')).toHaveLength(3);
      });

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        const errorEl = screen.getByText('Assignment failed');
        expect(errorEl).toBeInTheDocument();
        expect(errorEl).toHaveClass('tc-error');
      });
    });
  });
});
