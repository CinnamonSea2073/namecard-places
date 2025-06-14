<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import QRCode from 'qrcode'

const emit = defineEmits(['show-map', 'show-map-view'])

const cardInfo = ref(null)
const loading = ref(true)
const error = ref(null)
const qrCodeDataUrl = ref('')

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

onMounted(async () => {
  await loadCardInfo()
  await generateQRCode()
})

const loadCardInfo = async () => {
  try {
    console.log('API_BASE:', API_BASE)
    console.log('Making request to:', `${API_BASE}/api/card-info`)
    
    const response = await axios.get(`${API_BASE}/api/card-info`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
      },
      timeout: 10000, // 10秒のタイムアウト
    })
    console.log('Response status:', response.status)
    console.log('Response headers:', response.headers)
    console.log('Response data:', response.data)
    
    cardInfo.value = response.data
  } catch (err) {
    console.error('Error loading card info:', err)
    console.error('Error response:', err.response)
    console.error('Error message:', err.message)
    console.error('Error config:', err.config)
    
    if (err.response) {
      error.value = `カード情報の読み込みに失敗しました (${err.response.status}: ${err.response.statusText})`
    } else if (err.request) {
      error.value = 'サーバーへの接続に失敗しました'
    } else {
      error.value = 'カード情報の読み込みに失敗しました'
    }
  } finally {
    loading.value = false
  }
}

const generateQRCode = async () => {
  try {
    // 固定URLを生成（名刺印刷用）
    const baseUrl = window.location.origin + window.location.pathname
    qrCodeDataUrl.value = await QRCode.toDataURL(baseUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
  } catch (err) {
    console.error('QR Code generation error:', err)
  }
}

const goToMap = () => {
  emit('show-map')
}

const goToMapView = () => {
  emit('show-map-view')
}

const openWebsite = () => {
  if (cardInfo.value?.website) {
    window.open(cardInfo.value.website, '_blank')
  }
}

const sendEmail = () => {
  if (cardInfo.value?.email) {
    window.location.href = `mailto:${cardInfo.value.email}`
  }
}
</script>

<template>
  <div class="card-container">
    <div v-if="loading" class="text-center">
      <div class="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">読み込み中...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6">
      <p class="text-red-800">{{ error }}</p>
    </div>

    <div v-else class="bg-white rounded-2xl shadow-xl overflow-hidden">
      <!-- ヘッダー -->
      <div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-white">
        <h1 class="text-2xl font-bold mb-2">{{ cardInfo?.name }}</h1>
        <p class="text-blue-100 text-lg">{{ cardInfo?.title }}</p>
        <p class="text-blue-200">{{ cardInfo?.company }}</p>
      </div>

      <!-- カード内容 -->
      <div class="p-6">
        <div class="mb-6">
          <p class="text-gray-700 leading-relaxed">{{ cardInfo?.description }}</p>
        </div>

        <!-- 連絡先ボタン -->
        <div class="space-y-3 mb-6">
          <button 
            @click="openWebsite"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
            </svg>
            ウェブサイトを見る
          </button>

          <button 
            @click="sendEmail"
            class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
            メールを送る
          </button>
        </div>

        <!-- 出会った場所を記録ボタン -->
        <div class="border-t pt-6">
          <button 
            @click="goToMap"
            data-testid="map-record-button"
            class="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 px-4 rounded-lg transition duration-200 flex items-center justify-center text-lg mb-3"
          >
            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            出会った場所を記録する
          </button>
          
          <button 
            @click="goToMapView"
            data-testid="map-view-button"
            class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v0"></path>
            </svg>
            記録された場所を見る
          </button>
        </div>

        <!-- QRコード表示 -->
        <div v-if="qrCodeDataUrl" class="mt-6 text-center">
          <p class="text-sm text-gray-600 mb-3">この名刺をシェア</p>
          <div class="qr-code-container mx-auto">
            <img :src="qrCodeDataUrl" alt="QRコード" class="mx-auto" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-container {
  max-width: 28rem;
  margin: 0 auto;
}

.qr-code-container {
  max-width: 200px;
}
</style>
