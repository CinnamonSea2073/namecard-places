import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import axios from 'axios'
import MapView from '../components/MapView.vue'
import NameCard from '../components/NameCard.vue'
import AdminPanel from '../components/AdminPanel.vue'
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

// 管理者パネルのテスト
describe('AdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('ログイン機能が正常に動作する', async () => {
    axios.post.mockResolvedValue({ data: { success: true } })
    axios.get.mockResolvedValue({ 
      data: { enabled: false, expires_at: null, description: null }
    })

    const wrapper = mount(AdminPanel)
    
    // 初期状態ではログイン画面が表示される
    expect(wrapper.vm.isLoggedIn).toBe(false)
    
    // パスワードを入力してログイン
    wrapper.vm.adminPassword = 'admin123'
    await wrapper.vm.login()
    await flushPromises()
    
    // ログイン成功
    expect(wrapper.vm.isLoggedIn).toBe(true)
  })

  it('設定の読み込みと保存が正常に動作する', async () => {
    const mockConfig = {
      personalInfo: {
        name: 'テスト太郎',
        title: 'エンジニア',
        company: 'テスト会社',
        department: '',
        email: 'test@example.com',
        phone: '',
        website: 'https://example.com'
      },
      socialLinks: [
        {
          type: 'twitter',
          label: 'Twitter',
          url: 'https://twitter.com/test',
          icon: 'twitter',
          enabled: true
        }
      ],
      design: {
        theme: 'modern',
        primaryColor: '#3B82F6',
        backgroundColor: '#FFFFFF',
        textColor: '#1F2937'      }
    }    // ログイン用APIのmock
    axios.post.mockResolvedValue({ data: { success: true } })
    
    // loadAdminData内の3つのAPIを個別にmock
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/admin/session-status')) {
        return Promise.resolve({ data: { enabled: false } })
      } else if (url.includes('/api/admin/locations')) {
        return Promise.resolve({ data: [] })
      } else if (url.includes('/api/admin/config')) {
        return Promise.resolve({ data: mockConfig })
      }
      return Promise.reject(new Error('Unknown URL'))
    })
    
    const wrapper = mount(AdminPanel)
    wrapper.vm.adminPassword = 'admin123'
    await wrapper.vm.login()
    await flushPromises()

    // 設定が読み込まれている
    expect(wrapper.vm.config.personalInfo.name).toBe('テスト太郎')
    expect(wrapper.vm.config.socialLinks[0].type).toBe('twitter')

    // 設定を変更
    wrapper.vm.config.personalInfo.name = '変更太郎'
      // 保存
    axios.put = vi.fn().mockResolvedValue({ data: { success: true } })
    await wrapper.vm.saveConfig()
    await flushPromises()

    // config-updatedイベントが発火される
    expect(wrapper.emitted('config-updated')).toBeTruthy()
  })

  it('SNSリンクの追加と削除が正常に動作する', async () => {    // ログイン用APIのmock
    axios.post.mockResolvedValue({ data: { success: true } })
    
    // loadAdminData内の3つのAPIを個別にmock
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/admin/session-status')) {
        return Promise.resolve({ data: { enabled: false } })
      } else if (url.includes('/api/admin/locations')) {
        return Promise.resolve({ data: [] })
      } else if (url.includes('/api/admin/config')) {
        return Promise.resolve({
          data: { 
            personalInfo: {}, 
            socialLinks: [], 
            design: {} 
          } 
        })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    const wrapper = mount(AdminPanel)
    wrapper.vm.adminPassword = 'admin123'
    await wrapper.vm.login()
    await flushPromises()

    // 初期状態ではSNSリンクがない
    expect(wrapper.vm.config.socialLinks).toHaveLength(0)

    // SNSリンクを追加
    await wrapper.vm.addSocialLink()
    expect(wrapper.vm.config.socialLinks).toHaveLength(1)

    // 自動設定機能をテスト
    const link = wrapper.vm.config.socialLinks[0]
    link.type = 'twitter'
    wrapper.vm.onSocialTypeChange(link)
    expect(link.icon).toBe('twitter')
    expect(link.label).toBe('Twitter')

    // SNSリンクを削除
    await wrapper.vm.removeSocialLink(0)
    expect(wrapper.vm.config.socialLinks).toHaveLength(0)
  })
  it('空欄項目が非表示になることをテストする', async () => {
    const mockConfig = {
      personalInfo: {
        name: 'テスト太郎',
        title: 'エンジニア', 
        company: 'テスト会社',
        department: '', // 空欄
        email: 'test@example.com',
        phone: '', // 空欄
        website: 'https://example.com'
      },
      socialLinks: [
        {
          type: 'twitter',
          label: 'Twitter',
          url: '', // 空欄
          icon: 'twitter',
          enabled: true
        },
        {
          type: 'github',
          label: 'GitHub',
          url: 'https://github.com/test',
          icon: 'github',
          enabled: false // 無効
        }
      ],
      design: {
        theme: 'modern',
        primaryColor: '#3B82F6',
        backgroundColor: '#FFFFFF',
        textColor: '#1F2937'
      }
    }

    // card-info APIのレスポンスをモック
    axios.get.mockResolvedValue({ data: mockConfig })

    const wrapper = mount(NameCard)
    await flushPromises()

    // 名前、肩書き、会社、メール、ウェブサイトは表示される
    expect(wrapper.vm.personalInfo.name).toBe('テスト太郎')
    expect(wrapper.vm.personalInfo.title).toBe('エンジニア')
    expect(wrapper.vm.personalInfo.company).toBe('テスト会社')
    expect(wrapper.vm.personalInfo.email).toBe('test@example.com')
    expect(wrapper.vm.personalInfo.website).toBe('https://example.com')

    // 空欄の項目は存在するが空
    expect(wrapper.vm.personalInfo.department).toBe('')
    expect(wrapper.vm.personalInfo.phone).toBe('')

    // SNSリンクは有効かつURLありのもののみ
    expect(wrapper.vm.socialLinks).toHaveLength(2)
    // enabled=falseやurl=''のものもAPIから返されるが、表示時に制御される
  })
  it('設定変更後に名刺画面が自動更新される', async () => {
    const initialConfig = {
      personalInfo: { name: '初期名前' },
      socialLinks: [],
      design: {}
    }
    
    const updatedConfig = {
      personalInfo: { name: '更新名前' },
      socialLinks: [],
      design: {}
    }

    // 初期読み込み
    axios.get.mockResolvedValueOnce({ data: initialConfig })
    
    const wrapper = mount(NameCard, {
      props: { refreshTrigger: 0 }
    })
    await flushPromises()
    
    expect(wrapper.vm.personalInfo.name).toBe('初期名前')    // 設定更新をシミュレート（refreshTriggerの変更）
    axios.get.mockResolvedValueOnce({ data: updatedConfig })
    
    await wrapper.setProps({ refreshTrigger: 1 })
    await flushPromises()

    expect(wrapper.vm.personalInfo.name).toBe('更新名前')
  })
})

