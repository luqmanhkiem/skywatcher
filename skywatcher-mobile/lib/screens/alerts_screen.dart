import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../notification_service.dart';

/// Live anomaly alerts — the core ground-staff screen.
/// Polls every 5s, supports pull-to-refresh, fires local notifications on new
/// anomalies, and lets staff resolve alerts.
class AlertsScreen extends StatefulWidget {
  final SkyWatcherApi api;
  final VoidCallback onLogout;
  final ValueChanged<int>? onUnresolvedChanged;
  const AlertsScreen({super.key, required this.api, required this.onLogout, this.onUnresolvedChanged});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

enum _Filter { all, open, resolved }

class _AlertsScreenState extends State<AlertsScreen> {
  List<dynamic> _alerts = [];
  int _unresolved = 0;
  bool _loading = true;
  String? _error;
  final Set<int> _resolving = {};
  Timer? _timer;
  _Filter _filter = _Filter.all;

  // Anomaly ids we've already seen — used to notify only on genuinely NEW ones.
  final Set<int> _seenIds = {};
  bool _seeded = false;

  @override
  void initState() {
    super.initState();
    NotificationService.instance.init();
    _load();
    _timer =
        Timer.periodic(const Duration(seconds: 5), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Fire a local notification for every unresolved anomaly we haven't seen yet.
  /// The first successful load just seeds [_seenIds] (no notifications).
  void _notifyNewAnomalies(List<dynamic> alerts) {
    if (!_seeded) {
      for (final a in alerts) {
        final id = a['id'];
        if (id is int) _seenIds.add(id);
      }
      _seeded = true;
      return;
    }
    for (final a in alerts) {
      final id = a['id'];
      if (id is! int || _seenIds.contains(id)) continue;
      _seenIds.add(id);
      final resolved = a['resolved'] == true || a['resolved'] == 1;
      if (resolved) continue;
      NotificationService.instance.showAnomaly(
        id: id,
        type: (a['type'] ?? 'ANOMALY').toString(),
        tagId: (a['tag_id'] ?? '?').toString(),
        checkpoint: (a['checkpoint'] ?? 'unknown').toString(),
      );
    }
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() { _loading = true; _error = null; });
    try {
      final data = await widget.api.getAlerts(limit: 100);
      if (!mounted) return;
      final alerts = (data['alerts'] as List?) ?? [];
      _notifyNewAnomalies(alerts);
      final unresolved = (data['unresolved'] as int?) ?? 0;
      widget.onUnresolvedChanged?.call(unresolved);
      setState(() {
        _alerts = alerts;
        _unresolved = unresolved;
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

  bool _isResolved(dynamic a) => a['resolved'] == true || a['resolved'] == 1;

  List<dynamic> get _filtered {
    switch (_filter) {
      case _Filter.open:
        return _alerts.where((a) => !_isResolved(a)).toList();
      case _Filter.resolved:
        return _alerts.where((a) => _isResolved(a)).toList();
      case _Filter.all:
        return _alerts;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => _load(silent: true),
          child: _buildBody(),
        ),
      ),
    );
  }

  Widget _header() {
    final resolvedCount = _alerts.where(_isResolved).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                widget.api.user != null
                    ? 'Welcome, ${widget.api.user!['name'] ?? widget.api.user!['username'] ?? 'Operator'}'
                    : 'Live alerts',
                style: const TextStyle(color: AppColors.muted, fontSize: 15),
              ),
            ),
            _circleButton(Icons.logout_rounded, _logout, 'Sign out'),
          ],
        ),
        const SizedBox(height: 2),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('$_unresolved',
                style: const TextStyle(
                    fontSize: 40,
                    fontWeight: FontWeight.w800,
                    height: 1.0,
                    color: AppColors.text)),
            const SizedBox(width: 8),
            const Padding(
              padding: EdgeInsets.only(bottom: 6),
              child: Text('open',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: AppColors.text)),
            ),
            const Spacer(),
            if (_unresolved == 0 && _alerts.isNotEmpty)
              const DotChip(
                  label: 'All clear', color: AppColors.success, filled: true),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            _filterPill('All', _alerts.length, _Filter.all),
            const SizedBox(width: 8),
            _filterPill('Open', _unresolved, _Filter.open),
            const SizedBox(width: 8),
            _filterPill('Resolved', resolvedCount, _Filter.resolved),
          ],
        ),
      ],
    );
  }

  Widget _filterPill(String label, int count, _Filter f) {
    final active = _filter == f;
    return GestureDetector(
      onTap: () => setState(() => _filter = f),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: active ? null : kCardShadow,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label,
                style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13.5,
                    color: active ? Colors.white : AppColors.text)),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
              decoration: BoxDecoration(
                color: active
                    ? Colors.white.withValues(alpha: 0.22)
                    : AppColors.bg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('$count',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: active ? Colors.white : AppColors.muted)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _circleButton(IconData icon, VoidCallback onTap, String tip) {
    return Tooltip(
      message: tip,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.surface,
            shape: BoxShape.circle,
            boxShadow: kCardShadow,
          ),
          child: Icon(icon, size: 20, color: AppColors.text),
        ),
      ),
    );
  }

  Widget _buildBody() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      children: [
        _header(),
        const SizedBox(height: 18),
        if (_loading)
          const Padding(
            padding: EdgeInsets.only(top: 80),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_error != null)
          _stateCard(
            icon: Icons.cloud_off_rounded,
            title: 'Could not reach the server',
            subtitle: _error!,
            action: FilledButton(
                onPressed: () => _load(), child: const Text('Retry')),
          )
        else if (_filtered.isEmpty)
          _stateCard(
            icon: Icons.check_circle_outline_rounded,
            title: 'Nothing here',
            subtitle: _filter == _Filter.all
                ? 'No alerts yet. All clear ✈️'
                : 'No ${_filter.name} alerts.',
          )
        else
          ..._filtered.map(_alertCard),
      ],
    );
  }

  Widget _stateCard({
    required IconData icon,
    required String title,
    required String subtitle,
    Widget? action,
  }) {
    return Padding(
      padding: const EdgeInsets.only(top: 40),
      child: SoftCard(
        padding: const EdgeInsets.all(28),
        child: Column(
          children: [
            Icon(icon, size: 44, color: AppColors.muted),
            const SizedBox(height: 14),
            Text(title,
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(subtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, fontSize: 13.5)),
            if (action != null) ...[const SizedBox(height: 18), action],
          ],
        ),
      ),
    );
  }

  Widget _alertCard(dynamic a) {
    final type = (a['type'] ?? 'ANOMALY').toString();
    final color = AppColors.anomaly(type);
    final resolved = _isResolved(a);
    final id = a['id'] as int;
    final tag = (a['tag_id'] ?? '?').toString();
    final cp = (a['checkpoint'] ?? 'unknown').toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SoftCard(
        padding: EdgeInsets.zero,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Type accent stripe
              Container(width: 5, color: color),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(Icons.warning_amber_rounded,
                                color: color, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(type.replaceAll('_', ' '),
                                    style: const TextStyle(
                                        fontSize: 15.5,
                                        fontWeight: FontWeight.w700)),
                                const SizedBox(height: 2),
                                Text('Bag $tag',
                                    style: const TextStyle(
                                        color: AppColors.muted,
                                        fontSize: 13)),
                              ],
                            ),
                          ),
                          if (resolved)
                            const DotChip(
                                label: 'Resolved',
                                color: AppColors.success,
                                filled: true),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          DotChip(
                              label: checkpointLabel(cp),
                              color: checkpointColor(cp),
                              filled: true),
                          const Spacer(),
                          if (!resolved)
                            _resolving.contains(id)
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))
                                : TextButton.icon(
                                    onPressed: () => _resolve(id),
                                    icon: const Icon(Icons.check_rounded,
                                        size: 18),
                                    label: const Text('Resolve'),
                                    style: TextButton.styleFrom(
                                      foregroundColor: AppColors.text,
                                      backgroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 14, vertical: 8),
                                      shape: RoundedRectangleBorder(
                                        borderRadius:
                                            BorderRadius.circular(12),
                                        side: const BorderSide(
                                            color: AppColors.line),
                                      ),
                                    ),
                                  ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
