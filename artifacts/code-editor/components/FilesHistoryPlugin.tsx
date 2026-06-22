import { Feather } from "@expo/vector-icons";
  import * as Haptics from "expo-haptics";
  import React, { useState } from "react";
  import {
    Alert, FlatList, Modal, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
  } from "react-native";
  import { useIDE } from "@/context/IDEContext";

  interface Props { onBack: () => void; }

  export default function FilesHistoryPlugin({ onBack }: Props) {
    const { projects, currentProject, selectProject, deleteProject, colors } = useIDE() as any;

    const [renameTarget, setRenameTarget] = useState<any>(null);
    const [renameVal, setRenameVal] = useState("");
    const [viewProject, setViewProject] = useState<any>(null);

    const handleRename = () => {
      if (!renameTarget || !renameVal.trim()) return;
      // Patch project name in projects list via selectProject approach
      // Since IDEContext may not expose renameProject, we use deleteProject + createProject workaround
      // But we need renameProject — use direct mutation workaround with alert
      Alert.alert("Rename", `Rename "${renameTarget.name}" to "${renameVal.trim()}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rename", onPress: () => {
            // Mutate via context update — projects are stored in AsyncStorage
            // We'll use selectProject after rename to reflect change
            renameTarget.name = renameVal.trim();
            selectProject({ ...renameTarget });
            setRenameTarget(null);
          },
        },
      ]);
    };

    const handleDelete = (project: any) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        "Delete Project",
        `Delete "${project.name}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => deleteProject(project.id) },
        ],
      );
    };

    const handleView = (project: any) => {
      Haptics.selectionAsync();
      setViewProject(project);
    };

    const handleOpen = (project: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      selectProject(project);
      onBack();
    };

    const formatDate = (ts: number) => {
      const d = new Date(ts);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    return (
      <View style={[s.container, { backgroundColor: colors.sidebar }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Feather name="arrow-left" size={16} color={colors.mutedText} />
          </TouchableOpacity>
          <Feather name="clock" size={14} color={colors.mutedText} />
          <Text style={[s.headerTitle, { color: colors.mutedText }]}>FILES HISTORY</Text>
        </View>

        {projects.length === 0 ? (
          <View style={s.empty}>
            <Feather name="inbox" size={36} color={colors.mutedText} />
            <Text style={[s.emptyTxt, { color: colors.mutedText }]}>No projects yet</Text>
          </View>
        ) : (
          <FlatList
            data={[...projects].sort((a: any, b: any) => b.createdAt - a.createdAt)}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }: any) => {
              const isCurrent = currentProject?.id === item.id;
              return (
                <View style={[s.card, { backgroundColor: colors.card ?? colors.muted, borderColor: isCurrent ? colors.accent : colors.border }]}>
                  {/* Project icon + name */}
                  <TouchableOpacity style={s.cardMain} onPress={() => handleView(item)} activeOpacity={0.8}>
                    <View style={[s.iconBox, { backgroundColor: colors.accent + "22" }]}>
                      <Feather name="folder" size={20} color={colors.accent} />
                    </View>
                    <View style={s.cardInfo}>
                      <View style={s.nameRow}>
                        <Text style={[s.projectName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                        {isCurrent && (
                          <View style={[s.activeBadge, { backgroundColor: colors.accent + "33" }]}>
                            <Text style={[s.activeTxt, { color: colors.accent }]}>Active</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[s.meta, { color: colors.mutedText }]}>
                        {item.files?.length ?? 0} file{item.files?.length !== 1 ? "s" : ""} · {formatDate(item.createdAt)}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Actions */}
                  <View style={s.actions}>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: "#3b82f622" }]}
                      onPress={() => handleOpen(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="folder-plus" size={14} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: "#f59e0b22" }]}
                      onPress={() => { setRenameTarget(item); setRenameVal(item.name); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="edit-2" size={14} color="#f59e0b" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: "#ef444422" }]}
                      onPress={() => handleDelete(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Feather name="trash-2" size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Rename Modal */}
        <Modal visible={!!renameTarget} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
          <View style={s.overlay}>
            <View style={[s.modalBox, { backgroundColor: colors.card ?? colors.muted, borderColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Rename Project</Text>
              <TextInput
                style={[s.input, { color: colors.text, borderColor: colors.accent, backgroundColor: colors.muted }]}
                value={renameVal}
                onChangeText={setRenameVal}
                placeholder="New project name"
                placeholderTextColor={colors.mutedText}
                autoFocus
                autoCapitalize="none"
                onSubmitEditing={handleRename}
              />
              <View style={s.modalBtns}>
                <TouchableOpacity style={[s.btn, { backgroundColor: colors.muted }]} onPress={() => setRenameTarget(null)}>
                  <Text style={[s.btnTxt, { color: colors.mutedText }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: colors.accent }]} onPress={handleRename}>
                  <Text style={[s.btnTxt, { color: "#fff" }]}>Rename</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* View Project Modal */}
        <Modal visible={!!viewProject} transparent animationType="slide" onRequestClose={() => setViewProject(null)}>
          <View style={s.overlay}>
            <View style={[s.viewBox, { backgroundColor: colors.card ?? colors.muted, borderColor: colors.border }]}>
              <View style={s.viewHeader}>
                <Feather name="folder" size={18} color={colors.accent} />
                <Text style={[s.viewTitle, { color: colors.text }]} numberOfLines={1}>{viewProject?.name}</Text>
                <TouchableOpacity onPress={() => setViewProject(null)}>
                  <Feather name="x" size={18} color={colors.mutedText} />
                </TouchableOpacity>
              </View>
              <Text style={[s.viewSub, { color: colors.mutedText }]}>
                {viewProject?.files?.length ?? 0} files · Created {viewProject ? formatDate(viewProject.createdAt) : ""}
              </Text>
              <FlatList
                data={viewProject?.files ?? []}
                keyExtractor={(f: any) => f.id}
                style={s.fileList}
                renderItem={({ item: f }: any) => (
                  <View style={[s.fileRow, { borderBottomColor: colors.border }]}>
                    <Feather name="file-text" size={13} color={colors.mutedText} />
                    <Text style={[s.fileName, { color: colors.text }]} numberOfLines={1}>{f.name}</Text>
                    <Text style={[s.fileLang, { color: colors.mutedText }]}>{f.language}</Text>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={[s.emptyTxt, { color: colors.mutedText }]}>No files in this project</Text>
                }
              />
              <TouchableOpacity
                style={[s.openBtn, { backgroundColor: colors.accent }]}
                onPress={() => { handleOpen(viewProject); setViewProject(null); }}
              >
                <Feather name="folder-plus" size={15} color="#fff" />
                <Text style={s.openBtnTxt}>Open This Project</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const s = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1 },
    backBtn: { padding: 2 },
    headerTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    emptyTxt: { fontSize: 14, fontFamily: "Inter_400Regular" },
    card: { marginHorizontal: 10, marginVertical: 5, borderRadius: 10, borderWidth: 1, overflow: "hidden" },
    cardMain: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
    iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    cardInfo: { flex: 1 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    projectName: { fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 },
    activeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    activeTxt: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
    meta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
    actions: { flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingBottom: 10 },
    actionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    overlay: { flex: 1, backgroundColor: "#00000088", alignItems: "center", justifyContent: "center", padding: 20 },
    modalBox: { width: "100%", maxWidth: 340, borderRadius: 14, borderWidth: 1, padding: 20, gap: 12 },
    modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
    modalBtns: { flexDirection: "row", gap: 10 },
    btn: { flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: "center" },
    btnTxt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    viewBox: { width: "100%", maxWidth: 380, maxHeight: "80%", borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
    viewHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    viewTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold" },
    viewSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
    fileList: { maxHeight: 240 },
    fileRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
    fileName: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
    fileLang: { fontSize: 11, fontFamily: "Inter_400Regular" },
    openBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, marginTop: 4 },
    openBtnTxt: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
    formatDate: {},
  });
  