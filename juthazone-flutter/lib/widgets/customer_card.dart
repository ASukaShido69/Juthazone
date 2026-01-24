import 'package:flutter/material.dart';
import '../models/customer.dart';
import 'timer_widget.dart';

class CustomerCard extends StatelessWidget {
  final Customer customer;
  final VoidCallback? onTap;
  final bool showTimer;
  final bool showActions;
  final Function(int)? onEndSession;
  final Function(Customer)? onEdit;

  const CustomerCard({
    super.key,
    required this.customer,
    this.onTap,
    this.showTimer = true,
    this.showActions = false,
    this.onEndSession,
    this.onEdit,
  });

  Color _getBadgeColor() {
    if (!customer.isActive) return Colors.grey;
    if (customer.isPaid) return Colors.green;
    return Colors.orange;
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          customer.name,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '🏠 ${customer.room}',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.grey[700],
                          ),
                        ),
                        if (customer.phone != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            '📱 ${customer.phone}',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: _getBadgeColor(),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      customer.isPaid ? '💰 จ่ายแล้ว' : '⏳ รอชำระ',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),

              // Timer
              if (showTimer &&
                  customer.isActive &&
                  customer.expectedEndTime != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: TimerWidget(customer: customer),
                ),
              ],

              // Info
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.only(top: 12),
                decoration: BoxDecoration(
                  border: Border(
                    top: BorderSide(color: Colors.grey[300]!),
                  ),
                ),
                child: Column(
                  children: [
                    _buildInfoRow('⏱️ ระยะเวลา:',
                        '${customer.durationMinutes} นาที'),
                    _buildInfoRow(
                        '💵 ค่าบริการ:', '฿${customer.cost.toStringAsFixed(0)}'),
                    if (customer.staffName != null)
                      _buildInfoRow('👤 พนักงาน:', customer.staffName!),
                  ],
                ),
              ),

              // Actions
              if (showActions) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (onEdit != null)
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => onEdit!(customer),
                          icon: const Icon(Icons.edit, size: 18),
                          label: const Text('แก้ไข'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blue,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                    if (onEdit != null && onEndSession != null)
                      const SizedBox(width: 8),
                    if (onEndSession != null && customer.isActive)
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => onEndSession!(customer.id),
                          icon: const Icon(Icons.flag, size: 18),
                          label: const Text('จบเซสชัน'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(fontSize: 14, color: Colors.grey[700]),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
