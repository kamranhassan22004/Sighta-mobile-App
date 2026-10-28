import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Keep profile data in the existing cache; credentials live in Android Keystore.
const TOKEN_KEY = "sighta.session.token";
let migration;
async function migrate() {
  if (!migration) migration = (async () => {
    const legacy = await AsyncStorage.getItem("token");
    const cached = await AsyncStorage.getItem("user");
    let credential = await SecureStore.getItemAsync(TOKEN_KEY);
    if (legacy && !credential) {
      await SecureStore.setItemAsync(TOKEN_KEY, legacy);
      credential = legacy;
    }
    if (cached) {
      const profile = JSON.parse(cached);
      if (profile.token && profile.token !== credential) {
        // Never associate a cached identity with a different account's token.
        await AsyncStorage.removeItem("user");
      } else {
        delete profile.token;
        await AsyncStorage.setItem("user", JSON.stringify(profile));
      }
    }
    await AsyncStorage.removeItem("token");
  })().catch(error => { migration = null; throw error; });
  return migration;
}
const storage = {
  async getItem(key) {
    await migrate();
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (key === "token") return token;
    const value = await AsyncStorage.getItem(key);
    // Preserve AuthContext's existing cached-session contract in memory only.
    return key === "user" && value ? JSON.stringify({ ...JSON.parse(value), token }) : value;
  },
  async setItem(key, value) {
    await migrate();
    if (key === "token") return SecureStore.setItemAsync(TOKEN_KEY, value);
    if (key === "user") {
      const profile = JSON.parse(value);
      delete profile.token;
      value = JSON.stringify(profile);
    }
    return AsyncStorage.setItem(key, value);
  },
  async multiSet(pairs) { for (const [key, value] of pairs) await storage.setItem(key, value); },
  async multiRemove(keys) {
    await migrate();
    if (keys.includes("token")) await SecureStore.deleteItemAsync(TOKEN_KEY);
    await AsyncStorage.multiRemove(keys);
  },
};
export default storage;
