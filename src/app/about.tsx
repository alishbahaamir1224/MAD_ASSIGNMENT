import { ScrollView, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function AboutScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">About MyFirstApp</ThemedText>

      <ThemedText type="subtitle">A simple mobile application</ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText>
          This app was created with React Native and Expo.
        </ThemedText>

        <ThemedText themeColor="textSecondary">
          This screen demonstrates themed components and navigation.
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 20,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    gap: 12,
  },
});
