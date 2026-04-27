// frontend/Driver/screens/NotificationsScreen.js  — Driver
'use strict';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, StyleSheet, Platform,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API = 'https://raahi-q2ur.onrender.com/api';
const T = {
  g900:'#1A2B1C', g800:'#2D3E2F', g700:'#415844',
  g500:'#5A7A5C', g300:'#A8C8AA', g100:'#EDF4ED', g50:'#F5F8F5',
  white:'#FFFFFF', bg:'#F7FAF7',
  ink:'#0F1A10', body:'#3A4D3C', muted:'#7A9A7C',
  line:'#EAEEED', lineMid:'#C8D8C8',
};
const TYPE = {
  poll:             { g:['#1E3A5A','#0D2240'], icon:'bar-chart',              label:'Poll'      },
  route:            { g:['#1A3A1E','#0D2410'], icon:'map',                    label:'Route'     },
  route_assigned:   { g:['#1A3A1E','#0D2410'], icon:'map',                    label:'Route'     },
  route_started:    { g:['#1A3A1E','#0D2410'], icon:'play-circle',            label:'Route'     },
  route_completed:  { g:['#1A3A2A','#0D2418'], icon:'checkmark-done-circle',  label:'Complete'  },
  route_missed:     { g:['#3A1818','#240E0E'], icon:'close-circle',           label:'Missed'    },
  confirmation:     { g:['#1A3A2A','#0D2418'], icon:'checkmark-circle',       label:'Confirmed' },
  alert:            { g:['#3A2A0A','#241A04'], icon:'warning',                label:'Alert'     },
  complaint:        { g:['#3A1818','#240E0E'], icon:'alert-circle',           label:'Complaint' },
  feedback:         { g:['#3A3410','#24200A'], icon:'star',                   label:'Feedback'  },
  payment:          { g:['#0E2E3A','#061E28'], icon:'card',                   label:'Payment'   },
  passenger_picked: { g:['#1A3A2A','#0D2418'], icon:'checkmark-circle',       label:'Pickup'    },
  next_pickup:      { g:['#3A1818','#240E0E'], icon:'navigate',               label:'Pickup'    },
  general:          { g:['#2A3A2C','#1A2A1C'], icon:'notifications',          label:'Update'    },
};
const getMeta = t => TYPE[t] || TYPE.general;
const rel = d => {
  if (!d) return '';
  const m=Math.floor((Date.now()-new Date(d))/60000);
  if(m<1)return 'Just now';
  if(m<60)return`${m}m ago`;
  const h=Math.floor(m/60);
  if(h<24)return`${h}h ago`;
  const dy=Math.floor(h/24);
  if(dy<7)return`${dy}d ago`;
  return new Date(d).toLocaleDateString('en-PK',{day:'numeric',month:'short'});
};
const CATS=[
  {id:'all',label:'All',icon:'layers-outline'},
  {id:'route',label:'Routes',icon:'map-outline'},
  {id:'route_assigned',label:'Assigned',icon:'checkmark-circle-outline'},
  {id:'passenger_picked',label:'Pickups',icon:'people-outline'},
  {id:'payment',label:'Payments',icon:'card-outline'},
  {id:'alert',label:'Alerts',icon:'warning-outline'},
];

