import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { ApiError } from "./src/api/client";
import { fetchHello } from "./src/api/hello";

type ScreenState =
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export default function App() {
  const [state, setState] = useState<ScreenState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { message } = await fetchHello();
      setState({ status: "success", message });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "An unexpected error occurred.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      {state.status === "loading" && (
        <>
          <ActivityIndicator size="large" />
          <Text style={styles.caption}>Contacting the backend…</Text>
        </>
      )}

      {state.status === "success" && (
        <>
          <Text style={styles.heading}>Connected</Text>
          <Text style={styles.message}>{state.message}</Text>
        </>
      )}

      {state.status === "error" && (
        <>
          <Text style={styles.heading}>Could not connect</Text>
          <Text style={styles.error}>{state.message}</Text>
        </>
      )}

      <View style={styles.actions}>
        <Button
          title="Retry"
          onPress={() => void load()}
          disabled={state.status === "loading"}
        />
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  heading: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  caption: {
    marginTop: 12,
    color: "#666",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
  },
  error: {
    fontSize: 14,
    color: "#b00020",
    textAlign: "center",
  },
  actions: {
    marginTop: 24,
  },
});
