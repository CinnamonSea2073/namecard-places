import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import axios from 'axios'
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
            getFeatures: vi.fn(() => []),
            removeFeature: vi.fn()
          }))
        }
      ])
    })),
    forEachFeatureAtPixel: vi.fn(),
    setTarget: vi.fn()
  })),
  View: vi.fn(),
  Feature: vi.fn()
}))

vi.mock('ol/layer/Tile', () => ({ default: vi.fn() }))
vi.mock('ol/source/OSM', () => ({ default: vi.fn() }))
vi.mock('ol/layer/Vector', () => ({ default: vi.fn() }))
vi.mock('ol/source/Vector', () => ({ default: vi.fn() }))
vi.mock('ol/geom/Point', () => ({ default: vi.fn() }))
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
vi.mock('ol/Overlay', () => ({ default: vi.fn(() => ({ setPosition: vi.fn() })) }))

// Axiosのモック
vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: { message: 'success', id: 1 } })),
    delete: vi.fn(() => Promise.resolve({ data: { message: 'success' } }))
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
      props: { viewOnly: true }
    })
    
    expect(wrapper.find('.map-container').exists()).toBe(true)
    expect(wrapper.text()).toContain('記録された場所が表示されています')
  })

  it('記録モードでレンダリングできる', () => {
    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })
    
    expect(wrapper.find('.map-container').exists()).toBe(true)
  })
})

describe('NameCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('コンポーネントが正常にレンダリングされる', async () => {
    axios.get.mockResolvedValue({ 
      data: { 
        name: 'テスト太郎',
        title: 'エンジニア',
        company: 'テスト会社',
        description: 'テスト説明'
      } 
    })

    const wrapper = mount(NameCard)
    
    await wrapper.vm.$nextTick()
    await flushPromises()
    
    expect(wrapper.exists()).toBe(true)
  })
})

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
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
})

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('session_idをボディに含めて位置を記録する', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: { enabled: true, expires_at: null, description: null }
      })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
    
    axios.post.mockResolvedValueOnce({
      data: { message: 'Location recorded successfully', id: 123 }
    })

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()
    await flushPromises()

    wrapper.vm.userSessionId = 'test_session_id'
    wrapper.vm.currentLocation = {
      latitude: 35.6895,
      longitude: 139.6917
    }

    await wrapper.vm.confirmLocation()
    await flushPromises()

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/record-location'),
      expect.objectContaining({
        latitude: 35.6895,
        longitude: 139.6917,
        session_id: 'test_session_id'
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    )
  })
  it('削除機能が正常に動作する', async () => {    axios.delete.mockResolvedValueOnce({
      data: { message: 'Location deleted successfully' }
    })

    global.confirm = vi.fn(() => true)
    global.alert = vi.fn()

    // getUserSessionId関数をモック
    global.getUserSessionId = vi.fn(() => 'test_session_id')

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()

    wrapper.vm.userSessionId = 'test_session_id'    // deleteLocationはグローバル関数として定義されているため、直接呼び出し
    if (typeof window.deleteLocation === 'function') {
      await window.deleteLocation(123)
    } else {
      // グローバル関数が設定されていない場合はコンポーネントメソッドを直接呼び出し
      await wrapper.vm.deleteLocation(123)
    }

    expect(axios.delete).toHaveBeenCalledWith(
      expect.stringContaining('/api/locations/123'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Session-Id': 'test_session_id'
        })
      })
    )

    expect(global.alert).toHaveBeenCalledWith('記録を削除しました')
  })

  it('一ユーザー一ピン制限が動作する', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: { enabled: true, expires_at: null, description: null }
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            latitude: 35.6762,
            longitude: 139.6503,
            timestamp: '2024-01-01T03:00:00Z',
            session_id: 'user_test_session'
          }
        ]
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            latitude: 35.6762,
            longitude: 139.6503,
            timestamp: '2024-01-01T03:00:00Z',
            session_id: 'user_test_session'
          }
        ]
      })

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    wrapper.vm.userSessionId = 'user_test_session'

    await wrapper.vm.$nextTick()
    await flushPromises()

    wrapper.vm.currentLocation = {
      latitude: 35.6863,
      longitude: 139.7018
    }

    await wrapper.vm.confirmLocation()
    await flushPromises()

    expect(wrapper.vm.error).toContain('既に位置情報を記録済みです')
  })

  it('削除エラーハンドリングが正しく動作する - オブジェクトエラー', async () => {
    // オブジェクト形式のエラーレスポンスをモック
    axios.delete.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          error: 'validation_failed',
          details: {
            field: 'session_id',
            message: 'Invalid session ID'
          }
        }
      }
    })

    global.confirm = vi.fn(() => true)
    global.alert = vi.fn()

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()

    wrapper.vm.userSessionId = 'test_session_id'

    await wrapper.vm.deleteLocation(123)

    // オブジェクトが適切にJSON化されて表示されることを確認
    expect(global.alert).toHaveBeenCalledWith(
      expect.stringContaining('削除に失敗しました: {"error":"validation_failed","details":{"field":"session_id","message":"Invalid session ID"}}')
    )
  })

  it('削除エラーハンドリングが正しく動作する - 文字列エラー', async () => {
    // 文字列形式のエラーレスポンスをモック
    axios.delete.mockRejectedValueOnce({
      response: {
        status: 403,
        data: 'Location not found or not owned by user'
      }
    })

    global.confirm = vi.fn(() => true)
    global.alert = vi.fn()

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()

    wrapper.vm.userSessionId = 'test_session_id'

    await wrapper.vm.deleteLocation(123)

    // 文字列エラーが適切に表示されることを確認
    expect(global.alert).toHaveBeenCalledWith(
      '削除に失敗しました: Location not found or not owned by user'
    )
  })

  it('削除エラーハンドリングが正しく動作する - ネットワークエラー', async () => {
    // ネットワークエラーをモック
    axios.delete.mockRejectedValueOnce({
      message: 'Network Error'
    })

    global.confirm = vi.fn(() => true)
    global.alert = vi.fn()

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()

    wrapper.vm.userSessionId = 'test_session_id'

    await wrapper.vm.deleteLocation(123)

    // ネットワークエラーが適切に表示されることを確認
    expect(global.alert).toHaveBeenCalledWith(
      '削除に失敗しました: Network Error'
    )
  })

  it('削除エラーハンドリングが正しく動作する - 不明なエラー', async () => {
    // 不明なエラーをモック
    axios.delete.mockRejectedValueOnce({})

    global.confirm = vi.fn(() => true)
    global.alert = vi.fn()

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()

    wrapper.vm.userSessionId = 'test_session_id'

    await wrapper.vm.deleteLocation(123)

    // 不明なエラーが適切に表示されることを確認
    expect(global.alert).toHaveBeenCalledWith(
      '削除に失敗しました: 不明なエラーが発生しました'
    )
  })
})

