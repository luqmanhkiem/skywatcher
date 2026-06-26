import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

const _checkpoints = ['check_in', 'security', 'sorting', 'loading', 'arrival'];
const _cpLabels = {
  'check_in': 'Check-In',
  'security': 'Security',
  'sorting': 'Sorting',
  'loading': 'Loading',
  'arrival': 'Arrival',
};
const _levels = ['operational', 'degraded', 'down'];
const _levelLabels = {
  'operational': 'Operational',
  'degraded': 'Degraded',
  'down': 'Down',
};
const _levelColors = {
  'operational': Color(0xFF00CC7D),
  'degraded': Color(0xFFF59E0B),
  'down': Color(0xFFEF4444),
};

class AdvisoriesScreen extends StatefulWidget {
  final SkyWatcherApi api;
  const AdvisoriesScreen({super.key, required this.api});

  @override
  State<AdvisoriesScreen> createState() => _AdvisoriesScreenState();
}

class _AdvisoriesScreenState extends State<AdvisoriesScreen> {
  List<dynamic> _advisories = [];
  bool _loading = true;
  String? _error;

  // Request form state
  String _cp = _checkpoints[0];
  String _level = 'degraded';
  final _msgCtrl = TextEditingController();
  bool _submitting = false;
  String? _formMsg;
  bool _formOk = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final list = await widget.api.getAdvisories();
      if (!mounted) return;
      setState(() { _advisories = list; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString().replaceFirst('Exception: ', ''); _loading = false; });
    }
  }

  Future<void> _submit() async {
    setState(() { _submitting = true; _formMsg = null; _formOk = false; });
    try {
      await widget.api.requestAdvisory(
        checkpoint: _cp,
        level: _level,
        message: _msgCtrl.text.trim().isEmpty ? null : _msgCtrl.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _formOk = true;
        _formMsg = 'Request submitted — awaiting admin approval.';
        _msgCtrl.clear();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _formOk = false;
        _formMsg = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Map<String, dynamic> _byCp() {
    return Map.fromEntries(
      _advisories.map((a) => MapEntry(a['checkpoint'] as String, a)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
                  : _error != null
                      ? _buildError()
                      : _buildBody(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Advisories', style: TextStyle(
                  fontFamily: 'Rajdhani', fontSize: 22,
                  fontWeight: FontWeight.w700, color: AppColors.text,
                )),
                SizedBox(height: 2),
                Text('Request a checkpoint status change', style: TextStyle(
                  fontSize: 13, color: AppColors.muted,
                )),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.muted),
            onPressed: _load,
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.wifi_off_rounded, color: AppColors.muted, size: 40),
          const SizedBox(height: 12),
          Text(_error!, textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted, fontSize: 13)),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: _load, child: const Text('Retry')),
        ]),
      ),
    );
  }

  Widget _buildBody() {
    return RefreshIndicator(
      onRefresh: _load,
      color: AppColors.accent,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildCurrentStatus(),
          const SizedBox(height: 20),
          _buildRequestForm(),
        ],
      ),
    );
  }

  Widget _buildCurrentStatus() {
    final byCp = _byCp();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionLabel('Current Status'),
        const SizedBox(height: 10),
        ...(_checkpoints.map((cp) {
          final row = byCp[cp];
          final level = (row?['level'] as String?) ?? 'operational';
          final color = _levelColors[level] ?? AppColors.muted;
          final msg = row?['message'] as String?;
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border(left: BorderSide(color: color, width: 3)),
            ),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_cpLabels[cp] ?? cp,
                    style: const TextStyle(fontWeight: FontWeight.w700,
                      fontSize: 14, color: AppColors.text)),
                  if (msg != null && msg.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(msg, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                  ],
                ]),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color.withAlpha(38),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text((_levelLabels[level] ?? level).toUpperCase(),
                  style: TextStyle(fontFamily: 'JetBrainsMono',
                    fontSize: 9, fontWeight: FontWeight.w700, color: color)),
              ),
            ]),
          );
        })),
      ],
    );
  }

  Widget _buildRequestForm() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
        // accent top border
        boxShadow: const [BoxShadow(color: Colors.transparent)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: EdgeInsets.zero,
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.accent, width: 2)),
            ),
          ),
          const SizedBox(height: 12),
          const _SectionLabel('Request Advisory Change'),
          const SizedBox(height: 12),

          // Checkpoint
          const _FieldLabel('Checkpoint'),
          const SizedBox(height: 6),
          _Dropdown(
            value: _cp,
            items: _checkpoints.map((c) => DropdownMenuItem(value: c, child: Text(_cpLabels[c] ?? c))).toList(),
            onChanged: (v) => setState(() => _cp = v!),
          ),
          const SizedBox(height: 12),

          // Level
          const _FieldLabel('Status level'),
          const SizedBox(height: 6),
          _Dropdown(
            value: _level,
            items: _levels.map((l) => DropdownMenuItem(
              value: l,
              child: Row(children: [
                Container(width: 8, height: 8,
                  decoration: BoxDecoration(
                    color: _levelColors[l], shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Text(_levelLabels[l] ?? l),
              ]),
            )).toList(),
            onChanged: (v) => setState(() => _level = v!),
          ),
          const SizedBox(height: 12),

          // Message
          const _FieldLabel('Message (optional)'),
          const SizedBox(height: 6),
          TextField(
            controller: _msgCtrl,
            style: const TextStyle(color: AppColors.text, fontSize: 13),
            maxLines: 2,
            decoration: InputDecoration(
              hintText: 'e.g. Belt 3 under maintenance',
              hintStyle: const TextStyle(color: AppColors.muted, fontSize: 13),
              filled: true, fillColor: AppColors.bg,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: AppColors.line),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: AppColors.line),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 16),

          if (_formMsg != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: (_formOk ? AppColors.success : const Color(0xFFEF4444)).withAlpha(31),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: (_formOk ? AppColors.success : const Color(0xFFEF4444)).withAlpha(102)),
              ),
              child: Text(_formMsg!,
                style: TextStyle(
                  fontSize: 12,
                  color: _formOk ? AppColors.success : const Color(0xFFEF4444),
                )),
            ),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(width: 14, height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : const Icon(Icons.send_rounded, size: 16),
              label: Text(_submitting ? 'Submitting…' : 'Submit Request'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.accent,
                foregroundColor: Colors.black,
                textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Your request will be reviewed by an admin before taking effect.',
            style: TextStyle(fontSize: 11, color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);
  @override
  Widget build(BuildContext context) => Text(
    text.toUpperCase(),
    style: const TextStyle(
      fontFamily: 'JetBrainsMono', fontSize: 9,
      fontWeight: FontWeight.w600, color: AppColors.muted,
      letterSpacing: 0.14,
    ),
  );
}

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
      color: AppColors.muted, letterSpacing: 0.5),
  );
}

class _Dropdown<T> extends StatelessWidget {
  final T value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
  const _Dropdown({required this.value, required this.items, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      items: items,
      onChanged: onChanged,
      dropdownColor: AppColors.bg,
      style: const TextStyle(color: AppColors.text, fontSize: 13),
      decoration: InputDecoration(
        filled: true, fillColor: AppColors.bg,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
    );
  }
}
