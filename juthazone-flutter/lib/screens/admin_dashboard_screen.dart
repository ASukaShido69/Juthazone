import 'package:flutter/material.dart';
import '../models/customer.dart';
import '../services/supabase_service.dart';
import '../widgets/customer_card.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final _supabase = SupabaseService();
  List<Customer> _customers = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCustomers();
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

  Future<void> _showAddCustomerDialog() async {
    final nameController = TextEditingController();
    final roomController = TextEditingController();
    final phoneController = TextEditingController();
    final durationController = TextEditingController(text: '60');
    final costController = TextEditingController(text: '100');

    return showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('เพิ่มลูกค้าใหม่'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'ชื่อ',
                  prefixIcon: Icon(Icons.person),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: roomController,
                decoration: const InputDecoration(
                  labelText: 'ห้อง',
                  prefixIcon: Icon(Icons.home),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneController,
                decoration: const InputDecoration(
                  labelText: 'เบอร์โทร (ถ้ามี)',
                  prefixIcon: Icon(Icons.phone),
                ),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: durationController,
                decoration: const InputDecoration(
                  labelText: 'ระยะเวลา (นาที)',
                  prefixIcon: Icon(Icons.timer),
                ),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: costController,
                decoration: const InputDecoration(
                  labelText: 'ค่าบริการ (บาท)',
                  prefixIcon: Icon(Icons.attach_money),
                ),
                keyboardType: TextInputType.number,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('ยกเลิก'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.isEmpty ||
                  roomController.text.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('กรุณากรอกข้อมูลให้ครบ')),
                );
                return;
              }

              try {
                await _supabase.addCustomer(
                  name: nameController.text,
                  room: roomController.text,
                  phone: phoneController.text.isEmpty
                      ? null
                      : phoneController.text,
                  durationMinutes: int.parse(durationController.text),
                  cost: double.parse(costController.text),
                );

                if (mounted) {
                  Navigator.pop(context);
                  _loadCustomers();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('เพิ่มลูกค้าสำเร็จ')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('เกิดข้อผิดพลาด: $e')),
                  );
                }
              }
            },
            child: const Text('เพิ่ม'),
          ),
        ],
      ),
    );
  }

  Future<void> _endSession(int customerId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('จบเซสชัน'),
        content: const Text('ต้องการจบเซสชันนี้หรือไม่?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('ยกเลิก'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('จบเซสชัน'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _supabase.endSession(
          id: customerId,
          isPaid: true,
          paymentMethod: 'cash',
        );
        _loadCustomers();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('จบเซสชันสำเร็จ')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('เกิดข้อผิดพลาด: $e')),
          );
        }
      }
    }
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
                    '👨‍💼 จัดการลูกค้า',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'ทั้งหมด ${_customers.length} ท่าน',
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
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _customers.isEmpty
                      ? const Center(child: Text('ยังไม่มีลูกค้า'))
                      : RefreshIndicator(
                          onRefresh: _loadCustomers,
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _customers.length,
                            itemBuilder: (context, index) {
                              return CustomerCard(
                                customer: _customers[index],
                                showTimer: true,
                                showActions: true,
                                onEndSession: _endSession,
                              );
                            },
                          ),
                        ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddCustomerDialog,
        backgroundColor: const Color(0xFF9333ea),
        icon: const Icon(Icons.add),
        label: const Text('เพิ่มลูกค้า'),
      ),
    );
  }
}
