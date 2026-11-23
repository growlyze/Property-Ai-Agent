import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Dashboard from '../pages/Dashboard';
import api from '../services/api';

jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));

const overview = {
  portfolio: { totalRentals: 12, occupied: 9, vacant: 3, occupancyRate: 75, activeLeases: 9 },
  rent: {
    collectedThisMonth: 14250,
    pendingAmount: 1800,
    pendingCount: 1,
    failedAmount: 2100,
    failedCount: 1,
    monthly: [
      { month: 'Jun', collected: 12000 },
      { month: 'Jul', collected: 13000 },
    ],
  },
  maintenance: { open: 5, urgent: 2 },
  applications: { pending: 4 },
  recentMaintenance: [
    { id: 'm1', title: 'Leaking faucet', status: 'OPEN', priority: 'HIGH', createdAt: '2026-11-20T10:00:00Z', rental: 'Unit 101' },
  ],
  recentPayments: [
    { id: 'p1', amount: 1800, status: 'COMPLETED', date: '2026-11-01T00:00:00Z', tenant: 'John Smith', rental: 'Unit 101' },
  ],
  expiringLeases: [],
};

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    (api.get as jest.Mock).mockResolvedValue({ data: { data: overview } });
  });

  it('renders the portfolio overview heading', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { name: /portfolio overview/i })).toBeInTheDocument();
  });

  it('shows occupancy and maintenance KPIs from the overview API', async () => {
    renderDashboard();
    expect(await screen.findByText('75%')).toBeInTheDocument();
    expect(screen.getByText('5 high priority or emergency'.replace('5', '2'))).toBeInTheDocument();
  });

  it('lists recent maintenance and payments', async () => {
    renderDashboard();
    expect(await screen.findByText('Leaking faucet')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('warns about failed rent payments', async () => {
    renderDashboard();
    expect(await screen.findByText(/1 rent payment failed/i)).toBeInTheDocument();
  });

  it('shows an error when the overview cannot load', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('down'));
    renderDashboard();
    expect(await screen.findByText(/could not load the dashboard overview/i)).toBeInTheDocument();
  });
});
