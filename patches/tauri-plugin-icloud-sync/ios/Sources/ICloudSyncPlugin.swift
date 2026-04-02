import Foundation
import Security
import Tauri

struct WriteBlobArgs: Decodable {
    let data: String
}

struct StoreKeyArgs: Decodable {
    let key: String
}

class ICloudSyncPlugin: Plugin {
    private var metadataQuery: NSMetadataQuery?

    // MARK: - iCloud Availability

    @objc func checkIcloudAvailable(_ invoke: Invoke) {
        let available = FileManager.default.ubiquityIdentityToken != nil
        invoke.resolve(["available": available])
    }

    // MARK: - Cloud Blob (iCloud Documents)

    @objc func readCloudBlob(_ invoke: Invoke) {
        DispatchQueue.global(qos: .userInitiated).async {
            guard let containerURL = FileManager.default.url(forUbiquityContainerIdentifier: nil) else {
                invoke.resolve(["data": NSNull()])
                return
            }

            let fileURL = containerURL.appendingPathComponent("Documents/ghost-auth-vault.enc")

            // Trigger download from iCloud if the file is a placeholder (not yet
            // downloaded to this device). This is a no-op if already local.
            try? FileManager.default.startDownloadingUbiquitousItem(at: fileURL)

            guard FileManager.default.fileExists(atPath: fileURL.path) else {
                invoke.resolve(["data": NSNull()])
                return
            }

            let coordinator = NSFileCoordinator()
            var coordinatorError: NSError?
            var readData: Data?
            var readError: String?

            coordinator.coordinate(readingItemAt: fileURL, options: [], error: &coordinatorError) { url in
                do {
                    readData = try Data(contentsOf: url)
                } catch {
                    readError = error.localizedDescription
                }
            }

            if let error = coordinatorError {
                invoke.reject("File coordination error: \(error.localizedDescription)")
            } else if let error = readError {
                invoke.reject("Read error: \(error)")
            } else if let data = readData {
                invoke.resolve(["data": data.base64EncodedString()])
            } else {
                invoke.resolve(["data": NSNull()])
            }
        }
    }

    @objc func writeCloudBlob(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(WriteBlobArgs.self)

        guard let rawData = Data(base64Encoded: args.data) else {
            invoke.reject("Invalid base64 data")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            guard let containerURL = FileManager.default.url(forUbiquityContainerIdentifier: nil) else {
                invoke.reject("iCloud container not available")
                return
            }

            let docsURL = containerURL.appendingPathComponent("Documents")
            let fileURL = docsURL.appendingPathComponent("ghost-auth-vault.enc")

            do {
                try FileManager.default.createDirectory(at: docsURL, withIntermediateDirectories: true)
            } catch {
                invoke.reject("Failed to create Documents directory: \(error.localizedDescription)")
                return
            }

            let coordinator = NSFileCoordinator()
            var coordinatorError: NSError?
            var writeError: String?

            coordinator.coordinate(writingItemAt: fileURL, options: .forReplacing, error: &coordinatorError) { url in
                do {
                    try rawData.write(to: url, options: .atomic)
                } catch {
                    writeError = error.localizedDescription
                }
            }

            if let error = coordinatorError {
                invoke.reject("File coordination error: \(error.localizedDescription)")
            } else if let error = writeError {
                invoke.reject("Write error: \(error)")
            } else {
                invoke.resolve([:])
            }
        }
    }

    // MARK: - iCloud Change Watching

    @objc func startWatching(_ invoke: Invoke) {
        // Resolve immediately — query setup is fire-and-forget on the main queue.
        // Putting invoke.resolve inside DispatchQueue.main.async deadlocks when
        // run_mobile_plugin blocks the main thread (synchronous Tauri command).
        invoke.resolve([:])

        DispatchQueue.main.async {
            self.metadataQuery?.stop()
            NotificationCenter.default.removeObserver(
                self, name: .NSMetadataQueryDidUpdate, object: self.metadataQuery)

            let query = NSMetadataQuery()
            query.searchScopes = [NSMetadataQueryUbiquitousDocumentsScope]
            query.predicate = NSPredicate(
                format: "%K == %@", NSMetadataItemFSNameKey, "ghost-auth-vault.enc")

            NotificationCenter.default.addObserver(
                self,
                selector: #selector(self.metadataQueryDidUpdate(_:)),
                name: .NSMetadataQueryDidUpdate,
                object: query
            )

            self.metadataQuery = query
            query.start()
        }
    }

    @objc private func metadataQueryDidUpdate(_ notification: Notification) {
        // Ensure the updated file is downloaded before notifying Rust.
        if let containerURL = FileManager.default.url(forUbiquityContainerIdentifier: nil) {
            let fileURL = containerURL.appendingPathComponent("Documents/ghost-auth-vault.enc")
            try? FileManager.default.startDownloadingUbiquitousItem(at: fileURL)
        }
        self.trigger("icloud-change", data: [:])
    }

    @objc func stopWatching(_ invoke: Invoke) {
        invoke.resolve([:])

        DispatchQueue.main.async {
            if let query = self.metadataQuery {
                query.stop()
                NotificationCenter.default.removeObserver(
                    self, name: .NSMetadataQueryDidUpdate, object: query)
                self.metadataQuery = nil
            }
        }
    }

    // MARK: - Cloud Sync Key (iCloud Keychain)

    @objc func loadCloudSyncKey(_ invoke: Invoke) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "ghost-auth-cloud-sync",
            kSecAttrAccount as String: "cloud-encryption-key",
            kSecAttrSynchronizable as String: true,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecSuccess, let data = result as? Data {
            invoke.resolve(["key": data.base64EncodedString()])
        } else if status == errSecItemNotFound {
            invoke.resolve(["key": NSNull()])
        } else {
            invoke.reject("Keychain read failed: OSStatus \(status)")
        }
    }

    @objc func storeCloudSyncKey(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(StoreKeyArgs.self)

        guard let keyData = Data(base64Encoded: args.key) else {
            invoke.reject("Invalid base64 key")
            return
        }

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "ghost-auth-cloud-sync",
            kSecAttrAccount as String: "cloud-encryption-key",
            kSecAttrSynchronizable as String: true,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
            kSecValueData as String: keyData,
        ]

        var status = SecItemAdd(addQuery as CFDictionary, nil)

        if status == errSecDuplicateItem {
            let matchQuery: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: "ghost-auth-cloud-sync",
                kSecAttrAccount as String: "cloud-encryption-key",
                kSecAttrSynchronizable as String: true,
            ]
            let updateAttrs: [String: Any] = [
                kSecValueData as String: keyData,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
            ]
            status = SecItemUpdate(matchQuery as CFDictionary, updateAttrs as CFDictionary)
        }

        if status == errSecSuccess {
            invoke.resolve([:])
        } else {
            invoke.reject("Keychain store failed: OSStatus \(status)")
        }
    }

    @objc func deleteCloudSyncKey(_ invoke: Invoke) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "ghost-auth-cloud-sync",
            kSecAttrAccount as String: "cloud-encryption-key",
            kSecAttrSynchronizable as String: true,
        ]

        let status = SecItemDelete(query as CFDictionary)

        if status == errSecSuccess || status == errSecItemNotFound {
            invoke.resolve([:])
        } else {
            invoke.reject("Keychain delete failed: OSStatus \(status)")
        }
    }
}

@_cdecl("init_plugin_icloud_sync")
func initPlugin() -> Plugin {
    return ICloudSyncPlugin()
}
