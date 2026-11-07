// Unbox for iPhone: the web app inside a native shell.
// - Sign-in goes through Apple's secure sign-in sheet (Google refuses to sign in inside an app's web view).
// - The personal widget address is handed to the home-screen / lock-screen widgets through the shared app group.
// - Links to other sites open in Safari; the app itself stays on packetdrop.vercel.app.
import SwiftUI
import WebKit
import AuthenticationServices
import WidgetKit

let SITE = URL(string: "https://packetdrop.vercel.app")!
let GROUP = "group.com.eliorsasi.unbox"

@main
struct UnboxApp: App {
    var body: some Scene {
        WindowGroup {
            WebScreen()
                .ignoresSafeArea()
                .background(Color(red: 10/255, green: 15/255, blue: 20/255))
                .preferredColorScheme(.dark)
                // unbox://open?p=… from a widget
                .onOpenURL { NotificationCenter.default.post(name: .unboxOpenURL, object: $0) }
        }
    }
}

struct WebScreen: UIViewRepresentable {
    func makeCoordinator() -> Shell { Shell() }
    func makeUIView(context: Context) -> WKWebView { context.coordinator.web }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

final class Shell: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {
    let web: WKWebView
    private var session: ASWebAuthenticationSession?

    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.applicationNameForUserAgent = "UnboxApp/1"
        let ucc = WKUserContentController()
        // After each page load: hand the personal widget address to the widgets (same-origin request, the user's own session).
        let js = """
        (function(){try{fetch('/api/sms',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(d){
          if(d&&d.widget)window.webkit.messageHandlers.unbox.postMessage({type:'widget',url:d.widget});}).catch(function(){});}catch(e){}})();
        """
        ucc.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        config.userContentController = ucc
        web = WKWebView(frame: .zero, configuration: config)
        super.init()
        ucc.add(self, name: "unbox")
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 10/255, green: 15/255, blue: 20/255, alpha: 1)
        web.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { web.isInspectable = true }
        web.load(URLRequest(url: SITE))
        NotificationCenter.default.addObserver(self, selector: #selector(openURL(_:)), name: .unboxOpenURL, object: nil)
    }

    // Messages from the page.
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        if type == "widget", let url = body["url"] as? String, url.hasPrefix(SITE.absoluteString) {
            let store = UserDefaults(suiteName: GROUP)
            if store?.string(forKey: "widgetURL") != url {
                store?.set(url, forKey: "widgetURL")
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.allow) }
        let host = url.host ?? ""
        // Google sign-in: not inside the web view. The secure sign-in sheet takes over and hands the session back.
        if host.hasSuffix("accounts.google.com") || url.path.hasPrefix("/api/auth/signin") {
            decisionHandler(.cancel)
            signIn()
            return
        }
        if url.scheme == "unbox" { decisionHandler(.cancel); handle(url); return }
        if host == SITE.host || url.scheme == "about" || url.scheme == "blob" || url.scheme == "data" { return decisionHandler(.allow) }
        // Maps, Gmail, stores, couriers, tel:, mailto:, webcal: - the system opens them.
        if action.navigationType == .linkActivated || action.targetFrame == nil || !(url.scheme ?? "").hasPrefix("http") {
            decisionHandler(.cancel)
            UIApplication.shared.open(url)
            return
        }
        decisionHandler(.allow)
    }

    // target=_blank and window.open: same rule as links.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if url.host == SITE.host { webView.load(URLRequest(url: url)) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    private func signIn() {
        let start = SITE.appendingPathComponent("api/native/login")
        let s = ASWebAuthenticationSession(url: start, callbackURLScheme: "unbox") { [weak self] url, _ in
            if let url { self?.handle(url) }
        }
        s.presentationContextProvider = self
        s.prefersEphemeralWebBrowserSession = false
        session = s
        s.start()
    }

    // unbox://auth?code=… - the one-time code becomes the app's own session.
    private func handle(_ url: URL) {
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        if url.host == "auth", let code = items.first(where: { $0.name == "code" })?.value {
            var c = URLComponents(url: SITE.appendingPathComponent("api/native/claim"), resolvingAgainstBaseURL: false)!
            c.queryItems = [URLQueryItem(name: "code", value: code)]
            web.load(URLRequest(url: c.url!))
        } else if url.host == "open", let p = items.first(where: { $0.name == "p" })?.value {
            // From a widget: open that parcel.
            var c = URLComponents(url: SITE, resolvingAgainstBaseURL: false)!
            c.queryItems = [URLQueryItem(name: "p", value: p)]
            web.load(URLRequest(url: c.url!))
        }
    }

    @objc private func openURL(_ n: Notification) { if let url = n.object as? URL { handle(url) } }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
    }

    // alert / confirm from the page, as native dialogs.
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        present(UIAlertController(title: nil, message: message, preferredStyle: .alert), actions: [("אישור", true)]) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        present(UIAlertController(title: nil, message: message, preferredStyle: .alert), actions: [("ביטול", false), ("אישור", true)], done: completionHandler)
    }
    private func present(_ a: UIAlertController, actions: [(String, Bool)], done: @escaping (Bool) -> Void) {
        for (t, v) in actions { a.addAction(UIAlertAction(title: t, style: v ? .default : .cancel) { _ in done(v) }) }
        guard let root = UIApplication.shared.connectedScenes.compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first?.rootViewController else { return done(false) }
        root.present(a, animated: true)
    }
}

extension Notification.Name { static let unboxOpenURL = Notification.Name("unboxOpenURL") }
