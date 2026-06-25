import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

class ForgotPasswordScreen extends StatefulWidget {
  final SkyWatcherApi api;
  const ForgotPasswordScreen({super.key, required this.api});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter a valid email address.');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await widget.api.forgotPassword(email);
      if (mounted) setState(() => _sent = true);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('Reset password'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
            child: _sent ? _SuccessView() : _FormView(
              emailCtrl: _email,
              loading: _loading,
              error: _error,
              onSubmit: _submit,
            ),
          ),
        ),
      ),
    );
  }
}

class _FormView extends StatelessWidget {
  final TextEditingController emailCtrl;
  final bool loading;
  final String? error;
  final VoidCallback onSubmit;
  const _FormView({
    required this.emailCtrl,
    required this.loading,
    required this.error,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(Icons.lock_reset_rounded,
                color: AppColors.primary, size: 32),
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Forgot your password?',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: AppColors.text,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Enter the email on your staff account and we\'ll send a reset link.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.muted, fontSize: 14, height: 1.5),
        ),
        const SizedBox(height: 32),
        TextField(
          controller: emailCtrl,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => onSubmit(),
          decoration: const InputDecoration(
            labelText: 'Email address',
            hintText: 'you@example.com',
            prefixIcon: Icon(Icons.mail_outline_rounded),
          ),
        ),
        if (error != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
                  child: Text(error!,
                      style: const TextStyle(
                          color: AppColors.wrongRoute, fontSize: 13)),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 24),
        FilledButton(
          onPressed: loading ? null : onSubmit,
          child: loading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2.5, color: Colors.white))
              : const Text('Send reset link'),
        ),
      ],
    );
  }
}

class _SuccessView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.successSoft,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(Icons.mark_email_read_outlined,
                color: AppColors.success, size: 32),
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Check your inbox',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: AppColors.text,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'If that email matches a staff account, a reset link is on its way. Check your spam folder too.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.muted, fontSize: 14, height: 1.5),
        ),
        const SizedBox(height: 32),
        OutlinedButton(
          onPressed: () => Navigator.of(context).pop(),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.text,
            side: const BorderSide(color: AppColors.line),
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16)),
          ),
          child: const Text('Back to sign in',
              style: TextStyle(fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }
}
