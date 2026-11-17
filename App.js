import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, NativeModules, PermissionsAndroid, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

let BluetoothClassic = null;
try { if (NativeModules.RNBluetoothClassic) BluetoothClassic = require('react-native-bluetooth-classic').default; } catch (error) { /* Expo Go não tem este módulo nativo. */ }

const COLORS = { bg: '#0B1018', panel: '#111923', border: '#202B37', text: '#F1F4F7', muted: '#8190A1', green: '#6BD9AA', amber: '#FFBE72', red: '#FF7185', blue: '#83B8FF' };
const LOGS = [
  { time: 'Agora', title: 'Sensores em espera', detail: 'Aguardando dados do Wallie via Bluetooth.', type: 'Sistema', color: COLORS.blue },
  { time: 'Há 12 min', title: 'Movimento detectado', detail: 'Sensor de movimento · dado demonstrativo', type: 'Movimento', color: COLORS.green },
  { time: 'Há 38 min', title: 'Temperatura registrada', detail: '22 °C · dado demonstrativo', type: 'Ambiente', color: COLORS.amber },
  { time: 'Hoje, 09:14', title: 'Wallie ligado', detail: 'Registro de exemplo, sem conexão com o robô.', type: 'Sistema', color: COLORS.blue },
];

function Label({ children }) { return <Text style={styles.label}>{children}</Text>; }
function SectionTitle({ title, action }) { return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{action ? <Text style={styles.sectionAction}>{action}</Text> : null}</View>; }
function Card({ children, style }) { return <View style={[styles.card, style]}>{children}</View>; }
function Pill({ text, color = COLORS.muted }) { return <View style={[styles.pill, { borderColor: `${color}44`, backgroundColor: `${color}14` }]}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={[styles.pillText, { color }]}>{text}</Text></View>; }
function ActionButton({ title, onPress, secondary = false, style }) { return <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.actionButton, secondary && styles.secondaryButton, style]}><Text style={[styles.actionButtonText, secondary && styles.secondaryButtonText]}>{title}</Text></TouchableOpacity>; }

