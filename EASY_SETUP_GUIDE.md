# 📱 Easy Setup Guide for NutriSafe App

A simple step-by-step guide for non-technical users to run the NutriSafe backend and mobile app on a Windows PC and view it on an Android phone using Expo Go.

---

## 📋 Prerequisites

Before starting, make sure you have:
1. **Node.js** installed on your PC ([Download Node.js](https://nodejs.org/)).
2. **Expo Go** app installed on your Android phone from the [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).
3. **Same Wi-Fi Network**: Ensure your PC and Android phone are connected to the exact same Wi-Fi network.

---

## 🚀 Step-by-Step Instructions

### Step 1: Open Terminal / Command Prompt on PC
1. Press `Win + R` on your keyboard, type `cmd`, and press **Enter**.
2. Navigate to the project folder by running:
   ```cmd
   cd C:\Users\priya\Code\testing\nutrisafe
   ```

---

### Step 2: Install Project Dependencies (First Time Only)
Run the following command to install all necessary packages:
```cmd
npm install
```

---

### Step 3: Start the Backend Server
The app requires the NutriCheck API server to handle signup, login, and data storage.

1. Open a terminal window and run:
   ```cmd
   npm run api
   ```
2. You will see a message: `NutriCheck API server running on http://0.0.0.0:4000`.
3. **Keep this window open** while using the app!

---

### Step 4: Start the Mobile App (Expo)
1. Open a **second** terminal window / Command Prompt.
2. Navigate to the project directory:
   ```cmd
   cd C:\Users\priya\Code\testing\nutrisafe
   ```
3. Start the Expo development server:
   ```cmd
   npm run start
   ```
4. A large **QR Code** will appear inside your terminal window.

---

### Step 5: Connect Your Android Phone
1. Open the **Expo Go** app on your Android phone.
2. Tap **"Scan QR Code"**.
3. Point your phone camera at the QR code displayed in your PC terminal.
4. Wait a few seconds for the app to load on your phone!

---

## ❓ Troubleshooting & Tips

- **Cannot connect / Network Error during Signup**:
  - Make sure **both** `npm run api` and `npm run start` are actively running.
  - Check that your phone and PC are connected to the **same Wi-Fi**.
  - Check Windows Firewall: allow Node.js if prompted.

- **To Stop the Servers**:
  - Click on the terminal window and press `Ctrl + C`.
