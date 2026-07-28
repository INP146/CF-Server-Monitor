import { createApp } from 'vue'

import App from './App.vue'
import 'ant-design-vue/dist/reset.css'
import './styles.css'
import router from './router'
import { initConfig } from './utils/config'

if (window.location.hash.startsWith('#admin')) {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/${window.location.hash.slice(1)}`)
}

initConfig()
createApp(App).use(router).mount('#app')
