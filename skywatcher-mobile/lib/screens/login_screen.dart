import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import 'forgot_password_screen.dart';

class LoginScreen extends StatefulWidget {
  final SkyWatcherApi api;
  final VoidCallback onLoggedIn;
  const LoginScreen({super.key, required this.api, required this.onLoggedIn});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _user = TextEditingController(text: 'staff');
  final _pass = TextEditingController(text: 'staff123');
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() { _loading = true; _error = null; });
    try {
      await widget.api.login(_user.text.trim(), _pass.text);
      widget.onLoggedIn();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Brand ────────────────────────────────────────────────
                const Center(child: BrandMark(size: 64)),
                const SizedBox(height: 20),
                RichText(
                  textAlign: TextAlign.center,
                  text: const TextSpan(
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: AppColors.text,
                      letterSpacing: -0.5,
                    ),
                    children: [
                      TextSpan(
                        text: 'Sky',
                        style: TextStyle(color: AppColors.brandSky),
                      ),
                      TextSpan(text: 'Watcher'),
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Ground operations',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted, fontSize: 14),
                ),
                const SizedBox(height: 40),

                // ── Fields ───────────────────────────────────────────────
                TextField(
                  controller: _user,
                  autocorrect: false,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                    labelText: 'Username',
                    hintText: 'e.g. staff',
                    prefixIcon: Icon(Icons.person_outline_rounded),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _pass,
                  obscureText: _obscure,
                  onSubmitted: (_) => _submit(),
                  decoration: InputDecoration(
                    labelText: 'Password',
                    hintText: '••••••••',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    suffixIcon: IconButton(
                      icon: Icon(_obscure
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined),
                      color: AppColors.muted,
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                ),

                // ── Error ────────────────────────────────────────────────
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.wrongRoute.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: AppColors.wrongRoute.withValues(alpha: 0.25)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded,
                            color: AppColors.wrongRoute, size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(_error!,
                              style: const TextStyle(
                                  color: AppColors.wrongRoute, fontSize: 13)),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 24),

                // ── Sign in button ────────────────────────────────────────
                FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.5, color: Colors.white))
                      : const Text('Sign in'),
                ),
                const SizedBox(height: 12),

                // ── Forgot password ───────────────────────────────────────
                Center(
                  child: TextButton(
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            ForgotPasswordScreen(api: widget.api),
                      ),
                    ),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      textStyle: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                    child: const Text('Forgot password?'),
                  ),
                ),
                const SizedBox(height: 16),

                // ── Demo hint ─────────────────────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 40,
                      height: 1,
                      color: AppColors.line,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        'Demo accounts',
                        style: TextStyle(
                            color: AppColors.muted.withValues(alpha: 0.7),
                            fontSize: 11,
                            fontWeight: FontWeight.w500),
                      ),
                    ),
                    Container(
                      width: 40,
                      height: 1,
                      color: AppColors.line,
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  'admin / admin123   ·   staff / staff123',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
