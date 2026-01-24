import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PeakHoursChartProps {
  data: { hour: string; customers: number }[];
}

const PeakHoursChart: React.FC<PeakHoursChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
        <XAxis dataKey="hour" />
        <YAxis />
        <Tooltip formatter={(value) => `${value} คน`} contentStyle={{ backgroundColor: '#fff', border: '2px solid #06b6d4', borderRadius: '8px' }} />
        <Bar dataKey="customers" fill="#06b6d4" radius={[8, 8, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default PeakHoursChart;