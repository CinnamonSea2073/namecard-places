<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const emit = defineEmits(['back-to-card', 'config-updated'])

const adminPassword = ref('')
const isLoggedIn = ref(false)
const loginError = ref('')
const sessionStatus = ref({ enabled: false, expires_at: null, description: null })
const newSession = ref({ enabled: false, expires_at: '', description: '' })
const locations = ref([])
const loading = ref(false)

// 設定管理用の状態
const config = ref({
  personalInfo: {
    name: '',
    title: '',
    company: '',
    department: '',
    email: '',
    phone: '',
    website: ''
  },
  socialLinks: [],
  design: {
    theme: 'modern',
    primaryColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    profileImage: '',
    backgroundImage: '',
    logoImage: ''
  }
})
const configLoading = ref(false)
const configError = ref('')
const configSuccess = ref('')
const activeTab = ref('session') // 'session', 'config', 'locations'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

onMounted(() => {
  // 保存されたパスワードがあるかチェック（セッション中のみ）
  const savedPassword = sessionStorage.getItem('adminPassword')
  if (savedPassword) {
    adminPassword.value = savedPassword
    checkAdminAccess()
  }
})

const login = async () => {
  if (!adminPassword.value) {
    loginError.value = 'パスワードを入力してください'
    return
  }

  try {
    await axios.post(`${API_BASE}/api/admin/login`, {
      password: adminPassword.value
    })
    isLoggedIn.value = true
    loginError.value = ''
    sessionStorage.setItem('adminPassword', adminPassword.value)
    await loadAdminData()
  } catch (err) {
    loginError.value = 'パスワードが間違っています'
    console.error('Admin login error:', err)
  }
}

const checkAdminAccess = async () => {
  try {
    await axios.get(`${API_BASE}/api/admin/session-status`, {
      params: { admin_password: adminPassword.value }
    })
    isLoggedIn.value = true
    await loadAdminData()
  } catch (err) {
    sessionStorage.removeItem('adminPassword')
    adminPassword.value = ''
  }
}

const loadAdminData = async () => {
  await Promise.all([
    loadSessionStatus(),
    loadLocations(),
    loadConfig()
  ])
}

// 設定管理関数
const loadConfig = async () => {
  configLoading.value = true
  configError.value = ''
  try {    const response = await axios.get(`${API_BASE}/api/admin/config`, {
      params: { admin_password: adminPassword.value }
    })
    config.value = response.data
  } catch (err) {
    configError.value = '設定の読み込みに失敗しました'
    console.error('Error loading config:', err)
  } finally {
    configLoading.value = false
  }
}

const saveConfig = async () => {
  configLoading.value = true
  configError.value = ''
  configSuccess.value = ''
  try {
    await axios.put(`${API_BASE}/api/admin/config`, config.value, {
      params: { admin_password: adminPassword.value }
    })
    configSuccess.value = '設定を保存しました'
    // 名刺画面に更新を通知
    emit('config-updated')
    setTimeout(() => {
      configSuccess.value = ''
    }, 3000)
  } catch (err) {
    configError.value = '設定の保存に失敗しました'
    console.error('Error saving config:', err)
  } finally {
    configLoading.value = false
  }
}

const addSocialLink = () => {
  config.value.socialLinks.push({
    type: '',
    label: '',
    url: '',
    icon: '',
    enabled: false
  })
}

const removeSocialLink = (index) => {
  config.value.socialLinks.splice(index, 1)
}

// カラーパレット定義
const colorPalettes = {
  blue: { name: 'ブルー', primary: '#3B82F6', secondary: '#1E40AF', light: '#DBEAFE' },
  green: { name: 'グリーン', primary: '#10B981', secondary: '#047857', light: '#D1FAE5' },
  purple: { name: 'パープル', primary: '#8B5CF6', secondary: '#5B21B6', light: '#E9D5FF' },
  red: { name: 'レッド', primary: '#EF4444', secondary: '#B91C1C', light: '#FEE2E2' },
  orange: { name: 'オレンジ', primary: '#F59E0B', secondary: '#D97706', light: '#FEF3C7' },
  pink: { name: 'ピンク', primary: '#EC4899', secondary: '#BE185D', light: '#FCE7F3' },
  indigo: { name: 'インディゴ', primary: '#6366F1', secondary: '#4338CA', light: '#E0E7FF' },
  teal: { name: 'ティール', primary: '#14B8A6', secondary: '#0F766E', light: '#CCFBF1' }
}

