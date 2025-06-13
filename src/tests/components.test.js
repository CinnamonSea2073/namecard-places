import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MapView from '../components/MapView.vue'
import NameCard from '../components/NameCard.vue'
import App from '../App.vue'

// OpenLayersのモック
vi.mock('ol', () => ({
  Map: vi.fn(() => ({
    addLayer: vi.fn(),
    addOverlay: vi.fn(),
    on: vi.fn(),
    getView: vi.fn(() => ({
      setCenter: vi.fn(),
      setZoom: vi.fn()
    })),
    getLayers: vi.fn(() => ({
      getArray: vi.fn(() => [
        {},
        {
          getSource: vi.fn(() => ({
            addFeature: vi.fn(),
            getFeatures: vi.fn(() => [])
          }))
        }
      ])
    })),
    forEachFeatureAtPixel: vi.fn()
  })),
  View: vi.fn(),
  Feature: vi.fn(() => ({
    getGeometry: vi.fn(() => ({
      getCoordinates: vi.fn(() => [0, 0])
    })),
    get: vi.fn(),
    set: vi.fn()
  }))
}))

vi.mock('ol/layer/Tile', () => ({
  default: vi.fn()
}))

vi.mock('ol/source/OSM', () => ({
  default: vi.fn()
}))

vi.mock('ol/layer/Vector', () => ({
  default: vi.fn()
}))

vi.mock('ol/source/Vector', () => ({
  default: vi.fn()
}))

vi.mock('ol/geom/Point', () => ({
  default: vi.fn()
}))

vi.mock('ol/proj', () => ({
  fromLonLat: vi.fn((coords) => coords),
  toLonLat: vi.fn((coords) => coords)
}))

vi.mock('ol/style', () => ({
  Style: vi.fn(),
  Icon: vi.fn(),
  Circle: vi.fn(),
  Fill: vi.fn(),
  Stroke: vi.fn(),
  Text: vi.fn()
}))

vi.mock('ol/Overlay', () => ({
  default: vi.fn(() => ({
    setPosition: vi.fn()
  }))
}))

// Axiosのモック
vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ 
      data: { 
        enabled: false, 
        description: null,
        expires_at: null 
      } 
    })),
    post: vi.fn(() => Promise.resolve({ data: { message: 'success' } }))
  }
}))

// QRCodeのモック
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mock'))
  }
}))

