# SIGHTA Guardian App

Mobile companion app for the SIGHTA smart assistive glasses FYP. Guardians (family/caregivers)
log in to see the visually impaired user's live location, receive SOS/battery/device alerts,
and review activity history.

## Stack
- Frontend: React Native (Expo) + JavaScript, React Navigation, Axios, react-native-maps
- Backend: Express.js REST API, JWT auth, bcrypt
- Database: MongoDB Atlas (Mongoose)

## Run the backend
```
cd backend
npm install
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm run dev                # starts on http://localhost:5000
```

## Run the frontend
```
cd frontend
npm install
```
Before starting, open `frontend/src/api/axiosConfig.js` and set `BASE_URL`:
- Android emulator → `http://10.0.2.2:5000/api`
- Physical phone (Expo Go) → `http://<your-computer-LAN-IP>:5000/api`
- Deployed backend → its public URL

Then:
```
npx expo start
```
Scan the QR code with the Expo Go app (iOS/Android) to run it on your phone.

## Google Maps
Live tracking uses `react-native-maps`. Add your Google Maps API keys in `frontend/app.json`
under `ios.config.googleMapsApiKey` and `android.config.googleMaps.apiKey`, or the map will
fall back to a placeholder.

## Notes
- The MVP screens match the approved Stitch designs (login, register, dashboard, live tracking,
  alerts, history, profile). Notification Settings was added as a sub-screen under Profile since
  it appeared in the design set but wasn't in the original folder structure.
- Firebase Cloud Messaging (push notifications) is listed in the stack but not wired up yet —
  the `fcmToken` field exists on the User model, ready for it.
