import { createApp } from 'vue'
import App from './App.vue'
import { enableHaptics } from './haptics'
import './style.css'
import { applyThemes } from './theme'

applyThemes()
enableHaptics()
createApp(App).mount('#app')