describe('MapView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('地図閲覧専用モードでレンダリングできる', () => {
    const wrapper = mount(MapView, {
      props: {
        viewOnly: true
      }
    })
    
    expect(wrapper.find('.map-container').exists()).toBe(true)
    expect(wrapper.text()).toContain('記録された場所が表示されています')
  })

  it('記録モードでレンダリングできる', () => {
    const wrapper = mount(MapView, {
      props: {
        viewOnly: false
      }
    })
    
    expect(wrapper.find('.map-container').exists()).toBe(true)
  })
  it('説明ダイアログが表示される', async () => {
    const wrapper = mount(MapView, {
      props: {
        viewOnly: false
      }
    })
    
    // 初期状態で説明ダイアログが表示されていることを確認
    expect(wrapper.find('.instruction-dialog').exists()).toBe(true)
    expect(wrapper.text()).toContain('位置記録について')
  })
  it('記録方法選択UIが表示される', async () => {
    // 記録が有効になるようにaxiosモックを設定
    const axios = await import('axios')
    axios.default.get.mockResolvedValue({ 
      data: { 
        enabled: true, 
        description: 'Test session',
        expires_at: null 
      } 
    })

    const wrapper = mount(MapView, {
      props: {
        viewOnly: false
      }
    })
    
    // コンポーネントがマウントされるまで待機
    await wrapper.vm.$nextTick()
    
    // 説明ダイアログを閉じる
    await wrapper.find('[data-testid="close-instruction"]').trigger('click')
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('.recording-methods').exists()).toBe(true)
    expect(wrapper.text()).toContain('地図をクリック')
    expect(wrapper.text()).toContain('GPS利用')
  })
  it('GPS記録ボタンをクリックできる', async () => {
    // 記録が有効になるようにaxiosモックを設定
    const axios = await import('axios')
    axios.default.get.mockResolvedValue({ 
      data: { 
        enabled: true, 
        description: 'Test session',
        expires_at: null 
      } 
    })

    // Geolocationのモック
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) => {
          success({
            coords: {
              latitude: 35.6895,
              longitude: 139.6917
            }
          })
        })
      }
    })

    const wrapper = mount(MapView, {
      props: {
        viewOnly: false
      }
    })
    
    // コンポーネントがマウントされるまで待機
    await wrapper.vm.$nextTick()
    
    // 説明ダイアログを閉じる
    await wrapper.find('[data-testid="close-instruction"]').trigger('click')
    await wrapper.vm.$nextTick()
    
    const gpsButton = wrapper.find('[data-testid="gps-record"]')
    expect(gpsButton.exists()).toBe(true)
    
    await gpsButton.trigger('click')
    
    // GPS記録の処理が実行されることを確認
    expect(global.navigator.geolocation.getCurrentPosition).toHaveBeenCalled()
  })

  it('戻るボタンが機能する', async () => {
    const wrapper = mount(MapView, {
      props: {
        viewOnly: true
      }
    })
    
    const backButton = wrapper.find('[data-testid="back-button"]')
    expect(backButton.exists()).toBe(true)
    
    await backButton.trigger('click')
    
    expect(wrapper.emitted('back-to-card')).toBeTruthy()
  })

  it('タイムスタンプ付きピンの表示ができる', async () => {
    const mockLocations = [
      {
        latitude: 35.6895,
        longitude: 139.6917,
        timestamp: '2024-01-01T12:00:00Z'
      }
    ]

    // axiosのモックを更新
    const axios = await import('axios')
    axios.default.get.mockResolvedValue({ data: mockLocations })

    const wrapper = mount(MapView, {
      props: {
        viewOnly: true
      }
    })

    // コンポーネントがマウントされて位置情報が読み込まれることを確認
    await wrapper.vm.$nextTick()
    
    expect(axios.default.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/locations')
    )
  })
})

