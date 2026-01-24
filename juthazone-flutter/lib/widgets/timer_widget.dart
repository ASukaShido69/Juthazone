import 'package:flutter/material.dart';
import '../models/customer.dart';

class TimerWidget extends StatefulWidget {
  final Customer customer;
  final bool compact;

  const TimerWidget({
    super.key,
    required this.customer,
    this.compact = false,
  });

  @override
  State<TimerWidget> createState() => _TimerWidgetState();
}

class _TimerWidgetState extends State<TimerWidget> {
  late Stream<int> _timerStream;

  @override
  void initState() {
    super.initState();
    _timerStream = Stream.periodic(
      const Duration(seconds: 1),
      (_) => widget.customer.timeLeftSeconds,
    );
  }

  Color _getColor(int minutesLeft, bool isExpired) {
    if (isExpired) return Colors.red;
    if (minutesLeft <= 5) return Colors.orange;
    if (minutesLeft <= 15) return Colors.amber;
    return Colors.green;
  }

  String _formatTime(int seconds) {
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    final secs = seconds % 60;

    if (widget.compact) {
      return hours > 0
          ? '$hours:${minutes.toString().padLeft(2, '0')}h'
          : '$minutes:${secs.toString().padLeft(2, '0')}';
    }

    return '${hours.toString().padLeft(2, '0')}:'
        '${minutes.toString().padLeft(2, '0')}:'
        '${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<int>(
      stream: _timerStream,
      initialData: widget.customer.timeLeftSeconds,
      builder: (context, snapshot) {
        final timeLeft = snapshot.data ?? 0;
        final minutesLeft = (timeLeft / 60).floor();
        final isExpired = timeLeft == 0;
        final color = _getColor(minutesLeft, isExpired);
        final progress = widget.customer.progressPercentage;

        return Container(
          padding: widget.compact
              ? const EdgeInsets.all(4)
              : const EdgeInsets.all(10),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                isExpired ? 'หมดเวลา!' : _formatTime(timeLeft),
                style: TextStyle(
                  fontSize: widget.compact ? 20 : 32,
                  fontWeight: FontWeight.bold,
                  color: color,
                  fontFamily: 'monospace',
                ),
              ),
              if (!widget.compact) ...[
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress / 100,
                    backgroundColor: Colors.grey[300],
                    valueColor: AlwaysStoppedAnimation<Color>(color),
                    minHeight: 8,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isExpired
                      ? 'กรุณาตรวจสอบ'
                      : 'เหลือ $minutesLeft นาที (${progress.floor()}%)',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
