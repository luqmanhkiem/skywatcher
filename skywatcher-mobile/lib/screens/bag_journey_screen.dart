import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

/// Bag detail: FSM status, a "Register scan" control, operator actions, the
/// state-transition trail, and the visual checkpoint journey (check_in →
/// arrival). The mobile counterpart of the dashboard's BagHistoryModal.
class BagJourneyScreen extends StatefulWidget {
  final SkyWatcherApi api;
  final String tagId;
  final String passenger;
  final String flightId;
  final String? status;
  final String? carousel;
  final bool autoScan;
  const BagJourneyScreen({
    super.key,
    required this.api,
    required this.tagId,
    required this.passenger,
    required this.flightId,
    this.status,
    this.carousel,
    this.autoScan = false,
  });

  @override
  State<BagJourneyScreen> createState() => _BagJourneyScreenState();
}

class _BagJourneyScreenState extends State<BagJourneyScreen> {
  List<dynamic> _events = [];
  List<dynamic> _transitions = [];
  bool _loading = true;
  String? _error;
  String? _currentStatus;
  String? _carousel;
  String? _selectedCp;
  bool _busy = false; // a scan / action is in flight

  @override
  void initState() {
    super.initState();
    _currentStatus = widget.status;
    _carousel = widget.carousel;
    _load().then((_) {
      if (widget.autoScan && mounted) {
        _toast('Pick a checkpoint, then Register scan');
      }
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final events = await widget.api.getBagHistory(widget.tagId);
      if (!mounted) return;
      List<dynamic> transitions = [];
      try {
        transitions = await widget.api.getBagStatusHistory(widget.tagId);
      } catch (_) {
        // Backend not yet restarted or bag has no status history — show empty trail
      }
      if (!mounted) return;
      setState(() {
        _events = events;
        _transitions = transitions;
        _currentStatus = transitions.isNotEmpty
            ? (transitions.last as Map<String, dynamic>)['to_status']?.toString()
            : (_currentStatus ?? widget.status);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  void _toast(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: error ? AppColors.wrongRoute : AppColors.text,
      ));
  }

  Future<void> _registerScan() async {
    if (_selectedCp == null || _busy) return;
    setState(() => _busy = true);
    try {
      final res = await widget.api.registerScan(
        widget.tagId, _selectedCp!,
      );
      final anomaly = res['anomaly'] as Map<String, dynamic>?;
      final status  = res['status']?.toString() ?? '?';
      _toast(
        anomaly != null
            ? 'Flagged: $status (${anomaly['type']})'
            : 'Status → $status',
        error: anomaly != null,
      );
      _selectedCp = null;
      await _load();
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _runAction(OperatorAction action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final res = await widget.api.bagAction(widget.tagId, action.key);
      _toast('${res['from_status']} → ${res['status']}');
      await _load();
    } catch (e) {
      _toast(e.toString().replaceFirst('Exception: ', ''), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Latest event per checkpoint (events come ordered ascending by timestamp).
  Map<String, Map<String, dynamic>> get _byCheckpoint {
    final map = <String, Map<String, dynamic>>{};
    for (final e in _events) {
      final m = e as Map<String, dynamic>;
      final cp = (m['checkpoint'] ?? '').toString();
      if (cp.isNotEmpty) map[cp] = m;
    }
    return map;
  }

  String _fmtTime(String? ts) {
    if (ts == null) return '';
    final dt = DateTime.tryParse(ts);
    if (dt == null) return ts;
    final l = dt.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(l.day)}/${two(l.month)} · ${two(l.hour)}:${two(l.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.tagId)),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(onRefresh: _load, child: _buildBody()),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return ListView(children: [
        Padding(
          padding: const EdgeInsets.all(20),
          child: SoftCard(
            padding: const EdgeInsets.all(28),
            child: Column(children: [
              const Icon(Icons.cloud_off_rounded,
                  size: 44, color: AppColors.muted),
              const SizedBox(height: 14),
              const Text('Could not load journey',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.muted, fontSize: 13.5)),
              const SizedBox(height: 18),
              FilledButton(onPressed: _load, child: const Text('Retry')),
            ]),
          ),
        ),
      ]);
    }

    final visited = _byCheckpoint;
    int reachedIdx = -1;
    for (var i = 0; i < kCheckpointFlow.length; i++) {
      if (visited.containsKey(kCheckpointFlow[i])) reachedIdx = i;
    }
    final progress = (reachedIdx + 1) / kCheckpointFlow.length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
      children: [
        _header(progress, reachedIdx),
        const SizedBox(height: 16),
        _registerScanCard(),
        const SizedBox(height: 16),
        _actionsCard(),
        const SizedBox(height: 20),
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 12),
          child: Text('Checkpoint journey',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        ),
        SoftCard(
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 6),
          child: Column(
            children: [
              for (var i = 0; i < kCheckpointFlow.length; i++)
                _step(
                  i,
                  done: visited.containsKey(kCheckpointFlow[i]),
                  isCurrent: i == reachedIdx,
                  isLast: i == kCheckpointFlow.length - 1,
                  event: visited[kCheckpointFlow[i]],
                ),
            ],
          ),
        ),
        if (_transitions.isNotEmpty) ...[
          const SizedBox(height: 20),
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 12),
            child: Text('Status history',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          ),
          _transitionsCard(),
        ],
      ],
    );
  }

