import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput, FlatList,
  TouchableOpacity, SafeAreaView, StatusBar, Alert,
  KeyboardAvoidingView, Platform
} from 'react-native';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('keystrokes.db');

function initDB() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      char_count INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0
    );
  `);
}

function today() { return new Date().toISOString().slice(0, 10); }
function nowISO() { return new Date().toISOString(); }

export default function App() {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState({ chars: 0, words: 0, entries: 0 });
  const [tab, setTab] = useState('write');

  useEffect(() => { initDB(); loadEntries(); loadStats(); }, []);

  const loadEntries = useCallback(() => {
    const rows = db.getAllSync('SELECT * FROM entries WHERE date = ? ORDER BY id DESC', [today()]);
    setEntries(rows);
  }, []);

  const loadStats = useCallback(() => {
    const row = db.getFirstSync('SELECT COALESCE(SUM(char_count),0) as chars, COALESCE(SUM(word_count),0) as words, COUNT(*) as entries FROM entries WHERE date = ?', [today()]);
    setStats(row || { chars: 0, words: 0, entries: 0 });
  }, []);

  const saveEntry = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const words = trimmed.split(/\s+/).length;
    db.runSync('INSERT INTO entries (timestamp, date, content, char_count, word_count) VALUES (?,?,?,?,?)', [nowISO(), today(), trimmed, trimmed.length, words]);
    setText('');
    loadEntries();
    loadStats();
  }, [text, loadEntries, loadStats]);

  const exportData = useCallback(() => {
    const rows = db.getAllSync("SELECT date, GROUP_CONCAT(content, '\n') as text FROM entries GROUP BY date ORDER BY date DESC");
    Alert.alert('Export', rows.length + ' days of data ready. Total: ' + stats.chars + ' chars');
  }, [stats]);

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <Text style={s.title}>Keystroke Distiller</Text>
        <Text style={s.subtitle}>distill yourself</Text>
      </View>
      <View style={s.tabBar}>
        {['write','history','stats'].map(t=>(
          <TouchableOpacity key={t} style={[s.tab, tab===t&&s.tabActive]} onPress={()=>{setTab(t);loadEntries();loadStats();}}>
            <Text style={[s.tabText, tab===t&&s.tabTextActive]}>{t==='write'?'Write':t==='history'?'History':'Stats'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab==='write'&&(
        <KeyboardAvoidingView style={s.writeContainer} behavior={Platform.OS==='ios'?'padding':'height'}>
          <TextInput style={s.input} multiline placeholder="Start typing..." placeholderTextColor="#666" value={text} onChangeText={setText} autoFocus />
          <View style={s.inputFooter}>
            <Text style={s.charCount}>{text.length} chars</Text>
            <TouchableOpacity style={[s.saveBtn,!text.trim()&&s.saveBtnDisabled]} onPress={saveEntry} disabled={!text.trim()}>
              <Text style={s.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
      {tab==='history'&&(
        <FlatList style={s.list} data={entries} keyExtractor={i=>String(i.id)}
          ListEmptyComponent={<Text style={s.empty}>No entries today</Text>}
          renderItem={({item})=>(
            <View style={s.card}>
              <Text style={s.cardTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
              <Text style={s.cardText}>{item.content}</Text>
              <Text style={s.cardMeta}>{item.char_count} chars</Text>
            </View>
          )} />
      )}
      {tab==='stats'&&(
        <View style={s.statsContainer}>
          <Text style={s.statsDate}>Today: {today()}</Text>
          <View style={s.statsGrid}>
            {[['chars','Characters'],['words','Words'],['entries','Entries']].map(([k,l])=>(
              <View key={k} style={s.statBox}><Text style={s.statNum}>{stats[k]}</Text><Text style={s.statLabel}>{l}</Text></View>
            ))}
          </View>
          <TouchableOpacity style={s.exportBtn} onPress={exportData}><Text style={s.exportText}>Export All Data</Text></TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0a0a0a'},
  header:{paddingHorizontal:20,paddingTop:16,paddingBottom:8},
  title:{fontSize:28,fontWeight:'700',color:'#fff'},
  subtitle:{fontSize:14,color:'#888',marginTop:2},
  tabBar:{flexDirection:'row',paddingHorizontal:16,gap:8,marginBottom:8},
  tab:{flex:1,paddingVertical:10,borderRadius:10,backgroundColor:'#1a1a1a',alignItems:'center'},
  tabActive:{backgroundColor:'#2d5a27'},
  tabText:{color:'#888',fontSize:14},
  tabTextActive:{color:'#fff',fontWeight:'600'},
  writeContainer:{flex:1,paddingHorizontal:16},
  input:{flex:1,backgroundColor:'#111',borderRadius:12,padding:16,color:'#fff',fontSize:16,textAlignVertical:'top',lineHeight:24},
  inputFooter:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:12},
  charCount:{color:'#666',fontSize:13},
  saveBtn:{backgroundColor:'#2d5a27',paddingHorizontal:24,paddingVertical:10,borderRadius:8},
  saveBtnDisabled:{opacity:0.4},
  saveBtnText:{color:'#fff',fontWeight:'600',fontSize:15},
  list:{flex:1,paddingHorizontal:16},
  empty:{color:'#666',textAlign:'center',marginTop:60,fontSize:15},
  card:{backgroundColor:'#111',borderRadius:10,padding:14,marginBottom:8},
  cardTime:{color:'#555',fontSize:12,marginBottom:4},
  cardText:{color:'#ddd',fontSize:15,lineHeight:22},
  cardMeta:{color:'#444',fontSize:11,marginTop:6},
  statsContainer:{flex:1,paddingHorizontal:20,paddingTop:20},
  statsDate:{color:'#888',fontSize:14,marginBottom:20,textAlign:'center'},
  statsGrid:{flexDirection:'row',gap:12},
  statBox:{flex:1,backgroundColor:'#111',borderRadius:12,padding:20,alignItems:'center'},
  statNum:{color:'#fff',fontSize:32,fontWeight:'700'},
  statLabel:{color:'#666',fontSize:12,marginTop:4},
  exportBtn:{backgroundColor:'#1a1a2e',borderRadius:10,padding:16,alignItems:'center',marginTop:24},
  exportText:{color:'#8888ff',fontSize:15,fontWeight:'600'},
});
