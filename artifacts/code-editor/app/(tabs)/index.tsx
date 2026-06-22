import React, { useCallback, useEffect } from "react";
  import { BackHandler, Dimensions, Platform, StyleSheet, View } from "react-native";
  import { useSafeAreaInsets } from "react-native-safe-area-context";
  import ActivityBar from "@/components/ActivityBar";
  import AIPanel from "@/components/AIPanel";
  import CodeEditor from "@/components/CodeEditor";
  import DeviceExplorer from "@/components/DeviceExplorer";
  import FileExplorer from "@/components/FileExplorer";
  import GitPanel from "@/components/GitPanel";
  import PluginPanel from "@/components/PluginPanel";
  import SettingsPanel from "@/components/SettingsPanel";
  import { useIDE } from "@/context/IDEContext";

  const { width: SCREEN_WIDTH } = Dimensions.get("window");
  const SIDEBAR_WIDTH = Math.min(270, SCREEN_WIDTH * 0.72);

  export default function IDEScreen() {
    const { activePanel, colors, sidebarOpen, setSidebarOpen } = useIDE();
    const insets = useSafeAreaInsets();

    useEffect(() => {
      if (Platform.OS !== "android") return;
      const handler = BackHandler.addEventListener("hardwareBackPress", () => {
        if (sidebarOpen) { setSidebarOpen(false); return true; }
        return true;
      });
      return () => handler.remove();
    }, [sidebarOpen, setSidebarOpen]);

    const renderSidePanel = useCallback(() => {
      switch (activePanel) {
        case "files":    return <FileExplorer />;
        case "device":   return <DeviceExplorer />;
        case "ai":       return <AIPanel />;
        case "git":      return <GitPanel />;
        case "settings": return <SettingsPanel />;
        case "plugins":  return <PluginPanel />;
        default:         return null;
      }
    }, [activePanel]);

    const showSide = sidebarOpen && activePanel !== "editor";

    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.body}>
          <ActivityBar />
          <View style={styles.workspace}>
            {showSide && (
              <View style={[styles.sidebar, { width: SIDEBAR_WIDTH, backgroundColor: colors.sidebar, borderRightColor: colors.sidebarBorder }]}>
                {renderSidePanel()}
              </View>
            )}
            <View style={styles.fill}>
              <CodeEditor />
            </View>
          </View>
        </View>
      </View>
    );
  }

  const styles = StyleSheet.create({
    root: { flex: 1 },
    body: { flex: 1, flexDirection: "row" },
    workspace: { flex: 1, flexDirection: "row" },
    sidebar: { borderRightWidth: 1 },
    fill: { flex: 1 },
  });
  