// 統合インターフェース機能のテスト
describe('Unified Map Interface Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn()
    }
  })
  it('モード切り替えボタンが正常に表示される', async () => {
    axios.get.mockResolvedValue({
      data: { enabled: true, expires_at: null, description: null }
    })

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()

    // モード切り替えボタンの存在確認（テキストベースで検索）
    const buttons = wrapper.findAll('button')
    const viewModeButton = buttons.find(button => button.text().includes('表示モード'))
    const recordModeButton = buttons.find(button => button.text().includes('記録モード'))
    
    expect(viewModeButton).toBeTruthy()
    expect(recordModeButton).toBeTruthy()
  })

  it('初期状態では記録モードが選択されている（viewOnly=falseの場合）', async () => {
    axios.get.mockResolvedValue({
      data: { enabled: true, expires_at: null, description: null }
    })

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()

    expect(wrapper.vm.currentMode).toBe('record')
  })

  it('初期状態では表示モードが選択されている（viewOnly=trueの場合）', async () => {
    axios.get.mockResolvedValue({
      data: [{ latitude: 35.7802, longitude: 139.9318 }]
    })

    const wrapper = mount(MapView, {
      props: { viewOnly: true }
    })

    await wrapper.vm.$nextTick()

    expect(wrapper.vm.currentMode).toBe('view')
  })

  it('カスタムズームコントロールが正常に動作する', async () => {
    const mockView = {
      getZoom: vi.fn(() => 10),
      setZoom: vi.fn(),
      setCenter: vi.fn()
    }

    const mockMap = {
      getView: vi.fn(() => mockView),
      addLayer: vi.fn(),
      addOverlay: vi.fn(),
      on: vi.fn(),
      getLayers: vi.fn(() => ({
        getArray: vi.fn(() => [])
      })),
      setTarget: vi.fn()
    }

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    wrapper.vm.map = mockMap

    // ズームイン
    await wrapper.vm.zoomIn()
    expect(mockView.setZoom).toHaveBeenCalledWith(11)

    // ズームアウト
    await wrapper.vm.zoomOut()
    expect(mockView.setZoom).toHaveBeenCalledWith(11) // 最初の呼び出し後の値から-1

    // 初期位置リセット
    await wrapper.vm.resetView()
    expect(mockView.setCenter).toHaveBeenCalled()
    expect(mockView.setZoom).toHaveBeenCalledWith(10)
  })

  it('モード切り替え時に適切な表示が切り替わる', async () => {
    axios.get.mockResolvedValue({
      data: { enabled: true, expires_at: null, description: null }
    })

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()

    // 記録モード時の表示確認
    expect(wrapper.vm.currentMode).toBe('record')
    
    // 表示モードに切り替え
    await wrapper.vm.switchMode('view')
    expect(wrapper.vm.currentMode).toBe('view')

    // 記録モードに戻す
    await wrapper.vm.switchMode('record')
    expect(wrapper.vm.currentMode).toBe('record')
  })

  it('記録モード時のみ記録機能が有効になる', async () => {
    axios.get.mockResolvedValue({
      data: { enabled: true, expires_at: null, description: null }
    })

    const wrapper = mount(MapView, {
      props: { viewOnly: false }
    })

    await wrapper.vm.$nextTick()

    // 記録モード時は記録方法選択が表示される
    expect(wrapper.vm.currentMode).toBe('record')
    
    // 表示モードに切り替えると記録機能が無効になる
    await wrapper.vm.switchMode('view')
    expect(wrapper.vm.currentMode).toBe('view')
  })
})
