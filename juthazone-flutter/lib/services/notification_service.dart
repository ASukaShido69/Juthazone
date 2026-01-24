import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/customer.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();

  final Set<String> _sentNotifications = {};

  Future<void> initialize() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    await requestPermissions();
  }

  Future<void> requestPermissions() async {
    if (await Permission.notification.isDenied) {
      await Permission.notification.request();
    }
  }

  void _onNotificationTapped(NotificationResponse response) {
    print('Notification tapped: ${response.payload}');
  }

  Future<void> checkTimersAndNotify(List<Customer> customers) async {
    for (final customer in customers) {
      if (!customer.isActive || customer.expectedEndTime == null) continue;

      final minutesLeft = customer.minutesLeft;
      final notifyKey = '${customer.id}-$minutesLeft';

      // แจ้งเตือนที่ 15, 10, 5, 1 นาที
      if ([15, 10, 5, 1].contains(minutesLeft) &&
          !_sentNotifications.contains(notifyKey)) {
        await _showTimerNotification(customer, minutesLeft);
        _sentNotifications.add(notifyKey);
      }

      // แจ้งเมื่อหมดเวลา
      if (customer.isExpired &&
          !_sentNotifications.contains('${customer.id}-expired')) {
        await _showExpiredNotification(customer);
        _sentNotifications.add('${customer.id}-expired');
      }
    }

    // ล้างการแจ้งเตือนเก่า (เกิน 1 ชั่วโมง)
    _cleanupOldNotifications();
  }

  Future<void> _showTimerNotification(
      Customer customer, int minutesLeft) async {
    final emoji = minutesLeft <= 5 ? '🚨' : minutesLeft <= 10 ? '⏰' : '⏳';
    final priority = minutesLeft <= 5
        ? Priority.high
        : minutesLeft <= 10
            ? Priority.defaultPriority
            : Priority.low;

    const androidDetails = AndroidNotificationDetails(
      'timer_channel',
      'Timer Notifications',
      channelDescription: 'แจ้งเตือนเวลาใกล้หมด',
      importance: Importance.high,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
      vibrationPattern: Int64List.fromList([0, 250, 250, 250]),
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notifications.show(
      customer.id,
      '$emoji แจ้งเตือนเวลาใกล้หมด!',
      '${customer.name} (${customer.room}) เหลือเวลาอีก $minutesLeft นาที',
      details,
      payload: 'customer_${customer.id}',
    );
  }

  Future<void> _showExpiredNotification(Customer customer) async {
    const androidDetails = AndroidNotificationDetails(
      'expired_channel',
      'Expired Notifications',
      channelDescription: 'แจ้งเตือนเมื่อหมดเวลา',
      importance: Importance.max,
      priority: Priority.max,
      playSound: true,
      enableVibration: true,
      vibrationPattern: Int64List.fromList([0, 500, 200, 500]),
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notifications.show(
      customer.id + 10000,
      '🔴 เวลาหมดแล้ว!',
      '${customer.name} (${customer.room}) หมดเวลาแล้ว กรุณาตรวจสอบ',
      details,
      payload: 'expired_${customer.id}',
    );
  }

  void _cleanupOldNotifications() {
    // ล้างการแจ้งเตือนที่เก็บไว้เกิน 1000 รายการ
    if (_sentNotifications.length > 1000) {
      _sentNotifications.clear();
    }
  }

  Future<void> cancelAll() async {
    await _notifications.cancelAll();
    _sentNotifications.clear();
  }
}
