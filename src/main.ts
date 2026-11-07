import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { applyThemes } from './theme'

applyThemes()
createApp(App).mount('#app')
