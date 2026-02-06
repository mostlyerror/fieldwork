import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>PickleUp</Text>
      <Text style={{ marginTop: 8, color: "#666" }}>Coming soon</Text>
    </View>
  );
}
