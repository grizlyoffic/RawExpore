import { Feather } from "@expo/vector-icons";
  import * as Haptics from "expo-haptics";
  import React, { useState } from "react";
  import {
    FlatList, StyleSheet, Text, TextInput,
    TouchableOpacity, View,
  } from "react-native";
  import { useIDE } from "@/context/IDEContext";
  import FilesHistoryPlugin from "./FilesHistoryPlugin";
  import CladPlugin from "./CladPlugin";

  interface Plugin {
    id: string;
    name: string;
    description: string;
    icon: string;
    iconColor: string;
    category: string;
    author: string;
    version: string;
  }

  const PLUGINS: Plugin[] = [
    {
      id: "files-history",
      name: "Files History",
      description: "View, rename and delete all your saved projects in one place.",
      icon: "clock",
      iconColor: "#58a6ff",
      category: "Productivity",
      author: "KIU Studio",
      version: "1.0.0",
    },
    {
      id: "clad",
      name: "Clad",
      description: "Auto-remove comment lines and blank spaces with a beautiful wave animation.",
      icon: "zap",
      iconColor: "#a78bfa",
      category: "Code Tools",
      author: "KIU Studio",
      version: "1.2.0",
    },
    {
      id: "prettier",
      name: "Prettier",
      description: "Format your code automatically on save. Supports JS, TS, Python and more.",
      icon: "align-left",
      iconColor: "#f59e0b",
      category: "Formatter",
      author: "Community",
      version: "0.9.1",
    },
    {
      id: "snippets",
      name: "Code Snippets",
      description: "Quickly insert common code patterns with a single tap.",
      icon: "copy",
      iconColor: "#34d399",
      category: "Productivity",
      author: "Community",
      version: "1.1.0",
    },
    {
      id: "git-lens",
      name: "Git Lens",
      description: "See who changed what and when. Inline blame & history.",
      icon: "git-commit",
      iconColor: "#f97316",
      category: "Version Control",
      author: "Community",
      version: "0.7.0",
    },
  ];

  type View = "list" | "files-history" | "clad";

  export default function PluginPanel() {
    const { colors } = useIDE();
    const [query, setQuery] = useState("");
    const [view, setView] = useState<View>("list");

    if (view === "files-history") return <FilesHistoryPlugin onBack={() => setView("list")} />;
    if (view === "clad")          return <CladPlugin onBack={() => setView("list")} />;

    const filtered = PLUGINS.filter(
      p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase()),
    );

    const handleOpen = (plugin: Plugin) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (plugin.id === "files-history") setView("files-history");
      else if (plugin.id === "clad")     setView("clad");
    };

    return (
      <View style={[s.container, { backgroundColor: colors.sidebar }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <Feather name="package" size={14} color={colors.mutedText} />
          <Text style={[s.headerTitle, { color: colors.mutedText }]}>PLUGINS</Text>
        </View>

        {/* Search */}
        <View style={[s.searchRow, { backgroundColor: colors.input ?? colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.mutedText} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            placeholder="Search plugins..."
            placeholderTextColor={colors.mutedText}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Feather name="x" size={14} color={colors.mutedText} />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats row */}
        <Text style={[s.statsLabel, { color: colors.mutedText }]}>
          {filtered.length} plugin{filtered.length !== 1 ? "s" : ""} available
        </Text>

        {/* Plugin list */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.card, { backgroundColor: colors.card ?? colors.muted, borderColor: colors.border }]}
              onPress={() => handleOpen(item)}
              activeOpacity={0.75}
            >
              {/* Icon */}
              <View style={[s.iconBox, { backgroundColor: item.iconColor + "22" }]}>
                <Feather name={item.icon as any} size={22} color={item.iconColor} />
              </View>
              {/* Info */}
              <View style={s.info}>
                <View style={s.nameRow}>
                  <Text style={[s.pluginName, { color: colors.text }]}>{item.name}</Text>
                  <View style={[s.badge, { backgroundColor: colors.accent + "22" }]}>
                    <Text style={[s.badgeTxt, { color: colors.accent }]}>{item.category}</Text>
                  </View>
                </View>
                <Text style={[s.desc, { color: colors.mutedText }]} numberOfLines={2}>
                  {item.description}
                </Text>
                <Text style={[s.meta, { color: colors.mutedText }]}>
                  by {item.author} · v{item.version}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedText} />
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  const s = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
    headerTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 10, marginVertical: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
    searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", padding: 0 },
    statsLabel: { fontSize: 11, fontFamily: "Inter_400Regular", paddingHorizontal: 12, marginBottom: 4 },
    card: { flexDirection: "row", alignItems: "center", marginHorizontal: 10, marginVertical: 4, padding: 12, borderRadius: 10, borderWidth: 1, gap: 10 },
    iconBox: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    info: { flex: 1, gap: 3 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    pluginName: { fontSize: 14, fontFamily: "Inter_700Bold" },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    badgeTxt: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
    desc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
    meta: { fontSize: 10, fontFamily: "Inter_400Regular" },
  });
  