<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Map, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { fromLonLat, toLonLat } from 'ol/proj'
import { Style, Icon, Circle, Fill, Stroke, Text } from 'ol/style'
import Overlay from 'ol/Overlay'
import axios from 'axios'

const props = defineProps({
  viewOnly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['back-to-card'])

// 内部的なモード管理（新機能）
const currentMode = ref(props.viewOnly ? 'view' : 'record') // 'view' or 'record'

const mapRef = ref(null)
const popupRef = ref(null)
const map = ref(null)
const popup = ref(null)
const currentLocation = ref(null)
const showConfirmDialog = ref(false)
const showInstructionDialog = ref(true)
const isRecording = ref(false)
const error = ref(null)
const success = ref(false)
const recordingStatus = ref({ enabled: false, description: null })
const recordingMethod = ref('click') // 'click' or 'gps'
const isLocating = ref(false)
const userSessionId = ref(null)

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

// モード切り替え関数
const switchMode = (mode) => {
  currentMode.value = mode
  if (mode === 'record' && !recordingStatus.value.enabled) {
    checkRecordingStatus()
  }
}

// セッションIDを生成または取得
const getUserSessionId = () => {
  if (!userSessionId.value) {
    userSessionId.value = localStorage.getItem('userSessionId') || 
      'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('userSessionId', userSessionId.value)
  }
  return userSessionId.value
}

// グローバル関数として削除機能を追加
window.deleteLocation = async (locationId) => {
  // locationIdの有効性をチェック
  if (!locationId || locationId === 'undefined' || locationId === 'null') {
    alert('削除対象のIDが無効です')
    return
  }
  
  if (!confirm('この記録を削除しますか？')) return
  
  try {
    await axios.delete(`${API_BASE}/api/locations/${locationId}`, {
      headers: {
        'X-Session-Id': getUserSessionId()
      }
    })
    
    // 地図から該当のピンを削除
    const vectorLayer = map.value.getLayers().getArray()[1]
    const vectorSource = vectorLayer.getSource()
    const features = vectorSource.getFeatures()
    
    const featureToRemove = features.find(f => f.get('locationId') === locationId)
    if (featureToRemove) {
      vectorSource.removeFeature(featureToRemove)
    }
    
    // ポップアップを閉じる
    popup.value.setPosition(undefined)
    
    alert('記録を削除しました')  } catch (err) {
    console.error('削除エラー:', err)
    
    // エラーメッセージを適切に抽出
    let errorMessage = '削除に失敗しました'
    
    if (err.response) {
      // サーバーからのレスポンスエラー
      if (err.response.data) {
        if (typeof err.response.data === 'string') {
          errorMessage += ': ' + err.response.data
        } else if (err.response.data.detail) {
          errorMessage += ': ' + err.response.data.detail
        } else if (err.response.data.message) {
          errorMessage += ': ' + err.response.data.message
        } else {
          errorMessage += ': ' + JSON.stringify(err.response.data)
        }
      } else {
        errorMessage += ': サーバーエラー (ステータス: ' + err.response.status + ')'
      }
    } else if (err.message) {
      // ネットワークエラーなど
      errorMessage += ': ' + err.message
    } else {
      // その他のエラー
      errorMessage += ': 不明なエラーが発生しました'
    }
    
    alert(errorMessage)
  }
}

onMounted(async () => {
  if (!props.viewOnly) {
    await checkRecordingStatus()
  }
  initMap()
  getCurrentLocation()
  loadExistingLocations()
})

onUnmounted(() => {
  if (map.value) {
    map.value.setTarget(null)
  }
})

const checkRecordingStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE}/api/recording-status`)
    recordingStatus.value = response.data
    
    if (!recordingStatus.value.enabled) {
      error.value = '現在、位置記録は無効になっています'
    }
  } catch (err) {
    error.value = '記録状態の確認に失敗しました'
    console.error('Recording status check error:', err)
  }
}

const checkExistingUserRecord = async () => {
  try {
    // 既存の位置情報を取得
    const response = await axios.get(`${API_BASE}/api/locations`)
    const userSessionId = getUserSessionId()
    
    // レスポンスが配列であることを確認
    if (!Array.isArray(response.data)) {
      console.error('Expected array but got:', typeof response.data, response.data)
      return false
    }
    
    // 現在のユーザーの記録があるかチェック
    const existingRecord = response.data.find(loc => loc.session_id === userSessionId)
    
    if (existingRecord) {
      error.value = '既に位置情報を記録済みです。一度だけ記録できます。'
      return true
    }
    return false
  } catch (err) {
    console.error('既存記録チェックエラー:', err)
    return false  }
}

// カスタムズーム制御関数
const zoomIn = () => {
  if (map.value) {
    const view = map.value.getView()
    const zoom = view.getZoom()
    view.setZoom(zoom + 1)
  }
}

const zoomOut = () => {
  if (map.value) {
    const view = map.value.getView()
    const zoom = view.getZoom()
    view.setZoom(zoom - 1)
  }
}

const resetView = () => {
  if (map.value) {
    const view = map.value.getView()
    view.setCenter(fromLonLat([139.6917, 35.6895])) // 東京駅
    view.setZoom(10)
  }
}

const initMap = () => {
  const vectorSource = new VectorSource()
  const vectorLayer = new VectorLayer({
    source: vectorSource,
    style: (feature) => {
      const timestamp = feature.get('timestamp')
      const isUserRecord = feature.get('isUserRecord')
      
      return new Style({
        image: new Circle({
          radius: 12,
          fill: new Fill({ 
            color: isUserRecord ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)' 
          }),
          stroke: new Stroke({ 
            color: 'white', 
            width: 3,
            lineDash: isUserRecord ? [5, 5] : undefined
          })
        }),        text: timestamp ? new Text({
          text: new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(new Date(timestamp)),
          offsetY: -20,
          font: 'bold 12px sans-serif',
          fill: new Fill({ color: '#1f2937' }),
          stroke: new Stroke({ color: 'white', width: 3 }),
          backgroundFill: new Fill({ color: 'rgba(255, 255, 255, 0.8)' }),
          padding: [2, 4, 2, 4]
        }) : undefined
      })
    }
  })
  map.value = new Map({
    target: mapRef.value,
    controls: [], // デフォルトコントロールを無効化
    layers: [
      new TileLayer({
        source: new OSM()
      }),
      vectorLayer
    ],
    view: new View({
      center: fromLonLat([139.6917, 35.6895]), // 東京駅
      zoom: 10
    })
  })

  // ポップアップの設定
  popup.value = new Overlay({
    element: popupRef.value,
    positioning: 'bottom-center',
    stopEvent: false,
    offset: [0, -10]
  })
  map.value.addOverlay(popup.value)
  // マップクリックイベント
  map.value.on('click', (event) => {
    // ピンがクリックされた場合の処理
    const feature = map.value.forEachFeatureAtPixel(event.pixel, (feature) => feature)
    if (feature) {
      const coordinate = feature.getGeometry().getCoordinates()
      const timestamp = feature.get('timestamp')
      const locationId = feature.get('locationId')
      const isUserRecord = feature.get('isUserRecord')
        if (timestamp) {
        const date = new Date(timestamp)
        // 日本時間で表示
        const jstDate = new Intl.DateTimeFormat('ja-JP', {
          timeZone: 'Asia/Tokyo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).format(date)
          const deleteButton = (isUserRecord && locationId && locationId !== 'undefined') 
          ? `<button onclick="deleteLocation(${locationId})" class="mt-2 bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">削除</button>`
          : ''
        
        popupRef.value.innerHTML = `
          <div class="bg-white p-3 rounded-lg shadow-lg border">
            <div class="font-semibold text-gray-800">記録日時 (JST)</div>
            <div class="text-sm text-gray-600">${jstDate}</div>
            ${isUserRecord ? '<div class="text-xs text-green-600 mt-1">あなたの記録</div>' : ''}
            ${deleteButton}
          </div>
        `
        popup.value.setPosition(coordinate)
      }
      return
    }    // 地図のクリック（記録機能）
    if (currentMode === 'record' && recordingStatus.value.enabled && recordingMethod.value === 'click') {
      const coordinate = toLonLat(event.coordinate)
      currentLocation.value = {
        latitude: coordinate[1],
        longitude: coordinate[0]
      }
      showConfirmDialog.value = true
    }
    
    // ポップアップを隠す
    popup.value.setPosition(undefined)
  })
}

const getCurrentLocation = () => {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const center = fromLonLat([longitude, latitude])
        map.value.getView().setCenter(center)
        map.value.getView().setZoom(15)
      },
      (error) => {
        console.warn('位置情報の取得に失敗:', error)
      }
    )
  }
}

const loadExistingLocations = async () => {
  try {
    const response = await axios.get(`${API_BASE}/api/locations`)
    const locations = response.data
    const currentSessionId = getUserSessionId()

    const vectorLayer = map.value.getLayers().getArray()[1]
    const vectorSource = vectorLayer.getSource()

    locations.forEach(location => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([location.longitude, location.latitude])),
        timestamp: location.timestamp,
        locationId: location.id,
        isUserRecord: location.session_id === currentSessionId
      })
      vectorSource.addFeature(feature)
    })
  } catch (err) {
    console.error('既存の位置情報の読み込みに失敗:', err)
  }
}

const useGPSLocation = () => {
  if (!('geolocation' in navigator)) {
    error.value = 'お使いのブラウザは位置情報に対応していません'
    return
  }

  isLocating.value = true
  error.value = null

  navigator.geolocation.getCurrentPosition(
    (position) => {
      isLocating.value = false
      const { latitude, longitude } = position.coords
      currentLocation.value = { latitude, longitude }
      
      // 地図の中心を現在位置に移動
      const center = fromLonLat([longitude, latitude])
      map.value.getView().setCenter(center)
      map.value.getView().setZoom(16)
      
      showConfirmDialog.value = true
    },
    (err) => {
      isLocating.value = false
      switch(err.code) {
        case err.PERMISSION_DENIED:
          error.value = '位置情報の使用が許可されていません'
          break
        case err.POSITION_UNAVAILABLE:
          error.value = '位置情報を取得できませんでした'
          break
        case err.TIMEOUT:
          error.value = '位置情報の取得がタイムアウトしました'
          break
        default:
          error.value = '位置情報の取得に失敗しました'
          break
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  )
}

const confirmLocation = async () => {
  if (!currentLocation.value) return

  // 既に記録があるかチェック
  const hasExistingRecord = await checkExistingUserRecord()
  if (hasExistingRecord) {
    isRecording.value = false
    return
  }

  isRecording.value = true
  error.value = null

  try {    // リクエストボディにsession_idを含める
    const locationData = {
      ...currentLocation.value,
      session_id: getUserSessionId()
    }
    
    const response = await axios.post(`${API_BASE}/api/record-location`, locationData, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // 地図に新しいピンを追加
    const vectorLayer = map.value.getLayers().getArray()[1]
    const vectorSource = vectorLayer.getSource()
    
    const feature = new Feature({
      geometry: new Point(fromLonLat([
        currentLocation.value.longitude,
        currentLocation.value.latitude
      ])),
      timestamp: new Date().toISOString(),
      locationId: response.data.id,
      isUserRecord: true    })
    vectorSource.addFeature(feature)
    
    success.value = true
    showConfirmDialog.value = false
    
    setTimeout(() => {
      success.value = false
      // 自動遷移を無効化（ユーザーが地図に残り続けられるように）
      // if (!props.viewOnly) {
      //   emit('back-to-card')
      // }
    }, 2000)

  } catch (err) {
    error.value = err.response?.data?.detail || '位置情報の記録に失敗しました'
    console.error('Location recording error:', err)
  } finally {
    isRecording.value = false
  }
}

const cancelLocation = () => {
  showConfirmDialog.value = false
  currentLocation.value = null
}

const closeInstructions = () => {
  showInstructionDialog.value = false
}

const goBack = () => {
  emit('back-to-card')
}

// コンポーネントメソッドとしてのdeleteLocation（テスト用）
const deleteLocation = async (locationId) => {
  // locationIdの有効性をチェック
  if (!locationId || locationId === 'undefined' || locationId === 'null') {
    alert('削除対象のIDが無効です')
    return
  }
  
  if (!confirm('この記録を削除しますか？')) return
  
  try {
    await axios.delete(`${API_BASE}/api/locations/${locationId}`, {
      headers: {
        'X-Session-Id': getUserSessionId()
      }
    })
    
    // 地図から該当のピンを削除
    if (map.value && map.value.getLayers) {
      const vectorLayer = map.value.getLayers().getArray()[1]
      if (vectorLayer && vectorLayer.getSource) {
        const vectorSource = vectorLayer.getSource()
        const features = vectorSource.getFeatures()
        
        const featureToRemove = features.find(f => f.get('locationId') === locationId)
        if (featureToRemove) {
          vectorSource.removeFeature(featureToRemove)
        }
      }
    }
    
    // ポップアップを閉じる
    if (popup.value && popup.value.setPosition) {
      popup.value.setPosition(undefined)
    }
    
    alert('記録を削除しました')
  } catch (err) {
    console.error('削除エラー:', err)
    
    // エラーメッセージを適切に抽出
    let errorMessage = '削除に失敗しました'
    
    if (err.response) {
      // サーバーからのレスポンスエラー
      if (err.response.data) {
        if (typeof err.response.data === 'string') {
          errorMessage += ': ' + err.response.data
        } else if (err.response.data.detail) {
          errorMessage += ': ' + err.response.data.detail
        } else if (err.response.data.message) {
          errorMessage += ': ' + err.response.data.message
        } else {
          errorMessage += ': ' + JSON.stringify(err.response.data)
        }
      } else {
        errorMessage += ': サーバーエラー (ステータス: ' + err.response.status + ')'
      }
    } else if (err.message) {
      // ネットワークエラーなど
      errorMessage += ': ' + err.message
    } else {
      // その他のエラー
      errorMessage += ': 不明なエラーが発生しました'
    }
    
    alert(errorMessage)
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto">    <!-- ヘッダー -->
    <div class="bg-white rounded-t-2xl shadow-lg p-4 mb-0">
      <div class="flex items-center justify-between">
        <button 
          @click="goBack"
          data-testid="back-button"
          class="flex items-center text-gray-600 hover:text-gray-800 transition duration-200"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          名刺に戻る
        </button>
        
        <!-- モード切り替えボタン -->
        <div class="flex items-center space-x-2">
          <button 
            @click="switchMode('view')"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition duration-200',
              currentMode === 'view' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            表示モード
          </button>
          <button 
            @click="switchMode('record')"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition duration-200',
              currentMode === 'record' 
                ? 'bg-orange-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            記録モード
          </button>
        </div>
        
        <div class="w-20"></div> <!-- スペーサー -->
      </div>
    </div>    <!-- 説明ダイアログ -->
    <div v-if="showInstructionDialog && currentMode === 'record'" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-2xl instruction-dialog">
        <h3 class="text-lg font-bold text-gray-800 mb-4">
          <svg class="w-6 h-6 inline mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>          位置記録について
        </h3>
        <div class="text-gray-600 mb-6">
          <p class="mb-3">この機能では、名刺を交換した場所を地図上に記録できます。</p>
          <div class="bg-blue-50 p-3 rounded-lg mb-3">
            <h4 class="font-semibold text-blue-800 mb-2">記録方法：</h4>
            <ul class="text-sm text-blue-700 space-y-1">
              <li>• <strong>地図クリック</strong>：地図上の場所をクリックして記録</li>
              <li>• <strong>GPS利用</strong>：現在位置を自動取得して記録</li>
            </ul>
          </div>
          <div class="bg-yellow-50 p-3 rounded-lg mb-3">
            <h4 class="font-semibold text-yellow-800 mb-2">⚠️ 重要な注意点：</h4>
            <ul class="text-sm text-yellow-700 space-y-1">
              <li>• <strong>記録期限</strong>：管理者が設定した期間内のみ記録可能</li>
              <li>• <strong>期限切れ防止</strong>：関係ない時間での誤記録を防ぐため</li>
              <li>• <strong>削除機能</strong>：ご自身の記録のみ削除可能（緑色のピン）</li>
            </ul>
          </div>
          <p class="text-sm text-gray-500">
            ※記録された位置は地図上にピンで表示され、クリックすると記録日時が確認できます。
          </p>
        </div>
          <button 
          @click="closeInstructions"
          data-testid="close-instruction"
          class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
        >
          理解しました
        </button>
      </div>
    </div>

    <!-- エラーメッセージ -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <p class="text-red-800">{{ error }}</p>
    </div>

    <!-- 成功メッセージ -->
    <div v-if="success" class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
      <p class="text-green-800">位置情報が記録されました！</p>
    </div>    <!-- 記録が無効な場合 -->
    <div v-if="!recordingStatus.enabled && !error && currentMode === 'record'" class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
      <div class="text-center">
        <svg class="mx-auto h-12 w-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
        </svg>
        <h3 class="mt-2 text-lg font-medium text-yellow-800">位置記録は現在無効です</h3>
        <p class="mt-1 text-yellow-700">管理者によって位置記録が無効化されています。</p>
        <p v-if="recordingStatus.description" class="mt-2 text-sm text-yellow-600">
          {{ recordingStatus.description }}
        </p>
      </div>
    </div>    <!-- 記録方法選択（記録有効時のみ） -->
    <div v-if="recordingStatus.enabled && currentMode === 'record'" class="bg-white rounded-lg shadow-lg p-4 mb-4 recording-methods">
      <h3 class="text-lg font-semibold text-gray-800 mb-3">記録方法を選択</h3>
      <div class="grid grid-cols-2 gap-3">
        <button 
          @click="recordingMethod = 'click'"
          :class="[
            'p-3 rounded-lg border-2 transition duration-200',
            recordingMethod === 'click' 
              ? 'border-blue-500 bg-blue-50 text-blue-700' 
              : 'border-gray-200 hover:border-gray-300'
          ]"
        >
          <input type="radio" :value="'click'" v-model="recordingMethod" class="sr-only">
          <svg class="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          <div class="text-sm font-medium">地図クリック</div>
          <div class="text-xs text-gray-500">地図上をクリック</div>
        </button>
        
        <button 
          @click="useGPSLocation"
          data-testid="gps-record"
          :disabled="isLocating"
          class="p-3 rounded-lg border-2 border-green-200 hover:border-green-300 transition duration-200 disabled:opacity-50"
        >
          <input type="radio" :value="'gps'" v-model="recordingMethod" class="sr-only">
          <svg class="w-6 h-6 mx-auto mb-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          <div class="text-sm font-medium text-green-700">
            {{ isLocating ? '取得中...' : 'GPS利用' }}
          </div>
          <div class="text-xs text-gray-500">現在位置を取得</div>
        </button>
      </div>
    </div>    <!-- 地図表示 -->
    <div class="bg-white rounded-b-2xl shadow-lg overflow-hidden relative">
      <div v-if="currentMode === 'record' && recordingStatus.enabled" class="p-4 bg-blue-50 border-b">
        <p class="text-sm text-blue-800">
          <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          {{ recordingMethod === 'click' ? '地図上をクリックして、出会った場所を記録してください。' : 'GPSボタンで現在位置を取得するか、地図をクリックして記録してください。' }}
        </p>
        <p v-if="recordingStatus.expires_at" class="text-xs text-blue-600 mt-1">
          記録期限: {{ new Date(recordingStatus.expires_at).toLocaleString('ja-JP') }}
        </p>
      </div>
      
      <div v-if="currentMode === 'view'" class="p-4 bg-green-50 border-b">
        <p class="text-sm text-green-800">
          <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 10V9m0 0L9 7"></path>
          </svg>
          記録された場所が表示されています。ピンをクリックすると記録日時が表示されます。
        </p>
      </div>
      
      <!-- カスタム地図コントロール -->
      <div class="absolute top-4 left-4 z-10 flex flex-col space-y-2">
        <button 
          @click="zoomIn"
          class="w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm flex items-center justify-center transition duration-200"
          title="拡大"
        >
          <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
        </button>
        <button 
          @click="zoomOut"
          class="w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm flex items-center justify-center transition duration-200"
          title="縮小"
        >
          <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6"></path>
          </svg>
        </button>
        <button 
          @click="resetView"
          class="w-10 h-10 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm flex items-center justify-center transition duration-200"
          title="初期位置に戻る"
        >
          <svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
          </svg>
        </button>
      </div>
      
      <div ref="mapRef" class="map-container"></div>
      
      <!-- ポップアップ用の要素 -->
      <div ref="popupRef" class="ol-popup"></div>
    </div>

    <!-- 位置確認ダイアログ -->
    <div v-if="showConfirmDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-2xl">
        <h3 class="text-lg font-bold text-gray-800 mb-4">場所の記録</h3>
        <p class="text-gray-600 mb-6">
          この場所で出会ったことを記録しますか？<br>
          <small class="text-gray-500">※記録は一度のみ可能です</small>
        </p>
        
        <div class="flex space-x-3">
          <button 
            @click="cancelLocation"
            class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            キャンセル
          </button>
          <button 
            @click="confirmLocation"
            :disabled="isRecording"
            class="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >            <span v-if="isRecording">記録中...</span>
            <span v-else>記録する</span>
          </button>
        </div>
      </div>
    </div>  </div>
</template>

<style scoped>
.map-container {
  height: 400px;
  width: 100%;
}

.ol-popup {
  position: absolute;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  padding: 15px;
  border: none;
  bottom: 12px;
  left: -50px;
  min-width: 200px;
}

.ol-popup:after, .ol-popup:before {
  top: 100%;
  border: solid transparent;
  content: " ";
  height: 0;
  width: 0;
  position: absolute;
  pointer-events: none;
}

.ol-popup:after {
  border-color: rgba(255, 255, 255, 0);
  border-top-color: white;
  border-width: 10px;
  left: 48px;
  margin-left: -10px;
}

.ol-popup:before {
  border-color: rgba(0, 0, 0, 0);
  border-top-color: rgba(0, 0, 0, 0.1);
  border-width: 11px;
  left: 48px;
  margin-left: -11px;
}

.instruction-dialog {
  max-height: 90vh;
  overflow-y: auto;
}

.recording-methods {
  border: 2px solid #e5e7eb;
}
</style>
