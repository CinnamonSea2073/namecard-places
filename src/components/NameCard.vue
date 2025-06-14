<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

const emit = defineEmits(['show-map', 'show-map-view'])

const cardInfo = ref(null)
const loading = ref(true)
const error = ref(null)

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

// 計算されたプロパティ：表示用の個人情報
const personalInfo = computed(() => cardInfo.value?.personalInfo || {})
const socialLinks = computed(() => cardInfo.value?.socialLinks || [])
const design = computed(() => cardInfo.value?.design || {})

// ソーシャルアイコンのマッピング
const getSocialIcon = (type) => {
  const icons = {
    twitter: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84"/>
    </svg>`,
    linkedin: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z" clip-rule="evenodd"/>
    </svg>`,
    github: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"/>
    </svg>`,
    instagram: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M10 0C7.284 0 6.944.012 5.877.06 2.246.227.227 2.242.06 5.877.012 6.944 0 7.284 0 10s.012 3.056.06 4.123c.167 3.632 2.182 5.65 5.817 5.817C6.944 19.988 7.284 20 10 20s3.056-.012 4.123-.06c3.629-.167 5.652-2.182 5.817-5.817C19.988 13.056 20 12.716 20 10s-.012-3.056-.06-4.123C19.833 2.245 17.815.227 14.183.06 13.056.012 12.716 0 10 0zm0 1.802c2.67 0 2.987.01 4.042.059 2.71.123 3.975 1.409 4.099 4.099.048 1.054.057 1.37.057 4.04 0 2.672-.01 2.988-.057 4.042-.124 2.687-1.387 3.975-4.1 4.099-1.054.048-1.37.058-4.041.058-2.67 0-2.987-.01-4.04-.058-2.717-.124-3.977-1.416-4.1-4.1-.048-1.054-.058-1.37-.058-4.041 0-2.67.01-2.986.058-4.04.124-2.69 1.387-3.977 4.1-4.1 1.054-.048 1.37-.058 4.04-.058zM10 4.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clip-rule="evenodd"/>
    </svg>`
  }
  return icons[type] || `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
    <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
  </svg>`
}

onMounted(async () => {
  await loadCardInfo()
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

const goToMap = () => {
  emit('show-map')
}

const goToMapView = () => {
  emit('show-map-view')
}

const openWebsite = () => {
  if (personalInfo.value?.website) {
    window.open(personalInfo.value.website, '_blank')
  }
}

const sendEmail = () => {
  if (personalInfo.value?.email) {
    window.location.href = `mailto:${personalInfo.value.email}`
  }
}

const openSocialLink = (url) => {
  if (url) {
    window.open(url, '_blank')
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
