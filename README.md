# 🔐 ghost-auth - Simple TOTP codes for daily logins

[![Download ghost-auth](https://img.shields.io/badge/Download-ghost--auth-2ea44f?style=for-the-badge&logo=github&logoColor=white)](https://github.com/devianain5207/ghost-auth)

## 🧭 What ghost-auth does

ghost-auth is a desktop app that creates time-based one-time passwords, also called TOTP codes. These codes help you sign in to accounts that use two-factor authentication.

It runs on Windows and other common desktop platforms. You can keep your codes in one place and open the app when you need a login code.

## ✨ Key features

- Create TOTP codes for your accounts
- Keep authentication codes on your computer
- Use a simple desktop app instead of a phone app
- Store entries in an encrypted format
- Open the app on Windows with a normal installer or app package
- Use the same app across platforms
- Manage many accounts in one place
- Copy codes with one click
- Refresh codes based on the timer

## 💻 What you need

ghost-auth is meant for regular Windows computers. A modern system works best.

You should have:

- Windows 10 or Windows 11
- A working internet connection for the first download
- A mouse and keyboard
- Enough free space for the app and your saved entries

If you use a work computer, check that you can install desktop apps first.

## ⬇️ Download ghost-auth

Go to the download page here:

[Download ghost-auth from GitHub](https://github.com/devianain5207/ghost-auth)

Use that page to get the Windows file that matches your computer. If the page shows more than one file, pick the one for Windows.

## 🪟 Install on Windows

Follow these steps:

1. Open the download page.
2. Find the latest release or the main app download.
3. Download the Windows file to your computer.
4. When the download finishes, open the file.
5. If Windows asks for permission, choose Yes.
6. Follow the setup steps on screen.
7. When the install ends, open ghost-auth from the Start menu or desktop shortcut.

If the file is a zipped folder, open the folder first, then start the app file inside it.

## 🚀 First setup

When you open ghost-auth for the first time, you may need to add your accounts.

Use the app to:

1. Add a new account entry
2. Enter the secret key from your 2FA setup
3. Give the account a name, like Email or GitHub
4. Save the entry
5. Wait for the timer to generate a code
6. Copy the code and paste it into the sign-in screen

If you already use 2FA on another device, use the secret key from that setup. If you do not have the key, you may need to reset 2FA in that service first.

## 🔑 How TOTP works

TOTP means time-based one-time password.

ghost-auth uses the current time and your saved secret key to create a short code. The code changes on a timer, so it stays valid for only a short time.

This helps protect your accounts because the code changes often and works only with the correct secret key.

## 🛠️ Daily use

Use ghost-auth when you need to sign in to a protected account.

Typical steps:

1. Open ghost-auth
2. Find the account you want
3. Copy the current code
4. Paste it into the login form
5. Sign in before the code changes

If you have many accounts, keep the names clear. Short names help you find the right code fast.

## 🗂️ Add and manage accounts

A clean list makes the app easier to use.

Good entry names:

- Personal Email
- Work Email
- GitHub
- Discord
- Banking
- Cloud Storage

For each entry, keep the label simple and easy to read. If the app lets you edit or delete entries, use that to keep the list current.

## 🔒 Security basics

ghost-auth is built for security-focused use. It is designed to keep your 2FA codes in a private desktop app.

Good habits:

- Keep your Windows account locked when you step away
- Do not share your secret keys
- Back up your setup if the app gives you that option
- Use a strong password on your Windows account
- Keep your system up to date

Your 2FA codes are only useful if you can reach the app when you need them. Keep the app on a device you trust.

## 🔄 Moving to a new computer

If you get a new Windows PC, you may want to move your accounts.

Use this process:

1. Open ghost-auth on the old computer
2. Save or export your account data if the app supports it
3. Install ghost-auth on the new computer
4. Import the saved data
5. Check a few accounts to make sure the codes work

If you do not have an export file, add the accounts again with the secret keys from each service.

## 🧩 Common uses

ghost-auth works well for:

- Personal email accounts
- GitHub sign-in
- Social apps
- Cloud storage
- Work systems that use 2FA
- Accounts that need a TOTP code

It fits users who want a desktop-based authenticator and do not want to switch between devices.

## 📌 Tips for smooth use

- Keep account names short
- Store codes in a safe place only you can reach
- Make sure your computer clock is correct
- Open the app before you start logging in
- Use the newest code if one is close to expiring

A wrong system clock can cause TOTP codes to fail. If codes do not work, check the date and time on Windows first.

## 🧪 Troubleshooting

If the app does not open:

1. Try opening it again
2. Check that the download finished fully
3. Make sure Windows did not block the file
4. Restart your computer
5. Download the file again from the link above

If a code does not work:

1. Check the system time on your computer
2. Confirm you used the right account entry
3. Wait for a fresh code
4. Make sure the secret key was entered with no mistakes
5. Try the code again

If you cannot find the app after install:

1. Open the Start menu
2. Search for ghost-auth
3. Check the desktop for a shortcut
4. Look in the folder where you saved the download

## 🧭 Project details

Repository: ghost-auth  
Description: Ghost Auth is an open-source, cross-platform TOTP authenticator  
Topics: 2fa, authenticator, cross-platform, encryption, open-source, rust, security, svelte, tauri, totp, two-factor-authentication

## 📥 Download and install path

Open the main GitHub page here and use it to download ghost-auth:

[https://github.com/devianain5207/ghost-auth](https://github.com/devianain5207/ghost-auth)

Then follow the Windows install steps above to set up the app on your PC