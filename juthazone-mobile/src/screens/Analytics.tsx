import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { RevenueChart, RoomChart, PeakHoursChart } from '../components/Charts';
import { fetchAnalyticsData } from '../services/analytics';

const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getAnalyticsData = async () => {
      try {
        const data = await fetchAnalyticsData();
        setAnalyticsData(data);
      } catch (err) {
        setError('Error fetching analytics data');
      } finally {
        setLoading(false);
      }
    };

    getAnalyticsData();
  }, []);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#9333ea" />
        <Text>Loading analytics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-red-500">{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="p-4">
      <Text className="text-2xl font-bold mb-4">Analytics Dashboard</Text>
      <RevenueChart data={analyticsData.dailyRevenue} />
      <RoomChart data={analyticsData.roomStats} />
      <PeakHoursChart data={analyticsData.peakHours} />
    </ScrollView>
  );
};

export default Analytics;