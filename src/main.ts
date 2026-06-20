import '@/assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useAuthStore } from '@/stores/useAuthStore'
import { useThemeStore } from '@/stores/useThemeStore'

const app = createApp(App)

app.use(createPinia())

// Tema durumunu (index.html'de zaten uygulanan sınıfla) senkronla.
useThemeStore().init()

// Yönlendirme guard'ı oturumu okuyabilsin diye router'dan önce auth'u başlat.
const auth = useAuthStore()
auth.init().finally(() => {
  app.use(router)
  app.mount('#app')
})