  Widget _header(double progress, int reachedIdx) {
    final pct = (progress * 100).round();
    final current =
        reachedIdx >= 0 ? checkpointLabel(kCheckpointFlow[reachedIdx]) : '—';
    return SoftCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                    widget.passenger.isEmpty
                        ? 'Unknown passenger'
                        : widget.passenger,
                    style: const TextStyle(
                        fontSize: 19, fontWeight: FontWeight.w800)),
              ),
              if (_currentStatus != null)
                DotChip(
                  label: bagStatusLabel(_currentStatus),
                  color: bagStatusColor(_currentStatus),
                  filled: true,
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.flight_rounded, size: 15, color: AppColors.muted),
            const SizedBox(width: 6),
            Text(widget.flightId.isEmpty ? '—' : widget.flightId,
                style: const TextStyle(color: AppColors.muted, fontSize: 13.5)),
            const SizedBox(width: 16),
            const Icon(Icons.tag_rounded, size: 15, color: AppColors.muted),
            const SizedBox(width: 4),
            Text(widget.tagId,
                style: const TextStyle(color: AppColors.muted, fontSize: 13.5)),
          ]),
          const SizedBox(height: 18),
          Row(
            children: [
              const Text('Progress',
                  style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.muted)),
              const Spacer(),
              Text('$current · $pct%',
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 8),
          MiniProgress(value: progress),
          if (_currentStatus?.toUpperCase() == 'ARRIVED' && _carousel != null) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              decoration: BoxDecoration(
                color: const Color(0xFF15803D),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                const Text('🛄', style: TextStyle(fontSize: 24)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Bag arrived — collect at',
                          style: TextStyle(
                              color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600)),
                      Text('Belt $_carousel',
                          style: const TextStyle(
                              color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
              ]),
            ),
          ],
        ],
      ),
    );
  }

  Widget _registerScanCard() {
    return SoftCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Register scan',
              style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final cp in kCheckpointFlow.where((c) => c != 'check_in'))
                ChoiceChip(
                  label: Text(checkpointLabel(cp)),
                  selected: _selectedCp == cp,
                  showCheckmark: false,
                  onSelected: _busy
                      ? null
                      : (_) => setState(() => _selectedCp = cp),
                  selectedColor: checkpointColor(cp).withValues(alpha: 0.16),
                  backgroundColor: AppColors.bg,
                  labelStyle: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _selectedCp == cp
                        ? checkpointColor(cp)
                        : AppColors.text,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(
                      color: _selectedCp == cp
                          ? checkpointColor(cp)
                          : AppColors.line,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: (_selectedCp == null || _busy) ? null : _registerScan,
              icon: const Icon(Icons.qr_code_scanner_rounded, size: 18),
              label: Text(_busy ? 'Working…' : 'Register scan'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionsCard() {
    final actions = actionsFor(_currentStatus);
    return SoftCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Operator actions',
              style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          if (actions.isEmpty)
            const Text('No actions available from this status.',
                style: TextStyle(color: AppColors.muted, fontSize: 13.5))
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final a in actions)
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _runAction(a),
                    icon: Icon(a.icon, size: 17, color: a.color),
                    label: Text(a.label),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: a.color,
                      side: BorderSide(color: a.color.withValues(alpha: 0.4)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _transitionsCard() {
    return SoftCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Column(
        children: [
          for (var i = 0; i < _transitions.length; i++)
            _transitionRow(_transitions[i] as Map<String, dynamic>,
                isLast: i == _transitions.length - 1),
        ],
      ),
    );
  }

  Widget _transitionRow(Map<String, dynamic> t, {required bool isLast}) {
    final from = t['from_status']?.toString();
    final to = t['to_status']?.toString();
    final trigger = t['trigger']?.toString() ?? '';
    final actor = t['actor']?.toString();
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(from == null ? 'NEW' : bagStatusLabel(from),
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: bagStatusColor(from))),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 6),
                      child: Icon(Icons.arrow_forward_rounded,
                          size: 14, color: AppColors.muted),
                    ),
                    Text(bagStatusLabel(to),
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: bagStatusColor(to))),
                  ],
                ),
                const SizedBox(height: 2),
                Text('$trigger${actor != null ? ' · $actor' : ''}',
                    style:
                        const TextStyle(color: AppColors.muted, fontSize: 12)),
              ],
            ),
          ),
          Text(_fmtTime(t['created_at']?.toString()),
              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _step(
    int i, {
    required bool done,
    required bool isCurrent,
    required bool isLast,
    Map<String, dynamic>? event,
  }) {
    final cp = kCheckpointFlow[i];
    final color = checkpointColor(cp);
    final dotColor = done ? color : AppColors.line;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: done ? color : AppColors.surface,
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: done ? color : AppColors.line, width: 2),
                  boxShadow: isCurrent
                      ? [
                          BoxShadow(
                              color: color.withValues(alpha: 0.35),
                              blurRadius: 10,
                              spreadRadius: 1)
                        ]
                      : null,
                ),
                child: Icon(
                  done ? Icons.check_rounded : Icons.circle_outlined,
                  size: 16,
                  color: done ? Colors.white : AppColors.muted,
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2.5,
                    color: dotColor.withValues(alpha: done ? 0.4 : 1),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 22, top: 3),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        checkpointLabel(cp),
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: done ? AppColors.text : AppColors.muted,
                        ),
                      ),
                      if (isCurrent) ...[
                        const SizedBox(width: 8),
                        const DotChip(
                            label: 'Current',
                            color: AppColors.primary,
                            filled: true),
                      ],
                    ],
                  ),
                  if (event != null) ...[
                    const SizedBox(height: 4),
                    Text(_fmtTime(event['timestamp']?.toString()),
                        style: const TextStyle(
                            color: AppColors.muted, fontSize: 12.5)),
                    if (event['duration_mins'] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          '${(event['duration_mins'] as num).toStringAsFixed(1)} min at checkpoint',
                          style: const TextStyle(
                              color: AppColors.muted, fontSize: 12.5),
                        ),
                      ),
                  ] else
                    const Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text('Pending',
                          style: TextStyle(
                              color: AppColors.muted, fontSize: 12.5)),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
