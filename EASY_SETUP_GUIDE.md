# 📱 Complete Setup Guide for NutriSafe App (For Beginners)

A step-by-step guide for non-technical users to set up, install, and run the NutriSafe mobile application on a PC and test it on an Android phone using Expo Go.

---

## 🛠️ Step 1: Install Required Software (One-Time Setup)

Before starting, install these 3 items on your computer and phone:

1. **Node.js (for PC)**:
   - Download and install Node.js (LTS version, 22 or newer) from [nodejs.org](https://nodejs.org/).
   - Click "Next" through all installation prompts.
   - This project uses **pnpm** — after installing Node.js, enable it once:
     ```cmd
     corepack enable
     ```

2. **Git (for PC)**:
   - Download and install Git from [git-scm.com](https://git-scm.com/).
   - Keep all default options during setup.

3. **Expo Go App (for Android Phone)**:
   - Search for **Expo Go** on the [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) and install it on your Android phone.

> ⚠️ **Important Requirement**: Your PC and Android phone **must be connected to the exact same Wi-Fi network**.

---

## 📥 Step 2: Clone the Project Repository

1. Press `Win + R` on your keyboard, type `cmd`, and press **Enter** to open Command Prompt.
2. Clone the NutriSafe project repository to your PC:
   ```cmd
   git clone https://github.com/Priyanshudotdev/nutrisafe.git
   ```
3. Enter the project folder:
   ```cmd
   cd nutrisafe
   ```

---

## 📦 Step 3: Install Project Dependencies

Run the following command inside the `nutrisafe` folder to install all required packages:

```cmd
pnpm install
```

_(This may take 1–2 minutes. Wait until it finishes completely.)_

---

## ⚙️ Step 4: Start the Backend Server

The app requires the NutriSafe API backend server to handle account creation, login, and data storage.

1. In your Command Prompt window, run:
   ```cmd
   pnpm api
   ```
2. You will see a message:
   `NutriSafe API server running on http://0.0.0.0:4000`
3. 📌 **Keep this terminal window OPEN!** Do not close it while using the app.

> 🤖 **Optional — real photo recognition:** copy `.env.example` to `.env.local`,
> add your `GEMINI_API_KEY` (free tier at Google AI Studio), and restart
> `pnpm api`. Without a key the app still works — food checks use the built-in
> rules engine and photo scans will tell you to use manual search instead.

---

## 🚀 Step 5: Start the Mobile App (Expo)

1. Open a **second** Command Prompt window (`Win + R` -> `cmd`).
2. Navigate into the `nutrisafe` folder:
   ```cmd
   cd nutrisafe
   ```
   _(Or specify the full path if you saved it elsewhere, e.g. `cd C:\Users\priya\Code\testing\nutrisafe`)_
3. Start the Expo mobile app server:
   ```cmd
   pnpm start
   ```
4. A large **QR Code** will be displayed inside your terminal window.

---

## 📲 Step 6: Scan the QR Code on Your Android Phone

1. Open the **Expo Go** app on your Android phone.
2. Tap the **"Scan QR Code"** button.
3. Point your phone camera at the QR code shown on your PC screen.
4. The NutriSafe mobile app will build and open directly on your phone!

---

## 💡 Troubleshooting & Common Fixes

- **"Cannot reach NutriSafe API" or Connection Error**:
  - Make sure **both** terminal windows are running: `pnpm api` in one, and `pnpm start` in the other.
  - Ensure your phone and PC are connected to the **same Wi-Fi**.
  - If Windows Firewall prompts you, click **Allow access** for Node.js.

- **How to stop the app**:
  - Click on each terminal window and press `Ctrl + C`, then type `y` and press **Enter**.

---

## 📦 Installing a standalone Android build (EAS)

Expo Go can discover the API running on your PC. A standalone APK cannot: it needs a public HTTPS API URL embedded at build time. Both the `preview` and `production` EAS profiles are configured to use the deployed NutriSafe API.

Build a new APK after changing the API URL or EAS configuration:

```cmd
eas build --platform android --profile preview
```

For a store/release build, use:

```cmd
eas build --platform android --profile production
```

> Do not reinstall an APK built before the EAS configuration was updated. Its embedded API URL may still be `localhost`, which points to the phone/emulator itself. In that case text checks can still show local rule-engine results, but photo scanning cannot reach the server.
