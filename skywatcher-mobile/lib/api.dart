import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// ── Configure this for your network ─────────────────────────────────────────
/// The Flask backend runs on your Mac at port 5001. A phone/emulator can't reach
/// "localhost", so point it at the host machine:
///   • Real iPhone / iOS simulator on the same Wi-Fi → your Mac's LAN IP
///   • Android emulator                              → 10.0.2.2 (host alias)
///
/// Default: the deployed API on Render, so the phone works on any network
/// (campus Wi-Fi or cellular) without the Mac running a local server.
const String kBaseUrl = 'https://skywatcher-api.onrender.com/api'; // ← deployed backend
// const String kBaseUrl = 'http://192.168.1.8:5001/api'; // ← local Flask via Mac LAN IP (`ipconfig getifaddr en0`)
// const String kBaseUrl = 'http://localhost:5001/api';   // ← iOS Simulator
// const String kBaseUrl = 'http://10.0.2.2:5001/api';    // ← Android emulator

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

  /// GET /bags → { bags, count }
  Future<List<dynamic>> getBags() async {
    final res = await http.get(Uri.parse('$kBaseUrl/bags'), headers: _headers);
    if (res.statusCode != 200) {
      throw Exception(_error(res, 'Failed to load bags'));
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return (data['bags'] as List?) ?? [];
  }

  /// GET /bags/:tagId/history → { tag_id, events, count }
  Future<List<dynamic>> getBagHistory(String tagId) async {
    final res = await http.get(
      Uri.parse('$kBaseUrl/bags/${Uri.encodeComponent(tagId)}/history'),
      headers: _headers,
    );
    if (res.statusCode != 200) {
      throw Exception(_error(res, 'Failed to load bag history'));
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return (data['events'] as List?) ?? [];
  }

  /// GET /bags/:tagId/status-history → { tag_id, history, count }
  /// The FSM state-transition trail (oldest first).
  Future<List<dynamic>> getBagStatusHistory(String tagId) async {
    final res = await http.get(
      Uri.parse('$kBaseUrl/bags/${Uri.encodeComponent(tagId)}/status-history'),
      headers: _headers,
    );
    if (res.statusCode != 200) {
      throw Exception(_error(res, 'Failed to load status history'));
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return (data['history'] as List?) ?? [];
  }

  /// POST /bags/:tagId/scan → register an operator checkpoint scan.
  /// Returns { tag_id, checkpoint, status, anomaly }.
  Future<Map<String, dynamic>> registerScan(
    String tagId,
    String checkpoint,
  ) async {
    final res = await http.post(
      Uri.parse('$kBaseUrl/bags/${Uri.encodeComponent(tagId)}/scan'),
      headers: _headers,
      body: jsonEncode({'checkpoint': checkpoint}),
    );
    if (res.statusCode != 201) {
      throw Exception(_error(res, 'Scan failed'));
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// POST /bags/:tagId/action → apply an operator action
  /// (hold/release/reroute/claim/report_lost/found).
  /// Returns { tag_id, from_status, status, action }. An illegal action → 409.
  Future<Map<String, dynamic>> bagAction(String tagId, String action) async {
    final res = await http.post(
      Uri.parse('$kBaseUrl/bags/${Uri.encodeComponent(tagId)}/action'),
      headers: _headers,
      body: jsonEncode({'action': action}),
    );
    if (res.statusCode != 200) {
      throw Exception(_error(res, 'Action failed'));
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// POST /auth/forgot-password → send reset email (always 200)
  Future<void> forgotPassword(String email) async {
    final res = await http.post(
      Uri.parse('$kBaseUrl/auth/forgot-password'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email}),
    );
    if (res.statusCode != 200) throw Exception(_error(res, 'Request failed'));
  }

  /// GET /advisories?all=true → list of all checkpoint advisories.
  Future<List<dynamic>> getAdvisories() async {
    final res = await http.get(
      Uri.parse('$kBaseUrl/advisories?all=true'),
      headers: _headers,
    );
    if (res.statusCode != 200) throw Exception(_error(res, 'Failed to load advisories'));
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return data['advisories'] as List<dynamic>? ?? [];
  }

  /// POST /advisories/request → submit an advisory change request.
  Future<void> requestAdvisory({
    required String checkpoint,
    required String level,
    String? message,
  }) async {
    final res = await http.post(
      Uri.parse('$kBaseUrl/advisories/request'),
      headers: _headers,
      body: jsonEncode({
        'checkpoint': checkpoint,
        'level': level,
        if (message != null && message.isNotEmpty) 'message': message,
      }),
    );
    if (res.statusCode != 201) throw Exception(_error(res, 'Request failed'));
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
