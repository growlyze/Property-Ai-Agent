import React, { useEffect, useState } from 'react';
import { useVendorList, useVendorPerformance } from '../hooks/useVendorPerformance';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const VendorPerformanceAnalyticsScreen: React.FC = () => {
  const { data: vendorList, isLoading: vendorsLoading, error: vendorsError } = useVendorList();
  const vendors = vendorList ?? [];
  const [selectedVendor, setSelectedVendor] = useState<string>('');

  // Pick the first real vendor once the directory has loaded.
  useEffect(() => {
    if (!selectedVendor && vendors.length > 0) setSelectedVendor(vendors[0].id);
  }, [vendors, selectedVendor]);

  const { ratings, ratingsLoading, ratingsError, averageScore, averageScoreLoading, averageScoreError } = useVendorPerformance(selectedVendor);

  const handleVendorChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVendor(event.target.value);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Vendor Performance Analytics</h1>

      {/* Filtering Section */}
      <div className="mb-8 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Filters</h2>
        <div className="flex space-x-4">
          <div>
            <label htmlFor="vendor-select" className="block text-sm font-medium text-gray-700">Vendor</label>
            <select
              id="vendor-select"
              value={selectedVendor}
              onChange={handleVendorChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              {vendors.length === 0 && (
                <option value="">{vendorsLoading ? 'Loading vendors...' : 'No vendors yet'}</option>
              )}
              {vendors.map(vendor => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          </div>
          {/* Add other filters for service category, time period, etc. here */}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mb-8 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Performance Metrics</h2>
        {vendorsError && <p>Could not load vendors.</p>}
        {!vendorsLoading && !vendorsError && vendors.length === 0 && (
          <p className="text-gray-500">No vendors yet. Add a vendor to see performance metrics.</p>
        )}
        {(ratingsLoading || averageScoreLoading) && <p>Loading...</p>}
        {(ratingsError || averageScoreError) && <p>Error loading data</p>}
        {ratings && averageScore && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-100 rounded-lg">
              <h3 className="text-lg font-semibold">Average Score</h3>
              <p className="text-3xl font-bold">{Number(averageScore.averageScore ?? 0).toFixed(2)}</p>
            </div>
            <div className="p-4 bg-gray-100 rounded-lg">
              <h3 className="text-lg font-semibold">Total Ratings</h3>
              <p className="text-3xl font-bold">{ratings.length}</p>
            </div>
          </div>
        )}
      </div>

      {/* Ratings Chart */}
      <div className="mb-8 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Ratings Distribution</h2>
        {ratings && ratings.length === 0 && <p className="text-gray-500">No ratings yet.</p>}
        {ratings && ratings.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ratings}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="metricId" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="rating" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* AI-Recommended Vendor Assignments */}
      <div>
        <h2 className="text-xl font-semibold mb-2">AI-Recommended Vendors</h2>
        <div className="bg-white p-4 rounded-lg shadow">
          {/* Placeholder for AI recommendations */}
          <p className="text-gray-500">AI-recommended vendor assignments based on job type and performance will be shown here.</p>
        </div>
      </div>
    </div>
  );
};

export default VendorPerformanceAnalyticsScreen;
