<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'

const emit = defineEmits(['show-map', 'show-map-view'])

const props = defineProps({
  refreshTrigger: {
    type: Number,
    default: 0
  }
})

const cardInfo = ref(null)
const loading = ref(true)
const error = ref(null)

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

// 計算されたプロパティ：表示用の個人情報
const personalInfo = computed(() => cardInfo.value?.personalInfo || {})
const socialLinks = computed(() => cardInfo.value?.socialLinks || [])
const design = computed(() => cardInfo.value?.design || {})

// 背景スタイルを計算する関数
const headerBackgroundStyle = computed(() => {
  const primaryColor = design.value.primaryColor || '#3B82F6'
  
  if (design.value.backgroundImage) {
    return {
      background: `linear-gradient(135deg, ${primaryColor}aa 0%, ${primaryColor}bb 100%), url('${design.value.backgroundImage}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundBlendMode: 'overlay'
    }
  } else {
    return {
      background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }
})

// カード全体のクラスを計算
const cardContainerClasses = computed(() => {
  const theme = design.value.theme || 'modern'
  
  const baseClasses = {
    'modern': 'bg-white rounded-2xl shadow-2xl transition-all duration-300 hover:shadow-3xl',
    'minimal': 'bg-white rounded-lg shadow-lg border border-gray-200',
    'classic': 'bg-white rounded-none shadow-xl border-4 border-gray-800',
    'creative': 'bg-white rounded-3xl shadow-2xl transform rotate-1 hover:rotate-0 transition-all duration-500',
    'corporate': 'bg-white rounded-lg shadow-lg border-l-4',
    'artistic': 'bg-white rounded-2xl shadow-2xl border-2 border-opacity-30'
  }
  
  return baseClasses[theme] || baseClasses.modern
})

// カード全体のスタイルを計算
const cardContainerStyle = computed(() => {
  const theme = design.value.theme || 'modern'
  const primaryColor = design.value.primaryColor || '#3B82F6'
  const backgroundColor = design.value.backgroundColor || '#FFFFFF'
  const textColor = design.value.textColor || '#1F2937'
  
  let style = {
    backgroundColor,
    color: textColor
  }
  
  // テーマ別の特別なスタイル
  if (theme === 'corporate') {
    style.borderLeftColor = primaryColor
  } else if (theme === 'artistic') {
    style.borderColor = primaryColor
  } else if (theme === 'creative') {
    style.boxShadow = `0 25px 50px -12px ${primaryColor}30`
  } else if (theme === 'minimal') {
    style.borderColor = `${primaryColor}40`
  }
  
  return style
})

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
    </svg>`,
    facebook: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M20 10c0-5.523-4.477-10-10-10S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z" clip-rule="evenodd"/>
    </svg>`,
    youtube: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>`,
    tiktok: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>`,
    discord: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0002 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z"/>
    </svg>`,
    telegram: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>`,
    whatsapp: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.89 3.688"/>
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

// propsの変更を監視して設定を再読み込み
watch(() => props.refreshTrigger, async () => {
  if (props.refreshTrigger > 0) {
    await loadCardInfo()
  }
})

const loadCardInfo = async () => {
  loading.value = true
  error.value = null
  
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
  <div class="max-w-md mx-auto">
    <!-- ローディング状態 -->
    <div v-if="loading" class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p class="mt-4 text-gray-600">名刺情報を読み込み中...</p>
    </div>

    <!-- エラー状態 -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
      <p class="font-semibold">エラーが発生しました</p>
      <p class="text-sm">{{ error }}</p>
    </div>    <!-- 名刺表示 -->
    <div 
      v-else-if="cardInfo" 
      :class="cardContainerClasses"
      :style="cardContainerStyle"
      class="overflow-hidden"
    >
      <!-- ヘッダー部分 -->
      <div 
        class="px-8 py-6 text-center relative overflow-hidden"
        :style="headerBackgroundStyle"
      >
        <!-- 装飾的な背景要素 -->
        <div class="absolute top-0 left-0 w-full h-full opacity-10">
          <div class="absolute top-4 right-4 w-20 h-20 rounded-full border-2 border-white"></div>
          <div class="absolute bottom-2 left-6 w-12 h-12 rounded-full border border-white"></div>
        </div>
        
        <!-- プロフィール画像 -->
        <div v-if="design.profileImage" class="relative z-10 mb-4">
          <img 
            :src="design.profileImage" 
            :alt="`${personalInfo.name}のプロフィール画像`"
            class="w-24 h-24 rounded-full mx-auto object-cover border-4 border-white shadow-lg"
            @error="$event.target.style.display='none'"
          >
        </div>
        
        <div class="relative z-10">
          <h1 
            class="text-3xl text-white mb-2"
            :class="{
              'font-light tracking-wider': design.theme === 'minimal',
              'font-serif font-bold': design.theme === 'classic',
              'font-bold tracking-wide': design.theme === 'modern',
              'font-bold tracking-widest text-shadow': design.theme === 'creative',
              'font-semibold tracking-normal': design.theme === 'corporate',
              'font-bold tracking-wide text-shadow-lg': design.theme === 'artistic'
            }"
          >
            {{ personalInfo.name }}
          </h1>
          <p 
            v-if="personalInfo.title" 
            class="text-lg text-white opacity-90 font-medium"
          >
            {{ personalInfo.title }}
          </p>
        </div>
      </div>

      <!-- 会社情報 -->
      <div class="px-8 py-6 border-b border-gray-100">
        <div class="space-y-2">
          <div v-if="personalInfo.company" class="flex items-center">
            <!-- ロゴ画像がある場合は表示 -->
            <div v-if="design.logoImage" class="mr-3">
              <img 
                :src="design.logoImage" 
                :alt="`${personalInfo.company}のロゴ`"
                class="w-8 h-8 object-contain"
                @error="$event.target.style.display='none'"
              >
            </div>
            <!-- ロゴ画像がない場合は従来のアイコン -->
            <svg v-else class="w-5 h-5 mr-3 opacity-60" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clip-rule="evenodd"/>
            </svg>
            <span class="font-medium">{{ personalInfo.company }}</span>
          </div>
          <div v-if="personalInfo.department" class="flex items-center text-sm opacity-75 ml-8">
            {{ personalInfo.department }}
          </div>
        </div>
      </div>

      <!-- 連絡先情報 -->
      <div class="px-8 py-6">
        <div class="space-y-4">
          <div v-if="personalInfo.email" class="flex items-center group hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors">
            <svg class="w-5 h-5 mr-3 opacity-60 group-hover:opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            <span class="text-sm break-all">{{ personalInfo.email }}</span>
          </div>
          
          <div v-if="personalInfo.phone" class="flex items-center group hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors">
            <svg class="w-5 h-5 mr-3 opacity-60 group-hover:opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            <span class="text-sm">{{ personalInfo.phone }}</span>
          </div>

          <div v-if="personalInfo.website" class="flex items-center group hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition-colors">
            <svg class="w-5 h-5 mr-3 opacity-60 group-hover:opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"/>
            </svg>
            <span class="text-sm break-all">{{ personalInfo.website }}</span>
          </div>
        </div>
      </div>

      <!-- SNSリンク -->
      <div v-if="socialLinks.filter(link => link.enabled && link.url).length > 0" class="px-8 py-6 border-t border-gray-100">
        <h3 class="text-sm font-medium opacity-75 mb-4">SNS・ソーシャルメディア</h3>
        <div class="flex flex-wrap gap-3">
          <a 
            v-for="link in socialLinks.filter(l => l.enabled && l.url)" 
            :key="link.type"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200 group"
            :style="{ borderColor: design.primaryColor + '20' }"
          >
            <span 
              v-html="getSocialIcon(link.icon || link.type)" 
              class="mr-2 opacity-70 group-hover:opacity-100 transition-opacity"
              :style="{ color: design.primaryColor || '#3B82F6' }"
            ></span>
            <span class="text-sm font-medium group-hover:text-gray-800">{{ link.label }}</span>
          </a>
        </div>
      </div>

      <!-- アクションボタン -->
      <div class="px-8 py-6 space-y-3 border-t border-gray-100">
        <div class="grid grid-cols-2 gap-3">
          <button 
            v-if="personalInfo.website"
            @click="openWebsite"
            :style="{ backgroundColor: design.primaryColor || '#3B82F6' }"
            class="flex-1 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center hover:opacity-90 text-sm"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
            </svg>
            サイトへ
          </button>

          <button 
            v-if="personalInfo.email"
            @click="sendEmail"
            class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center text-sm"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
            メール
          </button>
        </div>
      </div>

      <!-- 場所記録機能 -->
      <div class="px-8 py-6 border-t-2 border-gray-100">
        <div class="space-y-3">
          <button 
            @click="goToMap"
            data-testid="map-record-button"
            class="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-4 px-4 rounded-lg transition duration-200 flex items-center justify-center text-lg shadow-lg"
          >
            <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            出会った場所を記録する
          </button>            <button 
            @click="goToMapView"
            data-testid="map-view-button"
            :style="{ backgroundColor: design.primaryColor || '#3B82F6' }"
            class="w-full text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center hover:opacity-90"
          >
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7"></path>
            </svg>
            記録された場所を見る
          </button>
        </div>
      </div>

      <!-- プロジェクト情報 -->
      <div class="px-8 py-6 border-t border-gray-200 bg-gray-50">
        <div class="text-center">
          <h3 class="text-sm font-semibold text-gray-600 mb-2">このプロジェクトについて</h3>
          <p class="text-xs text-gray-500 mb-3 leading-relaxed">
            名刺交換場所記録サイト - QRコードで名刺を表示し、出会った場所を地図上に記録できるWebアプリケーション
          </p>
          <div class="flex justify-center items-center space-x-4">
            <a 
              href="https://github.com/your-username/namecard-places" 
              target="_blank" 
              rel="noopener noreferrer"
              class="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors duration-200"
            >
              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"/>
              </svg>
              GitHub
            </a>
            <div class="text-xs text-gray-400">
              Vue 3 + FastAPI + OpenLayers
            </div>
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

/* カスタムシャドウ */
.shadow-3xl {
  box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.25);
}

/* アニメーション */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.bg-white {
  animation: fadeIn 0.5s ease-out;
}
</style>
