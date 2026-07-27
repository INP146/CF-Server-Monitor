import { createApp } from 'vue'

import App from './App.vue'
import './styles.css'
import { initConfig } from './utils/config'

initConfig()
createApp(App).mount('#app')
