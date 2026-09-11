import 'package:flutter/material.dart';
import 'api.dart';
import 'notification_service.dart';
import 'theme.dart';
import 'screens/login_screen.dart';
import 'screens/alerts_screen.dart';
import 'screens/bags_screen.dart';
import 'screens/advisories_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  NotificationService.instance.init();
  runApp(const SkyWatcherApp());
}

class SkyWatcherApp extends StatelessWidget {
  const SkyWatcherApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SkyWatcher Ops',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
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
      return HomeShell(
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

/// Bottom-nav shell hosting the two ground-ops screens: Alerts and Bags.
class HomeShell extends StatefulWidget {
  final SkyWatcherApi api;
  final VoidCallback onLogout;
  const HomeShell({super.key, required this.api, required this.onLogout});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  int _unresolvedAlerts = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      AlertsScreen(
        api: widget.api,
        onLogout: widget.onLogout,
        onUnresolvedChanged: (n) => setState(() => _unresolvedAlerts = n),
      ),
      BagsScreen(api: widget.api, onLogout: widget.onLogout),
      AdvisoriesScreen(api: widget.api),
    ];
    return Scaffold(
      body: IndexedStack(index: _index, children: screens),
      bottomNavigationBar: _PillNavBar(
        index: _index,
        onTap: (i) => setState(() => _index = i),
        items: const [
          _NavItem(Icons.notifications_rounded, 'Alerts'),
          _NavItem(Icons.luggage_rounded, 'Bags'),
          _NavItem(Icons.campaign_rounded, 'Advisories'),
        ],
        badges: [_unresolvedAlerts, 0, 0],
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final String label;
  const _NavItem(this.icon, this.label);
}

/// Custom bottom nav where the active item is an indigo pill (icon + label),
/// inactive items show just the icon - matching the reference aesthetic.
class _PillNavBar extends StatelessWidget {
  final int index;
  final ValueChanged<int> onTap;
  final List<_NavItem> items;
  final List<int> badges;
  const _PillNavBar({
    required this.index,
    required this.onTap,
    required this.items,
    this.badges = const [],
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(20, 0, 20, 14),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(26),
          boxShadow: kCardShadow,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            for (var i = 0; i < items.length; i++)
              _buildItem(i, items[i], i == index,
                  badge: i < badges.length ? badges[i] : 0),
          ],
        ),
      ),
    );
  }

  Widget _buildItem(int i, _NavItem item, bool active, {int badge = 0}) {
    return Expanded(
      child: GestureDetector(
        onTap: () => onTap(i),
        behavior: HitTestBehavior.opaque,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            padding: const EdgeInsets.symmetric(vertical: 12),
            margin: const EdgeInsets.symmetric(horizontal: 4),
            decoration: BoxDecoration(
              color: active ? AppColors.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(item.icon,
                    size: 22,
                    color: active ? Colors.white : AppColors.muted),
                if (active) ...[
                  const SizedBox(width: 8),
                  Text(item.label,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 14)),
                ],
              ],
            ),
          ),
          // Red badge
          if (badge > 0)
            Positioned(
              top: 6,
              right: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: const BoxDecoration(
                  color: Color(0xFFDC2626),
                  borderRadius: BorderRadius.all(Radius.circular(10)),
                ),
                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                child: Text(
                  badge > 99 ? '99+' : '$badge',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    height: 1.2,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ]),
      ),
    );
  }
}
