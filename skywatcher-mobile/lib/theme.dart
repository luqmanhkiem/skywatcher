import 'package:flutter/material.dart';

/// ── SkyWatcher mobile design system ─────────────────────────────────────────
/// Clean, friendly ground-ops aesthetic: warm off-white canvas, deep-indigo
/// primary, soft rounded white cards, pill chips, green progress. Inspired by
/// modern task-planner UIs but tuned for an airport baggage-ops tool.

class AppColors {
  // Streamlined to match the web dashboard's design tokens (src/index.css).
  static const brandSky = Color(0xFF5B5BD6); // "Sky" in SkyWatcher (--brand-sky)
  static const bg = Color(0xFFF1EFE9); // warm cream canvas (--bg)
  static const surface = Color(0xFFFAF9F5); // off-white cards (--surface)
  static const primary = Color(0xFF3D5AFE); // CTA blue (--lt-cta)
  static const primarySoft = Color(0xFFDCE2FF); // (--lt-cta-soft)
  static const accent = Color(0xFFF5A623); // SkyWatcher amber (--accent)
  static const success = Color(0xFF16A34A); // (--success)
  static const successSoft = Color(0xFFE7F6EC);
  static const text = Color(0xFF0A0A0A); // near-black (--text)
  static const muted = Color(0xFF6B6B6B); // (--muted)
  static const line = Color(0xFFE5E2D8); // (--border)

  // Anomaly types — semantic, matched to the dashboard palette.
  static const bypass = Color(0xFF7C3AED); // (--purple)
  static const wrongRoute = Color(0xFFDC2626); // (--danger)
  static const stall = Color(0xFFEA580C); // (--warning)

  static Color anomaly(String type) {
    switch (type) {
      case 'SECURITY_BYPASS':
        return bypass;
      case 'WRONG_ROUTE':
        return wrongRoute;
      case 'STALL':
        return stall;
      default:
        return accent;
    }
  }
}

/// Canonical checkpoint flow + display helpers (shared across screens).
const List<String> kCheckpointFlow = [
  'check_in',
  'security',
  'sorting',
  'loading',
  'arrival',
];

const Map<String, String> kCheckpointLabels = {
  'check_in': 'Check-in',
  'security': 'Security',
  'sorting': 'Sorting',
  'loading': 'Loading',
  'arrival': 'Arrival',
};

Color checkpointColor(String? cp) {
  switch (cp) {
    case 'check_in':
      return const Color(0xFF3D5AFE); // CTA blue
    case 'security':
      return const Color(0xFF7C3AED); // purple
    case 'sorting':
      return const Color(0xFFF5A623); // amber
    case 'loading':
      return const Color(0xFFF97316); // orange (--pink)
    case 'arrival':
      return const Color(0xFF16A34A); // success
    default:
      return AppColors.muted;
  }
}

String checkpointLabel(String? cp) =>
    kCheckpointLabels[cp] ?? (cp ?? 'unknown').replaceAll('_', ' ');

/// Journey progress 0..1 from the furthest checkpoint reached.
double checkpointProgress(String? lastCheckpoint) {
  final i = kCheckpointFlow.indexOf(lastCheckpoint ?? '');
  if (i < 0) return 0;
  return (i + 1) / kCheckpointFlow.length;
}

/// ── Bag state machine (FSM) — mirrors backend/models/state_machine.py ────────

/// Colour for an FSM bag status (happy states matched to checkpoint colours;
/// exception states in red/orange/slate). Legacy values map sensibly too.
Color bagStatusColor(String? status) {
  switch (status) {
    case 'REGISTERED':
      return const Color(0xFF0284C7); // sky
    case 'SCREENED':
    case 'in_transit':
      return const Color(0xFFB45309); // amber
    case 'SORTED':
      return const Color(0xFF7C3AED); // violet
    case 'LOADED':
      return const Color(0xFFEA580C); // orange
    case 'ARRIVED':
    case 'arrived':
    case 'CLAIMED':
      return AppColors.success; // green
    case 'FLAGGED':
    case 'LOST':
      return AppColors.wrongRoute; // red
    case 'MISROUTED':
      return AppColors.stall; // orange-red
    case 'HELD':
      return const Color(0xFF475569); // slate
    default:
      return AppColors.muted;
  }
}

String bagStatusLabel(String? status) =>
    (status == null || status.isEmpty) ? '—' : status.replaceAll('_', ' ');

