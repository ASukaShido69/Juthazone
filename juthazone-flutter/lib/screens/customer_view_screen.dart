import 'dart:async';
import 'package:flutter/material.dart';
import '../models/customer.dart';
import '../services/supabase_service.dart';
import '../services/notification_service.dart';
import '../widgets/customer_card.dart';

class CustomerViewScreen extends StatefulWidget {
  const CustomerViewScreen({super.key});

  @override
  State<CustomerViewScreen> createState() => _CustomerViewScreenState();
}

class _CustomerViewScreenState extends State<CustomerViewScreen> {
  final _supabase = SupabaseService();
  final _notifications = NotificationService();
  
  List<Customer> _customers = [];
  bool _isLoading = true;
  String? _error;
  Timer? _notificationTimer;

  @override
  void initState() {
    super.initState();
    _loadCustomers();
    _setupRealtimeSubscription();
    _startNotificationCheck();
  }

  @override
  void dispose() {
    _notificationTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadCustomers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final customers = await _supabase.fetchActiveCustomers();
      setState(() {
        _customers = customers;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _setupRealtimeSubscription() {
    _supabase.subscribeToCustomers((payload) {
      print('Realtime update: $payload');
      _loadCustomers();
    });
  }

  void _startNotificationCheck() {
    _notificationTimer = Timer.periodic(
      const Duration(seconds: 30),
      (timer) {
        _notifications.checkTimersAndNotify(_customers);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF9333ea), Color(0xFFa855f7)],
                ),
              ),
              child: Column(
                children: [
                  const Text(
                    '🏠 ลูกค้าปัจจุบัน',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${_customers.length} ท่าน',
                    style: const TextStyle(
                      fontSize: 16,
                      color: Color(0xFFe9d5ff),
                    ),
                  ),
                ],
              ),
            ),

            // Content
            Expanded(
              child: _buildContent(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: Color(0xFF9333ea)),
            SizedBox(height: 12),
            Text(
              'กำลังโหลด...',
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ],
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('⚠️', style: TextStyle(fontSize: 64)),
            const SizedBox(height: 16),
            Text(
              _error!,
              style: const TextStyle(fontSize: 18, color: Colors.red),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadCustomers,
              child: const Text('ลองอีกครั้ง'),
            ),
          ],
        ),
      );
    }

    if (_customers.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('😴', style: TextStyle(fontSize: 80)),
            const SizedBox(height: 16),
            const Text(
              'ยังไม่มีลูกค้าใช้บริการ',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: Color(0xFF374151),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'รอรับลูกค้าท่านถัดไป',
              style: TextStyle(fontSize: 16, color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadCustomers,
      color: const Color(0xFF9333ea),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _customers.length,
        itemBuilder: (context, index) {
          return CustomerCard(
            customer: _customers[index],
            showTimer: true,
            showActions: false,
          );
        },
      ),
    );
  }
}
