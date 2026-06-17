import 'package:flutter/material.dart';
import '../api.dart';

class LoginScreen extends StatefulWidget {
  final SkyWatcherApi api;
  final VoidCallback onLoggedIn;
  const LoginScreen({super.key, required this.api, required this.onLoggedIn});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _user = TextEditingController(text: 'staff1');
  final _pass = TextEditingController(text: 'staff123');
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
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
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('SkyWatcher',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              const Text('Ground ops',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey, fontSize: 15)),
              const SizedBox(height: 36),
              TextField(
                controller: _user,
                autocorrect: false,
                decoration: const InputDecoration(
                    labelText: 'Username', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _pass,
                obscureText: true,
                onSubmitted: (_) => _submit(),
                decoration: const InputDecoration(
                    labelText: 'Password', border: OutlineInputBorder()),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(_error!,
                      style: const TextStyle(color: Colors.red, fontSize: 13)),
                ),
              const SizedBox(height: 22),
              FilledButton(
                onPressed: _loading ? null : _submit,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: _loading
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Sign in'),
                ),
              ),
              const SizedBox(height: 12),
              const Text('Demo: admin / admin123  ·  staff1 / staff123',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}