/// Operator actions and the states they are valid from. `from` mirrors
/// ACTION_TRANSITIONS in state_machine.py; the backend still validates (409).
class OperatorAction {
  final String key;
  final String label;
  final IconData icon;
  final Color color;
  final List<String> from;
  const OperatorAction(this.key, this.label, this.icon, this.color, this.from);
}

const List<OperatorAction> kOperatorActions = [
  OperatorAction('hold', 'Hold', Icons.pause_circle_outline_rounded,
      AppColors.stall, ['REGISTERED', 'SCREENED', 'SORTED', 'LOADED', 'FLAGGED', 'MISROUTED']),
  OperatorAction('release', 'Release', Icons.play_circle_outline_rounded,
      AppColors.primary, ['HELD']),
  OperatorAction('reroute', 'Reroute', Icons.alt_route_rounded,
      AppColors.accent, ['MISROUTED']),
  OperatorAction('claim', 'Claim', Icons.check_circle_outline_rounded,
      AppColors.success, ['LOST']),
  OperatorAction('report_lost', 'Report lost', Icons.report_gmailerrorred_rounded,
      AppColors.wrongRoute, ['REGISTERED', 'SCREENED', 'SORTED', 'LOADED', 'FLAGGED', 'MISROUTED', 'HELD']),
  OperatorAction('found', 'Found', Icons.inventory_2_outlined,
      AppColors.success, ['LOST']),
];

List<OperatorAction> actionsFor(String? status) =>
    kOperatorActions.where((a) => a.from.contains(status)).toList();

/// Soft, low elevation shadow used on every card.
const List<BoxShadow> kCardShadow = [
  BoxShadow(color: Color(0x0F1B1F3B), blurRadius: 18, offset: Offset(0, 8)),
];

ThemeData buildAppTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.primary,
    primary: AppColors.primary,
    surface: AppColors.surface,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.bg,
    fontFamily: '.SF Pro Text',
    splashFactory: InkRipple.splashFactory,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: true,
      foregroundColor: AppColors.text,
      titleTextStyle: TextStyle(
        color: AppColors.text,
        fontSize: 17,
        fontWeight: FontWeight.w700,
      ),
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
          fontSize: 34, fontWeight: FontWeight.w800, color: AppColors.text),
      titleLarge: TextStyle(
          fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.text),
      titleMedium: TextStyle(
          fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.text),
      bodyMedium: TextStyle(fontSize: 14, color: AppColors.text),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      hintStyle: const TextStyle(color: AppColors.muted),
      labelStyle: const TextStyle(color: AppColors.muted, fontSize: 14),
      floatingLabelStyle: const TextStyle(color: AppColors.primary, fontSize: 13, fontWeight: FontWeight.w600),
      prefixIconColor: AppColors.muted,
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.6),
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.line),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    dividerColor: AppColors.line,
  );
}

/// The SkyWatcher brand mark — an "S" monogram on a near-black rounded square,
/// identical to the web dashboard (sidebar / landing nav / login).
class BrandMark extends StatelessWidget {
  final double size;
  const BrandMark({super.key, this.size = 32});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.text, // near-black, like --text on web
        borderRadius: BorderRadius.circular(size * 0.27),
      ),
      alignment: Alignment.center,
      child: Text(
        'S',
        style: TextStyle(
          color: AppColors.bg, // cream "S", like --bg on web
          fontWeight: FontWeight.w900,
          fontSize: size * 0.56,
          height: 1.0,
        ),
      ),
    );
  }
}

/// A rounded white card with the standard soft shadow.
class SoftCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? borderColor;
  const SoftCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: kCardShadow,
        border: borderColor != null
            ? Border.all(color: borderColor!, width: 1)
            : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// A pill chip with a leading colored dot — used for priority / type / status.
class DotChip extends StatelessWidget {
  final String label;
  final Color color;
  final bool filled;
  const DotChip({
    super.key,
    required this.label,
    required this.color,
    this.filled = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: filled ? color.withValues(alpha: 0.12) : AppColors.bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: filled ? color : AppColors.text,
            ),
          ),
        ],
      ),
    );
  }
}

/// Thin rounded progress bar (green) used on bag / journey cards.
class MiniProgress extends StatelessWidget {
  final double value; // 0..1
  final Color color;
  const MiniProgress({super.key, required this.value, this.color = AppColors.success});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: LinearProgressIndicator(
        value: value.clamp(0, 1),
        minHeight: 7,
        backgroundColor: AppColors.line,
        valueColor: AlwaysStoppedAnimation(color),
      ),
    );
  }
}
