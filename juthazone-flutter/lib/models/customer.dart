class Customer {
  final int id;
  final String name;
  final String room;
  final String? phone;
  final DateTime startTime;
  final DateTime? expectedEndTime;
  final DateTime? actualEndTime;
  final int durationMinutes;
  final double cost;
  final bool isPaid;
  final bool isActive;
  final String? paymentMethod;
  final String? staffName;
  final DateTime createdAt;
  final DateTime updatedAt;

  Customer({
    required this.id,
    required this.name,
    required this.room,
    this.phone,
    required this.startTime,
    this.expectedEndTime,
    this.actualEndTime,
    required this.durationMinutes,
    required this.cost,
    this.isPaid = false,
    this.isActive = true,
    this.paymentMethod,
    this.staffName,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Customer.fromJson(Map<String, dynamic> json) {
    return Customer(
      id: json['id'] as int,
      name: json['name'] as String,
      room: json['room'] as String,
      phone: json['phone'] as String?,
      startTime: DateTime.parse(json['start_time'] as String),
      expectedEndTime: json['expected_end_time'] != null
          ? DateTime.parse(json['expected_end_time'] as String)
          : null,
      actualEndTime: json['actual_end_time'] != null
          ? DateTime.parse(json['actual_end_time'] as String)
          : null,
      durationMinutes: json['duration_minutes'] as int,
      cost: (json['cost'] as num).toDouble(),
      isPaid: json['is_paid'] as bool? ?? false,
      isActive: json['is_active'] as bool? ?? true,
      paymentMethod: json['payment_method'] as String?,
      staffName: json['staff_name'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'room': room,
      'phone': phone,
      'start_time': startTime.toIso8601String(),
      'expected_end_time': expectedEndTime?.toIso8601String(),
      'actual_end_time': actualEndTime?.toIso8601String(),
      'duration_minutes': durationMinutes,
      'cost': cost,
      'is_paid': isPaid,
      'is_active': isActive,
      'payment_method': paymentMethod,
      'staff_name': staffName,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  Customer copyWith({
    int? id,
    String? name,
    String? room,
    String? phone,
    DateTime? startTime,
    DateTime? expectedEndTime,
    DateTime? actualEndTime,
    int? durationMinutes,
    double? cost,
    bool? isPaid,
    bool? isActive,
    String? paymentMethod,
    String? staffName,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Customer(
      id: id ?? this.id,
      name: name ?? this.name,
      room: room ?? this.room,
      phone: phone ?? this.phone,
      startTime: startTime ?? this.startTime,
      expectedEndTime: expectedEndTime ?? this.expectedEndTime,
      actualEndTime: actualEndTime ?? this.actualEndTime,
      durationMinutes: durationMinutes ?? this.durationMinutes,
      cost: cost ?? this.cost,
      isPaid: isPaid ?? this.isPaid,
      isActive: isActive ?? this.isActive,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      staffName: staffName ?? this.staffName,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  int get timeLeftSeconds {
    if (expectedEndTime == null) return 0;
    final diff = expectedEndTime!.difference(DateTime.now());
    return diff.inSeconds > 0 ? diff.inSeconds : 0;
  }

  int get minutesLeft => (timeLeftSeconds / 60).floor();

  bool get isExpired => timeLeftSeconds == 0;

  double get progressPercentage {
    if (expectedEndTime == null) return 0;
    final totalDuration = expectedEndTime!.difference(startTime).inSeconds;
    final elapsed = DateTime.now().difference(startTime).inSeconds;
    if (totalDuration == 0) return 100;
    return ((elapsed / totalDuration) * 100).clamp(0, 100);
  }
}