describe('NameCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('地図閲覧ボタンが表示される', async () => {
    // axiosモックでカード情報を設定
    const axios = await import('axios')
    axios.default.get.mockResolvedValue({ 
      data: { 
        name: 'テスト太郎',
        title: 'エンジニア',
        company: 'テスト会社',
        description: 'テスト説明'
      } 
    })

    const wrapper = mount(NameCard)
    
    // コンポーネントがマウントされるまで待機
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('[data-testid="map-view-button"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('記録された場所を見る')
  })
  it('地図記録ボタンが表示される', async () => {
    // axiosモックでカード情報を設定
    const axios = await import('axios')
    axios.default.get.mockResolvedValue({ 
      data: { 
        name: 'テスト太郎',
        title: 'エンジニア',
        company: 'テスト会社',
        description: 'テスト説明'
      } 
    })

    const wrapper = mount(NameCard)
    
    // コンポーネントがマウントされるまで待機
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('[data-testid="map-record-button"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('出会った場所を記録する')
  })
  it('地図閲覧ボタンクリックでイベントが発火される', async () => {
    // axiosモックでカード情報を設定
    const axios = await import('axios')
    axios.default.get.mockResolvedValue({ 
      data: { 
        name: 'テスト太郎',
        title: 'エンジニア',
        company: 'テスト会社',
        description: 'テスト説明'
      } 
    })

    const wrapper = mount(NameCard)
    
    // コンポーネントがマウントされるまで待機
    await wrapper.vm.$nextTick()
    
    await wrapper.find('[data-testid="map-view-button"]').trigger('click')
    
    expect(wrapper.emitted('show-map-view')).toBeTruthy()
  })
  it('地図記録ボタンクリックでイベントが発火される', async () => {
    // axiosモックでカード情報を設定
    const axios = await import('axios')
    axios.default.get.mockResolvedValue({ 
      data: { 
        name: 'テスト太郎',
        title: 'エンジニア',
        company: 'テスト会社',
        description: 'テスト説明'
      } 
    })

    const wrapper = mount(NameCard)
    
    // コンポーネントがマウントされるまで待機
    await wrapper.vm.$nextTick()
    
    await wrapper.find('[data-testid="map-record-button"]').trigger('click')
    
    expect(wrapper.emitted('show-map')).toBeTruthy()
  })
})

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // window.location.searchをモック
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
        origin: 'http://localhost:3000',
        pathname: '/'
      }
    })
  })

  it('初期状態でNameCardが表示される', () => {
    const wrapper = mount(App)
    
    expect(wrapper.findComponent(NameCard).exists()).toBe(true)
  })

  it('地図閲覧モードに切り替えできる', async () => {
    const wrapper = mount(App)
    
    // NameCardコンポーネントから地図閲覧イベントを発火
    await wrapper.findComponent(NameCard).vm.$emit('show-map-view')
    
    expect(wrapper.findComponent(MapView).exists()).toBe(true)
    expect(wrapper.findComponent(MapView).props('viewOnly')).toBe(true)
  })

  it('地図記録モードに切り替えできる', async () => {
    const wrapper = mount(App)
    
    // NameCardコンポーネントから地図記録イベントを発火
    await wrapper.findComponent(NameCard).vm.$emit('show-map')
    
    expect(wrapper.findComponent(MapView).exists()).toBe(true)
    expect(wrapper.findComponent(MapView).props('viewOnly')).toBe(false)
  })
  it('URLパラメータでmapviewモードを開始できる', () => {
    // URLSearchParamsをモック
    global.URLSearchParams = class {
      constructor(search) {
        this.params = new Map()
        if (search === '?view=mapview') {
          this.params.set('view', 'mapview')
        }
      }
      get(key) {
        return this.params.get(key)
      }
    }

    Object.defineProperty(window, 'location', {
      value: {
        search: '?view=mapview',
        origin: 'http://localhost:3000',
        pathname: '/'
      },
      writable: true
    })

    const wrapper = mount(App)
    
    expect(wrapper.findComponent(MapView).exists()).toBe(true)
    expect(wrapper.findComponent(MapView).props('viewOnly')).toBe(true)
  })
})

describe('新機能の統合テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('地図閲覧専用モードから記録モードに切り替えできない', () => {
    const wrapper = mount(MapView, {
      props: {
        viewOnly: true
      }
    })
    
    // 閲覧専用モードでは記録方法選択UIが表示されない
    expect(wrapper.find('.recording-methods').exists()).toBe(false)
    expect(wrapper.find('[data-testid="gps-record"]').exists()).toBe(false)
  })
  it('記録モードでGPSと地図クリック両方の選択肢がある', async () => {
    // 記録が有効になるようにaxiosモックを設定
    const axios = await import('axios')
    axios.default.get.mockResolvedValue({ 
      data: { 
        enabled: true, 
        description: 'Test session',
        expires_at: null 
      } 
    })

    const wrapper = mount(MapView, {
      props: {
        viewOnly: false
      }
    })
    
    // コンポーネントがマウントされるまで待機
    await wrapper.vm.$nextTick()
    
    // 説明ダイアログを閉じる
    await wrapper.find('[data-testid="close-instruction"]').trigger('click')
    await wrapper.vm.$nextTick()
    
    // 両方の記録方法のボタンが表示される
    expect(wrapper.find('[data-testid="gps-record"]').exists()).toBe(true)
    expect(wrapper.find('input[value="click"]').exists()).toBe(true)
    expect(wrapper.find('input[value="gps"]').exists()).toBe(true)
  })
  it('説明ダイアログに記録の趣旨と方法が表示される', () => {
    const wrapper = mount(MapView, {
      props: {
        viewOnly: false
      }
    })
    
    const instructionDialog = wrapper.find('.instruction-dialog')
    expect(instructionDialog.exists()).toBe(true)
    expect(instructionDialog.text()).toContain('名刺を交換した場所を地図上に記録')
    expect(instructionDialog.text()).toContain('地図クリック')
    expect(instructionDialog.text()).toContain('GPS利用')
  })
})
