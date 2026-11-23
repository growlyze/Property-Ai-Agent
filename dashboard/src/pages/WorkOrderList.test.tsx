import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorkOrderList from './WorkOrderList';
import workOrderService from '../services/workOrderService';

jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn().mockResolvedValue({ data: { data: [] } }) } }));
jest.mock('../services/workOrderService', () => {
  const actual = jest.requireActual('../services/workOrderService');
  const svc = { list: jest.fn(), create: jest.fn(), updateStatus: jest.fn(), decideQuote: jest.fn(), submitQuote: jest.fn(), get: jest.fn() };
  return { __esModule: true, ...actual, default: svc, workOrderService: svc };
});

const mocked = workOrderService as jest.Mocked<typeof workOrderService>;

const renderList = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WorkOrderList />
    </QueryClientProvider>,
  );

const item = {
  id: 'wo1',
  title: 'WO: Leaky faucet',
  description: 'Kitchen tap drips',
  status: 'OPEN' as const,
  priority: 'HIGH' as const,
  createdAt: '2026-01-10T00:00:00Z',
  rental: { id: 'r1', title: 'Sunrise Apartments - Unit 201', address: '1234 Main Street', city: 'San Francisco', unitNumber: '201' },
  maintenanceRequest: { id: 'm1', title: 'Leaky faucet', status: 'OPEN' },
  vendors: [{ id: 'v1', name: 'Mike Plumber', specialty: 'PLUMBING' }],
  quotes: [{ id: 'q1', vendorId: 'v1', vendorName: 'Mike Plumber', amount: 120, details: null, status: 'PENDING', createdAt: '2026-01-11T00:00:00Z' }],
};

describe('WorkOrderList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists work orders from /api/work-orders', async () => {
    mocked.list.mockResolvedValue({ data: [item], total: 1, page: 1, limit: 10 });
    renderList();
    expect(await screen.findByText('WO: Leaky faucet')).toBeInTheDocument();
    expect(screen.getByText('Mike Plumber')).toBeInTheDocument();
    expect(screen.getByText('Sunrise Apartments - Unit 201')).toBeInTheDocument();
    expect(mocked.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10 }));
  });

  it('shows an empty state', async () => {
    mocked.list.mockResolvedValue({ data: [], total: 0 });
    renderList();
    expect(await screen.findByText('No work orders found')).toBeInTheDocument();
  });

  it('shows an error state', async () => {
    mocked.list.mockRejectedValue(new Error('boom'));
    renderList();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to load work orders'));
  });
});
