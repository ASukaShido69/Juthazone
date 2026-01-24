import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/customer.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  late final SupabaseClient _client;

  // ⚠️ แทนที่ด้วย credentials ของคุณ
  static const String supabaseUrl = 'https://your-project.supabase.co';
  static const String supabaseAnonKey = 'your-anon-key';

  Future<void> initialize() async {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
    );
    _client = Supabase.instance.client;
  }

  SupabaseClient get client => _client;

  // Fetch active customers
  Future<List<Customer>> fetchActiveCustomers() async {
    try {
      final response = await _client
          .from('customers')
          .select()
          .eq('is_active', true)
          .order('created_at', ascending: false);

      return (response as List)
          .map((json) => Customer.fromJson(json))
          .toList();
    } catch (e) {
      print('Error fetching customers: $e');
      rethrow;
    }
  }

  // Fetch history
  Future<List<Customer>> fetchHistory({
    DateTime? dateFrom,
    DateTime? dateTo,
    String? room,
    bool? isPaid,
  }) async {
    try {
      var query = _client
          .from('customers_history')
          .select()
          .order('created_at', ascending: false);

      if (dateFrom != null) {
        query = query.gte('created_at', dateFrom.toIso8601String());
      }
      if (dateTo != null) {
        query = query.lte('created_at', dateTo.toIso8601String());
      }
      if (room != null && room != 'all') {
        query = query.eq('room', room);
      }
      if (isPaid != null) {
        query = query.eq('is_paid', isPaid);
      }

      final response = await query;

      return (response as List)
          .map((json) => Customer.fromJson(json))
          .toList();
    } catch (e) {
      print('Error fetching history: $e');
      rethrow;
    }
  }

  // Add customer
  Future<Customer> addCustomer({
    required String name,
    required String room,
    String? phone,
    required int durationMinutes,
    required double cost,
  }) async {
    try {
      final now = DateTime.now();
      final expectedEnd = now.add(Duration(minutes: durationMinutes));

      final response = await _client.from('customers').insert({
        'name': name,
        'room': room,
        'phone': phone,
        'start_time': now.toIso8601String(),
        'expected_end_time': expectedEnd.toIso8601String(),
        'duration_minutes': durationMinutes,
        'cost': cost,
        'is_active': true,
        'is_paid': false,
      }).select().single();

      return Customer.fromJson(response);
    } catch (e) {
      print('Error adding customer: $e');
      rethrow;
    }
  }

  // Update customer
  Future<Customer> updateCustomer(int id, Map<String, dynamic> updates) async {
    try {
      final response = await _client
          .from('customers')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

      return Customer.fromJson(response);
    } catch (e) {
      print('Error updating customer: $e');
      rethrow;
    }
  }

  // Delete customer
  Future<void> deleteCustomer(int id) async {
    try {
      await _client.from('customers').delete().eq('id', id);
    } catch (e) {
      print('Error deleting customer: $e');
      rethrow;
    }
  }

  // End session
  Future<Customer> endSession({
    required int id,
    required bool isPaid,
    String? paymentMethod,
  }) async {
    try {
      final response = await _client
          .from('customers')
          .update({
            'actual_end_time': DateTime.now().toIso8601String(),
            'is_active': false,
            'is_paid': isPaid,
            'payment_method': paymentMethod,
          })
          .eq('id', id)
          .select()
          .single();

      return Customer.fromJson(response);
    } catch (e) {
      print('Error ending session: $e');
      rethrow;
    }
  }

  // Subscribe to realtime changes
  RealtimeChannel subscribeToCustomers(Function(dynamic) callback) {
    return _client
        .channel('customers')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'customers',
          callback: callback,
        )
        .subscribe();
  }
}
