import { createApp } from 'vue'
import App from './App.vue'
import { enableHaptics } from './haptics'
import { registerOffline } from './pwa'
import './style.css'
import { applyThemes } from './theme'

applyThemes()
enableHaptics()
registerOffline()
createApp(App).mount('#app')
