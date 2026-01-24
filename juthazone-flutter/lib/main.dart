import 'package:flutter/material.dart';
import 'services/supabase_service.dart';
import 'services/notification_service.dart';
import 'screens/admin_dashboard_screen.dart';
import 'screens/customer_view_screen.dart';
import 'screens/analytics_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize services
  await SupabaseService().initialize();
  await NotificationService().initialize();
  
  runApp(const JuthazoneApp());
}

class JuthazoneApp extends StatelessWidget {
  const JuthazoneApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Juthazone',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.purple,
        primaryColor: const Color(0xFF9333ea),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF9333ea),
        ),
        fontFamily: 'Mali',
        useMaterial3: true,
      ),
      home: const MainNavigator(),
    );
  }
}

class MainNavigator extends StatefulWidget {
  const MainNavigator({super.key});

  @override
  State<MainNavigator> createState() => _MainNavigatorState();
}

class _MainNavigatorState extends State<MainNavigator> {
  int _selectedIndex = 0;

  final List<Widget> _screens = const [
    AdminDashboardScreen(),
    CustomerViewScreen(),
    AnalyticsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) => setState(() => _selectedIndex = index),
        selectedItemColor: const Color(0xFF9333ea),
        unselectedItemColor: Colors.grey,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600),
        items: const [
          BottomNavigationBarItem(
            icon: Text('👨‍💼', style: TextStyle(fontSize: 24)),
            label: 'จัดการ',
          ),
          BottomNavigationBarItem(
            icon: Text('🏠', style: TextStyle(fontSize: 24)),
            label: 'ลูกค้า',
          ),
          BottomNavigationBarItem(
            icon: Text('📊', style: TextStyle(fontSize: 24)),
            label: 'สถิติ',
          ),
        ],
      ),
    );
  }
}
