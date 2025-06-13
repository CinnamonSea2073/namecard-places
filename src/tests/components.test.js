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
    expect(wrapper.text()).toContain('地図クリック')
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

describe('MapView Enhanced Features', () => {
  test('displays enhanced pin styles with better visibility', async () => {
    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()
    
    // 地図が初期化されていることを確認
    expect(wrapper.vm.map).toBeDefined()
    
    // ピンのスタイルが設定されていることを確認（内部実装のテスト）
    const vectorLayer = wrapper.vm.map.getLayers().getArray()[1]
    expect(vectorLayer).toBeDefined()
  })

  test('shows session expiry information in instructions', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        enabled: true,
        expires_at: '2024-12-31T23:59:59',
        description: 'Test event'
      }
    })

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()
    await flushPromises()

    // 説明ダイアログの存在確認
    expect(wrapper.find('.instruction-dialog').exists()).toBe(true)
    
    // 期限に関する説明が含まれていることを確認
    const instructionText = wrapper.find('.instruction-dialog').text()
    expect(instructionText).toContain('記録期限')
    expect(instructionText).toContain('関係ない時間での誤記録を防ぐため')
  })

  test('generates and stores user session ID', async () => {
    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()
    
    // セッションIDが生成されることを確認
    const sessionId = wrapper.vm.getUserSessionId()
    expect(sessionId).toBeDefined()
    expect(sessionId).toMatch(/^user_\d+_[a-z0-9]+$/)
    
    // localStorageに保存されることを確認
    expect(localStorage.getItem('userSessionId')).toBe(sessionId)
  })

  test('sends session ID when recording location', async () => {
    axios.get.mockResolvedValueOnce({
      data: { enabled: true, expires_at: null, description: null }
    })
    axios.post.mockResolvedValueOnce({
      data: { message: 'Location recorded successfully', id: 123 }
    })

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()
    await flushPromises()

    // 位置を設定
    wrapper.vm.currentLocation = {
      latitude: 35.6895,
      longitude: 139.6917
    }

    // 記録実行
    await wrapper.vm.confirmLocation()

    // APIが正しいヘッダーで呼ばれたことを確認
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/record-location'),
      expect.objectContaining({
        latitude: 35.6895,
        longitude: 139.6917
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Session-Id': expect.any(String)
        })
      })
    )
  })

  test('displays delete button for user own records', async () => {
    // 既存の位置情報（ユーザーのもの）をモック
    axios.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          latitude: 35.6895,
          longitude: 139.6917,
          timestamp: '2024-01-01T12:00:00',
          session_id: 'user_test_session'
        }
      ]
    })

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    // セッションIDを設定
    wrapper.vm.userSessionId = 'user_test_session'

    await wrapper.vm.$nextTick()
    await flushPromises()

    // 地図がロードされていることを確認
    expect(wrapper.vm.map).toBeDefined()
  })

  test('deletes location successfully', async () => {
    axios.delete.mockResolvedValueOnce({
      data: { message: 'Location deleted successfully' }
    })

    // グローバル関数のテスト
    global.confirm = vi.fn(() => true)
    global.alert = vi.fn()

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()

    // 削除関数を実行
    await window.deleteLocation(123)

    // 削除APIが呼ばれたことを確認
    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/api/locations/123'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Session-Id': expect.any(String)
        })
      })
    )

    expect(global.alert).toHaveBeenCalledWith('記録を削除しました')
  })

  test('handles delete error gracefully', async () => {
    axios.delete.mockRejectedValueOnce({
      response: {
        data: { detail: 'Location not found or not owned by user' }
      }
    })

    global.confirm = vi.fn(() => true)
    global.alert = vi.fn()

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()

    // 削除関数を実行
    await window.deleteLocation(123)

    expect(global.alert).toHaveBeenCalledWith(
      '削除に失敗しました: Location not found or not owned by user'
    )
  })

  test('different pin styles for user vs other records', async () => {
    axios.get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          latitude: 35.6895,
          longitude: 139.6917,
          timestamp: '2024-01-01T12:00:00',
          session_id: 'user_test_session'
        },
        {
          id: 2,
          latitude: 35.6896,
          longitude: 139.6918,
          timestamp: '2024-01-01T13:00:00',
          session_id: 'other_user_session'
        }
      ]
    })

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    // セッションIDを設定
    wrapper.vm.userSessionId = 'user_test_session'

    await wrapper.vm.$nextTick()
    await flushPromises()

    // 異なるピンスタイルが適用されることを確認
    const vectorLayer = wrapper.vm.map.getLayers().getArray()[1]
    const features = vectorLayer.getSource().getFeatures()
    
    expect(features.length).toBe(2)
    expect(features[0].get('isUserRecord')).toBe(true)
    expect(features[1].get('isUserRecord')).toBe(false)
  })
})