// Props: notifications, markNotificationRead, getHeaders
export default function NotificationsScreen({notifications:propNotifs=[],markNotificationRead,getHeaders}){
  const [notifs,setNotifs]=useState(propNotifs);
  const [refreshing,setRefreshing]=useState(false);
  const [tab,setTab]=useState('all');

  useEffect(()=>{setNotifs(propNotifs);},[propNotifs]);

  const onRefresh=async()=>{
    setRefreshing(true);
    try{
      const r=await fetch(`${API}/notifications`,{headers:getHeaders?.()??{}});
      const d=await r.json();
      if(d.success)setNotifs(d.notifications||[]);
    }catch{}
    setRefreshing(false);
  };
  const markRead=async id=>{
    if(markNotificationRead){markNotificationRead(id);return;}
    try{
      await fetch(`${API}/notifications/${id}/read`,{method:'PUT',headers:getHeaders?.()??{}});
      setNotifs(p=>p.map(n=>n._id===id?{...n,read:true}:n));
    }catch{}
  };
  const markAll=async()=>{
    try{
      await fetch(`${API}/notifications/read-all`,{method:'PUT',headers:getHeaders?.()??{}});
      setNotifs(p=>p.map(n=>({...n,read:true})));
    }catch{}
  };

  const unread=notifs.filter(n=>!n.read).length;
  const shown=tab==='all'?notifs:notifs.filter(n=>n.type===tab||n.actionType===tab);
  const cnt=id=>id==='all'?notifs.length:notifs.filter(n=>n.type===id||n.actionType===id).length;

  return(
    <View style={s.root}>
      {/* Tabs */}
      <View style={s.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {CATS.map(c=>{
            const on=tab===c.id,n=cnt(c.id);
            return(
              <TouchableOpacity key={c.id} style={[s.tab,on&&s.tabOn]} onPress={()=>setTab(c.id)} activeOpacity={0.75}>
                <Ionicons name={c.icon} size={13} color={on?T.white:T.g500}/>
                <Text style={[s.tabTxt,on&&s.tabTxtOn]}>{c.label}{n>0?` (${n})`:''}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <ScrollView
        style={{flex:1}}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[T.g700]} tintColor={T.g700}/>}
      >
        <View style={s.secRow}>
          <Text style={s.secTitle}>{tab==='all'?'All Notifications':CATS.find(c=>c.id===tab)?.label}</Text>
          {unread>0&&(
            <TouchableOpacity onPress={markAll} style={s.markBtn}>
              <Ionicons name="checkmark-done" size={13} color={T.g700}/>
              <Text style={s.markTxt}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {shown.length>0?shown.map((n,i)=>{
          const ty=getMeta(n.type);
          return(
            <TouchableOpacity key={n._id||i} activeOpacity={0.78} style={[s.row,!n.read&&s.rowUnread]} onPress={()=>!n.read&&markRead(n._id)}>
              <View style={s.avWrap}>
                <LinearGradient colors={n.read?[T.g500,T.g800]:ty.g} style={s.av}>
                  <Ionicons name={n.read?'mail-open-outline':ty.icon} size={21} color="rgba(255,255,255,0.93)"/>
                </LinearGradient>
                {!n.read&&<View style={s.avDot}/>}
              </View>
              <View style={s.rowBody}>
                <View style={s.rowTop}>
                  <Text style={[s.rowTitle,!n.read&&s.rowTitleBold]} numberOfLines={1}>{n.title||'Notification'}</Text>
                  <Text style={[s.rowTime,!n.read&&{color:T.g500,fontWeight:'700'}]}>{rel(n.createdAt)}</Text>
                </View>
                <Text style={[s.rowMsg,n.read&&{color:T.muted,opacity:0.8}]} numberOfLines={2}>{n.message||n.body||'—'}</Text>
                {!n.read&&<View style={s.typePill}><Text style={s.typePillTxt}>{ty.label}</Text></View>}
              </View>
            </TouchableOpacity>
          );
        }):(
          <View style={s.empty}>
            <View style={s.emptyAv}><Ionicons name="notifications-off-outline" size={40} color={T.g300}/></View>
            <Text style={s.emptyH}>All caught up!</Text>
            <Text style={s.emptySub}>{tab==='all'?"No notifications at the moment.":`No ${CATS.find(c=>c.id===tab)?.label.toLowerCase()} notifications.`}</Text>
          </View>
        )}
        <View style={{height:60}}/>
      </ScrollView>

      {unread>0&&(
        <TouchableOpacity style={s.fab} onPress={markAll} activeOpacity={0.88}>
          <LinearGradient colors={[T.g700,T.g800]} style={s.fabInner}>
            <Ionicons name="checkmark-done" size={16} color={T.white}/>
            <Text style={s.fabTxt}>Mark all read</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const AV=54;
const s=StyleSheet.create({
  root:{flex:1,backgroundColor:T.bg},
  tabsWrap:{backgroundColor:T.white,borderBottomWidth:1,borderBottomColor:T.line},
  tabs:{paddingHorizontal:16,paddingVertical:10,gap:8},
  tab:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:7,borderRadius:20,borderWidth:1.5,borderColor:T.lineMid,backgroundColor:T.white},
  tabOn:{backgroundColor:T.g700,borderColor:T.g700},
  tabTxt:{fontSize:12,fontWeight:'600',color:T.g500},
  tabTxtOn:{color:T.white},
  list:{paddingBottom:40},
  secRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:18,paddingTop:16,paddingBottom:6},
  secTitle:{fontSize:15,fontWeight:'800',color:T.ink,letterSpacing:-0.2},
  markBtn:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:10,paddingVertical:5,borderRadius:10,borderWidth:1,borderColor:T.lineMid},
  markTxt:{fontSize:12,fontWeight:'700',color:T.g700},
  row:{flexDirection:'row',alignItems:'flex-start',paddingHorizontal:16,paddingVertical:14,backgroundColor:T.white,borderBottomWidth:1,borderBottomColor:T.line,gap:14},
  rowUnread:{backgroundColor:T.g50},
  avWrap:{position:'relative',flexShrink:0},
  av:{width:AV,height:AV,borderRadius:AV/2,alignItems:'center',justifyContent:'center'},
  avDot:{position:'absolute',bottom:1,right:1,width:14,height:14,borderRadius:7,backgroundColor:T.g700,borderWidth:2.5,borderColor:T.white},
  rowBody:{flex:1,paddingTop:1},
  rowTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:4,gap:6},
  rowTitle:{flex:1,fontSize:14,fontWeight:'600',color:T.body,letterSpacing:-0.1},
  rowTitleBold:{fontWeight:'800',color:T.ink},
  rowTime:{fontSize:11,color:T.muted},
  rowMsg:{fontSize:13,color:T.body,lineHeight:19},
  typePill:{alignSelf:'flex-start',backgroundColor:T.g100,paddingHorizontal:8,paddingVertical:3,borderRadius:7,marginTop:7},
  typePillTxt:{fontSize:10,fontWeight:'800',color:T.g700,letterSpacing:0.4},
  empty:{alignItems:'center',paddingTop:80,paddingHorizontal:40},
  emptyAv:{width:90,height:90,borderRadius:45,backgroundColor:T.g100,alignItems:'center',justifyContent:'center',marginBottom:20},
  emptyH:{fontSize:18,fontWeight:'800',color:T.ink,marginBottom:8},
  emptySub:{fontSize:14,color:T.muted,textAlign:'center',lineHeight:21},
  fab:{position:'absolute',bottom:24,alignSelf:'center'},
  fabInner:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:22,paddingVertical:13,borderRadius:30,...Platform.select({ios:{shadowColor:T.g800,shadowOpacity:0.3,shadowRadius:10,shadowOffset:{width:0,height:4}},android:{elevation:8}})},
  fabTxt:{color:T.white,fontWeight:'700',fontSize:14},
});