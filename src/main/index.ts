import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDatabase, getDatabase } from './db/database'
import { registerIpcHandlers } from './ipc/handlers'
import { startScheduler } from './services/scheduler'

// app.isPackaged kullanmak yerine process.env ile dev tespiti
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'win32'
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#1B3A6B',
            symbolColor: '#ffffff',
            height: 36
          }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.lirik.sanatevi')
  }

  // Veritabanını başlat
  try {
    initDatabase()
  } catch (err) {
    console.error('[DB] Başlatma hatası:', err)
    // Hata olsa bile pencereyi aç, kullanıcıya hata göster
  }

  // IPC handler'larını kaydet
  registerIpcHandlers()

  // Günlük otomatik SMS zamanlamasını başlat
  try {
    startScheduler(getDatabase())
  } catch (err) {
    console.error('[Scheduler] Başlatma hatası:', err)
  }

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
