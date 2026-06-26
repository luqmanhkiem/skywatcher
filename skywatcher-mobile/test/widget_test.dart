// Smoke test: the app boots to the login screen when no token is stored.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:skywatcher_mobile/main.dart';

void main() {
  testWidgets('App boots to the SkyWatcher login screen', (tester) async {
    // No stored token → app should land on the login screen.
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const SkyWatcherApp());
    await tester.pumpAndSettle();

    // Login screen shows the brand title and a Sign in button.
    expect(find.text('SkyWatcher'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Sign in'), findsOneWidget);
  });
}
