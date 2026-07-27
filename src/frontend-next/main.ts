import { createApp } from 'vue'

import App from './App.vue'
import 'ant-design-vue/dist/reset.css'
import './styles.css'
import { initConfig } from './utils/config'

initConfig()
createApp(App).mount('#app')