// テーマ定義の拡張
const themeOptions = [
  { value: 'modern', name: 'モダン', description: '洗練されたモダンデザイン' },
  { value: 'classic', name: 'クラシック', description: '伝統的で信頼感のあるデザイン' },
  { value: 'minimal', name: 'ミニマル', description: 'シンプルで機能的なデザイン' },
  { value: 'creative', name: 'クリエイティブ', description: '創造的で個性的なデザイン' },
  { value: 'corporate', name: 'コーポレート', description: 'ビジネス向けの専門的なデザイン' },
  { value: 'artistic', name: 'アーティスティック', description: '芸術的で表現豊かなデザイン' }
]

// SNSタイプが変更されたときにアイコンとラベルを自動設定
const onSocialTypeChange = (link) => {
  const typeMap = {
    twitter: { icon: 'twitter', label: 'Twitter', placeholder: 'https://twitter.com/username' },
    facebook: { icon: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/username' },
    linkedin: { icon: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username' },
    instagram: { icon: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username' },
    github: { icon: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
    youtube: { icon: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@username' },
    tiktok: { icon: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@username' },
    discord: { icon: 'discord', label: 'Discord', placeholder: 'https://discord.gg/invite' },
    telegram: { icon: 'telegram', label: 'Telegram', placeholder: 'https://t.me/username' },
    whatsapp: { icon: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/1234567890' }
  }
  
  if (typeMap[link.type]) {
    link.icon = typeMap[link.type].icon
    if (!link.label || Object.values(typeMap).some(t => t.label === link.label)) {
      link.label = typeMap[link.type].label
    }
    link.placeholder = typeMap[link.type].placeholder
  } else {
    link.placeholder = 'https://example.com/profile'
  }
}

// カラーパレットを適用
const applyColorPalette = (paletteKey) => {
  const palette = colorPalettes[paletteKey]
  if (palette) {
    config.value.design.primaryColor = palette.primary
  }
}

const loadSessionStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE}/api/admin/session-status`, {
      params: { admin_password: adminPassword.value }
    })
    sessionStatus.value = response.data
    
    // 新しいセッションのデフォルト値を設定
    newSession.value = {
      enabled: sessionStatus.value.enabled,
      expires_at: sessionStatus.value.expires_at || '',
      description: sessionStatus.value.description || ''
    }
  } catch (err) {
    console.error('Session status loading error:', err)
  }
}

const loadLocations = async () => {
  try {
    const response = await axios.get(`${API_BASE}/api/admin/locations`, {
      params: { admin_password: adminPassword.value }
    })
    locations.value = response.data
  } catch (err) {
    console.error('Locations loading error:', err)
  }
}

const deleteLocation = async (locationId) => {
  if (!confirm('この位置記録を削除しますか？')) return
  
  try {
    await axios.delete(`${API_BASE}/api/admin/locations/${locationId}`, {
      params: { admin_password: adminPassword.value }
    })
    
    // 一覧から削除
    locations.value = locations.value.filter(loc => loc.id !== locationId)
    alert('位置記録を削除しました')
  } catch (err) {
    console.error('位置記録の削除エラー:', err)
    alert('削除に失敗しました: ' + (err.response?.data?.detail || err.message))
  }
}

const updateSession = async () => {
  loading.value = true
  try {
    // 期限設定のロジック
    let expiresAt = newSession.value.expires_at
    if (newSession.value.enabled && !expiresAt) {
      // デフォルトで1時間後に設定
      const now = new Date()
      now.setHours(now.getHours() + 1)
      expiresAt = now.toISOString().slice(0, 16)
    }

    await axios.post(`${API_BASE}/api/admin/enable-recording`, {
      enabled: newSession.value.enabled,
      expires_at: expiresAt,
      description: newSession.value.description
    }, {
      params: { admin_password: adminPassword.value }
    })

    await loadSessionStatus()
  } catch (err) {
    console.error('Session update error:', err)
  } finally {
    loading.value = false
  }
}

const logout = () => {
  isLoggedIn.value = false
  adminPassword.value = ''
  sessionStorage.removeItem('adminPassword')
}

const goBack = () => {
  emit('back-to-card')
}

const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('ja-JP')
}

const getStatusColor = () => {
  if (!sessionStatus.value.enabled) return 'text-red-600'
  
  if (sessionStatus.value.expires_at) {
    const expiresAt = new Date(sessionStatus.value.expires_at)
    const now = new Date()
    if (expiresAt < now) return 'text-red-600'
  }
  
  return 'text-green-600'
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div class="bg-white rounded-2xl shadow-xl overflow-hidden">
      <!-- ヘッダー -->
      <div class="bg-gradient-to-r from-gray-700 to-gray-900 px-6 py-4 text-white">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-bold">管理者パネル</h1>
          <button 
            @click="goBack"
            class="text-gray-300 hover:text-white transition duration-200"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- ログイン画面 -->
      <div v-if="!isLoggedIn" class="p-8">
        <div class="max-w-sm mx-auto">
          <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">管理者ログイン</h2>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                パスワード
              </label>
              <input 
                v-model="adminPassword"
                type="password"
                @keyup.enter="login"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="管理者パスワードを入力"
              />
            </div>
            
            <div v-if="loginError" class="text-red-600 text-sm">
              {{ loginError }}
            </div>
            
            <button 
              @click="login"
              class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              ログイン
            </button>
          </div>
        </div>
      </div>      <!-- 管理画面 -->
      <div v-else class="p-6">
        <!-- タブナビゲーション -->
        <div class="border-b border-gray-200 mb-6">
          <nav class="-mb-px flex space-x-8">
            <button
              @click="activeTab = 'session'"
              :class="[
                activeTab === 'session' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition duration-200'
              ]"
            >
              セッション管理
            </button>
            <button
              @click="activeTab = 'config'"
              :class="[
                activeTab === 'config' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition duration-200'
              ]"
            >
              名刺設定
            </button>
            <button
              @click="activeTab = 'locations'"
              :class="[
                activeTab === 'locations' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition duration-200'
              ]"
            >
              位置記録
            </button>
          </nav>
        </div>

        <!-- ログアウトボタン -->
        <div class="flex justify-end mb-6">
          <button 
            @click="logout"
            class="text-sm text-gray-600 hover:text-gray-800 transition duration-200"
          >
            ログアウト
          </button>
        </div>

        <!-- セッション管理タブ -->
        <div v-if="activeTab === 'session'" class="space-y-6">

        <!-- 現在のセッション状態 -->        <!-- 現在のセッション状態 -->
        <div class="mb-8">
          <h3 class="text-lg font-bold text-gray-800 mb-4">現在の記録セッション</h3>
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span class="text-sm text-gray-600">状態:</span>
                <p :class="getStatusColor()" class="font-semibold">
                  {{ sessionStatus.enabled ? '有効' : '無効' }}
                </p>
              </div>
              <div>
                <span class="text-sm text-gray-600">期限:</span>
                <p class="font-semibold text-gray-800">
                  {{ formatDateTime(sessionStatus.expires_at) }}
                </p>
              </div>
              <div>
                <span class="text-sm text-gray-600">記録数:</span>
                <p class="font-semibold text-gray-800">{{ locations.length }}件</p>
              </div>
            </div>
            <div v-if="sessionStatus.description" class="mt-3">
              <span class="text-sm text-gray-600">説明:</span>
              <p class="text-gray-800">{{ sessionStatus.description }}</p>
            </div>
          </div>
        </div>

        <!-- セッション設定 -->
        <div class="mb-8">
          <h3 class="text-lg font-bold text-gray-800 mb-4">記録セッション設定</h3>
          <div class="space-y-4">
            <div class="flex items-center">
              <input 
                v-model="newSession.enabled"
                type="checkbox"
                id="enableRecording"
                class="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label for="enableRecording" class="ml-2 text-sm text-gray-700">
                位置記録を有効にする
              </label>
            </div>
            
            <div v-if="newSession.enabled">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                記録期限
              </label>
              <input 
                v-model="newSession.expires_at"
                type="datetime-local"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                セッション説明
              </label>
              <input 
                v-model="newSession.description"
                type="text"
                placeholder="例: 2024年営業会議"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button 
              @click="updateSession"
              :disabled="loading"
              class="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              {{ loading ? '更新中...' : 'セッションを更新' }}
            </button>          </div>
        </div>
        </div>

        <!-- 名刺設定タブ -->
        <div v-else-if="activeTab === 'config'" class="space-y-6">
          <div v-if="configLoading" class="text-center">
            <p class="text-gray-600">設定を読み込み中...</p>
          </div>
          
          <div v-else class="space-y-6">
            <!-- エラー・成功メッセージ -->
            <div v-if="configError" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {{ configError }}
            </div>
            <div v-if="configSuccess" class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {{ configSuccess }}
            </div>

            <!-- 個人情報設定 -->
            <div class="bg-white border border-gray-200 rounded-lg p-6">
              <h3 class="text-lg font-bold text-gray-800 mb-4">個人情報</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">名前</label>
                  <input 
                    v-model="config.personalInfo.name"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="山田太郎"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">肩書き</label>
                  <input 
                    v-model="config.personalInfo.title"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="エンジニア"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">会社名</label>
                  <input 
                    v-model="config.personalInfo.company"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="株式会社サンプル"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">部署（空欄時は非表示）</label>
                  <input 
                    v-model="config.personalInfo.department"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="開発部"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">メールアドレス</label>
                  <input 
                    v-model="config.personalInfo.email"
                    type="email"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="yamada@example.com"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">電話番号（空欄時は非表示）</label>
                  <input 
                    v-model="config.personalInfo.phone"
                    type="tel"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="090-1234-5678"
                  />
                </div>
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-2">ウェブサイト</label>
                  <input 
                    v-model="config.personalInfo.website"
                    type="url"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </div>            <!-- SNSリンク設定 -->
            <div class="bg-white border border-gray-200 rounded-lg p-6">
              <div class="flex items-center justify-between mb-6">
                <div>
                  <h3 class="text-lg font-bold text-gray-800">SNSリンク</h3>
                  <p class="text-sm text-gray-600 mt-1">ソーシャルメディアのプロフィールを追加できます</p>
                </div>
                <button 
                  @click="addSocialLink"
                  class="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-200 flex items-center"
                >
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                  SNSを追加
                </button>
              </div>
              
              <div v-if="config.socialLinks.length === 0" class="text-center py-8">
                <svg class="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                </svg>
                <p class="text-gray-500">まだSNSリンクが設定されていません</p>
                <p class="text-sm text-gray-400 mt-1">上の「SNSを追加」ボタンから始めましょう</p>
              </div>
              
              <div v-else class="space-y-4">
                <div 
                  v-for="(link, index) in config.socialLinks" 
                  :key="index"
                  class="border border-gray-200 rounded-lg p-4 transition duration-200 hover:border-gray-300 hover:shadow-sm"
                >
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-3">
                      <div class="flex items-center space-x-2">
                        <input 
                          v-model="link.enabled"
                          type="checkbox"
                          class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span class="text-sm font-medium text-gray-700">表示する</span>
                      </div>
                      <div v-if="link.enabled" class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        有効
                      </div>
                    </div>
                    <button 
                      @click="removeSocialLink(index)"
                      class="text-red-600 hover:text-red-800 transition duration-200 flex items-center text-sm"
                    >
                      <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                      削除
                    </button>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">SNSの種類</label>
                      <select 
                        v-model="link.type"
                        @change="onSocialTypeChange(link)"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">選択してください</option>
                        <optgroup label="人気のSNS">
                          <option value="twitter">Twitter / X</option>
                          <option value="instagram">Instagram</option>
                          <option value="facebook">Facebook</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="youtube">YouTube</option>
                          <option value="tiktok">TikTok</option>
                        </optgroup>
                        <optgroup label="その他">
                          <option value="github">GitHub</option>
                          <option value="discord">Discord</option>
                          <option value="telegram">Telegram</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="other">その他（カスタム）</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">表示名</label>
                      <input 
                        v-model="link.label"
                        type="text"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="例: Twitter"
                      />
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-sm font-medium text-gray-700 mb-2">プロフィールURL</label>
                      <input 
                        v-model="link.url"
                        type="url"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        :placeholder="link.placeholder || 'https://example.com/profile'"
                      />
                    </div>
                    <div v-if="link.type === 'other'" class="md:col-span-2">
                      <label class="block text-sm font-medium text-gray-700 mb-2">アイコン名（オプション）</label>
                      <input 
                        v-model="link.icon"
                        type="text"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="例: custom-icon"
                      />
                      <p class="text-xs text-gray-500 mt-1">空白の場合は汎用アイコンが使用されます</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>            <!-- デザイン設定 -->
            <div class="bg-white border border-gray-200 rounded-lg p-6">
              <div class="mb-6">
                <h3 class="text-lg font-bold text-gray-800">デザイン設定</h3>
                <p class="text-sm text-gray-600 mt-1">名刺のテーマや色合いをカスタマイズできます</p>
              </div>

              <!-- テーマ選択 -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-3">テーマ</label>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div 
                    v-for="theme in themeOptions" 
                    :key="theme.value"
                    @click="config.design.theme = theme.value"
                    :class="[
                      'border-2 rounded-lg p-4 cursor-pointer transition duration-200',
                      config.design.theme === theme.value 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    ]"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="font-semibold text-gray-800">{{ theme.name }}</h4>
                      <div v-if="config.design.theme === theme.value" class="text-blue-500">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                      </div>
                    </div>
                    <p class="text-xs text-gray-600">{{ theme.description }}</p>
                  </div>
                </div>
              </div>

              <!-- カラーパレット選択 -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-3">カラーパレット</label>
                <div class="grid grid-cols-4 md:grid-cols-8 gap-3 mb-4">
                  <div 
                    v-for="(palette, key) in colorPalettes" 
                    :key="key"
                    @click="applyColorPalette(key)"
                    :class="[
                      'group relative aspect-square rounded-lg cursor-pointer border-2 transition duration-200',
                      config.design.primaryColor === palette.primary 
                        ? 'border-gray-800 scale-110' 
                        : 'border-gray-200 hover:border-gray-400 hover:scale-105'
                    ]"
                    :style="{ backgroundColor: palette.primary }"
                    :title="palette.name"
                  >
                    <div v-if="config.design.primaryColor === palette.primary" class="absolute inset-0 flex items-center justify-center">
                      <svg class="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">カスタムプライマリカラー</label>
                    <div class="flex items-center space-x-3">
                      <input 
                        v-model="config.design.primaryColor"
                        type="color"
                        class="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                      />
                      <input 
                        v-model="config.design.primaryColor"
                        type="text"
                        class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="#3B82F6"
                      />
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">背景色</label>
                    <div class="flex items-center space-x-3">
                      <input 
                        v-model="config.design.backgroundColor"
                        type="color"
                        class="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                      />
                      <input 
                        v-model="config.design.backgroundColor"
                        type="text"
                        class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="#FFFFFF"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- テキストカラー -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">テキストカラー</label>
                <div class="flex items-center space-x-3">
                  <input 
                    v-model="config.design.textColor"
                    type="color"
                    class="w-12 h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                  <input 
                    v-model="config.design.textColor"
                    type="text"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#1F2937"
                  />
                </div>
              </div>

              <!-- プレビュー -->
              <div class="bg-gray-50 rounded-lg p-4">
                <h4 class="text-sm font-medium text-gray-700 mb-3">プレビュー</h4>
                <div 
                  class="w-full max-w-xs mx-auto rounded-lg p-4 text-center"
                  :style="{
                    backgroundColor: config.design.backgroundColor,
                    color: config.design.textColor,
                    border: `2px solid ${config.design.primaryColor}20`
                  }"
                >
                  <div 
                    class="text-white text-lg font-bold py-2 px-4 rounded mb-3"
                    :style="{ backgroundColor: config.design.primaryColor }"
                    :class="{
                      'font-light': config.design.theme === 'minimal',
                      'font-serif': config.design.theme === 'classic',
                      'tracking-wide': config.design.theme === 'creative'
                    }"
                  >
                    {{ config.personalInfo.name || '山田 太郎' }}
                  </div>
                  <div class="text-sm opacity-75">
                    {{ config.personalInfo.title || 'ソフトウェアエンジニア' }}
                  </div>
                  <div class="text-xs opacity-60 mt-2">
                    {{ config.personalInfo.company || '株式会社サンプル' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 画像設定 -->
            <div class="space-y-4 mb-6">
              <h4 class="text-md font-medium text-gray-700">画像設定</h4>
              
              <!-- プロフィール画像 -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">プロフィール画像URL</label>
                <input 
                  v-model="config.design.profileImage" 
                  type="url" 
                  class="w-full p-2 border rounded" 
                  placeholder="https://example.com/profile.jpg"
                >
                <p class="text-xs text-gray-500 mt-1">名刺に表示されるプロフィール画像のURL</p>
              </div>
              
              <!-- 背景画像 -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">背景画像URL</label>
                <input 
                  v-model="config.design.backgroundImage" 
                  type="url" 
                  class="w-full p-2 border rounded" 
                  placeholder="https://example.com/background.jpg"
                >
                <p class="text-xs text-gray-500 mt-1">名刺の背景画像のURL</p>
              </div>
              
              <!-- ロゴ画像 -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">ロゴ画像URL</label>
                <input 
                  v-model="config.design.logoImage" 
                  type="url" 
                  class="w-full p-2 border rounded" 
                  placeholder="https://example.com/logo.png"
                >
                <p class="text-xs text-gray-500 mt-1">会社・組織のロゴ画像のURL</p>
              </div>
            </div>

            <!-- 保存ボタン -->
            <div class="flex justify-end">
              <button 
                @click="saveConfig"
                :disabled="configLoading"
                class="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2 px-6 rounded-lg transition duration-200"
              >
                {{ configLoading ? '保存中...' : '設定を保存' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 位置記録タブ -->
        <div v-else-if="activeTab === 'locations'" class="space-y-6">
          <div>
            <h3 class="text-lg font-bold text-gray-800 mb-4">記録された位置 ({{ locations.length }}件)</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      記録日時
                    </th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      緯度
                    </th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      経度
                    </th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Google Maps
                    </th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="location in locations" :key="location.timestamp">
                  <td class="px-4 py-2 text-sm text-gray-900">
                    {{ formatDateTime(location.timestamp) }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-900">
                    {{ location.latitude.toFixed(6) }}
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-900">
                    {{ location.longitude.toFixed(6) }}
                  </td>
                  <td class="px-4 py-2 text-sm">
                    <a 
                      :href="`https://www.google.com/maps?q=${location.latitude},${location.longitude}`"
                      target="_blank"
                      class="text-blue-600 hover:text-blue-800 underline"
                    >
                      地図で見る
                    </a>
                  </td>
                  <td class="px-4 py-2 text-sm">
                    <button 
                      @click="deleteLocation(location.id)"
                      class="text-red-600 hover:text-red-800"
                    >
                      削除
                    </button>
                  </td>
                </tr>
                <tr v-if="locations.length === 0">
                  <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                    まだ位置情報が記録されていません
                  </td>
                </tr>
              </tbody>            </table>
          </div>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>
