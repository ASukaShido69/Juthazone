import React, { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { useCustomers } from '../hooks/useCustomers';
import { useAnalytics } from '../hooks/useAnalytics';
import Timer from '../components/Timer';
import CustomerCard from '../components/CustomerCard';
import RevenueChart from '../components/Charts/RevenueChart';
import RoomChart from '../components/Charts/RoomChart';
import PeakHoursChart from '../components/Charts/PeakHoursChart';

const AdminDashboard = () => {
  const { customers, fetchCustomers } = useCustomers();
  const { analyticsData, fetchAnalytics } = useAnalytics();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      await fetchCustomers();
      await fetchAnalytics();
      setLoading(false);
    };
    loadData();
  }, [fetchCustomers, fetchAnalytics]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 p-4 bg-gray-100">
      <Text className="text-2xl font-bold mb-4">Admin Dashboard</Text>
      <View className="mb-4">
        <Text className="text-lg font-semibold">Active Timers</Text>
        {customers.map((customer) => (
          <CustomerCard key={customer.id} customer={customer} />
        ))}
      </View>
      <View className="mb-4">
        <Text className="text-lg font-semibold">Revenue Overview</Text>
        <RevenueChart data={analyticsData.dailyRevenue} />
      </View>
      <View className="mb-4">
        <Text className="text-lg font-semibold">Room Usage Statistics</Text>
        <RoomChart data={analyticsData.roomStats} />
      </View>
      <View className="mb-4">
        <Text className="text-lg font-semibold">Peak Usage Hours</Text>
        <PeakHoursChart data={analyticsData.peakHours} />
      </View>
      <Button title="Refresh Data" onPress={() => loadData()} />
    </ScrollView>
  );
};

export default AdminDashboard;