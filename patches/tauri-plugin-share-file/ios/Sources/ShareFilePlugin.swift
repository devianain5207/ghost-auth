import UIKit
import Tauri

struct ShareFileArgs: Decodable {
    let path: String
    let mimeType: String
}

class ShareFilePlugin: Plugin {
    private func topViewController(from root: UIViewController) -> UIViewController {
        var top = root
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }

    @objc func shareFile(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(ShareFileArgs.self)
        let fileURL = URL(fileURLWithPath: args.path)

        guard FileManager.default.fileExists(atPath: args.path) else {
            invoke.reject("File not found at path: \(args.path)")
            return
        }

        let presentShareSheet = {
            guard
                let scene = UIApplication.shared.connectedScenes
                    .compactMap({ $0 as? UIWindowScene })
                    .first(where: { $0.activationState == .foregroundActive })
                    ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first
            else {
                invoke.reject("Could not find root view controller")
                return
            }

            let rootVC = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
                ?? scene.windows.first?.rootViewController
            guard let rootVC else {
                invoke.reject("Could not find root view controller")
                return
            }

            let presenter = self.topViewController(from: rootVC)
            let activityVC = UIActivityViewController(
                activityItems: [fileURL],
                applicationActivities: nil
            )

            // iPad requires popover configuration or it will crash
            if let popover = activityVC.popoverPresentationController {
                popover.sourceView = rootVC.view
                popover.sourceRect = CGRect(
                    x: rootVC.view.bounds.midX,
                    y: rootVC.view.bounds.midY,
                    width: 0, height: 0
                )
                popover.permittedArrowDirections = []
            }

            activityVC.completionWithItemsHandler = { _, completed, _, error in
                // Clean up the temp file regardless of outcome
                try? FileManager.default.removeItem(at: fileURL)

                if let error {
                    print("Share failed: \(error.localizedDescription)")
                } else {
                    print("Share completed: \(completed)")
                }
            }

            presenter.present(activityVC, animated: true) {
                invoke.resolve(["presented": true])
            }
        }

        if Thread.isMainThread {
            presentShareSheet()
        } else {
            DispatchQueue.main.async {
                presentShareSheet()
            }
        }
    }
}

@_cdecl("init_plugin_share_file")
func initPlugin() -> Plugin {
    return ShareFilePlugin()
}
