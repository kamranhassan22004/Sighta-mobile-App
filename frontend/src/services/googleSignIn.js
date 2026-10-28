import Constants from "expo-constants";
import { Platform } from "react-native";

export async function getGoogleIdentityToken() {
  if (Platform.OS !== "android" || Constants.appOwnership === "expo") {
    throw new Error("Google sign-in requires the configured SIGHTA Android build. It is not available in Expo Go.");
  }
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw new Error("Google sign-in is not configured yet. Please use email and password.");
  let sdk;
  try { sdk = require("@react-native-google-signin/google-signin"); }
  catch { throw new Error("Please install a new SIGHTA Android build with Google sign-in support."); }
  const { GoogleSignin, statusCodes } = sdk;
  try {
    GoogleSignin.configure({ webClientId, offlineAccess: false });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Clear the Google SDK's local selection so the account chooser opens again.
    // This does not sign the user out of their Google account on the phone.
    if (GoogleSignin.hasPreviousSignIn()) await GoogleSignin.signOut();
    const response = await GoogleSignin.signIn();
    if (response.type === "cancelled") return null;
    const idToken = response.data?.idToken;
    if (!idToken) throw new Error("Google did not return an identity token. Please try again.");
    return idToken;
  } catch (error) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    if (error.code === statusCodes.IN_PROGRESS) return null;
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Please update Google Play Services and try again.");
    }
    throw new Error("Google sign-in could not complete. Check your connection and try again. If it continues, check this build's Google configuration.");
  }
}
