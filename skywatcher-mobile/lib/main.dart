import 'package:flutter/material.dart';
import 'api.dart';
import 'screens/login_screen.dart';
import 'screens/alerts_screen.dart';

void main() => runApp(const SkyWatcherApp());

class SkyWatcherApp extends StatelessWidget {
  const SkyWatcherApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SkyWatcher Ops',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFFF5A623), // SkyWatcher amber
      ),
      home: const _Root(),
    );
  }
}

/// Decides between the login screen and the app, based on a stored token.
class _Root extends StatefulWidget {
  const _Root();

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  final _api = SkyWatcherApi();
  bool _loading = true;
  bool _loggedIn = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await _api.loadToken();
    setState(() {
      _loggedIn = _api.hasToken;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_loggedIn) {
      return AlertsScreen(
        api: _api,
        onLogout: () => setState(() => _loggedIn = false),
      );
    }
    return LoginScreen(
      api: _api,
      onLoggedIn: () => setState(() => _loggedIn = true),
    );
  }
}
