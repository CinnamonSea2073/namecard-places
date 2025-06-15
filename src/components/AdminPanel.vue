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
    textColor: '#1F2937'
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

// SNSタイプが変更されたときにアイコンとラベルを自動設定
const onSocialTypeChange = (link) => {
  const typeMap = {
    twitter: { icon: 'twitter', label: 'Twitter' },
    facebook: { icon: 'facebook', label: 'Facebook' },
    linkedin: { icon: 'linkedin', label: 'LinkedIn' },
    instagram: { icon: 'instagram', label: 'Instagram' },
    github: { icon: 'github', label: 'GitHub' },
    youtube: { icon: 'youtube', label: 'YouTube' },
    tiktok: { icon: 'tiktok', label: 'TikTok' }
  }
  
  if (typeMap[link.type]) {
    link.icon = typeMap[link.type].icon
    if (!link.label || Object.values(typeMap).some(t => t.label === link.label)) {
      link.label = typeMap[link.type].label
    }
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
            </div>

            <!-- SNSリンク設定 -->
            <div class="bg-white border border-gray-200 rounded-lg p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-gray-800">SNSリンク</h3>
                <button 
                  @click="addSocialLink"
                  class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-1 px-3 rounded transition duration-200"
                >
                  + 追加
                </button>
              </div>
              
              <div v-if="config.socialLinks.length === 0" class="text-gray-500 text-center py-4">
                SNSリンクが設定されていません
              </div>
              
              <div v-else class="space-y-4">
                <div 
                  v-for="(link, index) in config.socialLinks" 
                  :key="index"
                  class="border border-gray-200 rounded-lg p-4"
                >
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-2">
                      <input 
                        v-model="link.enabled"
                        type="checkbox"
                        class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span class="text-sm font-medium text-gray-700">有効</span>
                    </div>
                    <button 
                      @click="removeSocialLink(index)"
                      class="text-red-600 hover:text-red-800 text-sm"
                    >
                      削除
                    </button>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs text-gray-600 mb-1">種類</label>                      <select 
                        v-model="link.type"
                        @change="onSocialTypeChange(link)"
                        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">選択してください</option>
                        <option value="twitter">Twitter</option>
                        <option value="facebook">Facebook</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="instagram">Instagram</option>
                        <option value="github">GitHub</option>
                        <option value="youtube">YouTube</option>
                        <option value="tiktok">TikTok</option>
                        <option value="other">その他</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-600 mb-1">表示名</label>
                      <input 
                        v-model="link.label"
                        type="text"
                        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Twitter"
                      />
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-xs text-gray-600 mb-1">URL</label>
                      <input 
                        v-model="link.url"
                        type="url"
                        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="https://twitter.com/username"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-gray-600 mb-1">アイコン名</label>
                      <input 
                        v-model="link.icon"
                        type="text"
                        class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="twitter（自動設定されます）"
                        :readonly="link.type !== 'other'"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- デザイン設定 -->
            <div class="bg-white border border-gray-200 rounded-lg p-6">
              <h3 class="text-lg font-bold text-gray-800 mb-4">デザイン設定</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">テーマ</label>
                  <select 
                    v-model="config.design.theme"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="modern">モダン</option>
                    <option value="classic">クラシック</option>
                    <option value="minimal">ミニマル</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">プライマリカラー</label>
                  <input 
                    v-model="config.design.primaryColor"
                    type="color"
                    class="w-full h-10 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">背景色</label>
                  <input 
                    v-model="config.design.backgroundColor"
                    type="color"
                    class="w-full h-10 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">テキストカラー</label>
                  <input 
                    v-model="config.design.textColor"
                    type="color"
                    class="w-full h-10 border border-gray-300 rounded-lg"
                  />
                </div>              </div>
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
