<script setup>
import { ref, onMounted } from 'vue'
import NameCard from './components/NameCard.vue'
import MapView from './components/MapView.vue'
import AdminPanel from './components/AdminPanel.vue'

const currentView = ref('card')
const urlParams = new URLSearchParams(window.location.search)

const showCard = () => {
  currentView.value = 'card'
}

const showMap = () => {
  currentView.value = 'map'
}

const showAdmin = () => {
  currentView.value = 'admin'
}

const showMapView = () => {
  currentView.value = 'mapview'
}

onMounted(() => {
  // URLパラメータに基づいて初期表示を決定
  const view = urlParams.get('view')
  if (view === 'map') {
    currentView.value = 'map'
  } else if (view === 'admin') {
    currentView.value = 'admin'
  } else if (view === 'mapview') {
    currentView.value = 'mapview'
  } else {
    currentView.value = 'card'
  }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
    <div class="container mx-auto px-4 py-8">
      <!-- 管理者パネルリンク -->
      <div class="fixed top-4 right-4 z-50">
        <button 
          v-if="currentView !== 'admin'"
          @click="showAdmin"
          class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Admin
        </button>
      </div>

      <NameCard 
        v-if="currentView === 'card'" 
        @show-map="showMap"
        @show-map-view="showMapView"
      />
      <MapView 
        v-if="currentView === 'map'" 
        @back-to-card="showCard"
      />
      <MapView 
        v-if="currentView === 'mapview'" 
        :viewOnly="true"
        @back-to-card="showCard"
      />
      <AdminPanel
        v-if="currentView === 'admin'"
        @back-to-card="showCard"
      />
    </div>
  </div>
</template>