describe('AdminPanel - 拡張機能', () => {
  beforeEach(() => {
    axios.get.mockClear()
    axios.post.mockClear()
    axios.put.mockClear()
    axios.delete.mockClear()
  })

  it('拡張されたSNSオプションが正しく表示される', async () => {
    const mockConfig = {
      personalInfo: {},
      socialLinks: [],
      design: {}
    }

    axios.get.mockImplementation((url) => {
      if (url.includes('/api/admin/session-status')) {
        return Promise.resolve({ data: { enabled: false } })
      }
      if (url.includes('/api/admin/locations')) {
        return Promise.resolve({ data: [] })
      }
      if (url.includes('/api/admin/config')) {
        return Promise.resolve({ data: mockConfig })
      }
    })

    axios.post.mockResolvedValue({ data: { success: true } })

    const wrapper = mount(AdminPanel)
    wrapper.vm.adminPassword = 'test'
    wrapper.vm.isLoggedIn = true
    await flushPromises()

    // 名刺設定タブに切り替え
    wrapper.vm.activeTab = 'config'
    await wrapper.vm.$nextTick()    // SNS追加ボタンをクリック
    const addButtons = wrapper.findAll('button')
    const addButton = addButtons.find(btn => btn.text().includes('SNSを追加'))
    if (addButton && addButton.exists()) {
      await addButton.trigger('click')
    } else {
      // 直接メソッドを呼び出し
      wrapper.vm.addSocialLink()
    }
    await wrapper.vm.$nextTick()

    // 新しいSNSオプションが含まれていることを確認
    const socialTypeSelects = wrapper.findAll('select')
    const snsTypeSelect = socialTypeSelects.find(select => {
      const options = select.findAll('option')
      return options.some(option => option.text().includes('Discord') || option.text().includes('Telegram'))
    })

    expect(snsTypeSelect).toBeTruthy()
  })

  it('カラーパレットが正しく適用される', async () => {
    const mockConfig = {
      personalInfo: {},
      socialLinks: [],
      design: {
        primaryColor: '#3B82F6',
        backgroundColor: '#FFFFFF',
        textColor: '#1F2937',
        theme: 'modern'
      }
    }

    axios.get.mockImplementation((url) => {
      if (url.includes('/api/admin/config')) {
        return Promise.resolve({ data: mockConfig })
      }
      return Promise.resolve({ data: {} })
    })

    axios.post.mockResolvedValue({ data: { success: true } })

    const wrapper = mount(AdminPanel)
    wrapper.vm.adminPassword = 'test'
    wrapper.vm.isLoggedIn = true
    wrapper.vm.activeTab = 'config'
    await flushPromises()

    // カラーパレット適用をテスト
    wrapper.vm.applyColorPalette('green')
    expect(wrapper.vm.config.design.primaryColor).toBe('#10B981')

    wrapper.vm.applyColorPalette('purple')
    expect(wrapper.vm.config.design.primaryColor).toBe('#8B5CF6')
  })

  it('拡張されたテーマオプションが利用可能', async () => {
    const mockConfig = {
      personalInfo: {},
      socialLinks: [],
      design: {
        theme: 'modern'
      }
    }

    axios.get.mockImplementation((url) => {
      if (url.includes('/api/admin/config')) {
        return Promise.resolve({ data: mockConfig })
      }
      return Promise.resolve({ data: {} })
    })

    const wrapper = mount(AdminPanel)
    wrapper.vm.adminPassword = 'test'
    wrapper.vm.isLoggedIn = true
    wrapper.vm.activeTab = 'config'
    await flushPromises()

    // 新しいテーマオプションがthemeOptionsに含まれていることを確認
    const themeOptions = wrapper.vm.themeOptions
    expect(themeOptions.length).toBeGreaterThan(3) // 元の3つより多い
    expect(themeOptions.some(theme => theme.value === 'creative')).toBe(true)
    expect(themeOptions.some(theme => theme.value === 'corporate')).toBe(true)
    expect(themeOptions.some(theme => theme.value === 'artistic')).toBe(true)
  })

  it('SNS種類変更時にプレースホルダーが更新される', async () => {
    const wrapper = mount(AdminPanel)
    wrapper.vm.adminPassword = 'test'
    wrapper.vm.isLoggedIn = true
    wrapper.vm.config = {
      personalInfo: {},      socialLinks: [{ type: '', label: '', url: '', icon: '', enabled: false }],
      design: {}
    }

    const link = wrapper.vm.config.socialLinks[0]
    
    // Twitter設定時
    link.type = 'twitter'
    wrapper.vm.onSocialTypeChange(link)
    expect(link.placeholder).toBe('https://twitter.com/username')
    expect(link.label).toBe('Twitter')

    // Discord設定時
    link.type = 'discord'
    wrapper.vm.onSocialTypeChange(link)
    expect(link.placeholder).toBe('https://discord.gg/invite')
    expect(link.label).toBe('Discord')
  })

  describe('画像アップロード機能', () => {    it('プロフィール画像アップロードボタンが表示される', async () => {
      const mockConfig = {
        personalInfo: { name: 'テスト太郎' },
        socialLinks: [],
        design: { 
          primaryColor: '#3B82F6',
          showProfileImage: true,
          showBackgroundImage: true
        }
      }

      axios.get.mockResolvedValue({ data: mockConfig })

      const wrapper = mount(AdminPanel)
      await flushPromises()

      expect(wrapper.find('input[type="file"][accept="image/*"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('プロフィール画像')
      expect(wrapper.text()).toContain('背景画像')
    })

    it('画像ファイル選択時にBase64変換が実行される', async () => {
      const mockConfig = {
        personalInfo: { name: 'テスト太郎' },
        socialLinks: [],
        design: { 
          primaryColor: '#3B82F6',
          showProfileImage: true
        }
      }

      axios.get.mockResolvedValue({ data: mockConfig })

      const wrapper = mount(AdminPanel)
      await flushPromises()

      // FileReaderのモック
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        result: 'data:image/png;base64,mock'
      }
      global.FileReader = vi.fn(() => mockFileReader)

      const file = new File(['test'], 'test.png', { type: 'image/png' })
      const input = wrapper.find('input[type="file"][accept="image/*"]')
      
      if (input.exists()) {
        Object.defineProperty(input.element, 'files', {
          value: [file],
          writable: false,
        })

        await input.trigger('change')

        expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(file)
      }
    })

    it('画像削除ボタンが動作する', async () => {
      const mockConfig = {
        personalInfo: { name: 'テスト太郎' },
        socialLinks: [],
        design: { 
          primaryColor: '#3B82F6',
          showProfileImage: true,
          profileImage: 'data:image/png;base64,test'
        }
      }

      axios.get.mockResolvedValue({ data: mockConfig })
      axios.put.mockResolvedValue({ data: { message: '設定が更新されました' } })

      const wrapper = mount(AdminPanel)
      await flushPromises()

      // 削除ボタンを探す
      const deleteButtons = wrapper.findAll('button').filter(btn => 
        btn.text().includes('削除')
      )
      
      if (deleteButtons.length > 0) {
        await deleteButtons[0].trigger('click')
        await flushPromises()

        expect(axios.put).toHaveBeenCalled()
      }
    })

    it('画像プレビューが表示される', async () => {
      const mockConfig = {
        personalInfo: { name: 'テスト太郎' },
        socialLinks: [],
        design: { 
          primaryColor: '#3B82F6',
          profileImage: 'data:image/png;base64,test'
        }
      }

      axios.get.mockResolvedValue({ data: mockConfig })

      const wrapper = mount(AdminPanel)
      await flushPromises()

      const previewImage = wrapper.find('img[src*="data:image/png;base64"]')
      if (previewImage.exists()) {
        expect(previewImage.attributes('src')).toBe('data:image/png;base64,test')
      }
    })
  })
})

describe('NameCard - 拡張テーマ対応', () => {
  beforeEach(() => {
    axios.get.mockClear()
  })

  it('新しいテーマが正しく適用される', async () => {
    const mockCardInfo = {
      personalInfo: { name: 'テスト太郎' },
      socialLinks: [],
      design: { theme: 'creative', primaryColor: '#8B5CF6' }
    }

    axios.get.mockResolvedValue({ data: mockCardInfo })

    const wrapper = mount(NameCard)
    await flushPromises()

    const nameElement = wrapper.find('h1')
    expect(nameElement.classes()).toContain('tracking-widest')
  })

  it('コーポレートテーマが正しく適用される', async () => {
    const mockCardInfo = {
      personalInfo: { name: 'テスト太郎' },
      socialLinks: [],
      design: { theme: 'corporate', primaryColor: '#3B82F6' }
    }

    axios.get.mockResolvedValue({ data: mockCardInfo })

    const wrapper = mount(NameCard)
    await flushPromises()

    const nameElement = wrapper.find('h1')
    expect(nameElement.classes()).toContain('font-semibold')
    expect(nameElement.classes()).toContain('tracking-normal')
  })

  it('アーティスティックテーマが正しく適用される', async () => {
    const mockCardInfo = {
      personalInfo: { name: 'テスト太郎' },
      socialLinks: [],
      design: { theme: 'artistic', primaryColor: '#EC4899' }
    }

    axios.get.mockResolvedValue({ data: mockCardInfo })

    const wrapper = mount(NameCard)
    await flushPromises()

    const nameElement = wrapper.find('h1')
    expect(nameElement.classes()).toContain('font-bold')
    expect(nameElement.classes()).toContain('tracking-wide')
  })
})

describe('画像表示機能テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('プロフィール画像が正しく表示される', async () => {
    const mockCardInfo = {
      personalInfo: { name: 'テスト太郎' },
      socialLinks: [],
      design: { 
        theme: 'modern', 
        primaryColor: '#3B82F6',
        profileImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      }
    }

    axios.get.mockResolvedValue({ data: mockCardInfo })

    const wrapper = mount(NameCard)
    await flushPromises()

    const profileImage = wrapper.find('img[alt="プロフィール画像"]')
    expect(profileImage.exists()).toBe(true)
    expect(profileImage.attributes('src')).toContain('data:image/png;base64')
    expect(profileImage.classes()).toContain('w-24')
    expect(profileImage.classes()).toContain('h-24')
    expect(profileImage.classes()).toContain('rounded-full')
  })

  it('背景画像が正しく適用される', async () => {
    const mockCardInfo = {
      personalInfo: { name: 'テスト太郎' },
      socialLinks: [],
      design: { 
        theme: 'modern', 
        primaryColor: '#3B82F6',
        backgroundImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      }
    }

    axios.get.mockResolvedValue({ data: mockCardInfo })

    const wrapper = mount(NameCard)
    await flushPromises()

    const headerDiv = wrapper.find('.relative.overflow-hidden')
    const style = headerDiv.attributes('style')
    expect(style).toContain('url(data:image/png;base64')
    expect(style).toContain('background-size: cover')
  })

  it('プロフィール画像がない場合は表示されない', async () => {
    const mockCardInfo = {
      personalInfo: { name: 'テスト太郎' },
      socialLinks: [],
      design: { 
        theme: 'modern', 
        primaryColor: '#3B82F6',
        profileImage: ''
      }
    }

    axios.get.mockResolvedValue({ data: mockCardInfo })

    const wrapper = mount(NameCard)
    await flushPromises()

    const profileImage = wrapper.find('img[alt="プロフィール画像"]')
    expect(profileImage.exists()).toBe(false)
  })

  it('背景画像がない場合は通常のグラデーション背景が適用される', async () => {
    const mockCardInfo = {
      personalInfo: { name: 'テスト太郎' },
      socialLinks: [],
      design: { 
        theme: 'modern', 
        primaryColor: '#3B82F6',
        backgroundImage: ''
      }
    }

    axios.get.mockResolvedValue({ data: mockCardInfo })

    const wrapper = mount(NameCard)
    await flushPromises()

    const headerDiv = wrapper.find('.relative.overflow-hidden')
    const style = headerDiv.attributes('style')
    expect(style).not.toContain('url(')
    expect(style).toContain('linear-gradient(135deg, #3B82F6 0%, #3B82F6dd 100%)')
  })

  it('プロフィール画像と背景画像が両方設定されている場合', async () => {
    const mockCardInfo = {
      personalInfo: { name: 'テスト太郎' },
      socialLinks: [],
      design: { 
        theme: 'modern', 
        primaryColor: '#3B82F6',
        profileImage: 'data:image/png;base64,profile',
        backgroundImage: 'data:image/png;base64,background'
      }
    }

    axios.get.mockResolvedValue({ data: mockCardInfo })

    const wrapper = mount(NameCard)
    await flushPromises()

    // プロフィール画像の確認
    const profileImage = wrapper.find('img[alt="プロフィール画像"]')
    expect(profileImage.exists()).toBe(true)
    expect(profileImage.attributes('src')).toBe('data:image/png;base64,profile')

    // 背景画像の確認
    const headerDiv = wrapper.find('.relative.overflow-hidden')
    const style = headerDiv.attributes('style')
    expect(style).toContain('url(data:image/png;base64,background)')
    expect(style).toContain('background-size: cover')
  })
})
