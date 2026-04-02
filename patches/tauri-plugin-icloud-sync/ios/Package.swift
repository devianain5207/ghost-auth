// swift-tools-version:5.3

import PackageDescription

let package = Package(
  name: "tauri-plugin-icloud-sync",
  platforms: [
    .iOS(.v14),
  ],
  products: [
    .library(
      name: "tauri-plugin-icloud-sync",
      type: .static,
      targets: ["tauri-plugin-icloud-sync"])
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api")
  ],
  targets: [
    .target(
      name: "tauri-plugin-icloud-sync",
      dependencies: [
        .byName(name: "Tauri")
      ],
      path: "Sources")
  ]
)
