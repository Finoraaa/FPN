import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_v2ray/flutter_v2ray.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

const String currentAppVersion = '1.0.7';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const FpnApp());
}

class FpnNode {
  final String id;
  final String name;
  final String country;
  final String flag;
  final String vlessUri;
  int? ping;

  FpnNode({
    required this.id,
    required this.name,
    required this.country,
    required this.flag,
    required this.vlessUri,
    this.ping,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'country': country,
        'flag': flag,
        'vlessUri': vlessUri,
        'ping': ping,
      };

  factory FpnNode.fromJson(Map<String, dynamic> json) => FpnNode(
        id: json['id'] as String? ?? 'node-${DateTime.now().millisecondsSinceEpoch}',
        name: json['name'] as String? ?? 'VLESS Node',
        country: json['country'] as String? ?? 'Global',
        flag: json['flag'] as String? ?? '🌐',
        vlessUri: json['vlessUri'] as String? ?? '',
        ping: json['ping'] as int?,
      );
}

class FpnApp extends StatelessWidget {
  const FpnApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FPN',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF09090B),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF10B981),
          secondary: Color(0xFF38BDF8),
          surface: Color(0xFF121217),
        ),
        fontFamily: 'sans-serif',
      ),
      home: const FpnHomePage(),
    );
  }
}

class FpnHomePage extends StatefulWidget {
  const FpnHomePage({super.key});

  @override
  State<FpnHomePage> createState() => _FpnHomePageState();
}

