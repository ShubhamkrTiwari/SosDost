import { StyleSheet, View, ScrollView, TouchableOpacity, Alert, FlatList, Pressable, Dimensions, Modal, TextInput } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Image } from 'expo-image';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withDelay,
  interpolate,
  cancelAnimation,
  runOnJS,
  withSpring
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

const { width } = Dimensions.get('window');

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  icon: string;
  relation: string;
}

const DEFAULT_CONTACTS: EmergencyContact[] = [
  { id: 'police', name: 'Police Control', phone: '100', icon: 'shield.fill', relation: 'Official' },
  { id: 'ambulance', name: 'Ambulance', phone: '102', icon: 'cross.circle.fill', relation: 'Medical' },
];

const PulseRing = ({ delay = 0, color = '#ff3b30' }) => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2500 }), -1, false)
    );
    return () => cancelAnimation(pulse);
  }, [delay, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2.8]) }],
    opacity: interpolate(pulse.value, [0, 0.5, 1], [0.3, 0.15, 0]),
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: color,
          zIndex: -1,
        },
        animatedStyle,
      ]}
    />
  );
};

export default function SOSScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isActivating, setIsActivating] = useState(false);
  const [sosActive, setSOSActive] = useState(false);
  const [priorityContacts, setPriorityContacts] = useState<EmergencyContact[]>(DEFAULT_CONTACTS);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isRecordSheetVisible, setIsRecordSheetVisible] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<Contacts.Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const progress = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  const triggerSOS = useCallback(() => {
    setSOSActive(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      '🚨 SOS ACTIVATED',
      'Emergency services and your primary contacts have been notified of your location.',
      [{ text: 'I am Safe Now', onPress: () => setSOSActive(false), style: 'cancel' }]
    );
  }, []);

  const handlePressIn = () => {
    setIsActivating(true);
    buttonScale.value = withSpring(0.92);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    progress.value = withTiming(1, { duration: 2000 }, (finished) => {
      if (finished) {
        runOnJS(triggerSOS)();
        progress.value = 0;
        runOnJS(setIsActivating)(false);
      }
    });
  };

  const handlePressOut = () => {
    if (!sosActive) {
      setIsActivating(false);
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 300 });
      buttonScale.value = withSpring(1);
    }
  };

  const openContactPicker = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      });

      if (data.length > 0) {
        setDeviceContacts(data);
        setIsPickerVisible(true);
      } else {
        Alert.alert('No contacts found');
      }
    } else {
      Alert.alert('Permission Denied', 'Please enable contacts permission in settings to add priority contacts.');
    }
  };

  const addContact = (contact: Contacts.Contact) => {
    const phoneNumber = contact.phoneNumbers?.[0]?.number;
    if (!phoneNumber) {
      Alert.alert('Error', 'This contact has no phone number');
      return;
    }

    const newContact: EmergencyContact = {
      id: contact.id || Math.random().toString(),
      name: contact.name,
      phone: phoneNumber,
      icon: 'person.fill',
      relation: 'Added Contact',
    };

    if (priorityContacts.find(c => c.phone === phoneNumber)) {
      Alert.alert('Info', 'Contact already in priority list');
      return;
    }

    setPriorityContacts([...priorityContacts, newContact]);
    setIsPickerVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const removeContact = (id: string) => {
    if (id === 'police' || id === 'ambulance') {
      Alert.alert('Action Restricted', 'Default emergency services cannot be removed.');
      return;
    }
    setPriorityContacts(priorityContacts.filter(c => c.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const filteredContacts = useMemo(() => {
    return deviceContacts.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [deviceContacts, searchQuery]);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    backgroundColor: interpolate(progress.value, [0, 1], [0, 1]) > 0.5 ? '#d32f2f' : '#ff3b30',
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    opacity: isActivating ? 1 : 0,
  }));

  const handleRecordAction = (type: 'audio' | 'video') => {
    setIsRecordSheetVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(`Starting ${type} recording...`, 'The feed will be uploaded to the safety cloud.');
  };

  const renderContactCard = ({ item }: { item: EmergencyContact }) => (
    <TouchableOpacity
      style={[
        styles.contactCard,
        { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' },
        styles.shadow
      ]}
      onLongPress={() => removeContact(item.id)}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(`Call ${item.name}?`, `Dialing ${item.phone}`);
      }}>
      <View style={[styles.contactIconContainer, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
        <IconSymbol name={item.icon as any} size={20} color="#ff3b30" />
      </View>
      <View style={styles.contactInfo}>
        <ThemedText style={styles.contactName}>{item.name}</ThemedText>
        <ThemedText style={styles.contactRelation}>{item.relation}</ThemedText>
      </View>
      <View style={styles.callButton}>
        <IconSymbol name="phone.fill" size={14} color="#FFF" />
      </View>
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Professional Header */}
        <View style={styles.header}>
          <View>
            <ThemedText style={styles.greeting}>Emergency Hub</ThemedText>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: sosActive ? '#ff3b30' : '#34c759' }]} />
              <ThemedText style={styles.statusText}>{sosActive ? 'Emergency Active' : 'System Secure'}</ThemedText>
            </View>
          </View>
          <TouchableOpacity style={[styles.profileButton, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            <IconSymbol name="person.crop.circle.fill" size={28} color={isDark ? '#FFF' : '#000'} />
          </TouchableOpacity>
        </View>

        {/* SOS Button Section */}
        <View style={styles.sosSection}>
          <View style={styles.sosContainer}>
            {!sosActive && (
              <>
                <PulseRing delay={0} />
                <PulseRing delay={800} />
                <PulseRing delay={1600} />
              </>
            )}
            
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={sosActive}
            >
              <Animated.View style={[styles.sosButton, animatedButtonStyle, styles.sosShadow]}>
                <IconSymbol name="exclamationmark.triangle.fill" size={64} color="#FFF" />
                <ThemedText style={styles.sosLabel}>{sosActive ? 'ACTIVE' : 'SOS'}</ThemedText>
              </Animated.View>
            </Pressable>
          </View>
          
          <View style={styles.instructionContainer}>
            {isActivating ? (
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressBar, animatedProgressStyle]} />
                <ThemedText style={styles.progressText}>HOLD TO ACTIVATE</ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.sosHint}>
                {sosActive ? 'Help is on the way. Stay calm.' : 'Hold for 2 seconds to trigger emergency'}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Critical Actions</ThemedText>
          <View style={styles.grid}>
            <ActionCard 
              image="https://img.icons8.com/fluency/96/marker.png" 
              label="Live Track" 
              subLabel="Share Live" 
              color="#34c759" 
              isDark={isDark} 
            />
            <ActionCard 
              image="https://img.icons8.com/fluency/96/microphone.png" 
              label="Record" 
              subLabel="Audio/Video" 
              color="#5856d6" 
              isDark={isDark} 
              onPress={() => setIsRecordSheetVisible(true)}
            />
            <ActionCard 
              image="https://img.icons8.com/fluency/96/shield.png" 
              label="Safewalk" 
              subLabel="Timer Mode" 
              color="#ff9500" 
              isDark={isDark} 
            />
            <ActionCard 
              image="https://img.icons8.com/fluency/96/phone.png" 
              label="Fake Call" 
              subLabel="Privacy" 
              color="#007aff" 
              isDark={isDark} 
            />
          </View>
        </View>

        {/* Contacts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Priority Contacts</ThemedText>
            <TouchableOpacity onPress={openContactPicker}>
              <ThemedText style={styles.editLink}>Manage</ThemedText>
            </TouchableOpacity>
          </View>
          <FlatList
            data={priorityContacts}
            renderItem={renderContactCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <ThemedText style={styles.infoTitle}>Safety Protocol</ThemedText>
          <ThemedText style={styles.infoDesc}>
            Your location, audio, and camera feed will be shared with the control center once SOS is triggered.
          </ThemedText>
        </View>

        <View style={styles.footerSpace} />
      </ScrollView>

      {/* Contact Picker Modal */}
      <Modal
        visible={isPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select Contact</ThemedText>
            <TouchableOpacity onPress={() => setIsPickerVisible(false)}>
              <ThemedText style={styles.closeText}>Close</ThemedText>
            </TouchableOpacity>
          </View>
          
          <View style={[styles.searchBar, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            <IconSymbol name="magnifyingglass" size={18} color={isDark ? '#FFF' : '#000'} opacity={0.5} />
            <TextInput
              placeholder="Search contacts..."
              placeholderTextColor="#888"
              style={[styles.searchInput, { color: isDark ? '#FFF' : '#000' }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.id || Math.random().toString()}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.pickerItem}
                onPress={() => addContact(item)}
              >
                <View style={[styles.pickerIcon, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
                  <ThemedText style={styles.pickerInitial}>{item.name[0]}</ThemedText>
                </View>
                <View>
                  <ThemedText style={styles.pickerName}>{item.name}</ThemedText>
                  <ThemedText style={styles.pickerPhone}>
                    {item.phoneNumbers?.[0]?.number || 'No number'}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            )}
          />
        </ThemedView>
      </Modal>

      {/* Recording Selection Bottom Sheet (Modal) */}
      <Modal
        visible={isRecordSheetVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsRecordSheetVisible(false)}
      >
        <Pressable 
          style={styles.overlay} 
          onPress={() => setIsRecordSheetVisible(false)}
        >
          <ThemedView style={[styles.bottomSheet, { backgroundColor: isDark ? '#1C1C1E' : '#FFF' }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <ThemedText style={styles.sheetTitle}>Choose Recording Type</ThemedText>
            </View>
            
            <View style={styles.sheetOptions}>
              <TouchableOpacity 
                style={[styles.sheetOption, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
                onPress={() => handleRecordAction('audio')}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(88, 86, 214, 0.1)' }]}>
                  <IconSymbol name="mic.fill" size={24} color="#5856d6" />
                </View>
                <ThemedText style={styles.optionLabel}>Audio Only</ThemedText>
                <ThemedText style={styles.optionSub}>Stealth recording</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.sheetOption, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
                onPress={() => handleRecordAction('video')}
              >
                <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
                  <IconSymbol name="video.fill" size={24} color="#ff3b30" />
                </View>
                <ThemedText style={styles.optionLabel}>Video & Audio</ThemedText>
                <ThemedText style={styles.optionSub}>Full evidence capture</ThemedText>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setIsRecordSheetVisible(false)}
            >
              <ThemedText style={styles.cancelText}>Cancel</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

function ActionCard({ image, label, subLabel, color, isDark, onPress }: any) {
  return (
    <TouchableOpacity 
      style={[styles.actionCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }, styles.shadow]}
      onPress={() => {
        if (onPress) {
          onPress();
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}
    >
      <View style={[styles.actionIcon, { backgroundColor: `${color}10` }]}>
        <Image 
          source={{ uri: image }} 
          style={styles.actionImg}
          contentFit="contain"
          transition={500}
        />
      </View>
      <ThemedText style={styles.actionLabel}>{label}</ThemedText>
      <ThemedText style={styles.actionSubLabel}>{subLabel}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  sosContainer: {
    width: 280,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sosShadow: {
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  sosLabel: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 10,
    letterSpacing: 2,
  },
  instructionContainer: {
    height: 60,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  progressTrack: {
    width: width * 0.7,
    height: 40,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#ff3b30',
  },
  progressText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ff3b30',
    zIndex: 1,
  },
  sosHint: {
    fontSize: 14,
    opacity: 0.5,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  section: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  editLink: {
    fontSize: 14,
    color: '#ff3b30',
    fontWeight: '600',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: (width - 60) / 2,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  actionIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionImg: {
    width: 32,
    height: 32,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionSubLabel: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
  },
  contactIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
  },
  contactRelation: {
    fontSize: 13,
    opacity: 0.5,
  },
  callButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#34c759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    marginHorizontal: 24,
    marginTop: 30,
    padding: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.1)',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff3b30',
    marginBottom: 6,
  },
  infoDesc: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.6,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  footerSpace: {
    height: 40,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeText: {
    color: '#ff3b30',
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 15,
    paddingHorizontal: 15,
    height: 44,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.02)',
  },
  pickerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  pickerInitial: {
    fontSize: 18,
    fontWeight: '700',
    opacity: 0.5,
  },
  pickerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerPhone: {
    fontSize: 13,
    opacity: 0.5,
    marginTop: 2,
  },
  // Bottom Sheet Styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetOptions: {
    marginTop: 20,
    gap: 12,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionSub: {
    fontSize: 13,
    opacity: 0.5,
    marginLeft: 'auto',
  },
  cancelButton: {
    marginTop: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff3b30',
  },
});
