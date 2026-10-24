import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private let CHANNEL = "com.freedom.fpn_mobile/app"

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let controller = engineBridge.pluginRegistry.window?.rootViewController as? FlutterViewController
    let binaryMessenger = controller?.binaryMessenger ?? engineBridge.pluginRegistry.registrar(forPlugin: "FPNApp")?.messenger()
    if let messenger = binaryMessenger {
      let channel = FlutterMethodChannel(name: CHANNEL, binaryMessenger: messenger)
      channel.setMethodCallHandler({ (call: FlutterMethodCall, result: @escaping FlutterResult) in
        if call.method == "openUrl" {
          guard let args = call.arguments as? [String: Any],
                let urlString = args["url"] as? String,
                let url = URL(string: urlString) else {
            result(FlutterError(code: "INVALID_URL", message: "URL is invalid", details: nil))
            return
          }
          UIApplication.shared.open(url, options: [:]) { success in
            result(success)
          }
        } else {
          result(FlutterMethodNotImplemented)
        }
      })
    }
  }
}
