import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const STORAGE_KEY = '@myfirstapp/afterimage-notes';
const ART_API_URL =
  'https://api.artic.edu/api/v1/artworks?page=1&limit=10&fields=id,title,artist_display,date_display,image_id,thumbnail';

const MOODS = ['electric', 'hushed', 'tender', 'unsettled'] as const;
type Mood = (typeof MOODS)[number];

type AfterimageNote = {
  id: string;
  title: string;
  place: string;
  mood: Mood;
  note: string;
  createdAt: string;
};

type NoteForm = Omit<AfterimageNote, 'id' | 'createdAt'>;

type Artwork = {
  id: number;
  title: string;
  artist_display?: string | null;
  date_display?: string | null;
  image_id?: string | null;
  thumbnail?: {
    alt_text?: string | null;
  } | null;
};

type ArtworkResponse = {
  data: Artwork[];
};

const emptyForm: NoteForm = {
  title: '',
  place: '',
  mood: 'hushed',
  note: '',
};

export default function AfterimageScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [notes, setNotes] = useState<AfterimageNote[]>([]);
  const [query, setQuery] = useState('');
  const [activeMood, setActiveMood] = useState<Mood | 'all'>('all');
  const [form, setForm] = useState<NoteForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [isLoadingArtworks, setIsLoadingArtworks] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const persistNotes = useCallback(async (nextNotes: AfterimageNote[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextNotes));
    } catch {
      Alert.alert('Could not save', 'Your note could not be saved locally. Please try again.');
    }
  }, []);

  useEffect(() => {
    const restoreNotes = async () => {
      try {
        const savedNotes = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedNotes) {
          const parsedNotes = JSON.parse(savedNotes) as AfterimageNote[];
          if (Array.isArray(parsedNotes)) {
            setNotes(parsedNotes);
          }
        }
      } catch {
        Alert.alert('Could not restore', 'The saved field notes could not be read.');
      }
    };

    void restoreNotes();
  }, []);

  const fetchArtworks = useCallback(async () => {
    setIsLoadingArtworks(true);
    setApiError(null);

    try {
      const response = await axios.get<ArtworkResponse>(ART_API_URL);
      setArtworks(response.data.data);
    } catch {
      setApiError('The gallery feed is quiet right now. Try refreshing in a moment.');
    } finally {
      setIsLoadingArtworks(false);
    }
  }, []);

  useEffect(() => {
    void fetchArtworks();
  }, [fetchArtworks]);

  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notes.filter((note) => {
      const searchableText = [note.title, note.place, note.mood, note.note].join(' ').toLowerCase();
      const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);
      const matchesMood = activeMood === 'all' || note.mood === activeMood;
      return matchesQuery && matchesMood;
    });
  }, [activeMood, notes, query]);

  const hasWrittenNotes = notes.some((note) => note.note.trim().length > 0);
  const allNotesHaveTitles = notes.every((note) => note.title.trim().length > 0);
  const formIsComplete = [form.title, form.place, form.note].every((value) => value.trim().length > 0);

  const updateForm = <Field extends keyof NoteForm>(field: Field, value: NoteForm[Field]) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const openNewNote = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsEditorOpen(true);
  };

  const openEditNote = (id: string) => {
    const noteToEdit = notes.find((note) => note.id === id);
    if (!noteToEdit) {
      return;
    }

    setEditingId(noteToEdit.id);
    setForm({
      title: noteToEdit.title,
      place: noteToEdit.place,
      mood: noteToEdit.mood,
      note: noteToEdit.note,
    });
    setIsEditorOpen(true);
  };

  const saveNote = async () => {
    if (!formIsComplete) {
      Alert.alert('A little more', 'Add a name, place, and note before saving this afterimage.');
      return;
    }

    const nextNote: AfterimageNote = {
      id: editingId ?? `${Date.now()}`,
      title: form.title.trim(),
      place: form.place.trim(),
      mood: form.mood,
      note: form.note.trim(),
      createdAt: editingId
        ? notes.find((note) => note.id === editingId)?.createdAt ?? new Date().toISOString()
        : new Date().toISOString(),
    };

    const nextNotes = editingId
      ? notes.map((note) => (note.id === editingId ? nextNote : note))
      : [nextNote, ...notes];

    setNotes(nextNotes);
    await persistNotes(nextNotes);
    setIsEditorOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const removeNote = async (id: string) => {
    const nextNotes = notes.filter((note) => note.id !== id);
    setNotes(nextNotes);
    await persistNotes(nextNotes);
  };

  const confirmDelete = (id: string) => {
    const noteToDelete = notes.find((note) => note.id === id);
    if (!noteToDelete) {
      return;
    }

    Alert.alert('Release this afterimage?', noteToDelete.title, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void removeNote(id) },
    ]);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchArtworks();
    setIsRefreshing(false);
  };

  const renderNote = ({ item }: { item: AfterimageNote }) => (
    <ThemedView
      type="backgroundElement"
      style={[styles.noteCard, { borderColor: theme.backgroundSelected }]}>
      <View style={styles.noteCardHeader}>
        <View style={styles.noteTitleBlock}>
          <ThemedText type="subtitle" style={styles.noteTitle}>
            {item.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {item.place} · {item.mood}
          </ThemedText>
        </View>
        <View style={styles.noteActions}>
          <Pressable onPress={() => openEditNote(item.id)} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Edit
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => confirmDelete(item.id)} hitSlop={8}>
            <ThemedText type="smallBold" style={styles.deleteText}>
              Let go
            </ThemedText>
          </Pressable>
        </View>
      </View>
      <ThemedText style={styles.noteBody}>{item.note}</ThemedText>
    </ThemedView>
  );

  const listHeader = (
    <View>
      <ThemedView style={styles.hero}>
        <ThemedText type="smallBold" style={styles.eyebrow}>
          A NOTEBOOK FOR WHAT LINGERS
        </ThemedText>
        <ThemedText type="title" style={styles.heroTitle}>
          Afterimage
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.heroCopy}>
          Keep the feeling an artwork leaves behind—not a review, not a rating, just the small
          signal that stayed with you.
        </ThemedText>

        <Pressable onPress={openNewNote} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <ThemedText style={styles.primaryButtonText}>+ Capture an afterimage</ThemedText>
        </Pressable>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.statsCard}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            Your collection
          </ThemedText>
          <ThemedText type="subtitle">{notes.length} moments</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.statsCopy}>
          {notes.length === 0
            ? 'Start with one detail you do not want to lose.'
            : hasWrittenNotes && allNotesHaveTitles
              ? 'Your notes are safely held here.'
              : 'A few fragments are still taking shape.'}
        </ThemedText>
      </ThemedView>

      <View style={styles.sectionHeading}>
        <View>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Your field notes
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {filteredNotes.length} showing · stored on this device
          </ThemedText>
        </View>
        <Pressable onPress={openNewNote} hitSlop={8}>
          <ThemedText type="linkPrimary">New note</ThemedText>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search title, place, or feeling"
        placeholderTextColor={theme.textSecondary}
        style={[styles.searchInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
        returnKeyType="search"
      />

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={['all', ...MOODS] as const}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const isActive = activeMood === item;
          return (
            <Pressable
              onPress={() => setActiveMood(item)}
              style={[
                styles.filterChip,
                { borderColor: theme.backgroundSelected },
                isActive && { backgroundColor: theme.text, borderColor: theme.text },
              ]}>
              <ThemedText
                type="smallBold"
                style={isActive ? { color: theme.background } : undefined}
                themeColor={isActive ? undefined : 'textSecondary'}>
                {item === 'all' ? 'All moods' : item}
              </ThemedText>
            </Pressable>
          );
        }}
      />

      <View style={styles.apiHeading}>
        <View style={styles.apiTitleRow}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            From the gallery
          </ThemedText>
          <ThemedText type="smallBold" style={styles.livePill}>
            LIVE API
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          A fresh selection from the Art Institute of Chicago
        </ThemedText>
      </View>

      {isLoadingArtworks ? (
        <ThemedView type="backgroundElement" style={styles.apiState}>
          <ActivityIndicator color={theme.text} />
          <ThemedText type="small" themeColor="textSecondary">
            Opening the gallery doors…
          </ThemedText>
        </ThemedView>
      ) : apiError ? (
        <ThemedView type="backgroundElement" style={styles.apiState}>
          <ThemedText type="small" themeColor="textSecondary">
            {apiError}
          </ThemedText>
          <Pressable onPress={() => void fetchArtworks()}>
            <ThemedText type="linkPrimary">Try again</ThemedText>
          </Pressable>
        </ThemedView>
      ) : (
        <FlatList
          horizontal
          data={artworks}
          keyExtractor={(item) => String(item.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.artworkRow}
          renderItem={({ item }) => {
            const imageUri = item.image_id
              ? `https://www.artic.edu/iiif/2/${item.image_id}/full/843,/0/default.jpg`
              : undefined;

            return (
              <ThemedView
                type="backgroundElement"
                style={[styles.artworkCard, { borderColor: theme.backgroundSelected }]}>
                {imageUri ? (
                  <Image
                    source={{ uri: imageUri }}
                    contentFit="cover"
                    transition={250}
                    style={styles.artworkImage}
                  />
                ) : (
                  <View style={[styles.artworkImage, styles.imagePlaceholder]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      No image
                    </ThemedText>
                  </View>
                )}
                <ThemedText type="smallBold" numberOfLines={2} style={styles.artworkTitle}>
                  {item.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                  {item.artist_display || item.date_display || 'Art Institute of Chicago'}
                </ThemedText>
              </ThemedView>
            );
          }}
        />
      )}

      <ThemedText type="small" themeColor="textSecondary" style={styles.apiCredit}>
        Artwork data and images: Art Institute of Chicago API
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        data={filteredNotes}
        keyExtractor={(item) => item.id}
        renderItem={renderNote}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <ThemedView type="backgroundElement" style={styles.emptyState}>
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              Nothing pinned here yet
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptyCopy}>
              {notes.length > 0
                ? 'Try another search or mood, or capture a new afterimage.'
                : 'The first one can be tiny: a color, a shape, or the thought you carried home.'}
            </ThemedText>
            <Pressable onPress={openNewNote} style={styles.secondaryButton}>
              <ThemedText type="smallBold">Write the first one</ThemedText>
            </Pressable>
          </ThemedView>
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: safeAreaInsets.top, paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four },
        ]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} />}
      />

      <Modal
        visible={isEditorOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditorOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <ThemedView type="backgroundElement" style={styles.editorCard}>
            <View style={styles.editorHeader}>
              <View>
                <ThemedText type="smallBold" style={styles.eyebrow}>
                  {editingId ? 'REVISITING A MOMENT' : 'A NEW MOMENT'}
                </ThemedText>
                <ThemedText type="subtitle" style={styles.editorTitle}>
                  {editingId ? 'Edit the feeling' : 'Capture the feeling'}
                </ThemedText>
              </View>
              <Pressable onPress={() => setIsEditorOpen(false)} hitSlop={10}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Close
                </ThemedText>
              </Pressable>
            </View>

            <TextInput
              value={form.title}
              onChangeText={(value) => updateForm('title', value)}
              placeholder="Give this moment a name"
              placeholderTextColor={theme.textSecondary}
              style={[styles.editorInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
            <TextInput
              value={form.place}
              onChangeText={(value) => updateForm('place', value)}
              placeholder="Where were you?"
              placeholderTextColor={theme.textSecondary}
              style={[styles.editorInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />

            <ThemedText type="smallBold" themeColor="textSecondary">
              The temperature of it
            </ThemedText>
            <View style={styles.moodRow}>
              {MOODS.map((mood) => {
                const isSelected = form.mood === mood;
                return (
                  <Pressable
                    key={mood}
                    onPress={() => updateForm('mood', mood)}
                    style={[
                      styles.moodChip,
                      { borderColor: theme.backgroundSelected },
                      isSelected && { backgroundColor: theme.text, borderColor: theme.text },
                    ]}>
                    <ThemedText
                      type="small"
                      style={isSelected ? { color: theme.background } : undefined}
                      themeColor={isSelected ? undefined : 'textSecondary'}>
                      {mood}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={form.note}
              onChangeText={(value) => updateForm('note', value)}
              placeholder="What stayed with you?"
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlignVertical="top"
              style={[styles.editorInput, styles.noteInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />

            <Pressable
              onPress={() => void saveNote()}
              style={({ pressed }) => [styles.primaryButton, !formIsComplete && styles.disabledButton, pressed && styles.pressed]}>
              <ThemedText style={styles.primaryButtonText}>
                {editingId ? 'Save changes' : 'Pin this afterimage'}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  eyebrow: {
    letterSpacing: 1.5,
    fontSize: 11,
  },
  heroTitle: {
    fontSize: 52,
    lineHeight: 56,
  },
  heroCopy: {
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 520,
  },
  primaryButton: {
    marginTop: Spacing.two,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    backgroundColor: '#E95D9F',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.75,
  },
  statsCard: {
    padding: Spacing.three,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  statsCopy: {
    flex: 1,
    textAlign: 'right',
  },
  sectionHeading: {
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 32,
  },
  searchInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  filterRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  apiHeading: {
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  apiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  livePill: {
    color: '#B34B7A',
    backgroundColor: '#F8D5E6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    letterSpacing: 0.8,
    fontSize: 10,
  },
  apiState: {
    minHeight: 120,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  artworkRow: {
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  artworkCard: {
    width: 172,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: Spacing.two,
  },
  artworkImage: {
    width: '100%',
    height: 150,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DFDFE4',
  },
  artworkTitle: {
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
  },
  apiCredit: {
    marginTop: Spacing.one,
  },
  noteCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  noteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  noteTitleBlock: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  noteActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  deleteText: {
    color: '#B34B7A',
  },
  noteBody: {
    fontSize: 16,
    lineHeight: 25,
  },
  emptyState: {
    padding: Spacing.four,
    borderRadius: 18,
    marginBottom: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyTitle: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  emptyCopy: {
    textAlign: 'center',
    maxWidth: 360,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#E95D9F',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  editorCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  editorTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  editorInput: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
  },
  noteInput: {
    minHeight: 120,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  moodChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
});
