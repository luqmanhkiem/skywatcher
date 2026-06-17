import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';

/// Live anomaly alerts — the core ground-staff screen.
/// Polls every 5s, supports pull-to-refresh, and lets staff resolve alerts.
class AlertsScreen extends StatefulWidget {
  final SkyWatcherApi api;
  final VoidCallback onLogout;
  const AlertsScreen({super.key, required this.api, required this.onLogout});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  List<dynamic> _alerts = [];
  int _unresolved = 0;
  bool _loading = true;
  String? _error;
  final Set<int> _resolving = {};
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() { _loading = true; _error = null; });
    try {
      final data = await widget.api.getAlerts(limit: 100);
      if (!mounted) return;
      setState(() {
        _alerts = (data['alerts'] as List?) ?? [];
        _unresolved = (data['unresolved'] as int?) ?? 0;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _resolve(int id) async {
    setState(() => _resolving.add(id));
    try {
      await widget.api.resolveAlert(id);
      await _load(silent: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _resolving.remove(id));
    }
  }

  Future<void> _logout() async {
    await widget.api.logout();
    widget.onLogout();
  }

  Color _typeColor(String type) {
    switch (type) {
      case 'SECURITY_BYPASS':
        return const Color(0xFFA78BFA);
      case 'WRONG_ROUTE':
        return const Color(0xFFFF3355);
      case 'STALL':
        return const Color(0xFFFF7A2F);
      default:
        return const Color(0xFFF5A623);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Alerts · $_unresolved open'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: _logout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(silent: true),
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return ListView(
        children: [
          Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              children: [
                const Icon(Icons.cloud_off, size: 40, color: Colors.grey),
                const SizedBox(height: 12),
                Text('Could not reach the server.\n$_error',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.grey)),
                const SizedBox(height: 16),
                FilledButton(onPressed: () => _load(), child: const Text('Retry')),
              ],
            ),
          ),
        ],
      );
    }
    if (_alerts.isEmpty) {
      return ListView(
        children: const [
          Padding(
            padding: EdgeInsets.all(60),
            child: Center(child: Text('No alerts. All clear ✈️')),
          ),
        ],
      );
    }
    return ListView.separated(
      itemCount: _alerts.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final a = _alerts[i] as Map<String, dynamic>;
        final type = (a['type'] ?? 'ANOMALY').toString();
        final resolved = a['resolved'] == true || a['resolved'] == 1;
        final id = a['id'] as int;
        return ListTile(
          leading: CircleAvatar(
            backgroundColor: _typeColor(type).withOpacity(0.18),
            child: Icon(Icons.warning_amber_rounded,
                color: _typeColor(type), size: 20),
          ),
          title: Text(type.replaceAll('_', ' '),
              style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(
              'Tag ${a['tag_id'] ?? '?'}  ·  ${a['checkpoint'] ?? 'unknown'}'),
          trailing: resolved
              ? const Chip(
                  label: Text('Resolved'),
                  visualDensity: VisualDensity.compact,
                )
              : _resolving.contains(id)
                  ? const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : TextButton(
                      onPressed: () => _resolve(id),
                      child: const Text('Resolve'),
                    ),
        );
      },
    );
  }
}
