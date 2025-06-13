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

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

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

const initMap = () => {
  const vectorSource = new VectorSource()
  const vectorLayer = new VectorLayer({
    source: vectorSource,
    style: (feature) => {
      const timestamp = feature.get('timestamp')
      return new Style({
        image: new Circle({
          radius: 8,
          fill: new Fill({ color: 'rgba(255, 0, 0, 0.8)' }),
          stroke: new Stroke({ color: 'white', width: 2 })
        }),
        text: timestamp ? new Text({
          text: new Date(timestamp).toLocaleDateString('ja-JP'),
          offsetY: -15,
          font: '12px sans-serif',
          fill: new Fill({ color: '#333' }),
          stroke: new Stroke({ color: 'white', width: 2 })
        }) : undefined
      })
    }
  })

  map.value = new Map({
    target: mapRef.value,
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
      if (timestamp) {
        const date = new Date(timestamp)
        popupRef.value.innerHTML = `
          <div class="bg-white p-3 rounded-lg shadow-lg border">
            <div class="font-semibold text-gray-800">記録日時</div>
            <div class="text-sm text-gray-600">${date.toLocaleString('ja-JP')}</div>
          </div>
        `
        popup.value.setPosition(coordinate)
      }
      return
    }

    // 地図のクリック（記録機能）
    if (!props.viewOnly && recordingStatus.value.enabled && recordingMethod.value === 'click') {
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

    const vectorLayer = map.value.getLayers().getArray()[1]
    const vectorSource = vectorLayer.getSource()

    locations.forEach(location => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([location.longitude, location.latitude])),
        timestamp: location.timestamp
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

  isRecording.value = true
  error.value = null

  try {
    await axios.post(`${API_BASE}/api/record-location`, currentLocation.value)

    // 地図に新しいピンを追加
    const vectorLayer = map.value.getLayers().getArray()[1]
    const vectorSource = vectorLayer.getSource()
    
    const feature = new Feature({
      geometry: new Point(fromLonLat([
        currentLocation.value.longitude,
        currentLocation.value.latitude
      ])),
      timestamp: new Date().toISOString()
    })
    vectorSource.addFeature(feature)

    success.value = true
    showConfirmDialog.value = false
    
    setTimeout(() => {
      success.value = false
      if (!props.viewOnly) {
        emit('back-to-card')
      }
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
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- ヘッダー -->
    <div class="bg-white rounded-t-2xl shadow-lg p-4 mb-0">
      <div class="flex items-center justify-between">        <button 
          @click="goBack"
          data-testid="back-button"
          class="flex items-center text-gray-600 hover:text-gray-800 transition duration-200"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          {{ props.viewOnly ? '名刺に戻る' : '名刺に戻る' }}
        </button>
        <h2 class="text-xl font-bold text-gray-800">
          {{ props.viewOnly ? '出会った場所の地図' : '出会った場所を記録' }}
        </h2>
        <div class="w-20"></div> <!-- スペーサー -->
      </div>
    </div>    <!-- 説明ダイアログ -->
    <div v-if="showInstructionDialog && !props.viewOnly" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-2xl instruction-dialog">
        <h3 class="text-lg font-bold text-gray-800 mb-4">
          <svg class="w-6 h-6 inline mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          位置記録について
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
    </div>

    <!-- 記録が無効な場合 -->
    <div v-if="!recordingStatus.enabled && !error && !props.viewOnly" class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
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
    <div v-if="recordingStatus.enabled && !props.viewOnly" class="bg-white rounded-lg shadow-lg p-4 mb-4 recording-methods">
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
    </div>

    <!-- 地図表示 -->
    <div class="bg-white rounded-b-2xl shadow-lg overflow-hidden">
      <div v-if="!props.viewOnly && recordingStatus.enabled" class="p-4 bg-blue-50 border-b">
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
      
      <div v-if="props.viewOnly" class="p-4 bg-green-50 border-b">
        <p class="text-sm text-green-800">
          <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 10V9m0 0L9 7"></path>
          </svg>
          記録された場所が表示されています。ピンをクリックすると記録日時が表示されます。
        </p>
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
          >
            <span v-if="isRecording">記録中...</span>
            <span v-else">記録する</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
