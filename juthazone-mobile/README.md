# Juthazone Mobile App

Welcome to the Juthazone mobile application! This app is designed for managing customer timers in a gaming/play area business, featuring an admin dashboard and a customer view with real-time countdowns.

## Project Overview

The Juthazone mobile app allows users to:
- Manage customer timers
- View analytics related to customer usage and revenue
- Authenticate users
- Configure app settings

## Technical Stack

- **React Native**: For building the mobile application.
- **TypeScript**: For type safety and better development experience.
- **Supabase**: For backend services including authentication and database management.
- **Recharts**: For visualizing analytics data in charts.
- **Tailwind CSS**: For styling the components.

## Project Structure

- **src/screens**: Contains the main screens of the application.
  - `AdminDashboard.tsx`: Admin interface for managing timers and analytics.
  - `CustomerView.tsx`: Displays real-time countdowns and payment status.
  - `Analytics.tsx`: Presents analytics data and charts.
  - `Login.tsx`: Handles user authentication.
  - `Settings.tsx`: Allows users to configure app settings.

- **src/components**: Contains reusable components.
  - `Timer.tsx`: Manages and displays countdown timers.
  - `CustomerCard.tsx`: Displays customer information.
  - `QRCodeDisplay.tsx`: Generates and displays QR codes.
  - **Charts**: Contains components for visualizing data.
    - `RevenueChart.tsx`: Visualizes revenue data.
    - `RoomChart.tsx`: Visualizes room usage statistics.
    - `PeakHoursChart.tsx`: Visualizes peak usage hours.

- **src/services**: Contains service files for backend interactions.
  - `supabase.ts`: Configuration for Supabase.
  - `auth.ts`: Functions for user authentication.
  - `analytics.ts`: Functions for fetching analytics data.

- **src/hooks**: Contains custom hooks for managing state and logic.
  - `useTimer.ts`: Custom hook for timer management.
  - `useCustomers.ts`: Custom hook for customer data.
  - `useAnalytics.ts`: Custom hook for analytics data.

- **src/utils**: Contains utility functions.
  - `time.ts`: Time-related utility functions.
  - `format.ts`: Data formatting utility functions.

- **src/navigation**: Contains navigation setup.
  - `AppNavigator.tsx`: Sets up the navigation structure.

- **src/styles**: Contains styling configurations.
  - `theme.ts`: Theme configuration for the app.

- **src/types**: Contains TypeScript types and interfaces.

- **src/App.tsx**: Main entry point of the application.

## Getting Started

To get started with the Juthazone mobile app, follow these steps:

1. **Clone the repository**:
   ```
   git clone <repository-url>
   cd juthazone-mobile
   ```

2. **Install dependencies**:
   ```
   npm install
   ```

3. **Run the app**:
   - For Android:
     ```
     npx react-native run-android
     ```
   - For iOS:
     ```
     npx react-native run-ios
     ```

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.

## License

This project is licensed under the MIT License. See the LICENSE file for details.