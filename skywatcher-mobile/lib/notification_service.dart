import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Thin wrapper over flutter_local_notifications.
///
/// We don't use a remote push server (no Apple Developer account / FCM needed
/// for the FYP). Instead the app polls /api/alerts every few seconds and fires a
/// *local* notification whenever a brand-new anomaly appears - this buzzes the
/// phone and updates the badge exactly like remote push would, at zero cost.
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  bool _ready = false;

  /// Initialise the plugin and request OS permission. Safe to call repeatedly.
  Future<void> init() async {
    if (_ready) return;

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    await _plugin.initialize(
      const InitializationSettings(android: android, iOS: ios),
    );

    // Android 13+ explicit permission request
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();

    // iOS: v17+ requires an explicit requestPermissions() call in addition to
    // the DarwinInitializationSettings flags - without this iOS never shows banners.
    await _plugin
        .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(alert: true, badge: true, sound: true);

    _ready = true;
  }

  /// Show one anomaly notification. [id] should be the anomaly's DB id so the
  /// same alert never double-notifies.
  Future<void> showAnomaly({
    required int id,
    required String type,
    required String tagId,
    required String checkpoint,
  }) async {
    if (!_ready) await init();

    final title = '⚠️ ${type.replaceAll('_', ' ')}';
    final body = 'Bag $tagId · $checkpoint';

    const android = AndroidNotificationDetails(
      'anomalies',
      'Anomaly alerts',
      channelDescription: 'Real-time baggage anomaly alerts',
      importance: Importance.max,
      priority: Priority.high,
      color: Color(0xFFF5A623),
    );
    const ios = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    await _plugin.show(
      id,
      title,
      body,
      const NotificationDetails(android: android, iOS: ios),
    );
  }
}
