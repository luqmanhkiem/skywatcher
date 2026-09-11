import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../api.dart';
import '../theme.dart';
import 'bag_journey_screen.dart';

/// QR scanner - the flagship "real input" path. Scan a printed bag tag (which
/// encodes the public /track URL) or enter a tag id by hand, resolve it to a
/// bag, then open that bag's detail to register a checkpoint scan.
///
/// The iOS Simulator has no camera, so a manual-entry fallback is always offered.
class ScanScreen extends StatefulWidget {
  final SkyWatcherApi api;
  final List<dynamic> bags;
  const ScanScreen({super.key, required this.api, required this.bags});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Resolve a scanned/typed value to a known tag id.
  /// Current bag-tag QR encodes `…/track?ref=<booking_ref>`; older printed tags
  /// encode `…/track?flight=…&passenger=…`. Both are matched against the
  /// loaded bag list, and a plain tag id typed by hand also works.
  String? _resolveTag(String raw) {
    raw = raw.trim();
    if (raw.isEmpty) return null;

    final uri = Uri.tryParse(raw);

    // Current format: ?ref=<booking_ref>
    if (uri != null && uri.queryParameters.containsKey('ref')) {
      final ref = (uri.queryParameters['ref'] ?? '').trim().toLowerCase();
      if (ref.isNotEmpty) {
        for (final b in widget.bags) {
          final m = b as Map<String, dynamic>;
          if ((m['booking_ref'] ?? '').toString().toLowerCase() == ref) {
            return m['tag_id']?.toString();
          }
        }
      }
      return null; // a track URL, but no matching bag is loaded
    }

    // Legacy format: ?flight=…&passenger=…
    if (uri != null &&
        (uri.queryParameters.containsKey('flight') ||
            uri.queryParameters.containsKey('flight_id'))) {
      final flight = (uri.queryParameters['flight'] ??
              uri.queryParameters['flight_id'] ??
              '')
          .toLowerCase();
      final passenger = (uri.queryParameters['passenger'] ?? '').toLowerCase();
      for (final b in widget.bags) {
        final m = b as Map<String, dynamic>;
        final f = (m['flight_id'] ?? '').toString().toLowerCase();
        final p = (m['passenger'] ?? '').toString().toLowerCase();
        if (f == flight &&
            (passenger.isEmpty || p.contains(passenger) || passenger.contains(p))) {
          return m['tag_id']?.toString();
        }
      }
      return null; // a track URL, but no matching bag is loaded
    }

    // Otherwise treat the value as a tag id (verify against the loaded list).
    for (final b in widget.bags) {
      final m = b as Map<String, dynamic>;
      if ((m['tag_id'] ?? '').toString().toLowerCase() == raw.toLowerCase()) {
        return m['tag_id']?.toString();
      }
    }
    // Never treat a URL as a tag id; that produces a bogus /bags/<url>/history
    // request and a confusing HTTP 404.
    if (uri != null && uri.hasScheme) return null;
    return raw; // best-effort: a hand-typed tag id
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final code = capture.barcodes.isNotEmpty ? capture.barcodes.first.rawValue : null;
    if (code == null) return;
    _open(code);
  }

  Future<void> _open(String raw) async {
    final tag = _resolveTag(raw);
    if (tag == null || tag.isEmpty) {
      _toast('No matching bag for that code');
      return;
    }
    _handled = true;
    await _controller.stop();

    Map<String, dynamic>? bag;
    for (final b in widget.bags) {
      final m = b as Map<String, dynamic>;
      if ((m['tag_id'] ?? '').toString() == tag) {
        bag = m;
        break;
      }
    }
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(
      builder: (_) => BagJourneyScreen(
        api: widget.api,
        tagId: tag,
        passenger: (bag?['passenger'] ?? '').toString(),
        flightId: (bag?['flight_id'] ?? '').toString(),
        status: bag?['status']?.toString(),
        autoScan: true,
      ),
    ));
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _manualEntry() async {
    final ctrl = TextEditingController();
    final tag = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Enter bag tag'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(hintText: 'e.g. TAG-1001'),
          onSubmitted: (v) => Navigator.of(ctx).pop(v),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(ctrl.text),
            child: const Text('Open'),
          ),
        ],
      ),
    );
    if (tag != null && tag.trim().isNotEmpty) _open(tag.trim());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan bag tag'),
        actions: [
          IconButton(
            tooltip: 'Enter tag manually',
            icon: const Icon(Icons.keyboard_rounded),
            onPressed: _manualEntry,
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error, child) => _CameraUnavailable(
              onManual: _manualEntry,
            ),
          ),
          // Reticle + hint overlay
          IgnorePointer(
            child: Center(
              child: Container(
                width: 230,
                height: 230,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 3),
                  borderRadius: BorderRadius.circular(24),
                ),
              ),
            ),
          ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 28,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Text(
                    'Point at a SkyWatcher bag-tag QR',
                    style: TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: _manualEntry,
                  icon: const Icon(Icons.keyboard_rounded, size: 18),
                  label: const Text('Enter tag manually'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Shown when the camera can't start (no camera / permission denied) - e.g. the
/// iOS Simulator. Keeps the manual-entry path one tap away.
class _CameraUnavailable extends StatelessWidget {
  final VoidCallback onManual;
  const _CameraUnavailable({required this.onManual});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.bg,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.no_photography_rounded, size: 52, color: AppColors.muted),
          const SizedBox(height: 16),
          const Text('Camera unavailable',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          const Text(
            'No camera here (e.g. the iOS Simulator) or permission was denied. '
            'You can still enter a bag tag by hand.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, fontSize: 13.5),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: onManual,
            icon: const Icon(Icons.keyboard_rounded, size: 18),
            label: const Text('Enter tag manually'),
          ),
        ],
      ),
    );
  }
}
