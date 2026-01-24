import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface RoomChartProps {
  data: { name: string; value: number }[];
}

const RoomChart: React.FC<RoomChartProps> = ({ data }) => {
  const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF6699'];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, value }) => `${name}: ${value}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `${value} คน`} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default RoomChart;