export default function App() {
  const [tab, setTab] = useState('home');
  const [robotState, setRobotState] = useState('UNKNOWN');
  const [btDevice, setBtDevice] = useState(null);
  const [liveLogs, setLiveLogs] = useState(LOGS);
  const [cameraAngle, setCameraAngle] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [moveMode, setMoveMode] = useState('Manual');
  const [logFilter, setLogFilter] = useState('Todos');
  const [alertsOn, setAlertsOn] = useState(true);
  const fireAlertShown = useRef(false);
  const filteredLogs = useMemo(() => logFilter === 'Todos' ? liveLogs : liveLogs.filter((log) => log.type === logFilter), [logFilter, liveLogs]);

  const showBluetoothInfo = () => Alert.alert('Bluetooth Classic do WALLIE', 'Emparelhe o HC-05 nas configurações Bluetooth do Android (PIN normalmente 1234 ou 0000) e toque em Conectar. A conexão requer a versão Android própria do WALLIE, não o Expo Go.');
  const connectBluetooth = async () => {
    if (Platform.OS !== 'android') { Alert.alert('Android necessário', 'O HC-05 usa Bluetooth Classic serial. Esta integração do WALLIE é para Android.'); return; }
    if (!BluetoothClassic) { Alert.alert('Build Android necessária', 'O Expo Go não inclui Bluetooth Classic. Instale a build Android do WALLIE com o módulo nativo para conectar ao HC-05.'); return; }
    try {
      if (Platform.Version >= 31) {
        const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Permissão Bluetooth negada.');
      } else {
        const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Permissão necessária para Bluetooth.');
      }
      if (!(await BluetoothClassic.isBluetoothEnabled())) {
        await BluetoothClassic.requestBluetoothEnabled();
        if (!(await BluetoothClassic.isBluetoothEnabled())) throw new Error('Ative o Bluetooth do celular e tente novamente.');
      }
      const paired = await BluetoothClassic.getBondedDevices();
      const target = paired.find((device) => /hc-?05/i.test(device.name || ''));
      if (!target) {
        Alert.alert('HC-05 não emparelhado', 'Abra o Bluetooth do Android, emparelhe o HC-05 (PIN normalmente 1234 ou 0000) e tente novamente.', [
          { text: 'Abrir Bluetooth', onPress: () => BluetoothClassic.openBluetoothSettings() },
          { text: 'OK' },
        ]);
        return;
      }
      const connected = await target.isConnected();
      if (!connected) await target.connect({ CONNECTOR_TYPE: 'rfcomm', DELIMITER: '\n', DEVICE_CHARSET: 'utf-8' });
      setBtDevice(target);
      setRobotState('UNKNOWN');

    } catch (error) {
      Alert.alert('Falha na conexão Bluetooth', error?.message || 'Verifique o HC-05 e tente novamente.');
    }
  };
  const sendPowerCommand = async () => {
    if (!btDevice) { showBluetoothInfo(); return; }
    const command = robotState === 'ON' ? 'STOP' : 'START';
    try {
      await btDevice.write(command + '\n');
      setRobotState('PENDING');
    } catch (error) {
      setBtDevice(null);
      setRobotState('UNKNOWN');
      Alert.alert('Comando não enviado', error?.message || 'A conexão com o HC-05 foi perdida.');
    }
  };
  useEffect(() => {
    if (!btDevice) return undefined;
    const subscription = btDevice.onDataReceived((event) => {
      const incoming = String(event?.data ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      incoming.forEach((line) => {
        if (line === 'STATE:ON' || line === 'STATE:OFF') setRobotState(line.endsWith('ON') ? 'ON' : 'OFF');
        const match = line.match(/^(FIRE|TEMP|HUMIDITY):(.+)$/);
        if (match) {
          const type = match[1] === 'FIRE' ? 'Incêndio' : 'Ambiente';
          const title = match[1] === 'FIRE' ? (match[2] === '1' ? 'Fogo detectado' : 'Sem fogo detectado') : match[1] === 'TEMP' ? 'Temperatura' : 'Umidade';
          const unit = match[1] === 'TEMP' ? ' °C' : match[1] === 'HUMIDITY' ? ' %' : '';
          setLiveLogs((items) => [{ time: 'Agora', title, detail: match[2] + unit + ' · recebido do Wallie', type, color: match[1] === 'FIRE' && match[2] === '1' ? COLORS.red : COLORS.green }, ...items].slice(0, 40));
          if (match[1] === 'FIRE' && match[2] === '0') fireAlertShown.current = false;
          if (match[1] === 'FIRE' && match[2] === '1' && alertsOn && !fireAlertShown.current) {
            fireAlertShown.current = true;
            Alert.alert('Fogo detectado pelo Wallie', 'O sensor indicou chama. Verifique a situação. Se houver incêndio, ligue aos Bombeiros.', [{ text: 'Agora não', style: 'cancel' }, { text: 'Ligar para 193', onPress: confirmCall193 }]);
          }
        }
      });
    });
    btDevice.write('STATUS\n').catch(() => {});
    return () => subscription?.remove?.();
  }, [btDevice, alertsOn]);
  const call193 = async () => {
    try { await Linking.openURL('tel:193'); }
    catch { Alert.alert('Não foi possível abrir o telefone', 'Ligue para 193 pelo discador do celular.'); }
  };
  const confirmCall193 = () => Alert.alert('Alerta de incêndio', 'Confirme se há uma emergência real antes de ligar para os Bombeiros (193).', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Abrir ligação para 193', style: 'destructive', onPress: call193 },
  ]);
  const nudgeCamera = (delta) => setCameraAngle((current) => Math.max(-90, Math.min(90, current + delta)));
  const nudgeRobot = (direction) => Alert.alert(`Movimento: ${direction}`, 'Comando demonstrativo. Para movimentar o robô de verdade, falta integrar o protocolo Bluetooth do WALLIE.');

  const renderHome = () => <>
    <View style={styles.greeting}><Text style={styles.hello}>Olá 👋</Text><Text style={styles.subtitle}>Este é o status do seu robô.</Text></View>
    <Card style={styles.hero}>
      <View style={styles.heroTop}><View><Label>SEU ROBÔ</Label><Text style={styles.robotName}>Wallie · Principal</Text></View><Pill text={btDevice ? "HC-05 conectado" : "HC-05 desconectado"} color={btDevice ? COLORS.green : COLORS.amber} /></View>
      <View style={styles.robotVisual}><View style={styles.robotHalo}><Text style={styles.robotEmoji}>◉</Text></View><View><Text style={styles.monitoringTitle}>{robotState === 'ON' ? 'Ligado' : robotState === 'OFF' ? 'Desligado' : robotState === 'PENDING' ? 'Enviando comando…' : 'Estado não recebido'}</Text><Text style={styles.monitoringSub}>{btDevice ? 'Conectado ao HC-05' : 'Conecte o HC-05 para controlar'}</Text></View></View>
      <View style={styles.powerRow}><TouchableOpacity onPress={sendPowerCommand} style={[styles.powerButton, robotState === 'ON' && styles.powerButtonOn]}><Text style={styles.powerIcon}>⏻</Text><Text style={styles.powerText}>{robotState === 'ON' ? 'Desligar Wallie' : 'Ligar Wallie'}</Text></TouchableOpacity><TouchableOpacity onPress={connectBluetooth} style={styles.connectButton}><Text style={styles.connectIcon}>⌁</Text><Text style={styles.connectText}>Conectar por Bluetooth</Text></TouchableOpacity></View>
      <Text style={styles.demoNote}>{btDevice ? 'O botão inicia ou para a movimentação automática; não corta a alimentação do Arduino.' : 'Emparelhe o HC-05 e conecte. O botão controla a rotina automática, não corta a alimentação.'}</Text>
    </Card>
    <SectionTitle title="Bateria" action="TEMPO REAL VIA BLUETOOTH" />
    <Card style={styles.batteryCard}><View style={styles.batteryIcon}><Text style={{ color: COLORS.green, fontSize: 18 }}>▰</Text></View><View style={{ flex: 1 }}><Text style={styles.batteryValue}>—%</Text><Text style={styles.mutedSmall}>Aguardando leitura do Wallie</Text></View><Text style={styles.batteryTag}>SEM DADOS</Text></Card>
    <SectionTitle title="Sensores e alertas" />
    <Card style={styles.alertCard}><View style={styles.alertIcon}><Text style={styles.alertIconText}>!</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Alerta de incêndio</Text><Text style={styles.cardSub}>O app poderá avisar quando o robô detectar fumaça/calor.</Text></View></Card>
    <Card style={styles.callCard}><Text style={styles.callTitle}>Em uma emergência real</Text><Text style={styles.callDescription}>A notificação pode abrir o discador para você confirmar a ligação aos Bombeiros.</Text><ActionButton title="Ligar para 193" onPress={confirmCall193} style={{ marginTop: 13, backgroundColor: '#9D4352' }} /></Card>
    <Text style={styles.disclaimer}>PRÉVIA · STATUS, BATERIA E SENSORES AINDA NÃO VÊM DO ROBÔ</Text>
  </>;

  const renderRobot = () => <>
    <View style={styles.greeting}><Text style={styles.hello}>Wallie · Principal</Text><Text style={styles.subtitle}>Câmera e controles do robô</Text></View>
    <Card style={styles.cameraCard}><View style={styles.cameraPreview}><Text style={styles.cameraGlyph}>◉</Text><Text style={styles.cameraSoon}>CÂMERA FUTURA</Text><Text style={styles.cameraCaption}>A câmera ainda não está instalada</Text></View><View style={styles.cameraStatusRow}><Text style={styles.cardTitle}>Câmera do Wallie</Text><Pill text="Não conectada" color={COLORS.muted} /></View><Text style={styles.cardSub}>Quando instalada, a transmissão ao vivo aparecerá nesta área.</Text></Card>
    <SectionTitle title="Movimentação da câmera" />
    <Card><View style={styles.cameraControls}><ActionButton title="←" secondary onPress={() => nudgeCamera(-15)} style={styles.arrowButton} /><View style={styles.angleReadout}><Text style={styles.angle}>{cameraAngle}°</Text><Text style={styles.mutedSmall}>posição de demonstração</Text></View><ActionButton title="→" secondary onPress={() => nudgeCamera(15)} style={styles.arrowButton} /></View><Text style={styles.demoNote}>Controles visuais ativos; a câmera ainda não recebe comandos.</Text></Card>
    <SectionTitle title="Movimentação do robô" />
    <Card><View style={styles.dpad}><View style={styles.dpadRow}><View style={styles.dpadBlank} /><ActionButton title="↑" secondary onPress={() => nudgeRobot('frente')} style={styles.dpadButton} /><View style={styles.dpadBlank} /></View><View style={styles.dpadRow}><ActionButton title="←" secondary onPress={() => nudgeRobot('esquerda')} style={styles.dpadButton} /><View style={styles.dpadCenter}><Text style={styles.dpadCenterText}>W</Text></View><ActionButton title="→" secondary onPress={() => nudgeRobot('direita')} style={styles.dpadButton} /></View><View style={styles.dpadRow}><View style={styles.dpadBlank} /><ActionButton title="↓" secondary onPress={() => nudgeRobot('ré')} style={styles.dpadButton} /><View style={styles.dpadBlank} /></View></View><Text style={styles.demoNote}>Os comandos não são enviados sem a integração Bluetooth.</Text></Card>
  </>;

  const renderActivity = () => <>
    <View style={styles.greeting}><Text style={styles.hello}>Atividade</Text><Text style={styles.subtitle}>Leituras recentes dos sensores do Wallie</Text></View>
    <View style={styles.notice}><Text style={styles.noticeText}>Exemplos de registros. Os logs reais aparecerão após a conexão com o robô.</Text></View>
    <View style={styles.filterRow}>{['Todos', 'Movimento', 'Ambiente', 'Sistema'].map((filter) => <TouchableOpacity key={filter} onPress={() => setLogFilter(filter)} style={[styles.filterChip, logFilter === filter && styles.filterChipActive]}><Text style={[styles.filterText, logFilter === filter && styles.filterTextActive]}>{filter}</Text></TouchableOpacity>)}</View>
    <View style={styles.timeline}>{filteredLogs.map((log, index) => <View key={`${log.time}-${log.title}`} style={styles.logRow}><View style={styles.timelineRail}><View style={[styles.timelineDot, { backgroundColor: log.color }]} />{index < filteredLogs.length - 1 && <View style={styles.timelineLine} />}</View><View style={styles.logCard}><View style={styles.logTop}><Text style={styles.logTitle}>{log.title}</Text><Text style={styles.logTime}>{log.time}</Text></View><Text style={styles.logDetail}>{log.detail}</Text><Text style={[styles.logType, { color: log.color }]}>{log.type.toUpperCase()}</Text></View></View>)}</View>
    <Card style={styles.fireCard}><View style={styles.fireIcon}><Text style={{ color: COLORS.red, fontWeight: '800' }}>!</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Simular alerta de incêndio</Text><Text style={styles.cardSub}>Mostra o fluxo de confirmação para ligar ao 193.</Text></View><TouchableOpacity onPress={confirmCall193} style={styles.smallAction}><Text style={styles.smallActionText}>Abrir</Text></TouchableOpacity></Card>
    <Text style={styles.disclaimer}>ALERTAS AUTOMÁTICOS DEPENDEM DOS SENSORES E DA CONEXÃO COM O ROBÔ</Text>
  </>;

  const renderSettings = () => <>
    <View style={styles.greeting}><Text style={styles.hello}>Ajustes</Text><Text style={styles.subtitle}>Configure o WALLIE · Principal</Text></View>
    <SectionTitle title="Conexão" />
    <Card style={styles.settingCard}><View style={styles.settingIcon}><Text style={styles.settingIconText}>⌁</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Bluetooth</Text><Text style={styles.cardSub}>Desconectado · aguardando integração</Text></View><TouchableOpacity onPress={showBluetoothInfo} style={styles.smallAction}><Text style={styles.smallActionText}>Configurar</Text></TouchableOpacity></Card>
    <SectionTitle title="Notificações" />
    <Card style={styles.settingCard}><View style={styles.settingIcon}><Text style={styles.settingIconText}>♢</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>Alertas de incêndio</Text><Text style={styles.cardSub}>{alertsOn ? 'Avisos habilitados nesta prévia' : 'Avisos silenciados nesta prévia'}</Text></View><TouchableOpacity onPress={() => setAlertsOn((current) => !current)} style={[styles.toggle, alertsOn && styles.toggleOn]}><View style={[styles.toggleKnob, alertsOn && styles.toggleKnobOn]} /></TouchableOpacity></Card>
    <SectionTitle title="Mapeamento do Wallie" />
    <Card><View style={styles.mapPreview}><View style={styles.mapGrid}><View style={styles.mapRobot}><Text style={styles.mapRobotText}>W</Text></View></View></View><Text style={styles.mapTitle}>{mapReady ? 'Mapa de demonstração pronto' : 'Nenhum mapa salvo'}</Text><Text style={styles.cardSub}>O mapeamento real precisa dos sensores e da localização do robô.</Text><ActionButton title={mapReady ? 'Refazer mapeamento' : 'Iniciar mapeamento'} secondary onPress={() => { setMapReady((current) => !current); Alert.alert('Mapeamento demonstrativo', 'A tela registra apenas o estado da prévia. Para mapear o ambiente, falta integrar os sensores e o controle Bluetooth.'); }} style={{ marginTop: 14 }} /></Card>
    <SectionTitle title="Movimentação" />
    <Card><Text style={styles.cardTitle}>Modo de controle</Text><Text style={styles.cardSub}>Preferência local; não altera o comportamento do robô.</Text><View style={styles.modeRow}>{['Manual', 'Patrulha'].map((mode) => <TouchableOpacity key={mode} onPress={() => setMoveMode(mode)} style={[styles.modeOption, moveMode === mode && styles.modeOptionActive]}><Text style={[styles.modeText, moveMode === mode && styles.modeTextActive]}>{mode}</Text></TouchableOpacity>)}</View></Card>
    <Card style={styles.emergencyInfo}><Text style={styles.cardTitle}>Emergências</Text><Text style={styles.cardSub}>O app pedirá confirmação antes de abrir uma ligação para 193. A chamada não será feita automaticamente.</Text></Card>
  </>;

  const titles = { home: 'Início', robot: 'Robô', activity: 'Atividade', settings: 'Ajustes' };
  const screen = tab === 'home' ? renderHome() : tab === 'robot' ? renderRobot() : tab === 'activity' ? renderActivity() : renderSettings();
  const tabs = [ ['home', '⌂', 'Início'], ['robot', '◉', 'Robô'], ['activity', '◷', 'Atividade'], ['settings', '⚙', 'Ajustes'] ];
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={COLORS.bg} /><View style={styles.header}><View><Text style={styles.eyebrow}>CENTRAL DE MONITORAMENTO</Text><Text style={styles.brand}>WALLIE<Text style={styles.brandDot}>.</Text></Text></View><Pill text={btDevice ? "HC-05 conectado" : "HC-05 desconectado"} color={btDevice ? COLORS.green : COLORS.amber} /></View><ScrollView key={tab} contentContainerStyle={styles.content}>{screen}</ScrollView><View style={styles.tabBar}>{tabs.map(([id, icon, title]) => <TouchableOpacity key={id} accessibilityRole="button" accessibilityLabel={title} onPress={() => setTab(id)} style={styles.tab}><Text style={[styles.tabIcon, tab === id && styles.tabIconActive]}>{icon}</Text><Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{title}</Text></TouchableOpacity>)}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, content: { paddingHorizontal: 21, paddingTop: 12, paddingBottom: 28 },
  header: { paddingHorizontal: 21, paddingTop: 12, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#718096', fontSize: 8, letterSpacing: 1.8, fontWeight: '700' }, brand: { color: '#F4F7FA', fontSize: 23, letterSpacing: 3, fontWeight: '800', marginTop: 2 }, brandDot: { color: COLORS.green },
  greeting: { marginBottom: 19 }, hello: { color: COLORS.text, fontSize: 23, fontWeight: '700' }, subtitle: { color: COLORS.muted, fontSize: 12, marginTop: 5 },
  label: { color: '#829184', fontSize: 8, letterSpacing: 1.4, fontWeight: '700' }, pill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 6 }, dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 }, pillText: { fontSize: 8, fontWeight: '700' },
  card: { backgroundColor: COLORS.panel, borderColor: COLORS.border, borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 12 }, hero: { backgroundColor: '#14251F', borderColor: '#254638', borderRadius: 22, padding: 18, marginBottom: 25 }, heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, robotName: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginTop: 5 }, robotVisual: { flexDirection: 'row', alignItems: 'center', marginTop: 23, marginBottom: 19 }, robotHalo: { width: 55, height: 55, borderRadius: 19, backgroundColor: '#20392F', alignItems: 'center', justifyContent: 'center', marginRight: 13 }, robotEmoji: { color: COLORS.green, fontSize: 29 }, monitoringTitle: { color: '#F2F7F4', fontSize: 16, fontWeight: '700' }, monitoringSub: { color: '#8EA397', fontSize: 10, marginTop: 5 }, powerRow: { flexDirection: 'row', gap: 9 }, powerButton: { flex: 1, height: 46, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#49313A' }, powerButtonOn: { backgroundColor: '#28503E' }, powerIcon: { color: '#F9F4F5', fontSize: 19, marginRight: 7 }, powerText: { color: '#F9F4F5', fontSize: 11, fontWeight: '700' }, connectButton: { flex: 1.2, height: 46, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#20392F', borderWidth: 1, borderColor: '#315344' }, connectIcon: { color: COLORS.green, fontSize: 20, marginRight: 7 }, connectText: { color: '#B5E8CE', fontSize: 10, fontWeight: '700' }, demoNote: { color: '#778A80', fontSize: 9, lineHeight: 14, marginTop: 11 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 11 }, sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' }, sectionAction: { color: '#657789', fontSize: 7, letterSpacing: 0.7, fontWeight: '700' }, batteryCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 }, batteryIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: '#20392F', alignItems: 'center', justifyContent: 'center', marginRight: 11 }, batteryValue: { color: COLORS.text, fontSize: 18, fontWeight: '700' }, mutedSmall: { color: COLORS.muted, fontSize: 9, marginTop: 3 }, batteryTag: { color: '#8190A1', fontSize: 8, letterSpacing: 0.8 },
  alertCard: { flexDirection: 'row', alignItems: 'center' }, alertIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#3A2922', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, alertIconText: { color: COLORS.amber, fontSize: 17, fontWeight: '800' }, cardTitle: { color: '#E8EDF1', fontSize: 12, fontWeight: '700' }, cardSub: { color: '#8391A0', fontSize: 10, lineHeight: 15, marginTop: 4 }, callCard: { borderColor: '#49322A', backgroundColor: '#211A18' }, callTitle: { color: '#F3D5BB', fontSize: 12, fontWeight: '700' }, callDescription: { color: '#A88A75', fontSize: 10, lineHeight: 15, marginTop: 5 }, actionButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#28503E', alignItems: 'center', justifyContent: 'center' }, actionButtonText: { color: '#C9F2DE', fontSize: 11, fontWeight: '700' }, secondaryButton: { backgroundColor: '#18232E', borderWidth: 1, borderColor: '#2B3A48' }, secondaryButtonText: { color: '#C3D1DC' }, disclaimer: { textAlign: 'center', color: '#536171', fontSize: 7, lineHeight: 12, letterSpacing: 0.8, marginTop: 17, marginBottom: 5 },
  cameraCard: { padding: 12 }, cameraPreview: { height: 175, borderRadius: 13, backgroundColor: '#0B1118', borderWidth: 1, borderColor: '#263441', alignItems: 'center', justifyContent: 'center' }, cameraGlyph: { color: '#516170', fontSize: 42 }, cameraSoon: { color: '#91A3B3', fontSize: 9, letterSpacing: 1.6, fontWeight: '700', marginTop: 7 }, cameraCaption: { color: '#607183', fontSize: 10, marginTop: 5 }, cameraStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, marginBottom: 4 }, cameraControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, arrowButton: { width: 48, height: 45 }, angleReadout: { alignItems: 'center' }, angle: { color: COLORS.text, fontSize: 21, fontWeight: '700' }, dpad: { alignSelf: 'center', gap: 6 }, dpadRow: { flexDirection: 'row', gap: 6 }, dpadBlank: { width: 48, height: 45 }, dpadButton: { width: 48, height: 45 }, dpadCenter: { width: 48, height: 45, backgroundColor: '#20392F', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, dpadCenterText: { color: COLORS.green, fontWeight: '800' },
  notice: { backgroundColor: '#18232E', borderRadius: 12, padding: 12, marginBottom: 14 }, noticeText: { color: '#9DB0C0', fontSize: 10, lineHeight: 15 }, filterRow: { flexDirection: 'row', gap: 7, marginBottom: 16 }, filterChip: { borderWidth: 1, borderColor: '#273440', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 }, filterChipActive: { backgroundColor: '#20392F', borderColor: '#315344' }, filterText: { color: '#8291A0', fontSize: 9 }, filterTextActive: { color: '#B5E8CE', fontWeight: '700' }, timeline: { marginBottom: 13 }, logRow: { flexDirection: 'row', minHeight: 78 }, timelineRail: { width: 21, alignItems: 'center' }, timelineDot: { width: 9, height: 9, borderRadius: 5, marginTop: 17, zIndex: 1 }, timelineLine: { position: 'absolute', top: 23, bottom: -1, width: 1, backgroundColor: '#273440' }, logCard: { flex: 1, backgroundColor: COLORS.panel, borderColor: COLORS.border, borderWidth: 1, borderRadius: 13, padding: 12, marginBottom: 8 }, logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, logTitle: { color: '#E8EDF1', fontSize: 11, fontWeight: '700' }, logTime: { color: '#718093', fontSize: 8 }, logDetail: { color: '#8795A4', fontSize: 9, lineHeight: 14, marginTop: 4 }, logType: { fontSize: 7, letterSpacing: 1, fontWeight: '700', marginTop: 7 }, fireCard: { flexDirection: 'row', alignItems: 'center' }, fireIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#3A2228', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, smallAction: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: '#20392F' }, smallActionText: { color: '#B5E8CE', fontSize: 9, fontWeight: '700' },
  settingCard: { flexDirection: 'row', alignItems: 'center' }, settingIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: '#18232E', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, settingIconText: { color: COLORS.blue, fontSize: 18 }, toggle: { width: 42, height: 24, borderRadius: 14, backgroundColor: '#394451', padding: 3, justifyContent: 'center' }, toggleOn: { backgroundColor: '#347956' }, toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#C9D1D9' }, toggleKnobOn: { alignSelf: 'flex-end', backgroundColor: '#E2FFF0' }, mapPreview: { height: 125, borderRadius: 12, backgroundColor: '#0C131B', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, mapGrid: { width: '80%', height: '75%', borderWidth: 1, borderColor: '#293A48', borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }, mapRobot: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#20392F', alignItems: 'center', justifyContent: 'center' }, mapRobotText: { color: COLORS.green, fontWeight: '800' }, mapTitle: { color: COLORS.text, fontSize: 11, fontWeight: '700', marginTop: 12, marginBottom: 2 }, modeRow: { flexDirection: 'row', backgroundColor: '#0D141C', borderRadius: 12, padding: 4, marginTop: 13 }, modeOption: { flex: 1, borderRadius: 9, alignItems: 'center', paddingVertical: 9 }, modeOptionActive: { backgroundColor: '#20392F' }, modeText: { color: '#8795A4', fontSize: 10 }, modeTextActive: { color: '#B5E8CE', fontWeight: '700' }, emergencyInfo: { borderColor: '#49322A', backgroundColor: '#211A18' },
  tabBar: { height: 65, backgroundColor: '#0E151E', borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 5 }, tab: { alignItems: 'center', justifyContent: 'center', minWidth: 60 }, tabIcon: { color: '#718093', fontSize: 18, lineHeight: 22 }, tabIconActive: { color: COLORS.green }, tabText: { color: '#718093', fontSize: 8, marginTop: 3 }, tabTextActive: { color: COLORS.green, fontWeight: '700' },
});







