import { StyleSheet, View, ScrollView, TouchableOpacity, Alert, FlatList, Pressable, Dimensions } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
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

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { id: '1', name: 'Police Control', phone: '100', icon: 'shield.fill', relation: 'Official' },
  { id: '2', name: 'Ambulance', phone: '102', icon: 'cross.circle.fill', relation: 'Medical' },
  { id: '3', name: 'Mom', phone: '+91 98765 43210', icon: 'person.fill', relation: 'Family' },
  { id: '4', name: 'Dad', phone: '+91 98765 43211', icon: 'person.fill', relation: 'Family' },
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

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    backgroundColor: interpolate(progress.value, [0, 1], [0, 1]) > 0.5 ? '#d32f2f' : '#ff3b30',
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    opacity: isActivating ? 1 : 0,
  }));

  const renderContactCard = ({ item }: { item: EmergencyContact }) => (
    <TouchableOpacity
      style={[
        styles.contactCard,
        { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' },
        styles.shadow
      ]}
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
            <TouchableOpacity><ThemedText style={styles.editLink}>Manage</ThemedText></TouchableOpacity>
          </View>
          <FlatList
            data={EMERGENCY_CONTACTS}
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
    </ThemedView>
  );
}

function ActionCard({ image, label, subLabel, color, isDark }: any) {
  return (
    <TouchableOpacity style={[styles.actionCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }, styles.shadow]}>
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
  }
});