class _FpnHomePageState extends State<FpnHomePage>
    with SingleTickerProviderStateMixin {
  final ValueNotifier<V2RayStatus> v2rayStatus =
      ValueNotifier<V2RayStatus>(V2RayStatus());

  late final FlutterV2ray flutterV2ray;
  bool isConnecting = false;
  bool isTestingAllPings = false;
  late AnimationController _pulseController;

  // Ayarlar & Kalıcılık (SharedPreferences)
  bool bypassTurkeyApps = false;
  bool killSwitchEnabled = false;
  bool autoConnectFastest = false;
  List<String> subscriptionUrls = [];
  bool userIntendedConnected = false;

  // OTA Güncelleme Motoru Değişkenleri
  bool hasUpdate = false;
  String? latestVersion;
  String? updateDownloadUrl;
  String? updateReleaseNotes;
  bool isDownloadingUpdate = false;
  int updateProgress = 0;
  String updateStatusText = '';
  Timer? _updateCheckTimer;

  // Popüler Türk Bankacılık & Alışveriş Uygulamaları (Split Tunneling için muafiyet listesi)
  static const List<String> defaultBypassApps = [
    'com.akbank.android.apps',
    'com.garanti.cepsubesi',
    'com.finansbank.mobile.cepsube',
    'com.ykb.android',
    'com.ziraat.ziraatmobil',
    'com.vakifbank.mobile',
    'com.halkbank.sube',
    'com.teb',
    'com.papara',
    'tr.gov.turkiye.edevlet.kapisi',
    'com.pozitron.hepsiburada',
    'com.dmarket.dmarket',
    'com.getir',
    'com.migros.sanalmarket',
    'com.turkcell.hesabim',
    'com.vodafone.yanimda',
    'com.avea.onlineislemler',
  ];

  // Varsayılan Yüksek Hızlı VLESS Reality Sunucuları
  final List<FpnNode> defaultNodes = [
    FpnNode(
      id: 'node-de-frankfurt',
      name: 'Almanya - Frankfurt High-Speed',
      country: 'Almanya',
      flag: '🇩🇪',
      vlessUri:
          'vless://00144519-7e0d-476b-8d28-435576af9262@167.17.69.171:443?security=reality&sni=www.cloudflare.com&pbk=ALT8hIGeZEhi0sQFbXP_ntBg8Xo-v7i0YCLrqTnBxRk&sid=0990d22f&fp=chrome&type=tcp&flow=xtls-rprx-vision#FPN-Almanya-Frankfurt',
    ),
    FpnNode(
      id: 'node-eu-secure',
      name: 'Avrupa - Apple Secure Reality',
      country: 'Avrupa',
      flag: '🇪🇺',
      vlessUri:
          'vless://44ae52b9-76fc-444d-8e43-186b4384b80a@86.54.28.75:443?security=reality&encryption=none&pbk=PryGoq51ilG0eLUPl9i0xCvmk1xpwkyFSr_tG4GNLlU&headerType=none&type=tcp&flow=xtls-rprx-vision&sni=www.apple.com&sid=1d86d17709852910#FPN-Avrupa-Apple',
    ),
    FpnNode(
      id: 'node-us-fast',
      name: 'Amerika - Global Express',
      country: 'Amerika',
      flag: '🇺🇸',
      vlessUri:
          'vless://d65cc14c-f53f-4fe2-b262-97856601319c@169.40.42.231:443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=yahoo.com&fp=chrome&pbk=e2RLf57Li_-MDZGE9ss1BWPgP54mqRb5PfXhW2jcVVg&sid=c39cc7310a&type=tcp&headerType=none#FPN-Amerika-Global',
    ),
    FpnNode(
      id: 'node-us-cloud',
      name: 'Amerika - Fast Cloud Reality',
      country: 'Amerika',
      flag: '🇺🇸',
      vlessUri:
          'vless://d65cc14c-f53f-4fe2-b262-97856601319c@169.40.42.75:443?encryption=none&flow=xtls-rprx-vision&security=reality&sni=yahoo.com&fp=chrome&pbk=e2RLf57Li_-MDZGE9ss1BWPgP54mqRb5PfXhW2jcVVg&sid=c39cc7310a&type=tcp&headerType=none#FPN-Amerika-FastCloud',
    ),
  ];

  List<FpnNode> nodes = [];
  late FpnNode selectedNode;
  int currentPing = -1;

  @override
  void initState() {
    super.initState();
    nodes = List.from(defaultNodes);
    selectedNode = nodes[0];

    flutterV2ray = FlutterV2ray(
      onStatusChanged: (status) {
        v2rayStatus.value = status;
        if (status.state == 'DISCONNECTED' &&
            userIntendedConnected &&
            killSwitchEnabled) {
          _showKillSwitchAlert();
        }
        if (mounted) setState(() {});
      },
    );

    flutterV2ray.initializeV2Ray(
      notificationIconResourceType: "mipmap",
      notificationIconResourceName: "ic_launcher",
    );

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _loadPreferences();
    _updateCheckTimer = Timer(const Duration(seconds: 2), _checkForUpdates);
  }

  @override
  void dispose() {
    _updateCheckTimer?.cancel();
    _pulseController.dispose();
    super.dispose();
  }

  bool get isConnected => v2rayStatus.value.state == 'CONNECTED';

  // --- Kalıcılık Yöntemleri (SharedPreferences) ---
  Future<void> _loadPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      bypassTurkeyApps = prefs.getBool('fpn_bypass_turkey_apps') ?? false;
      killSwitchEnabled = prefs.getBool('fpn_kill_switch') ?? false;
      autoConnectFastest = prefs.getBool('fpn_auto_fastest') ?? false;
      subscriptionUrls = prefs.getStringList('fpn_subs') ?? [];

      final savedNodesJson = prefs.getString('fpn_saved_nodes');
      if (savedNodesJson != null && savedNodesJson.isNotEmpty) {
        final List<dynamic> decoded = jsonDecode(savedNodesJson);
        final loadedNodes =
            decoded.map((item) => FpnNode.fromJson(item)).toList();
        if (loadedNodes.isNotEmpty) {
          // Eski çalışmayan / kapanmış topluluk node'larını temizle (migration)
          const obsoleteIds = {
            'node-nl-amsterdam',
            'node-fr-paris',
            'node-de-berlin',
            'node-bg-sofia',
          };
          loadedNodes.removeWhere((n) => obsoleteIds.contains(n.id));

          for (final defNode in defaultNodes) {
            final idx = loadedNodes.indexWhere((n) => n.id == defNode.id);
            if (idx == -1) {
              loadedNodes.add(defNode);
            } else {
              loadedNodes[idx] = defNode;
            }
          }
          setState(() {
            nodes = loadedNodes;
          });
        }
      }

      final savedNodeId = prefs.getString('fpn_selected_node_id');
      const obsoleteIds = {
        'node-nl-amsterdam',
        'node-fr-paris',
        'node-de-berlin',
        'node-bg-sofia',
      };
      if (savedNodeId != null && !obsoleteIds.contains(savedNodeId)) {
        final match = nodes.firstWhere(
          (n) => n.id == savedNodeId,
          orElse: () => nodes[0],
        );
        setState(() {
          selectedNode = match;
        });
      } else {
        selectedNode = nodes[0];
      }
      if (mounted) setState(() {});
    } catch (e) {
      debugPrint("Prefs error: $e");
    }
  }

  Future<void> _savePreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('fpn_bypass_turkey_apps', bypassTurkeyApps);
      await prefs.setBool('fpn_kill_switch', killSwitchEnabled);
      await prefs.setBool('fpn_auto_fastest', autoConnectFastest);
      await prefs.setStringList('fpn_subs', subscriptionUrls);
      await prefs.setString('fpn_selected_node_id', selectedNode.id);

      final nodesJson = jsonEncode(nodes.map((n) => n.toJson()).toList());
      await prefs.setString('fpn_saved_nodes', nodesJson);
    } catch (e) {
      debugPrint("Save error: $e");
    }
  }

  void _showKillSwitchAlert() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          "⚠️ DİKKAT: VPN bağlantısı koptu! Kill Switch aktif olduğundan trafik güvende değil.",
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.redAccent,
        duration: Duration(seconds: 6),
      ),
    );
  }

  // --- V2Ray / Xray Konfigürasyonunu Optimize Et (DNS & Inbound Sniffing) ---
  String _optimizeV2RayConfig(String rawConfig) {
    try {
      final Map<String, dynamic> json = jsonDecode(rawConfig);

      // 1. Inbound Sniffing: Gelen bağlantılardan SNI (Host) ayrıştırılarak alan adı tespiti yapılır
      if (json['inbounds'] is List) {
        for (final inbound in json['inbounds']) {
          if (inbound is Map<String, dynamic>) {
            inbound['sniffing'] = {
              'enabled': true,
              'destOverride': ['http', 'tls'],
              'metadataOnly': false,
              'routeOnly': false,
            };
          }
        }
      }

      // 2. DNS Sunucuları (Android VpnService.Builder için güvenilir sayısal IP'ler)
      json['dns'] = {
        'servers': [
          '1.1.1.1',
          '8.8.8.8',
          '1.0.0.1',
          '8.8.4.4',
        ],
        'queryStrategy': 'UseIPv4',
      };

      // 3. Routing: Varsayılan "UseIp" stratejisi korunur. Harici geoip kuralı eklenmez
      // böylece dosya bağımlılığı olmadan tüm trafik doğrudan şifreli proxy üzerinden akar.
      json['routing'] = {
        'domainStrategy': 'UseIp',
      };

      return jsonEncode(json);
    } catch (e) {
      debugPrint("optimizeV2RayConfig error: $e");
      return rawConfig;
    }
  }

  Future<void> toggleConnection() async {
    if (isConnected) {
      userIntendedConnected = false;
      await flutterV2ray.stopV2Ray();
      setState(() {
        currentPing = -1;
      });
      _showToast("FPN Bağlantısı kesildi");
    } else {
      if (autoConnectFastest) {
        await _autoSelectFastestNode(silent: true);
      }

      setState(() => isConnecting = true);
      final hasPermission = await flutterV2ray.requestPermission();
      if (!hasPermission) {
        setState(() => isConnecting = false);
        _showToast("VPN Bağlantı izni verilmedi");
        return;
      }

      try {
        final V2RayURL v2rayUrl = FlutterV2ray.parseFromURL(selectedNode.vlessUri);
        userIntendedConnected = true;

        final rawConfig = v2rayUrl.getFullConfiguration();
        final optimizedConfig = _optimizeV2RayConfig(rawConfig);

        await flutterV2ray.startV2Ray(
          remark: selectedNode.name,
          config: optimizedConfig,
          proxyOnly: false,
          blockedApps: bypassTurkeyApps ? defaultBypassApps : null,
          notificationDisconnectButtonName: "BAĞLANTIYI KES",
        );
        _showToast(
            "${selectedNode.country} sunucusuna bağlanıldı! ${bypassTurkeyApps ? '(Bölünmüş Tünel Aktif)' : ''}");
        _testLatency();
      } catch (e) {
        userIntendedConnected = false;
        _showToast("Bağlantı hatası: $e");
      } finally {
        setState(() => isConnecting = false);
      }
    }
  }

  Future<void> _testLatency() async {
    try {
      if (isConnected) {
        final delay = await flutterV2ray.getConnectedServerDelay();
        setState(() => currentPing = delay);
      } else {
        final V2RayURL v2rayUrl =
            FlutterV2ray.parseFromURL(selectedNode.vlessUri);
        final delay = await flutterV2ray.getServerDelay(
            config: _optimizeV2RayConfig(v2rayUrl.getFullConfiguration()));
        setState(() => currentPing = delay);
      }
    } catch (_) {}
  }

  // --- Akıllı Otomatik En Düşük Ping Sunucusunu Bul ve Bağlan ---
  Future<void> _autoSelectFastestNode({bool silent = false}) async {
    if (nodes.isEmpty) return;
    setState(() => isTestingAllPings = true);
    if (!silent) _showToast("⚡ En hızlı sunucu taranıyor...");

    FpnNode? fastestNode;
    int minDelay = 999999;

    for (final node in nodes) {
      try {
        final parsed = FlutterV2ray.parseFromURL(node.vlessUri);
        final delay = await flutterV2ray.getServerDelay(
            config: _optimizeV2RayConfig(parsed.getFullConfiguration()));
        node.ping = delay;
        if (delay > 0 && delay < minDelay) {
          minDelay = delay;
          fastestNode = node;
        }
      } catch (_) {
        node.ping = -1;
      }
    }

    setState(() => isTestingAllPings = false);
    _savePreferences();

    if (fastestNode != null) {
      setState(() {
        selectedNode = fastestNode!;
        currentPing = minDelay;
      });
      if (!silent) {
        _showToast("En düşük pingli sunucu seçildi: ${fastestNode.name} ($minDelay ms)");
      }
    } else {
      if (!silent) _showToast("Ping testi tamamlandı.");
    }
  }

  // --- OTA Güncelleme Motoru (GitHub Releases) ---
  bool _isNewerVersion(String latest, String current) {
    try {
      final cleanLatest = latest.replaceAll(RegExp(r'[^0-9.]'), '');
      final cleanCurrent = current.replaceAll(RegExp(r'[^0-9.]'), '');
      final lParts = cleanLatest.split('.').map((e) => int.tryParse(e) ?? 0).toList();
      final cParts = cleanCurrent.split('.').map((e) => int.tryParse(e) ?? 0).toList();
      for (int i = 0; i < 3; i++) {
        final l = i < lParts.length ? lParts[i] : 0;
        final c = i < cParts.length ? cParts[i] : 0;
        if (l > c) return true;
        if (l < c) return false;
      }
    } catch (_) {}
    return false;
  }

  Future<void> _checkForUpdates() async {
    try {
      final res = await http.get(
        Uri.parse('https://api.github.com/repos/Finoraaa/FPN/releases/latest'),
        headers: {
          'User-Agent': 'FPN-Mobile-Client',
          'Accept': 'application/vnd.github.v3+json',
        },
      ).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final tag = (data['tag_name'] as String? ?? '').replaceFirst('v', '');
        if (_isNewerVersion(tag, currentAppVersion)) {
          final assets = data['assets'] as List<dynamic>? ?? [];
          final apkAsset = assets.firstWhere(
            (a) => (a['name'] as String? ?? '').endsWith('.apk'),
            orElse: () => null,
          );

          if (apkAsset != null && apkAsset['browser_download_url'] != null) {
            if (mounted) {
              setState(() {
                hasUpdate = true;
                latestVersion = tag;
                updateDownloadUrl = apkAsset['browser_download_url'] as String;
                updateReleaseNotes = data['body'] as String? ?? '';
              });
            }
          }
        }
      }
    } catch (e) {
      debugPrint("Mobil güncelleme kontrol hatası: $e");
    }
  }

  Future<void> _startOtaUpdate() async {
    if (updateDownloadUrl == null) return;
    _showToast("🚀 FPN APK indirmesi başlatılıyor...");
    try {
      final uri = Uri.parse(updateDownloadUrl!);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        _showToast("İndirme bağlantısı açılamadı.");
      }
    } catch (e) {
      _showToast("Hata oluştu: $e");
    }
  }

  Widget _buildUpdateBanner() {
    return Container(
      margin: const EdgeInsets.only(top: 14, bottom: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF141419),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: const Color(0xFF10B981).withValues(alpha: 0.4),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF10B981).withValues(alpha: 0.1),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Text("🚀", style: TextStyle(fontSize: 16)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Yeni FPN Sürümü Mevcut: v${latestVersion ?? ''}",
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      (updateReleaseNotes?.split('\n').first.trim().isNotEmpty ?? false)
                          ? updateReleaseNotes!.split('\n').first.trim()
                          : "Kararlılık ve hız güncellemelerini almak için tek dokunuşla güncelleyin.",
                      style: const TextStyle(
                        fontSize: 11,
                        color: Colors.white60,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 16, color: Colors.white54),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () => setState(() => hasUpdate = false),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 38,
            child: ElevatedButton.icon(
              onPressed: _startOtaUpdate,
              icon: const Icon(Icons.bolt, size: 16, color: Colors.black),
              label: const Text(
                "Tek Tıkla İndir & Güncelle",
                style: TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- Abonelik / Sub URL Yöneticisi ---
  Future<void> _fetchSubscription(String url) async {
    try {
      _showToast("Abonelik sunucuları indiriliyor...");
      final response = await http.get(Uri.parse(url.trim()));
      if (response.statusCode == 200) {
        String body = response.body.trim();
        // Base64 decode dene
        try {
          final normalized = base64.normalize(body.replaceAll('\n', '').replaceAll('\r', ''));
          body = utf8.decode(base64.decode(normalized));
        } catch (_) {
          // Zaten düz metin olabilir
        }

        final lines = body.split(RegExp(r'[\r\n]+'));
        int addedCount = 0;

        for (final line in lines) {
          final trimmed = line.trim();
          if (trimmed.startsWith('vless://')) {
            try {
              final parsed = FlutterV2ray.parseFromURL(trimmed);
              final newNode = FpnNode(
                id: 'sub-${DateTime.now().microsecondsSinceEpoch}-$addedCount',
                name: parsed.remark.isNotEmpty
                    ? parsed.remark
                    : 'Sub Düğüm ${nodes.length + 1}',
                country: 'Abonelik',
                flag: '⚡',
                vlessUri: trimmed,
              );
              // Tekrarı engelle
              if (!nodes.any((n) => n.vlessUri == trimmed)) {
                nodes.insert(0, newNode);
                addedCount++;
              }
            } catch (_) {}
          }
        }

        if (!subscriptionUrls.contains(url)) {
          subscriptionUrls.add(url);
        }
        await _savePreferences();
        setState(() {});
        _showToast("✅ $addedCount yeni VLESS sunucusu eklendi!");
      } else {
        _showToast("Abonelik çekilemedi: HTTP ${response.statusCode}");
      }
    } catch (e) {
      _showToast("Abonelik hatası: $e");
    }
  }

  void _showToast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF1E1E24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  static const MethodChannel _appChannel =
      MethodChannel('com.freedom.fpn_mobile/app');

  Future<void> _openBrowser(String url) async {
    try {
      await _appChannel.invokeMethod('openUrl', {'url': url});
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: url));
      _showToast("Bağlantı panoya kopyalandı!");
    }
  }

  void _showDonateModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF121217),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.85,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (context, scrollController) {
            return SingleChildScrollView(
              controller: scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Center(
                    child: Container(
                      width: 42,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF43F5E).withOpacity(0.15),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.favorite_rounded,
                              color: Color(0xFFF43F5E),
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "Geliştiriciye Destek Ol",
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                "FPN'i ayakta tutmak için bağış yapın",
                                style: TextStyle(
                                    fontSize: 12, color: Colors.white54),
                              ),
                            ],
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white70),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.04),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: const Text(
                      "FPN tamamen ücretsiz, açık kaynak ve sansürsüzdür. Sunucu maliyetlerine ve projenin geliştirilmesine katkıda bulunmak için dilediğiniz miktarda bağış yapabilirsiniz 💖",
                      style: TextStyle(
                          fontSize: 13, color: Colors.white70, height: 1.4),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFF43F5E).withOpacity(0.2),
                          blurRadius: 24,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.asset(
                            'assets/images/donate_qr.png',
                            width: 190,
                            height: 190,
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) {
                              return const SizedBox(
                                width: 190,
                                height: 190,
                                child: Center(
                                  child: Icon(Icons.qr_code_2_rounded,
                                      size: 120, color: Colors.black87),
                                ),
                              );
                            },
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          "Kameranızla QR kodu okutun",
                          style: TextStyle(
                            color: Colors.black54,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF09090B),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.1)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.link_rounded,
                            size: 18, color: Color(0xFF38BDF8)),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            "https://donatr.ee/fnora/",
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.white,
                              fontWeight: FontWeight.w500,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.copy_rounded,
                              size: 18, color: Colors.white70),
                          tooltip: "Linki Kopyala",
                          onPressed: () {
                            Clipboard.setData(const ClipboardData(
                                text: "https://donatr.ee/fnora/"));
                            _showToast("💖 Bağış linki kopyalandı!");
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF43F5E),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      onPressed: () {
                        _openBrowser("https://donatr.ee/fnora/");
                      },
                      icon:
                          const Icon(Icons.open_in_browser_rounded, size: 20),
                      label: const Text(
                        "Tarayıcıda donatr.ee Sayfasını Aç",
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _buildChipBadge("💳 Kredi Kartı"),
                      const SizedBox(width: 8),
                      _buildChipBadge("⚡ Papara"),
                      const SizedBox(width: 8),
                      _buildChipBadge("🔒 256-Bit SSL"),
                    ],
                  ),
                  const SizedBox(height: 10),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildChipBadge(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.06),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Text(
        text,
        style: const TextStyle(fontSize: 11, color: Colors.white60),
      ),
    );
  }

  // --- Ayarlar ve Bölünmüş Tünel Modalı ---
  void _showSettingsModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF121217),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.tune_rounded, color: Color(0xFF38BDF8)),
                          SizedBox(width: 8),
                          Text(
                            "FPN Gelişmiş Ayarlar",
                            style: TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // 1. Bölünmüş Tünel (Bypass Türkiye)
                  SwitchListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    tileColor: Colors.white.withOpacity(0.03),
                    title: const Text(
                      "Bölünmüş Tünel (Split Tunneling)",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    subtitle: const Text(
                      "Türk Bankaları, e-Devlet ve yerel alışveriş uygulamalarını VPN'den muaf tutar; tam hızda çalıştırır.",
                      style: TextStyle(fontSize: 12, color: Colors.white60),
                    ),
                    value: bypassTurkeyApps,
                    activeColor: const Color(0xFF10B981),
                    onChanged: (val) {
                      setModalState(() => bypassTurkeyApps = val);
                      setState(() => bypassTurkeyApps = val);
                      _savePreferences();
                    },
                  ),

                  const SizedBox(height: 10),

                  // 2. Kill Switch
                  SwitchListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    tileColor: Colors.white.withOpacity(0.03),
                    title: const Text(
                      "Kill Switch (Sızıntı Koruması)",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    subtitle: const Text(
                      "VPN bağlantısı beklenmedik şekilde kesilirse veri sızıntılarını önlemek için uyarı verir.",
                      style: TextStyle(fontSize: 12, color: Colors.white60),
                    ),
                    value: killSwitchEnabled,
                    activeColor: const Color(0xFFF43F5E),
                    onChanged: (val) {
                      setModalState(() => killSwitchEnabled = val);
                      setState(() => killSwitchEnabled = val);
                      _savePreferences();
                    },
                  ),

                  const SizedBox(height: 10),

                  // 3. Otomatik En Hızlı Sunucu
                  SwitchListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    tileColor: Colors.white.withOpacity(0.03),
                    title: const Text(
                      "Her Bağlantıda En Hızlı Sunucuyu Seç",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    subtitle: const Text(
                      "Bağlan'a bastığınızda en düşük pingli düğümü otomatik tespit edip bağlanır.",
                      style: TextStyle(fontSize: 12, color: Colors.white60),
                    ),
                    value: autoConnectFastest,
                    activeColor: const Color(0xFF38BDF8),
                    onChanged: (val) {
                      setModalState(() => autoConnectFastest = val);
                      setState(() => autoConnectFastest = val);
                      _savePreferences();
                    },
                  ),

                  const SizedBox(height: 16),

                  // Abonelik Linkleri Butonu
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          vertical: 14, horizontal: 16),
                      side: BorderSide(color: Colors.white.withOpacity(0.15)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: () {
                      Navigator.pop(context);
                      _showSubscriptionDialog();
                    },
                    icon: const Icon(Icons.rss_feed_rounded,
                        color: Color(0xFF38BDF8)),
                    label: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          "Abonelik (Subscription) Yönetimi",
                          style: TextStyle(color: Colors.white),
                        ),
                        Text(
                          "${subscriptionUrls.length} Aktif Sub",
                          style: const TextStyle(
                              color: Color(0xFF38BDF8), fontSize: 12),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 10),

                  // Sıfırlama Butonu
                  TextButton.icon(
                    onPressed: () async {
                      final confirm = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          backgroundColor: const Color(0xFF18181B),
                          title: const Text("Ayarları Sıfırla"),
                          content: const Text(
                              "Tüm eklenen özel sunucular ve ayarlar varsayılana dönecektir. Devam edilsin mi?"),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              child: const Text("İptal"),
                            ),
                            TextButton(
                              onPressed: () => Navigator.pop(ctx, true),
                              child: const Text("Sıfırla",
                                  style: TextStyle(color: Colors.redAccent)),
                            ),
                          ],
                        ),
                      );

                      if (confirm == true && mounted) {
                        setState(() {
                          nodes = List.from(defaultNodes);
                          selectedNode = nodes[0];
                          subscriptionUrls.clear();
                        });
                        await _savePreferences();
                        if (mounted) Navigator.pop(context);
                        _showToast("Tüm sunucular varsayılana sıfırlandı.");
                      }
                    },
                    icon: const Icon(Icons.refresh_rounded,
                        size: 16, color: Colors.white54),
                    label: const Text(
                      "Varsayılan Sunucuları Geri Yükle",
                      style: TextStyle(color: Colors.white54, fontSize: 12),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // --- Abonelik Ekleme Dialogu ---
  void _showSubscriptionDialog() {
    final textController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF121217),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.rss_feed_rounded, color: Color(0xFF38BDF8)),
              SizedBox(width: 8),
              Text("Abonelik (Sub) Linki Ekle"),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "v2ray / VLESS abonelik linkinizi (http/https) girin. Sunucular otomatik çekilecek ve kaydedilecektir:",
                style: TextStyle(fontSize: 12, color: Colors.white70),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: textController,
                decoration: InputDecoration(
                  hintText: "https://example.com/sub/...",
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.05),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              if (subscriptionUrls.isNotEmpty) ...[
                const SizedBox(height: 14),
                const Text(
                  "Kayıtlı Abonelikler:",
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Colors.white54),
                ),
                ...subscriptionUrls.map((url) => Text(
                      "• $url",
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFF38BDF8)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    )),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("İptal"),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
              ),
              onPressed: () {
                final url = textController.text.trim();
                if (url.startsWith('http://') || url.startsWith('https://')) {
                  Navigator.pop(ctx);
                  _fetchSubscription(url);
                } else {
                  _showToast("Geçerli bir http/https linki girin.");
                }
              },
              child: const Text("İndir & Kaydet"),
            ),
          ],
        );
      },
    );
  }

  void _showNodeSelector() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF121217),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.7,
          minChildSize: 0.4,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) {
            return Padding(
              padding:
                  const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Text(
                            "Çıkış Sunucusu Seçin",
                            style: TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.white10,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              "${nodes.length}",
                              style: const TextStyle(
                                  fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.paste_rounded,
                                color: Color(0xFF38BDF8), size: 20),
                            tooltip: "Panodan Ekle",
                            onPressed: () {
                              Navigator.pop(context);
                              _importFromClipboard();
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.close),
                            onPressed: () => Navigator.pop(context),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Otomatik En Hızlı Sunucu Butonu
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981).withOpacity(0.15),
                        foregroundColor: const Color(0xFF10B981),
                        elevation: 0,
                        side: const BorderSide(
                            color: Color(0xFF10B981), width: 1.2),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () async {
                        Navigator.pop(context);
                        await _autoSelectFastestNode();
                      },
                      icon: isTestingAllPings
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xFF10B981),
                              ),
                            )
                          : const Icon(Icons.bolt_rounded, size: 18),
                      label: const Text(
                        "⚡ En Düşük Gecikmeli Sunucuyu Otomatik Seç",
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  Expanded(
                    child: ListView.separated(
                      controller: scrollController,
                      itemCount: nodes.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final node = nodes[index];
                        final isSelected = node.id == selectedNode.id;

                        return ListTile(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                            side: BorderSide(
                              color: isSelected
                                  ? const Color(0xFF10B981)
                                  : Colors.white.withOpacity(0.06),
                            ),
                          ),
                          tileColor: isSelected
                              ? const Color(0xFF10B981).withOpacity(0.1)
                              : Colors.white.withOpacity(0.02),
                          leading: Text(node.flag,
                              style: const TextStyle(fontSize: 26)),
                          title: Text(
                            node.name,
                            style: TextStyle(
                              fontWeight: isSelected
                                  ? FontWeight.bold
                                  : FontWeight.normal,
                              color: isSelected
                                  ? const Color(0xFF10B981)
                                  : Colors.white,
                              fontSize: 14,
                            ),
                          ),
                          subtitle: Text(
                            "${node.country} • ${node.ping != null && node.ping! > 0 ? '${node.ping} ms' : 'Test edilmedi'}",
                            style: TextStyle(
                              color: node.ping != null && node.ping! > 0
                                  ? Colors.greenAccent
                                  : Colors.white54,
                              fontSize: 11,
                            ),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (isSelected)
                                const Icon(Icons.check_circle_rounded,
                                    color: Color(0xFF10B981)),
                              if (!defaultNodes.any((d) => d.id == node.id))
                                IconButton(
                                  icon: const Icon(Icons.delete_outline_rounded,
                                      size: 18, color: Colors.white38),
                                  onPressed: () {
                                    setState(() {
                                      nodes.removeAt(index);
                                      if (selectedNode.id == node.id &&
                                          nodes.isNotEmpty) {
                                        selectedNode = nodes[0];
                                      }
                                    });
                                    _savePreferences();
                                    Navigator.pop(context);
                                    _showToast("Sunucu silindi.");
                                  },
                                ),
                            ],
                          ),
                          onTap: () {
                            setState(() => selectedNode = node);
                            _savePreferences();
                            Navigator.pop(context);
                            if (isConnected) {
                              toggleConnection()
                                  .then((_) => toggleConnection());
                            }
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _importFromClipboard() async {
    final data = await Clipboard.getData('text/plain');
    final text = data?.text?.trim() ?? '';
    if (text.startsWith('vless://')) {
      try {
        final parsed = FlutterV2ray.parseFromURL(text);
        final newNode = FpnNode(
          id: 'custom-${DateTime.now().millisecondsSinceEpoch}',
          name: parsed.remark.isNotEmpty ? parsed.remark : 'Özel Sunucu',
          country: 'Özel VLESS',
          flag: '🌐',
          vlessUri: text,
        );
        setState(() {
          nodes.insert(0, newNode);
          selectedNode = newNode;
        });
        await _savePreferences();
        _showToast("Yeni VLESS sunucusu eklendi ve kaydedildi!");
      } catch (e) {
        _showToast("Geçersiz VLESS bağlantısı: $e");
      }
    } else {
      _showToast("Panoda geçerli bir vless:// bağlantısı bulunamadı.");
    }
  }

  // ignore: unused_element
  String _formatSpeed(int bytesPerSec) {
    if (bytesPerSec < 1024) return "$bytesPerSec B/s";
    if (bytesPerSec < 1024 * 1024) {
      return "${(bytesPerSec / 1024).toStringAsFixed(1)} KB/s";
    }
    return "${(bytesPerSec / (1024 * 1024)).toStringAsFixed(1)} MB/s";
  }

  @override
  Widget build(BuildContext context) {
    final activeColor = isConnected
        ? const Color(0xFF10B981)
        : (isConnecting ? Colors.amber : const Color(0xFF38BDF8));

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            children: [
              // Üst Logo, Ayarlar & Başlık Barı
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF121217),
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: Colors.white.withOpacity(0.2),
                              width: 1.5),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.white.withOpacity(0.08),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                        child: ClipOval(
                          child: Image.asset(
                            'assets/images/wolf_logo.png',
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "FPN",
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.2,
                            ),
                          ),
                          Text(
                            "Freedom Private Network",
                            style: TextStyle(
                                fontSize: 11, color: Colors.white54),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      // Ayarlar Butonu
                      IconButton(
                        tooltip: "Gelişmiş Ayarlar",
                        icon: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF121217),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color: Colors.white.withOpacity(0.08)),
                          ),
                          child: const Icon(Icons.settings_outlined,
                              size: 18, color: Colors.white70),
                        ),
                        onPressed: _showSettingsModal,
                      ),
                      // Destek Butonu
                      GestureDetector(
                        onTap: _showDonateModal,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF43F5E).withOpacity(0.12),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color:
                                    const Color(0xFFF43F5E).withOpacity(0.3)),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.favorite_rounded,
                                  size: 14, color: Color(0xFFF43F5E)),
                              SizedBox(width: 4),
                              Text(
                                "Destek",
                                style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFFF43F5E)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              // OTA Güncelleme Bildirim Çubuğu
              if (hasUpdate) _buildUpdateBanner(),

              const Spacer(),

              // Dev Güç / Bağlantı Butonu (Animasyonlu)
              Center(
                child: GestureDetector(
                  onTap: toggleConnection,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Nabız Halesi (Pulsing Ring)
                      if (isConnected)
                        AnimatedBuilder(
                          animation: _pulseController,
                          builder: (context, child) {
                            return Container(
                              width: 220 + (_pulseController.value * 25),
                              height: 220 + (_pulseController.value * 25),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFF10B981).withOpacity(
                                  0.15 * (1 - _pulseController.value),
                                ),
                              ),
                            );
                          },
                        ),
                      // Dış Çerçeve
                      Container(
                        width: 200,
                        height: 200,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF121217),
                          border: Border.all(
                            color:
                                activeColor.withOpacity(isConnected ? 0.8 : 0.3),
                            width: 3.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: activeColor
                                  .withOpacity(isConnected ? 0.35 : 0.05),
                              blurRadius: 30,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.power_settings_new_rounded,
                              size: 58,
                              color: activeColor,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              isConnected
                                  ? "BAĞLI"
                                  : (isConnecting
                                      ? "BAĞLANIYOR..."
                                      : "BAĞLAN"),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.5,
                                color: activeColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Bağlantı Durumu & Mod Bilgisi
              Text(
                isConnected
                    ? "GÜVENDESİNİZ • SANSÜRSÜZ İNTERNET"
                    : "Sansürsüz ve güvenli internet için butona dokunun",
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isConnected ? FontWeight.bold : FontWeight.normal,
                  color:
                      isConnected ? const Color(0xFF10B981) : Colors.white60,
                ),
              ),

              if (bypassTurkeyApps && isConnected) ...[
                const SizedBox(height: 4),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    "🛡️ Türk Bankaları & e-Devlet Doğrudan Bağlı (Bölünmüş Tünel)",
                    style: TextStyle(fontSize: 10, color: Color(0xFF10B981)),
                  ),
                ),
              ],

              if (isConnected) ...[
                const SizedBox(height: 6),
                ValueListenableBuilder<V2RayStatus>(
                  valueListenable: v2rayStatus,
                  builder: (context, status, _) {
                    return Text(
                      "⏱️ Bağlantı Süresi: ${status.duration}",
                      style:
                          const TextStyle(fontSize: 12, color: Colors.white70),
                    );
                  },
                ),
              ],

              const SizedBox(height: 20),

              // Sunucu Seçim Kartı (Tıklanabilir - Aktif Çıkış Noktası)
              InkWell(
                onTap: _showNodeSelector,
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF121217),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withOpacity(0.08)),
                  ),
                  child: Row(
                    children: [
                      Text(selectedNode.flag,
                          style: const TextStyle(fontSize: 30)),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              "HEDEF ÇIKIŞ ÜLKESİ",
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Colors.white54,
                                letterSpacing: 0.8,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              selectedNode.name,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Row(
                          children: [
                            Text(
                              "Değiştir",
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF38BDF8),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Icon(Icons.keyboard_arrow_down,
                                size: 16, color: Color(0xFF38BDF8)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const Spacer(),

              // Geliştiriciye Destek Ol (Bağış) Kartı
              InkWell(
                onTap: _showDonateModal,
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        const Color(0xFFF43F5E).withOpacity(0.12),
                        const Color(0xFF8B5CF6).withOpacity(0.06),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                        color: const Color(0xFFF43F5E).withOpacity(0.25)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF43F5E).withOpacity(0.18),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.volunteer_activism_rounded,
                          color: Color(0xFFF43F5E),
                          size: 18,
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Geliştiriciye Destek Ol (Bağış)",
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              "QR Kod & donatr.ee/fnora ile katkıda bulunun",
                              style: TextStyle(
                                fontSize: 10,
                                color: Colors.white54,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 12,
                        color: Colors.white38,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ignore: unused_element
  Widget _buildMetric({
    required IconData icon,
    required Color color,
    required String label,
    required String value,
  }) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 3),
            Text(
              label,
              style: const TextStyle(
                fontSize: 9,
                color: Colors.white54,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}
