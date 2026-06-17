import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// ── Configure this for your network ─────────────────────────────────────────
/// The Flask backend runs on your Mac at port 5001. A phone/emulator can't reach
/// "localhost", so point it at the host machine:
///   • Real iPhone / iOS simulator on the same Wi-Fi → your Mac's LAN IP
///   • Android emulator                              → 10.0.2.2 (host alias)
///
/// Your Mac's current LAN IP is 192.168.1.19 (re-check with `ipconfig getifaddr en0`).
const String kBaseUrl = 'http://192.168.1.19:5001/api';
// const String kBaseUrl = 'http://10.0.2.2:5001/api'; // ← use this for Android emulator

const String _tokenKey = 'sw_token';

/// Thin client over the existing SkyWatcher REST API.
/// Mirrors the endpoints the React dashboard uses.
class SkyWatcherApi {
  String? _token;
  Map<String, dynamic>? user;

  bool get hasToken => _token != null;

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
  }

  Future<void> _saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    _token = token;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    _token = null;
    user = null;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  /// POST /auth/login → { token, user }
  Future<void> login(String username, String password) async {
    final res = await http.post(
      Uri.parse('$kBaseUrl/auth/login'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    );
    if (res.statusCode != 200) {
      throw Exception(_error(res, 'Login failed'));
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    user = data['user'] as Map<String, dynamic>?;
    await _saveToken(data['token'] as String);
  }

  /// GET /alerts → { alerts, total, unresolved }
  Future<Map<String, dynamic>> getAlerts({int limit = 100}) async {
    final res = await http.get(
      Uri.parse('$kBaseUrl/alerts?limit=$limit'),
      headers: _headers,
    );
    if (res.statusCode != 200) {
      throw Exception(_error(res, 'Failed to load alerts'));
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// PATCH /alerts/:id/resolve
  Future<void> resolveAlert(int id) async {
    final res = await http.patch(
      Uri.parse('$kBaseUrl/alerts/$id/resolve'),
      headers: _headers,
    );
    if (res.statusCode != 200) {
      throw Exception(_error(res, 'Failed to resolve alert'));
    }
  }

  String _error(http.Response res, String fallback) {
    try {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return body['error']?.toString() ?? fallback;
    } catch (_) {
      return '$fallback (HTTP ${res.statusCode})';
    }
  }
}
