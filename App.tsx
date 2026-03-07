import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native'; // Додано
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

// Налаштування календаря
LocaleConfig.locales['uk'] = {
  monthNames: ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'],
  monthNamesShort: ['Січ','Лют','Бер','Квіт','Трав','Черв','Лип','Серп','Вер','Жов','Лис','Груд'],
  dayNames: ['Неділя','Понеділок','Вівторок','Середа','Четвер','П’ятниця','Субота'],
  dayNamesShort: ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'],
  today: "Сьогодні"
};
LocaleConfig.defaultLocale = 'uk';

const { width, height } = Dimensions.get('window');
const BOX_WIDTH = (width - 60) / 2;
const BOX_HEIGHT = BOX_WIDTH * 1.35;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Основний контент додатка винесено в окремий компонент
function MainScreen() {
  const [activeTab, setActiveTab] = useState('care');
  const [photos, setPhotos] = useState<any>({});
  const [history, setHistory] = useState<any>({});
  const [routineType, setRoutineType] = useState<'morning' | 'evening'>('morning');
  const [stepIndex, setStepIndex] = useState(0);
  
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [endTime, setEndTime] = useState<number | null>(null);

  const dayOfWeek = new Date().getDay(); 
  const isSpecialDay = [1, 3, 5].includes(dayOfWeek); // Пн, Ср, Пт для Дітроміцину

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const savedPhotos = await AsyncStorage.getItem('user_photos');
      const savedHistory = await AsyncStorage.getItem('user_history');
      if (savedPhotos) setPhotos(JSON.parse(savedPhotos));
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (e) { console.log(e); }
  };

  const markStepAsComplete = async () => {
    const today = new Date().toISOString().split('T')[0];
    const newHistory = { ...history };
    
    if (!newHistory[today]) newHistory[today] = { dots: [] };
    const dots = [...(newHistory[today].dots || [])];
    
    if (routineType === 'morning') {
      if (!dots.find((d: any) => d.key === 'morning')) {
        dots.push({ key: 'morning', color: '#FF69B4' });
      }
    } else {
      const color = isSpecialDay ? '#9370DB' : '#4169E1';
      const key = isSpecialDay ? 'special' : 'evening';
      if (!dots.find((d: any) => d.key === key)) {
        dots.push({ key, color });
      }
    }
    
    newHistory[today] = { ...newHistory[today], dots };
    setHistory(newHistory);
    await AsyncStorage.setItem('user_history', JSON.stringify(newHistory));
  };

  const morningSteps = [
    { title: "Гель для вмивання 🧼", hasTimer: false },
    { title: "Точковий гель 🎯", hasTimer: true, duration: 600, nextTask: "зволоження" },
    { title: "Зволожуючий крем 🧴", hasTimer: true, duration: 300, nextTask: "SPF" }, 
    { title: "SPF Захист ☀️", hasTimer: false }
  ];

  const eveningSteps = [
    { title: "Очищення 🧼", hasTimer: false },
    ...(isSpecialDay ? [{ title: "Дітроміцин 🧪", hasTimer: true, duration: 600, nextTask: "крем" }] : []),
    { title: "Зволожуючий крем 🧴", hasTimer: false }
  ];

  const currentSteps = routineType === 'morning' ? morningSteps : eveningSteps;

  useEffect(() => {
    let interval: any = null;
    if (timerActive && endTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        if (remaining === 0) {
          setTimerActive(false);
          setEndTime(null);
          setTimeLeft(0);
          if (stepIndex < currentSteps.length - 1) setStepIndex(prev => prev + 1);
        } else { setTimeLeft(remaining); }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, endTime, stepIndex, currentSteps.length]);

  const handleStepDone = async () => {
    const currentStep = currentSteps[stepIndex];
    if (currentStep.hasTimer && !timerActive) {
      const duration = currentStep.duration || 5;
      setEndTime(Date.now() + duration * 1000);
      setTimeLeft(duration);
      setTimerActive(true);
      
      await Notifications.scheduleNotificationAsync({
        content: { title: "Beauty Quest ✨", body: `Час вийшов! Пора наступний крок`, sound: true },
        trigger: { 
          seconds: duration,
        } as any,
      });
      return; 
    }

    if (stepIndex < currentSteps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      await markStepAsComplete();
      Alert.alert("Готово!", "Процедуру завершено ✨");
      setStepIndex(0);
      setTimerActive(false);
    }
  };

  const openCamera = async (key: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 1 });
    if (!result.canceled) {
      const newPhotos = { ...photos, [key]: result.assets[0].uri };
      setPhotos(newPhotos);
      await AsyncStorage.setItem('user_photos', JSON.stringify(newPhotos));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.navBar}>
        {['care', 'calendar', 'gallery'].map((tab) => (
          <TouchableOpacity 
            key={tab}
            style={[styles.navItem, activeTab === tab && styles.navItemActive]} 
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.navText, activeTab === tab && styles.navTextActive]}>
              {tab === 'care' ? 'КВЕСТ' : tab === 'calendar' ? 'МАРКИ' : 'ФОТО'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {activeTab === 'care' && (
          <View style={styles.centerWrapper}>
            <View style={styles.questCard}>
              <Text style={styles.routineTitle}>{routineType === 'morning' ? '☀️ РАНOK' : '🌙 ВЕЧІР'}</Text>
              <Text style={styles.taskTitle}>{currentSteps[stepIndex].title}</Text>
              {timerActive ? (
                <View style={styles.timerInfo}>
                  <Text style={styles.timerVal}>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</Text>
                  <TouchableOpacity style={styles.doneBtn} onPress={() => { setTimerActive(false); setEndTime(null); setStepIndex(stepIndex + 1); }}>
                    <Text style={styles.doneBtnText}>ПРОПУСТИТИ →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.doneBtn} onPress={handleStepDone}>
                  <Text style={styles.doneBtnText}>ГОТОВО ✅</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => {setRoutineType(routineType === 'morning' ? 'evening' : 'morning'); setStepIndex(0); setTimerActive(false);}} style={{marginTop: 20}}>
                <Text style={{color: '#AAA'}}>Змінити режим</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'calendar' && (
          <View style={{ padding: 20 }}>
            <Calendar markingType={'multi-dot'} markedDates={history} theme={{ todayTextColor: '#FF69B4' }} style={{ borderRadius: 20 }} />
            <View style={styles.legend}>
               <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#FF69B4'}]} /><Text style={styles.legendText}> Ранок</Text></View>
               <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#4169E1'}]} /><Text style={styles.legendText}> Вечір</Text></View>
               <View style={styles.legendItem}><View style={[styles.dot, {backgroundColor: '#9370DB'}]} /><Text style={styles.legendText}> Дітроміцин</Text></View>
            </View>
          </View>
        )}

        {activeTab === 'gallery' && (
          <View style={{ padding: 20 }}>
             <Text style={styles.collageHeader}>Найперший день !!</Text>
             <View style={styles.row}>
                <TouchableOpacity style={styles.tallBox} onPress={() => openCamera('sL')}>
                  {photos.sL ? <Image source={{ uri: photos.sL }} style={styles.image} /> : <Text style={styles.camIcon}>📸</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.tallBox} onPress={() => openCamera('sR')}>
                  {photos.sR ? <Image source={{ uri: photos.sR }} style={styles.image} /> : <Text style={styles.camIcon}>📸</Text>}
                </TouchableOpacity>
             </View>
             
             <View style={styles.spacer} />
             
             <Text style={styles.collageHeader}>Останній прогрес</Text>
             <View style={styles.row}>
                <TouchableOpacity style={styles.tallBox} onPress={() => openCamera('pL')}>
                  {photos.pL ? <Image source={{ uri: photos.pL }} style={styles.image} /> : <Text style={styles.camIcon}>📸</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.tallBox} onPress={() => openCamera('pR')}>
                  {photos.pR ? <Image source={{ uri: photos.pR }} style={styles.image} /> : <Text style={styles.camIcon}>📸</Text>}
                </TouchableOpacity>
             </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Головний компонент тепер просто обгортка для навігації
export default function App() {
  return (
    <NavigationContainer>
      <MainScreen />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF0F5' },
  navBar: { flexDirection: 'row', padding: 10, paddingTop: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  navItem: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 10 },
  navItemActive: { backgroundColor: '#FF69B4' },
  navText: { fontWeight: 'bold', color: '#AAA', fontSize: 11 },
  navTextActive: { color: '#fff' },
  scroll: { flexGrow: 1 },
  centerWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: height * 0.7 },
  questCard: { width: width * 0.85, backgroundColor: '#fff', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 5 },
  routineTitle: { fontSize: 12, color: '#FF69B4', fontWeight: 'bold', marginBottom: 10 },
  taskTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  doneBtn: { backgroundColor: '#333', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 20 },
  doneBtnText: { color: '#fff', fontWeight: 'bold' },
  timerVal: { fontSize: 48, fontWeight: 'bold', color: '#FF69B4', marginBottom: 20 },
  timerInfo: { alignItems: 'center' },
  collageHeader: { fontSize: 18, fontWeight: '900', color: '#333', marginBottom: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  tallBox: { width: BOX_WIDTH, height: BOX_HEIGHT, backgroundColor: '#fff', borderRadius: 20, borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#FFB6C1', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  camIcon: { fontSize: 24 },
  spacer: { height: 35 },
  legend: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', padding: 15, borderRadius: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendText: { fontSize: 12, color: '#333' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 5 }
});