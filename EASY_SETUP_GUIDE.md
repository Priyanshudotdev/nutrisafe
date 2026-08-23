# 📱 Complete Setup Guide for NutriSafe App (For Beginners)

A step-by-step guide for non-technical users to set up, install, and run the NutriSafe mobile application on a PC and test it on an Android phone using Expo Go.

---

## 🛠️ Step 1: Install Required Software (One-Time Setup)

Before starting, install these 3 items on your computer and phone:

1. **Node.js (for PC)**:
   - Download and install Node.js (LTS version) from [nodejs.org](https://nodejs.org/).
   - Click "Next" through all installation prompts.

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
npm install
```
*(This may take 1–2 minutes. Wait until it finishes completely.)*

---

## ⚙️ Step 4: Start the Backend Server

The app requires the NutriCheck API backend server to handle account creation, login, and data storage.

1. In your Command Prompt window, run:
   ```cmd
   npm run api
   ```
2. You will see a message:
   `NutriCheck API server running on http://0.0.0.0:4000`
3. 📌 **Keep this terminal window OPEN!** Do not close it while using the app.

---

## 🚀 Step 5: Start the Mobile App (Expo)

1. Open a **second** Command Prompt window (`Win + R` -> `cmd`).
2. Navigate into the `nutrisafe` folder:
   ```cmd
   cd nutrisafe
   ```
   *(Or specify the full path if you saved it elsewhere, e.g. `cd C:\Users\priya\Code\testing\nutrisafe`)*
3. Start the Expo mobile app server:
   ```cmd
   npm run start
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

- **"Cannot reach NutriCheck API" or Connection Error**:
  - Make sure **both** terminal windows are running: `npm run api` in one, and `npm run start` in the other.
  - Ensure your phone and PC are connected to the **same Wi-Fi**.
  - If Windows Firewall prompts you, click **Allow access** for Node.js.

- **How to stop the app**:
  - Click on each terminal window and press `Ctrl + C`, then type `y` and press **Enter**.
