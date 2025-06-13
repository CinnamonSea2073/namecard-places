<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const emit = defineEmits(['back-to-card'])

const adminPassword = ref('')
const isLoggedIn = ref(false)
const loginError = ref('')
const sessionStatus = ref({ enabled: false, expires_at: null, description: null })
const newSession = ref({ enabled: false, expires_at: '', description: '' })
const locations = ref([])
const loading = ref(false)

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
    loadLocations()
  ])
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
      </div>

      <!-- 管理画面 -->
      <div v-else class="p-6">
        <!-- ログアウトボタン -->
        <div class="flex justify-end mb-6">
          <button 
            @click="logout"
            class="text-sm text-gray-600 hover:text-gray-800 transition duration-200"
          >
            ログアウト
          </button>
        </div>

        <!-- 現在のセッション状態 -->
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
            </button>
          </div>
        </div>

        <!-- 記録された位置一覧 -->
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
                </tr>
                <tr v-if="locations.length === 0">
                  <td colspan="4" class="px-4 py-8 text-center text-gray-500">
                    まだ位置情報が記録されていません
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
