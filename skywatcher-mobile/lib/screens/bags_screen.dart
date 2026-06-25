import 'dart:async';
import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import 'bag_journey_screen.dart';
import 'scan_screen.dart';

/// Searchable list of every bag. Tap a row to see its checkpoint journey.
class BagsScreen extends StatefulWidget {
  final SkyWatcherApi api;
  final VoidCallback onLogout;
  const BagsScreen({super.key, required this.api, required this.onLogout});

  @override
  State<BagsScreen> createState() => _BagsScreenState();
}

class _BagsScreenState extends State<BagsScreen> {
  List<dynamic> _bags = [];
  bool _loading = true;
  String? _error;
  String _query = '';
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer =
        Timer.periodic(const Duration(seconds: 5), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _logout() async {
    await widget.api.logout();
    widget.onLogout();
  }

  Future<void> _openScanner() async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ScanScreen(api: widget.api, bags: _bags),
    ));
    if (mounted) _load(silent: true); // reflect any scan made while away
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() { _loading = true; _error = null; });
    try {
      final bags = await widget.api.getBags();
      if (!mounted) return;
      setState(() {
        _bags = bags;
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

  List<dynamic> get _filtered {
    if (_query.trim().isEmpty) return _bags;
    final q = _query.toLowerCase();
    return _bags.where((b) {
      final m = b as Map<String, dynamic>;
      return (m['tag_id'] ?? '').toString().toLowerCase().contains(q) ||
          (m['passenger'] ?? '').toString().toLowerCase().contains(q) ||
          (m['flight_id'] ?? '').toString().toLowerCase().contains(q) ||
          (m['status'] ?? '').toString().toLowerCase().contains(q) ||
          (m['last_checkpoint'] ?? '').toString().toLowerCase().contains(q);
    }).toList();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => _load(silent: true),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text('All bags',
                        style:
                            TextStyle(color: AppColors.muted, fontSize: 15)),
                  ),
                  _circleButton(Icons.qr_code_scanner_rounded, _openScanner,
                      'Scan bag tag'),
                  const SizedBox(width: 10),
                  _circleButton(Icons.logout_rounded, _logout, 'Sign out'),
                ],
              ),
              const SizedBox(height: 2),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('${_bags.length}',
                      style: const TextStyle(
                          fontSize: 40,
                          fontWeight: FontWeight.w800,
                          height: 1.0,
                          color: AppColors.text)),
                  const SizedBox(width: 8),
                  const Padding(
                    padding: EdgeInsets.only(bottom: 6),
                    child: Text('bags tracked',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppColors.text)),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                onChanged: (v) => setState(() => _query = v),
                decoration: const InputDecoration(
                  hintText: 'Search tag, passenger, flight…',
                  prefixIcon: Icon(Icons.search_rounded),
                ),
              ),
              const SizedBox(height: 16),
              ..._buildList(),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildList() {
    if (_loading) {
      return const [
        Padding(
          padding: EdgeInsets.only(top: 80),
          child: Center(child: CircularProgressIndicator()),
        )
      ];
    }
    if (_error != null) {
      return [
        Padding(
          padding: const EdgeInsets.only(top: 40),
          child: SoftCard(
            padding: const EdgeInsets.all(28),
            child: Column(children: [
              const Icon(Icons.cloud_off_rounded,
                  size: 44, color: AppColors.muted),
              const SizedBox(height: 14),
              const Text('Could not reach the server',
                  style:
                      TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style:
                      const TextStyle(color: AppColors.muted, fontSize: 13.5)),
              const SizedBox(height: 18),
              FilledButton(
                  onPressed: () => _load(), child: const Text('Retry')),
            ]),
          ),
        ),
      ];
    }
    final bags = _filtered;
    if (bags.isEmpty) {
      return [
        Padding(
          padding: const EdgeInsets.only(top: 40),
          child: SoftCard(
            padding: const EdgeInsets.all(28),
            child: Column(children: const [
              Icon(Icons.luggage_rounded, size: 44, color: AppColors.muted),
              SizedBox(height: 14),
              Text('No bags match',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              SizedBox(height: 6),
              Text('Try a different search.',
                  style: TextStyle(color: AppColors.muted, fontSize: 13.5)),
            ]),
          ),
        ),
      ];
    }
    return bags.map((b) => _bagCard(b as Map<String, dynamic>)).toList();
  }

  Widget _bagCard(Map<String, dynamic> b) {
    final tag = (b['tag_id'] ?? '?').toString();
    final cp = b['last_checkpoint']?.toString();
    final cpColor = checkpointColor(cp);
    final progress = checkpointProgress(cp);
    final pct = (progress * 100).round();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SoftCard(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => BagJourneyScreen(
            api: widget.api,
            tagId: tag,
            passenger: (b['passenger'] ?? '').toString(),
            flightId: (b['flight_id'] ?? '').toString(),
            status: b['status']?.toString(),
            carousel: b['carousel']?.toString(),
          ),
        )),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: cpColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(Icons.luggage_rounded, color: cpColor, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(tag,
                          style: const TextStyle(
                              fontSize: 15.5, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(
                        '${b['passenger'] ?? 'Unknown'} · ✈ ${b['flight_id'] ?? '—'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: AppColors.muted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded,
                    color: AppColors.muted),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                DotChip(label: checkpointLabel(cp), color: cpColor, filled: true),
                const Spacer(),
                Text('$pct%',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text)),
              ],
            ),
            const SizedBox(height: 8),
            MiniProgress(value: progress, color: cpColor),
          ],
        ),
      ),
    );
  }
}
